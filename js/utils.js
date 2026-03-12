/*
  將值轉成乾淨字串
*/
function cleanText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/*
  HTML escape，避免表格顯示異常
*/
function esc(v) {
  return cleanText(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/*
  判斷欄位是否有值
*/
function isFilled(v) {
  return cleanText(v) !== "";
}

/*
  正規化欄位 key
*/
function normalizeKey(v) {
  return cleanText(v)
    .replaceAll("：", ":")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/*
  正規化標案名稱
  用來做跨關鍵字去重
*/
function normalizeTitle(v) {
  return cleanText(v)
    .replaceAll("「", "")
    .replaceAll("」", "")
    .replaceAll("『", "")
    .replaceAll("』", "")
    .replaceAll("（", "(")
    .replaceAll("）", ")")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/*
  取得台灣今天日期（避免時區誤差）
*/
function getTaiwanTodayParts() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(now);
  const map = {};

  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

/*
  將日期字串轉成可比較的 YYYYMMDD 數字
  支援：
  1. 20260306
  2. 115/03/06
  3. 2026/03/06
  4. 115/03/06 09:30
  5. 2026/03/06 09:30
*/
function parseDateNumber(dateStr) {
  if (!dateStr) return 0;

  const raw = String(dateStr).trim();

  // 20260306
  if (/^\d{8}$/.test(raw)) {
    return parseInt(raw, 10);
  }

  // 20260306 09:30
  if (/^\d{8}\s+\d{1,2}:\d{1,2}/.test(raw)) {
    return parseInt(raw.slice(0, 8), 10);
  }

  // 115/03/06 或 2026/03/06，可帶時間
  const m = raw.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return 0;

  let year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  // 民國年轉西元
  if (year < 1911) {
    year += 1911;
  }

  return year * 10000 + month * 100 + day;
}

/*
  將日期統一顯示成民國格式：
  - 20260306 -> 115/03/06
  - 2026/03/06 -> 115/03/06
  - 115/03/06 -> 115/03/06
  - 115/03/06 09:30 -> 115/03/06
*/
function formatTenderDate(dateStr) {
  if (!dateStr) return "";

  const raw = String(dateStr).trim();

  // 20260306
  if (/^\d{8}$/.test(raw)) {
    const year = parseInt(raw.slice(0, 4), 10);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const rocYear = year - 1911;
    return `${rocYear}/${month}/${day}`;
  }

  // 20260306 09:30
  if (/^\d{8}\s+\d{1,2}:\d{1,2}/.test(raw)) {
    const ymd = raw.slice(0, 8);
    return formatTenderDate(ymd);
  }

  // 115/03/06 或 2026/03/06，可帶時間
  const m = raw.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return raw;

  let year = parseInt(m[1], 10);
  const month = String(parseInt(m[2], 10)).padStart(2, "0");
  const day = String(parseInt(m[3], 10)).padStart(2, "0");

  if (year >= 1911) {
    year -= 1911;
  }

  return `${year}/${month}/${day}`;
}

/*
  判斷日期是否在「今天往前 N 天（包含今天）」區間內
  例如：
  N=7
  若今天 3/12，則區間為 3/06 ~ 3/12
*/
function isDateWithinLastNDays(dateStr, days) {
  const dateNum = parseDateNumber(dateStr);
  if (!dateNum) return false;

  const { year, month, day } = getTaiwanTodayParts();

  const today = new Date(year, month - 1, day);
  const start = new Date(today);
  start.setDate(today.getDate() - (Number(days) - 1));

  const startNum =
    start.getFullYear() * 10000 +
    (start.getMonth() + 1) * 100 +
    start.getDate();

  const endNum =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();

  return dateNum >= startNum && dateNum <= endNum;
}

/*
  固定抓 detail 物件
  支援：
  1. obj.detail
  2. obj.records 最後一筆 detail
  3. 直接就是 detail object
*/
function extractDetailObject(obj) {
  if (!obj || typeof obj !== "object") return {};

  // 直接就是 detail 物件
  const keys = Object.keys(obj);
  if (
    keys.length > 0 &&
    keys.some(k => k.includes(":") || k === "url" || k === "type")
  ) {
    return obj;
  }

  // 單層 detail
  if (obj.detail && typeof obj.detail === "object" && !Array.isArray(obj.detail)) {
    return obj.detail;
  }

  // records 最後一筆 detail
  if (Array.isArray(obj.records) && obj.records.length > 0) {
    const lastRecord = obj.records[obj.records.length - 1];
    if (
      lastRecord &&
      typeof lastRecord === "object" &&
      lastRecord.detail &&
      typeof lastRecord.detail === "object"
    ) {
      return lastRecord.detail;
    }
  }

  return {};
}

/*
  從 detail 中抓欄位值
  比對順序：
  1. 完整 key 相等
  2. 尾段 key 相等
  3. 尾段包含
  4. 整體 key 包含
*/
function pickDetailValue(detail, targetName) {
  if (!detail || typeof detail !== "object") return "";

  const target = normalizeKey(targetName);
  const entries = Object.entries(detail);

  // 1. 完整 key 相等
  for (const [k, v] of entries) {
    if (normalizeKey(k) === target) {
      return cleanText(v);
    }
  }

  // 2. key 尾段相等
  for (const [k, v] of entries) {
    const tail = normalizeKey(k).split(":").pop().trim();
    if (tail === target) {
      return cleanText(v);
    }
  }

  // 3. key 尾段包含
  for (const [k, v] of entries) {
    const tail = normalizeKey(k).split(":").pop().trim();
    if (tail.includes(target) || target.includes(tail)) {
      return cleanText(v);
    }
  }

  // 4. 整體 key 包含
  for (const [k, v] of entries) {
    const nk = normalizeKey(k);
    if (nk.includes(target) || target.includes(nk)) {
      return cleanText(v);
    }
  }

  return "";
}

/*
  組裝官方標案網址
  優先順序：
  1. detail.url
  2. record.url
*/
function buildOfficialUrl(record, detail) {
  const detailUrl = cleanText(pickDetailValue(detail, "url"));
  if (detailUrl.startsWith("http://") || detailUrl.startsWith("https://")) {
    return detailUrl;
  }

  const raw = cleanText(record?.url || "");
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `https://pcc-api.openfun.app${raw}`;
  }

  return raw;
}
