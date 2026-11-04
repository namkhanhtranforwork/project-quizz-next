(() => {
  window.AdminViews=window.AdminViews||{};
  window.AdminViews.audit=ctx=>{
    const {state,esc,adminDataTab}=ctx;
    const selected=adminDataTab||"logs";
    const tabs=[
      ["logs","Nhật ký hệ thống"],
      ["local-backup","Backup cục bộ"],
      ["system-backup","Backup hệ thống (mockup)"]
    ];
    const panel=selected==="local-backup"?window.AdminViews.backup(ctx):selected==="system-backup"?window.AdminViews.systemBackupMockup():`<section class="card"><div class="row"><h2>Nhật ký thao tác</h2><button class="secondary" data-action="export-audit">Xuất CSV</button></div>${state.audit.length?`<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>${state.audit.map(l=>`<tr><td>${esc(new Date(l.at).toLocaleString('vi-VN'))}</td><td>${esc(state.users.find(u=>u.id===l.actor)?.name||'Hệ thống')}</td><td>${esc(l.action)}</td><td>${esc(JSON.stringify(l.detail))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Chưa có nhật ký.</div>'}</section>`;
    return `<nav class="tabs workspace-tabs" aria-label="Nhật ký và quản lý dữ liệu">${tabs.map(([id,label])=>`<button type="button" class="${selected===id?"active":""}" data-action="admin-data-tab" data-view="${id}" aria-pressed="${selected===id}">${label}</button>`).join("")}</nav>${panel}`;
  };
})();
