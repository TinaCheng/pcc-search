/*
  跨關鍵字去重：
  同一個標案若被不同關鍵字都查到，只保留一筆
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

    const oldInput = cleanText(existed["原始輸入"]);
    const newInput = cleanText(row["原始輸入"]);

    const inputSet = new Set(
      [...oldInput.split("｜"), ...newInput.split("｜")]
        .map(v => cleanText(v))
        .filter(Boolean)
    );

    existed["原始輸入"] = Array.from(inputSet).join("｜");

    if (parseDateNumber(row["公告日"]) > parseDateNumber(existed["公告日"])) {
      existed["公告日"] = row["公告日"];
    }

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
  將 search record + tender detail 合併成 row
*/
function buildRowFromRecord(rawQuery, record, tenderData) {
  const brief = record?.brief || {};

  const searchDetail = extractDetailObject(record);
  const tenderDetail = extractDetailObject(tenderData);

  // tenderDetail 優先，searchDetail 補空值
  const finalDetail = { ...searchDetail, ...tenderDetail };

  return {
    _selected: true,
    "項次": "",

    "原始輸入": cleanText(rawQuery),

    "公告日": formatTenderDate(
      pickDetailValue(finalDetail, "公告日") || cleanText(record?.date)
    ),

    "原公告日": formatTenderDate(
      pickDetailValue(finalDetail, "原公告日")
    ),

    "標案案號":
      pickDetailValue(finalDetail, "標案案號") ||
      cleanText(record?.job_number),

    "標案名稱":
      pickDetailValue(finalDetail, "標案名稱") ||
      cleanText(brief?.title),

    "類型":
      cleanText(brief?.type || pickDetailValue(finalDetail, "type")),

    "分類":
      cleanText(brief?.category || pickDetailValue(finalDetail, "標的分類")),

    "機關代碼":
      pickDetailValue(finalDetail, "機關代碼") ||
      cleanText(record?.unit_id),

    "機關名稱":
      pickDetailValue(finalDetail, "機關名稱") ||
      cleanText(record?.unit_name),

    "單位名稱":
      pickDetailValue(finalDetail, "單位名稱"),

    "機關地址":
      pickDetailValue(finalDetail, "機關地址"),

    "聯絡人":
      pickDetailValue(finalDetail, "聯絡人"),

    "聯絡電話":
      pickDetailValue(finalDetail, "聯絡電話"),

    "決標方式":
      pickDetailValue(finalDetail, "決標方式"),

    "截止投標":
      pickDetailValue(finalDetail, "截止投標"),

    "開標時間":
      pickDetailValue(finalDetail, "開標時間"),

    "是否異動招標文件":
      pickDetailValue(finalDetail, "是否異動招標文件"),

    "標案網址":
      buildOfficialUrl(record, finalDetail),

    "標案API":
      cleanText(record?.tender_api_url || "")
  };
}

/*
  單一關鍵字查詢
*/
async function buildRowsForQuery(rawQuery, maxRows, dateRangeDays) {
  const searchData = await searchOne(rawQuery);
  const allRecords = Array.isArray(searchData.records) ? searchData.records : [];

  // 先依標題 / unit / job 分組去重
  const groupedMap = new Map();

  for (const rec of allRecords) {
    const title = cleanText(rec?.brief?.title || "");

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

  // 每組拿最後一筆
  const groupedRecords = Array.from(groupedMap.values())
    .map(group => group[group.length - 1])
    .slice(0, maxRows);

  // 並行抓 detail
  const tasks = groupedRecords.map(async (record) => {
    const tenderApiUrl = cleanText(record?.tender_api_url || "");
    const tenderData = await fetchTenderDetail(tenderApiUrl);
    return buildRowFromRecord(rawQuery, record, tenderData);
  });

  const rows = await Promise.all(tasks);

  // 最終公告日區間過濾（包含今天）
  return rows.filter(row => isDateWithinLastNDays(row["公告日"], dateRangeDays));
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
    Math.min(50, Number(document.getElementById("maxRows").value || 10))
  );

  const dateRangeDays = Number(document.getElementById("dateRange").value || 15);

  status.textContent = "查詢中，正在補抓詳細欄位...";
  const errs = [];

  // 關鍵字也並行跑
  const queryTasks = queries.map(async (q) => {
    try {
      return await buildRowsForQuery(q, maxRows, dateRangeDays);
    } catch (e) {
      errs.push(`${q}：${e.message || e}`);
      return [];
    }
  });

  const queryResults = await Promise.all(queryTasks);
  const allRows = queryResults.flat();

  const dedupedRows = dedupeRowsAcrossQueries(allRows);

  // 再保險過濾一次日期
  const filteredFinalRows = dedupedRows.filter(row => {
    return isDateWithinLastNDays(row["公告日"], dateRangeDays);
  });

  const finalRows = filteredFinalRows.map((row, index) => ({
    ...row,
    "項次": index + 1
  }));

  LAST_ROWS = finalRows;
  renderTable(finalRows);

  status.textContent =
    `查詢完成：公告日期區間為今天往前 ${dateRangeDays} 天（含今天）；輸入 ${queries.length} 筆，原始 ${allRows.length} 筆，去重後 ${finalRows.length} 筆`;

  if (errs.length) {
    errorBox.textContent = errs.join("\n");
    errorCard.style.display = "block";
  }
}

/*
  清空
*/
function clearAll() {
  document.getElementById("queries").value = "";
  document.getElementById("status").textContent = "尚未查詢";
  document.getElementById("errorBox").textContent = "";
  document.getElementById("errorCard").style.display = "none";
  document.getElementById("tableWrap").innerHTML = "";
  document.getElementById("tableCard").style.display = "none";
  LAST_ROWS = [];
}

/*
  清除快取
*/
function clearCacheOnly() {
  clearAllApiCache();
  document.getElementById("status").textContent = "已清除快取";
}

/*
  初始化
*/
initAuth();
startAuthWatcher();
