/*
  取得登入到期毫秒數
  7 小時 = 7 * 60 * 60 * 1000
*/
function getAuthExpireMs() {
  return AUTH_EXPIRE_HOURS * 60 * 60 * 1000;
}

/*
  建立登入資料
  寫入 sessionStorage：
  - 狀態
  - 登入時間
*/
function setAuthSession() {
  const payload = {
    ok: true,
    loginAt: Date.now()
  };

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

/*
  讀取登入資料
*/
function getAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch (e) {
    return null;
  }
}

/*
  清除登入資料
*/
function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/*
  判斷目前登入是否已過期
*/
function isAuthExpired(authData) {
  if (!authData || !authData.ok || !authData.loginAt) return true;

  const now = Date.now();
  const diff = now - authData.loginAt;

  return diff > getAuthExpireMs();
}

/*
  顯示主頁
*/
function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "block";
}

/*
  顯示登入頁
*/
function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display = "none";
}

/*
  驗證密碼
*/
function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  const errorBox = document.getElementById("loginError");

  if (input === SITE_PASSWORD) {
    setAuthSession();
    errorBox.textContent = "";
    showApp();
  } else {
    errorBox.textContent = "密碼錯誤";
  }
}

/*
  登出
*/
function logout() {
  clearAuthSession();
  location.reload();
}

/*
  初始化驗證
  1. 沒登入 -> 顯示登入頁
  2. 已登入但超過 7 小時 -> 自動登出
  3. 未過期 -> 顯示主頁
*/
function initAuth() {
  const authData = getAuthSession();

  if (!authData) {
    showLogin();
    return;
  }

  if (isAuthExpired(authData)) {
    clearAuthSession();
    showLogin();
    const errorBox = document.getElementById("loginError");
    if (errorBox) {
      errorBox.textContent = `登入已超過 ${AUTH_EXPIRE_HOURS} 小時，請重新登入`;
    }
    return;
  }

  showApp();
}

/*
  定時檢查是否過期
  每 1 分鐘檢查一次
*/
function startAuthWatcher() {
  setInterval(() => {
    const authData = getAuthSession();

    if (!authData || isAuthExpired(authData)) {
      clearAuthSession();
      alert(`登入已超過 ${AUTH_EXPIRE_HOURS} 小時，系統將自動登出`);
      location.reload();
    }
  }, 60 * 1000);
}
