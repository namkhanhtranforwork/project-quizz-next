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
      <div class="row"><div><h2>Danh mục môn học</h2><p class="muted">Tạo môn học dùng chung để phân công giáo viên và tạo bài tập. Bấm "Xem chi tiết" để tùy chỉnh tên, mã, trạng thái và xem dữ liệu liên quan.</p></div><span class="pill">${subjects.length} môn</span></div>
      <form id="admin-subject-form" class="form-grid">
        <div><label for="admin-subject-name">Tên môn học</label><input id="admin-subject-name" name="name" required maxlength="80" placeholder="Ví dụ: Toán"></div>
        <div class="admin-form-submit"><button type="submit">Tạo môn học</button></div>
      </form>
    </section>
    <section class="card">
      <h2>Môn học hiện có</h2>
      ${subjects.length
        ? `<div class="table-wrap"><table><thead><tr><th>Tên môn</th><th>Mã môn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${subjects.map(subject => `<tr><td><b>${esc(subject.name || "Môn học chưa có tên")}</b></td><td class="code">${esc(subject.code || "Chưa đặt mã")}</td><td>${subject.active === false ? '<span class="pill off">Đã ẩn</span>' : '<span class="pill">Đang hoạt động</span>'}</td><td><button type="button" class="small secondary" data-action="view-subject-details" data-id="${esc(subject.id)}">Xem chi tiết</button></td></tr>`).join("")}</tbody></table></div>`
        : '<p class="empty">Chưa có môn học. Tạo môn đầu tiên để bắt đầu phân công.</p>'}
    </section>`;
  };
})();
