/*
  跨關鍵字去重：
  同一個標案若被不同關鍵字都查到，只保留一筆。
  判斷依據：
  - 機關代碼
  - 標案案號
  - 正規化後的標案名稱
*/
function dedupeRowsAcrossQueries(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      cleanText(row["機關代碼"]),
      cleanText(row["標案案號"]),
      normalizeTitle(row["標案名稱"])
    ].join("||");

    if (!map.has(key)) {
      map.set(key, { ...row });
      continue;
    }

    const existed = map.get(key);

    // 合併原始輸入，讓你知道這筆是被哪些關鍵字查到
    const oldInput = cleanText(existed["原始輸入"]);
    const newInput = cleanText(row["原始輸入"]);

    const inputSet = new Set(
      [...oldInput.split("｜"), ...newInput.split("｜")]
        .map(v => cleanText(v))
        .filter(Boolean)
    );

    existed["原始輸入"] = Array.from(inputSet).join("｜");

    // 公告日較新的保留
    if (parseDateNumber(row["公告日"]) > parseDateNumber(existed["公告日"])) {
      existed["公告日"] = row["公告日"];
    }

    // 空欄補值
    for (const keyName of Object.keys(row)) {
      if (!isFilled(existed[keyName]) && isFilled(row[keyName])) {
        existed[keyName] = row[keyName];
      }
    }

    map.set(key, existed);
  }

  return Array.from(map.values());
}

/*
  建立單一查詢字串的結果列
  流程：
  1. 先查 searchbytitle
  2. 不先用 rec.date 篩選，避免和 detail 公告日不一致
  3. 依同案分組
  4. 每組取最後一筆 record
  5. 再用 tender_api_url 補最後一筆 detail
  6. 用最終 row 的「公告日」做日期區間過濾
*/
async function buildRowsForQuery(rawQuery, maxRows, dateRangeDays) {
  const searchData = await searchOne(rawQuery);
  const allRecords = Array.isArray(searchData.records) ? searchData.records : [];

  // 這裡先不做日期過濾，避免 rec.date 與 detail 公告日不一致
  const filteredRecords = allRecords;

  const groupedMap = new Map();

  for (const rec of filteredRecords) {
    const brief = rec?.brief || {};
    const title = cleanText(brief?.title || "");

    const key = [
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

    // searchbytitle 同案 records：固定抓最後一筆 detail
    const searchDetail = extractDetailObject({ records: recs });

    const tenderApiUrl = cleanText(lastSearchRecord?.tender_api_url || "");
    const tenderData = await fetchTenderDetail(tenderApiUrl);

    // tender_api_url：固定抓最後一筆 detail
    const tenderDetail = extractDetailObject(tenderData);

    // tenderDetail 優先，searchDetail 補空缺
    const finalDetail = { ...searchDetail, ...tenderDetail };

    return {
      _selected: true,
      "項次": "",

      "原始輸入": cleanText(rawQuery),

      // 公告日優先抓 detail 正式欄位；沒有再退回 rec.date
      "公告日": pickDetailValue(finalDetail, "公告日") || cleanText(lastSearchRecord?.date),
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

  const rows = await Promise.all(tasks);

  // 最終用「顯示給使用者看的公告日」做日期區間過濾
  const finalRows = rows.filter(row => {
    return isDateWithinLastNDays(row["公告日"], dateRangeDays);
  });

  return finalRows;
}

/*
  主查詢流程
*/
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

  // 逐個 query 跑；每個 query 內部已並行抓 detail
  for (const q of queries) {
    try {
      const rows = await buildRowsForQuery(q, maxRows, dateRangeDays);
      allRows.push(...rows);
    } catch (e) {
      errs.push(`${q}：${e.message || e}`);
    }
  }

  // 跨關鍵字去重
  const dedupedRows = dedupeRowsAcrossQueries(allRows);

  // 補項次
  const finalRows = dedupedRows.map((row, index) => ({
    ...row,
    "項次": index + 1
  }));

  LAST_ROWS = finalRows;
  renderTable(finalRows);

  status.textContent =
    `查詢完成：公告日期區間為今天往前 ${dateRangeDays} 天；輸入 ${queries.length} 筆，原始 ${allRows.length} 筆，去重後 ${finalRows.length} 筆`;

  if (errs.length) {
    errorBox.textContent = errs.join("\n");
    errorCard.style.display = "block";
  }
}

/*
  清空查詢條件與結果
*/
function clearAll() {
  document.getElementById("queries").value = "";
  document.getElementById("status").textContent = "尚未查詢";
  document.getElementById("errorBox").textContent = "";
  document.getElementById("errorCard").style.display = "none";
  document.getElementById("tableWrap").innerHTML = "";
  document.getElementById("tableCard").style.display = "none";
  LAST_ROWS = [];

  // 若你不想清空時順便清 cache，把下面這行刪掉
  clearTenderCache();
}

/*
  只清除 API 快取
*/
function clearCacheOnly() {
  clearTenderCache();
  document.getElementById("status").textContent = "已清除快取";
}

/*
  初始化
*/
initAuth();
