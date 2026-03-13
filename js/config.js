const SEARCH_API_URL = "https://pcc-live-proxy.tina58991314.workers.dev/official-search-json";
const TENDER_DETAIL_API_URL = "https://pcc-live-proxy.tina58991314.workers.dev/official-detail";

const SITE_PASSWORD = "8888";
const AUTH_STORAGE_KEY = "pcc_tool_auth";
const AUTH_EXPIRE_HOURS = 7;

const TENDER_CACHE_PREFIX = "tender_cache::";
const TENDER_CACHE_TTL = 10 * 60 * 1000;

let LAST_ROWS = [];
