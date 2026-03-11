/*
  建立單一查詢字串的結果列
  1. 先查 searchbytitle
  2. 依公告日期區間過濾
  3. 依同案分組
  4. 每組取最後一筆 record
  5. 再用 tender_api_url 補最後一筆 detail
*/
async function buildRowsForQuery(rawQuery, maxRows, dateRangeDays) {
  const searchData = await searchOne(rawQuery);
  const allRecords = Array.isArray(searchData.records) ? searchData.records : [];

  const filteredRecords = allRecords.filter(rec => {
    return isWithinLastNDays(rec.date, dateRangeDays);
  });

  const groupedMap = new Map();

  for (const rec of filteredRecords) {
    const brief = rec?.brief || {};
    const title = cleanText(brief?.title || "");

    const key = [
      cleanText(rawQuery),
      cleanText(rec?.unit_id || ""),
      cleanText(rec?.job_number || ""),
      normalizeTitle(title)
    ].join("||");

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key).push(rec);
  }

  const groupedEntries = Array.from(groupedMap.entries()).slice(0, maxRows);

  // 並行抓 tender_api_url，加快速度
  const tasks = groupedEntries.map(async ([, recs]) => {
    const lastSearchRecord = recs[recs.length - 1];
    const lastBrief = lastSearchRecord?.brief || {};

    const searchDetail = extractDetailObject({ records: recs });

    const tenderApiUrl = cleanText(lastSearchRecord?.tender_api_url || "");
    const tenderData = await fetchTenderDetail(tenderApiUrl);
    const tenderDetail = extractDetailObject(tenderData);

    const finalDetail = { ...searchDetail, ...tenderDetail };

    return {
      _selected: true,
      "原始輸入": cleanText(rawQuery),
      "公告日": cleanText(lastSearchRecord?.date || pickDetailValue(finalDetail, "公告日")),
      "原公告日": pickDetailValue(finalDetail, "原公告日"),
      "標案案號": pickDetailValue(finalDetail, "標案案號") || cleanText(lastSearchRecord?.job_number),
      "標案名稱": pickDetailValue(finalDetail, "標案名稱") || cleanText(lastBrief?.title),
      "類型": cleanText(lastBrief?.type || pickDetailValue(finalDetail, "type")),
      "分類": cleanText(lastBrief?.category || pickDetailValue(finalDetail, "標的分類")),
      "機關代碼": pickDetailValue(finalDetail, "機關代碼") || cleanText(lastSearchRecord?.unit_id),
      "機關名稱": pickDetailValue(finalDetail, "機關名稱") || cleanText(lastSearchRecord?.unit_name),
      "單位名稱": pickDetailValue(finalDetail, "單位名稱"),
      "機關地址": pickDetailValue(finalDetail, "機關地址"),
      "聯絡人": pickDetailValue(finalDetail, "聯絡人"),
      "聯絡電話": pickDetailValue(finalDetail, "聯絡電話"),
      "決標方式": pickDetailValue(finalDetail, "決標方式"),
      "截止投標": pickDetailValue(finalDetail, "截止投標"),
      "開標時間": pickDetailValue(finalDetail, "開標時間"),
      "是否異動招標文件": pickDetailValue(finalDetail, "是否異動招標文件"),
      "標案網址": buildOfficialUrl(lastSearchRecord, finalDetail),
      "標案API": tenderApiUrl
    };
  });

  return await Promise.all(tasks);
}

// 主查詢流程
async function searchTender() {
  const status = document.getElementById("status");
  const errorCard = document.getElementById("errorCard");
  const errorBox = document.getElementById("errorBox");
  const tableWrap = document.getElementById("tableWrap");
  const tableCard = document.getElementById("tableCard");

  errorBox.textContent = "";
  errorCard.style.display = "none";
  tableWrap.innerHTML = "";
  tableCard.style.display = "none";
  LAST_ROWS = [];

  const queries = document.getElementById("queries").value
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);

  if (!queries.length) {
    status.textContent = "請先輸入至少一筆關鍵字";
    return;
  }

  const maxRows = Math.max(
    1,
    Math.min(20, Number(document.getElementById("maxRows").value || 8))
  );

  const dateRangeDays = Number(document.getElementById("dateRange").value || 15);

  status.textContent = "查詢中，正在補抓詳細欄位...";
  const allRows = [];
  const errs = [];

  // 逐個 query 跑，但每個 query 內部已並行抓 detail
  for (const q of queries) {
    try {
      const rows = await buildRowsForQuery(q, maxRows, dateRangeDays);
      allRows.push(...rows);
    } catch (e) {
      errs.push(`${q}：${e.message || e}`);
    }
  }

  LAST_ROWS = allRows;
  renderTable(allRows);

  status.textContent =
    `查詢完成：公告日期區間為今天往前 ${dateRangeDays} 天；輸入 ${queries.length} 筆，結果 ${allRows.length} 筆`;

  if (errs.length) {
    errorBox.textContent = errs.join("\n");
    errorCard.style.display = "block";
  }
}

// 清空
function clearAll() {
  document.getElementById("queries").value = "";
  document.getElementById("status").textContent = "尚未查詢";
  document.getElementById("errorBox").textContent = "";
  document.getElementById("errorCard").style.display = "none";
  document.getElementById("tableWrap").innerHTML = "";
  document.getElementById("tableCard").style.display = "none";
  LAST_ROWS = [];

  // 順便清快取
  clearTenderCache();
}

function clearCacheOnly() {
  clearTenderCache();
  document.getElementById("status").textContent = "已清除快取";
}

// 初始化
initAuth();
