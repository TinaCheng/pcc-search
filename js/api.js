// ===== 記憶體快取 =====
const tenderMemoryCache = new Map();

/*
  共用 API 呼叫
*/
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：${url}`);
  }
  return await res.json();
}

/*
  查 searchbytitle
*/
async function searchOne(query) {
  const url = `${SEARCH_API_URL}?query=${encodeURIComponent(query)}&page=1`;
  return await fetchJson(url);
}

/*
  建立 sessionStorage 的快取 key
*/
function buildTenderCacheKey(url) {
  return `${TENDER_CACHE_PREFIX}${url}`;
}

/*
  從 sessionStorage 取快取
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
    // storage 滿了或瀏覽器限制時，直接忽略
  }
}

/*
  清除全部 tender 快取
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
  查 tender_api_url
  先讀記憶體快取 -> 再讀 sessionStorage -> 最後才打 API
*/
async function fetchTenderDetail(url) {
  if (!isFilled(url)) return null;

  // 1. 記憶體快取
  if (tenderMemoryCache.has(url)) {
    return tenderMemoryCache.get(url);
  }

  // 2. sessionStorage 快取
  const sessionCached = getTenderFromSessionCache(url);
  if (sessionCached) {
    tenderMemoryCache.set(url, sessionCached);
    return sessionCached;
  }

  // 3. 真正打 API
  try {
    const data = await fetchJson(url);

    // 寫入雙層快取
    tenderMemoryCache.set(url, data);
    setTenderToSessionCache(url, data);

    return data;
  } catch (e) {
    return null;
  }
}
