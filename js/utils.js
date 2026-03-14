function cleanText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function esc(v) {
  return cleanText(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isFilled(v) {
  return cleanText(v) !== "";
}

function normalizeKey(v) {
  return cleanText(v)
    .replaceAll("：", ":")
    .replace(/\s+/g, "")
    .toLowerCase();
}

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

function parseDateNumber(dateStr) {
  if (!dateStr) return 0;

  const raw = String(dateStr).trim();

  if (/^\d{8}$/.test(raw)) {
    return parseInt(raw, 10);
  }

  if (/^\d{8}\s+\d{1,2}:\d{1,2}/.test(raw)) {
    return parseInt(raw.slice(0, 8), 10);
  }

  const m = raw.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return 0;

  let year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  if (year < 1911) {
    year += 1911;
  }

  return year * 10000 + month * 100 + day;
}

function formatTenderDate(dateStr) {
  if (!dateStr) return "";

  const raw = String(dateStr).trim();

  if (/^\d{8}$/.test(raw)) {
    const year = parseInt(raw.slice(0, 4), 10);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const rocYear = year - 1911;
    return `${rocYear}/${month}/${day}`;
  }

  if (/^\d{8}\s+\d{1,2}:\d{1,2}/.test(raw)) {
    return formatTenderDate(raw.slice(0, 8));
  }

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
