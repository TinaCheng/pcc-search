// 驗證密碼
function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  const errorBox = document.getElementById("loginError");

  if (input === SITE_PASSWORD) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, "ok");
    showApp();
  } else {
    errorBox.textContent = "密碼錯誤";
  }
}

// 顯示主頁
function showApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "block";
}

// 登出
function logout() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  location.reload();
}

// 初始化驗證
function initAuth() {
  const authed = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (authed === "ok") {
    showApp();
  } else {
    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("appPage").style.display = "none";
  }
}
