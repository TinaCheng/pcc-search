const tenderMemoryCache = new Map();
const searchMemoryCache = new Map();

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：${url}`);
  }
  return await res.json();
}

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

function buildSearchCacheKey(keyword, startDate, endDate) {
  return `search_cache::${keyword}::${startDate}::${endDate}`;
}

function buildTenderCacheKey(detailUrl) {
  return `${TENDER_CACHE_PREFIX}${detailUrl}`;
}

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

function clearAllApiCache() {
  clearSearchCache();
  clearTenderCache();
}

async function searchOne(keyword, startDate, endDate) {
  console.log("api.js newest loaded");
  
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

  const data = await fetchJson(url);

  searchMemoryCache.set(key, data);
  setToSessionCache(key, data);

  return data;
}

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
