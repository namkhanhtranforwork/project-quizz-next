/* Teacher view module: classes. Generated from the existing MVP renderer. */
(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};
  window.TeacherViews.classes = function (ctx) {
    const { state, esc, classes, classStudentCount } = ctx;

    return `<section class="card"><div class="row"><div><h2>Lớp học được phân công</h2><p class="muted">Chỉ hiển thị các lớp tài khoản này được phép quản lý.</p></div><span class="pill">${classes.length} lớp</span></div>${classes.length?`<div class="grid">${classes.map(c=>`<article class="teacher-class-card"><div class="teacher-class-icon">🌱</div><h3>${esc(c.name)}</h3><p class="muted">Mã lớp: <span class="code">${esc(c.code)}</span></p><div class="teacher-class-numbers"><span>Sĩ số <b>${classStudentCount(c)}</b></span><span><b>${state.assignments.filter(a=>a.classId===c.id).length}</b> bài tập</span></div><button data-tab="class:${c.id}">Quản lý lớp</button></article>`).join("")}</div>`:'<div class="empty">Chưa được phân công lớp. Hãy liên hệ Admin để được phân công.</div>'}</section>`;
  };
})();
