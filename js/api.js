const tenderMemoryCache = new Map();
const searchMemoryCache = new Map();

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
  search 快取 key
*/
function buildSearchCacheKey(query) {
  return `search_cache::${query}`;
}

/*
  tender detail 快取 key
*/
function buildTenderCacheKey(url) {
  return `${TENDER_CACHE_PREFIX}${url}`;
}

/*
  sessionStorage 讀取
*/
function getFromSessionCache(key, ttlMs) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const now = Date.now();
    if (!parsed.savedAt || now - parsed.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data || null;
  } catch (e) {
    return null;
  }
}

/*
  sessionStorage 寫入
*/
function setToSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      data
    }));
  } catch (e) {
    // ignore
  }
}

/*
  清除 tender 快取
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
    // ignore
  }
}

/*
  清除 search 快取
*/
function clearSearchCache() {
  searchMemoryCache.clear();

  try {
    const keysToDelete = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("search_cache::")) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    // ignore
  }
}

/*
  清掉全部 API 快取
*/
function clearAllApiCache() {
  clearTenderCache();
  clearSearchCache();
}

/*
  查詢候選標案
*/
async function searchOne(query) {
  const key = buildSearchCacheKey(query);

  if (searchMemoryCache.has(key)) {
    return searchMemoryCache.get(key);
  }

  const sessionCached = getFromSessionCache(key, TENDER_CACHE_TTL);
  if (sessionCached) {
    searchMemoryCache.set(key, sessionCached);
    return sessionCached;
  }

  const url = `${SEARCH_API_URL}?query=${encodeURIComponent(query)}&page=1`;
  const data = await fetchJson(url);

  searchMemoryCache.set(key, data);
  setToSessionCache(key, data);

  return data;
}

/*
  查詢單案 detail
*/
async function fetchTenderDetail(detailUrl) {
  if (!isFilled(detailUrl)) return null;

  if (tenderMemoryCache.has(detailUrl)) {
    return tenderMemoryCache.get(detailUrl);
  }

  const sessionCached = getFromSessionCache(buildTenderCacheKey(detailUrl), TENDER_CACHE_TTL);
  if (sessionCached) {
    tenderMemoryCache.set(detailUrl, sessionCached);
    return sessionCached;
  }

  try {
    const proxyUrl = `${TENDER_DETAIL_API_URL}?url=${encodeURIComponent(detailUrl)}`;
    const data = await fetchJson(proxyUrl);

    tenderMemoryCache.set(detailUrl, data);
    setToSessionCache(buildTenderCacheKey(detailUrl), data);

    return data;
  } catch (e) {
    return null;
  }
}
