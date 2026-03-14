function getAuthExpireMs() {
  return AUTH_EXPIRE_HOURS * 60 * 60 * 1000;
}

function setAuthSession() {
  const payload = {
    ok: true,
    loginAt: Date.now()
  };

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

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

function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function isAuthExpired(authData) {
  if (!authData || !authData.ok || !authData.loginAt) return true;
  const now = Date.now();
  const diff = now - authData.loginAt;
  return diff > getAuthExpireMs();
}

function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "block";
}

function showLogin() {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("appPage").style.display = "none";
}

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

function logout() {
  clearAuthSession();
  location.reload();
}

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
