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
  讀取 sessionStorage 快取
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
  寫入 sessionStorage 快取
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
  search 快取 key
*/
function buildSearchCacheKey(keyword, startDate, endDate) {
  return `search_cache::${keyword}::${startDate}::${endDate}`;
}

/*
  detail 快取 key
*/
function buildTenderCacheKey(detailUrl) {
  return `${TENDER_CACHE_PREFIX}${detailUrl}`;
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
  清除 detail 快取
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
  清除全部 API 快取
*/
function clearAllApiCache() {
  clearSearchCache();
  clearTenderCache();
}

/*
  官網搜尋
*/
async function searchOne(keyword, startDate, endDate) {
  const key = buildSearchCacheKey(keyword, startDate, endDate);

  if (searchMemoryCache.has(key)) {
    return searchMemoryCache.get(key);
  }

  const sessionCached = getFromSessionCache(key, TENDER_CACHE_TTL);
  if (sessionCached) {
    searchMemoryCache.set(key, sessionCached);
    return sessionCached;
  }

  const url =
    `${SEARCH_API_URL}?keyword=${encodeURIComponent(keyword)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  console.log("official search url =", url);

  const data = await fetchJson(url);

  searchMemoryCache.set(key, data);
  setToSessionCache(key, data);

  return data;
}

/*
  官網 detail
*/
async function fetchTenderDetail(detailUrl) {
  if (!isFilled(detailUrl)) return null;

  if (tenderMemoryCache.has(detailUrl)) {
    return tenderMemoryCache.get(detailUrl);
  }

  const cacheKey = buildTenderCacheKey(detailUrl);
  const sessionCached = getFromSessionCache(cacheKey, TENDER_CACHE_TTL);
  if (sessionCached) {
    tenderMemoryCache.set(detailUrl, sessionCached);
    return sessionCached;
  }

  const url = `${TENDER_DETAIL_API_URL}?detailUrl=${encodeURIComponent(detailUrl)}`;
  const data = await fetchJson(url);

  tenderMemoryCache.set(detailUrl, data);
  setToSessionCache(cacheKey, data);

  return data;
}
