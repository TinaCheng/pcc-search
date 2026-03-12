// API 入口
const SEARCH_API_URL = "https://pcc-live-proxy.tina58991314.workers.dev/search";
const TENDER_DETAIL_API_URL = "https://pcc-live-proxy.tina58991314.workers.dev/tender";

// 前端密碼
const SITE_PASSWORD = "Psd50968602";

// sessionStorage key
const AUTH_STORAGE_KEY = "pcc_tool_auth";

const AUTH_EXPIRE_HOURS = 7;

// tender detail 快取 key 前綴
const TENDER_CACHE_PREFIX = "tender_cache::";

// 快取有效時間（毫秒）
// 10 分鐘 = 10 * 60 * 1000
const TENDER_CACHE_TTL = 10 * 60 * 1000;

// 全域結果資料
let LAST_ROWS = [];

