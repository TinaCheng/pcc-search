const tenderMemoryCache = new Map();

/*
  共用 API 呼叫
*/
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：${url}`);
  }
  return await res.json();
}

/*
  查詢候選標案
  改走 Cloudflare Worker proxy
*/
async function searchOne(query) {
  const url = `${SEARCH_API_URL}?query=${encodeURIComponent(query)}&page=1`;
  return await fetchJson(url);
}

/*
  建立 tender detail 快取 key
*/
function buildTenderCacheKey(url) {
  return `${TENDER_CACHE_PREFIX}${url}`;
}

/*
  從 sessionStorage 讀快取
*/
function getTenderFromSessionCache(url) {
  try {
    const key = buildTenderCacheKey(url);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const now = Date.now();
    if (!parsed.savedAt || now - parsed.savedAt > TENDER_CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data || null;
  } catch (e) {
    return null;
  }
}

/*
  寫入 sessionStorage 快取
*/
function setTenderToSessionCache(url, data) {
  try {
    const key = buildTenderCacheKey(url);
    const payload = {
      savedAt: Date.now(),
      data
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    // 忽略 storage 例外
  }
}

/*
  清除所有 tender 快取
*/
function clearTenderCache() {
  tenderMemoryCache.clear();

  try {
    const keysToDelete = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(TENDER_CACHE_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    // 忽略
  }
}

/*
  目前不再主動抓 tender detail
  直接使用 /search 回來的 records.detail
*/
async function fetchTenderDetail(detailUrl) {
  return null;
}
