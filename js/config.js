// API 入口
const SEARCH_API_URL = "https://pcc-api.openfun.app/api/searchbytitle";

// 前端密碼
const SITE_PASSWORD = "123456";

// sessionStorage key
const AUTH_STORAGE_KEY = "pcc_tool_auth";

// tender detail 快取 key 前綴
const TENDER_CACHE_PREFIX = "tender_cache::";

// 快取有效時間（毫秒）
// 10 分鐘 = 10 * 60 * 1000
const TENDER_CACHE_TTL = 10 * 60 * 1000;

// 全域結果資料
let LAST_ROWS = [];
