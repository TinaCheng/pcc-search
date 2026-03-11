// 渲染結果表格
function renderTable(rows) {
  const wrap = document.getElementById("tableWrap");
  const card = document.getElementById("tableCard");

  if (!rows.length) {
    wrap.innerHTML = "<div style='padding:12px;'>查無資料</div>";
    card.style.display = "block";
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th class="checkbox-cell">勾選</th>
          <th>原始輸入</th>
          <th>公告日</th>
          <th>原公告日</th>
          <th>標案案號</th>
          <th>標案名稱</th>
          <th>類型</th>
          <th>分類</th>
          <th>機關代碼</th>
          <th>機關名稱</th>
          <th>單位名稱</th>
          <th>機關地址</th>
          <th>聯絡人</th>
          <th>聯絡電話</th>
          <th>決標方式</th>
          <th>截止投標</th>
          <th>開標時間</th>
          <th>是否異動招標文件</th>
          <th>標案網址</th>
          <th>標案 API</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, index) => `
          <tr>
            <td class="checkbox-cell">
              <input type="checkbox" ${r._selected ? "checked" : ""} onchange="toggleRowSelection(${index}, this.checked)">
            </td>
            <td>${esc(r["原始輸入"])}</td>
            <td>${esc(r["公告日"])}</td>
            <td>${esc(r["原公告日"])}</td>
            <td>${esc(r["標案案號"])}</td>
            <td>${esc(r["標案名稱"])}</td>
            <td>${esc(r["類型"])}</td>
            <td>${esc(r["分類"])}</td>
            <td>${esc(r["機關代碼"])}</td>
            <td>${esc(r["機關名稱"])}</td>
            <td>${esc(r["單位名稱"])}</td>
            <td>${esc(r["機關地址"])}</td>
            <td>${esc(r["聯絡人"])}</td>
            <td>${esc(r["聯絡電話"])}</td>
            <td>${esc(r["決標方式"])}</td>
            <td>${esc(r["截止投標"])}</td>
            <td>${esc(r["開標時間"])}</td>
            <td>${esc(r["是否異動招標文件"])}</td>
            <td>${r["標案網址"] ? `<a href="${esc(r["標案網址"])}" target="_blank" rel="noopener noreferrer">開啟</a>` : ""}</td>
            <td>${r["標案API"] ? `<a href="${esc(r["標案API"])}" target="_blank" rel="noopener noreferrer">開啟</a>` : ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  card.style.display = "block";
}

// 單列勾選切換
function toggleRowSelection(index, checked) {
  if (LAST_ROWS[index]) {
    LAST_ROWS[index]._selected = checked;
  }
}

// 全選
function selectAllRows() {
  LAST_ROWS = LAST_ROWS.map(row => ({ ...row, _selected: true }));
  renderTable(LAST_ROWS);
}

// 全部取消
function clearAllSelections() {
  LAST_ROWS = LAST_ROWS.map(row => ({ ...row, _selected: false }));
  renderTable(LAST_ROWS);
}
