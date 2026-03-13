/*
  將天數轉成官網要的西元日期區間
  例如今天 2026/03/13，15 天 => 2026/02/27 ~ 2026/03/13
*/
function buildOfficialDateRange(days) {
  const { year, month, day } = getTaiwanTodayParts();

  const today = new Date(year, month - 1, day);
  const start = new Date(today);
  start.setDate(today.getDate() - (Number(days) - 1));

  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${dd}`;
  }

  return {
    startDate: fmt(start),
    endDate: fmt(today)
  };
}

/*
  跨關鍵字去重
*/
function dedupeRowsAcrossQueries(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      cleanText(row["機關名稱"]),
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
  將官網搜尋結果 + 官網 detail 合併成前端 row
*/
function buildRowFromOfficialRecord(rawQuery, record, detailData) {
  const detail = detailData?.detail || {};

  return {
    _selected: true,
    "項次": "",

    "原始輸入": cleanText(rawQuery),

    "公告日": formatTenderDate(detail["公告日"] || record.announce_date || ""),
    "原公告日": formatTenderDate(detail["原公告日"] || ""),

    "標案案號": cleanText(detail["標案案號"] || record.tender_no || ""),
    "標案名稱": cleanText(detail["標案名稱"] || record.tender_name || ""),

    "類型": cleanText(record.tender_way || ""),
    "分類": cleanText(record.proc_type || ""),

    "機關代碼": "",
    "機關名稱": cleanText(detail["機關名稱"] || record.unit_name || ""),
    "單位名稱": cleanText(detail["單位名稱"] || ""),
    "機關地址": cleanText(detail["機關地址"] || ""),
    "聯絡人": cleanText(detail["聯絡人"] || ""),
    "聯絡電話": cleanText(detail["聯絡電話"] || ""),

    "決標方式": cleanText(detail["決標方式"] || ""),
    "截止投標": cleanText(detail["截止投標"] || record.deadline || ""),
    "開標時間": cleanText(detail["開標時間"] || ""),
    "是否異動招標文件": cleanText(detail["是否異動招標文件"] || ""),

    "標案網址": cleanText(record.detail_url || ""),
    "標案API": cleanText(detailData?.finalUrl || "")
  };
}

/*
  單一關鍵字查詢
*/
async function buildRowsForQuery(rawQuery, maxRows, dateRangeDays) {
  const { startDate, endDate } = buildOfficialDateRange(dateRangeDays);

  const searchData = await searchOne(rawQuery, startDate, endDate);
  const records = Array.isArray(searchData.records) ? searchData.records : [];

  const limitedRecords = records.slice(0, maxRows);

  const tasks = limitedRecords.map(async (record) => {
    const detailData = await fetchTenderDetail(record.detail_url);
    return buildRowFromOfficialRecord(rawQuery, record, detailData);
  });

  const rows = await Promise.all(tasks);

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

  status.textContent = "查詢中，正在抓取官網即時資料...";
  const errs = [];

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
