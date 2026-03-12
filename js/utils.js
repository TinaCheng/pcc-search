// 將值轉成乾淨字串
function cleanText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

// 避免 HTML 顯示亂掉
function esc(v) {
  return cleanText(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// 判斷是否有值
function isFilled(v) {
  return cleanText(v) !== "";
}

// 正規化 detail key
function normalizeKey(v) {
  return cleanText(v).replaceAll("：", ":").toLowerCase();
}

// 正規化標題，方便做同案識別
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
  將日期字串轉成可比較的 YYYYMMDD 數字
  支援：
  - 20260306
  - 115/03/06
  - 2026/03/06
*/
function parseDateNumber(dateStr) {
  if (!dateStr) return 0;

  const raw = String(dateStr).trim();

  // 純 8 碼西元格式
  if (/^\d{8}$/.test(raw)) {
    return parseInt(raw, 10);
  }

  // 斜線格式：115/03/06 或 2026/03/06
  const m = raw.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
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
  將日期格式統一顯示成 民國 YYYY/MM/DD
  例如：
  - 20260306 -> 115/03/06
  - 2026/03/06 -> 115/03/06
  - 115/03/06 -> 115/03/06
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

  // 2026/03/06 或 115/03/06
  const m = raw.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return raw;

  let year = parseInt(m[1], 10);
  const month = String(parseInt(m[2], 10)).padStart(2, "0");
  const day = String(parseInt(m[3], 10)).padStart(2, "0");

  if (year >= 1911) {
    year = year - 1911;
  }

  return `${year}/${month}/${day}`;
}

/*
  取得台灣今天日期（避免時區誤差）
*/
function getTaiwanTodayParts() {
  const now = new Date();

  const tw = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now); // 例如 2026-03-12

  const [year, month, day] = tw.split("-").map(Number);
  return { year, month, day };
}

/*
  判斷日期是否在「今天往前 N 天（包含今天）」區間內
  一律用台灣時區計算
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

// 將 YYYYMMDD 轉成 Date
function parseApiDate(v) {
  const s = String(v || "").replace(/\D/g, "");
  if (s.length !== 8) return null;

  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));

  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// 日期歸零
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 判斷是否在今天往前 N 天內
function isWithinLastNDays(dateValue, days) {
  const target = parseApiDate(dateValue);
  if (!target) return false;

  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - Number(days));

  const t = startOfDay(target);
  return t >= start && t <= today;
}

/*
  固定抓 records 最後一筆的 detail
*/
function extractDetailObject(obj) {
  if (!obj || typeof obj !== "object") return {};

  if (!Array.isArray(obj) && Object.keys(obj).some(k => k.includes(":"))) {
    return obj;
  }

  if (obj.detail && typeof obj.detail === "object" && !Array.isArray(obj.detail)) {
    return obj.detail;
  }

  if (Array.isArray(obj.records) && obj.records.length > 0) {
    const lastRecord = obj.records[obj.records.length - 1];
    if (lastRecord && typeof lastRecord === "object" && lastRecord.detail && typeof lastRecord.detail === "object") {
      return lastRecord.detail;
    }
  }

  return {};
}

/*
  從 detail 裡抓欄位
*/
function pickDetailValue(detail, targetName) {
  if (!detail || typeof detail !== "object") return "";

  const target = normalizeKey(targetName);
  const entries = Object.entries(detail);

  for (const [k, v] of entries) {
    if (normalizeKey(k) === target) return cleanText(v);
  }

  for (const [k, v] of entries) {
    const tail = normalizeKey(k).split(":").pop().trim();
    if (tail === target) return cleanText(v);
  }

  for (const [k, v] of entries) {
    const tail = normalizeKey(k).split(":").pop().trim();
    if (tail.includes(target) || target.includes(tail)) return cleanText(v);
  }

  for (const [k, v] of entries) {
    const nk = normalizeKey(k);
    if (nk.includes(target) || target.includes(nk)) return cleanText(v);
  }

  return "";
}

/*
  組裝標案網址
*/
function buildOfficialUrl(rec, detail) {
  const detailUrl = cleanText(pickDetailValue(detail, "url"));
  if (detailUrl.startsWith("http://") || detailUrl.startsWith("https://")) {
    return detailUrl;
  }

  const raw = cleanText(rec?.url || "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw) {
    if (raw.startsWith("/")) {
      if (raw.includes("searchTenderDetail") || raw.includes("searchtenderdetail")) {
        return `https://web.pcc.gov.tw${raw}`;
      }
      return `https://pcc-api.openfun.app${raw}`;
    }
    return raw;
  }

  return "";
}
