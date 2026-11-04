/* Admin management for the shared subject catalog. */
(() => {
  "use strict";
  window.AdminViews = window.AdminViews || {};

  window.AdminViews.subjects = function (ctx) {
    const { state, esc } = ctx;
    const subjects = (state.subjects || []).slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "vi")
    );

    return `<section class="card">
      <div class="row"><div><h2>Danh mục môn học</h2><p class="muted">Tạo môn học dùng chung để phân công giáo viên và tạo bài tập.</p></div><span class="pill">${subjects.length} môn</span></div>
      <form id="admin-subject-form" class="form-grid">
        <div><label for="admin-subject-name">Tên môn học</label><input id="admin-subject-name" name="name" required maxlength="80" placeholder="Ví dụ: Toán"></div>
        <div class="admin-form-submit"><button type="submit">Tạo môn học</button></div>
      </form>
    </section>
    <section class="card">
      <h2>Môn học hiện có</h2>
      ${subjects.length
        ? `<div class="table-wrap"><table><thead><tr><th>Tên môn</th><th>Trạng thái</th></tr></thead><tbody>${subjects.map(subject => `<tr><td>${esc(subject.name || "Môn học chưa có tên")}</td><td>${subject.active === false ? '<span class="pill off">Đã ẩn</span>' : '<span class="pill">Đang hoạt động</span>'}</td></tr>`).join("")}</tbody></table></div>`
        : '<p class="empty">Chưa có môn học. Tạo môn đầu tiên để bắt đầu phân công.</p>'}
    </section>`;
  };
})();
