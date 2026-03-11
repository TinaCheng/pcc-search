// 匯出 Excel，只匯出勾選列
function exportExcel() {
  const selectedRows = LAST_ROWS.filter(row => row._selected);

  if (!selectedRows.length) {
    alert("目前沒有勾選任何資料，無法匯出 Excel");
    return;
  }

  const exportRows = selectedRows.map(row => {
    const out = { ...row };
    delete out._selected;

    if (!isFilled(out["原公告日"])) {
      delete out["原公告日"];
    }

    return out;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "標案資料");
  XLSX.writeFile(wb, "政府標案查詢結果.xlsx");
}
