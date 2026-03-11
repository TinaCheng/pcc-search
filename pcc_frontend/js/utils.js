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

// 只保留數字方便比較日期大小
function parseDateNumber(v) {
  const s = String(v || "").replace(/\D/g, "");
  return s ? Number(s) : 0;
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
