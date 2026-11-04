/* Teacher view module: parent account requests and class-scoped guardian links. */
(() => {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};
  window.TeacherViews.parents = function (ctx) {
    const { state, esc, classes, students } = ctx;
    const classStudentIds = new Set(students.map(student => student.id));
    const links = (state.studentGuardians || []).filter(link => classStudentIds.has(link.studentId) && !link.revokedAt);
    const parentNames = new Set(links.map(link => state.users.find(user => user.id === link.parentId)?.name).filter(Boolean));
    const rows = links.map(link => {
      const parent = state.users.find(user => user.id === link.parentId);
      const student = state.users.find(user => user.id === link.studentId);
      const cls = classes.find(item => (student?.classIds || []).includes(item.id));
      const status = link.status === "verified" ? "Đã xác minh" : "Chờ Admin xác minh";
      return `<tr><td>${esc(parent?.name || "Tài khoản không tồn tại")}<div class="smalltext">${esc(parent?.email || "—")}</div></td><td>${esc(student?.name || "Học sinh không tồn tại")}</td><td>${esc(cls?.name || "—")}</td><td>${status}</td></tr>`;
    });

    return `<section class="card"><h2>Yêu cầu liên kết phụ huynh</h2><p class="muted">Tạo tài khoản phụ huynh hoặc gửi yêu cầu liên kết với học sinh trong lớp được phân công. Yêu cầu mới ở trạng thái chờ; Admin cần xác minh trước khi phụ huynh xem được dữ liệu.</p>${students.length ? `<form id="teacher-parent-request-form" class="form-grid"><div><label for="request-parent-name">Họ tên phụ huynh</label><input id="request-parent-name" name="parentName" required maxlength="120"></div><div><label for="request-parent-email">Email (không bắt buộc)</label><input id="request-parent-email" name="parentEmail" type="email" maxlength="254"></div><div><label for="request-parent-phone">Số điện thoại (không bắt buộc)</label><input id="request-parent-phone" name="parentPhone" type="tel" maxlength="30"></div><div><label for="request-student-id">Học sinh</label><select id="request-student-id" name="studentId" required><option value="">Chọn học sinh trong lớp của bạn</option>${students.map(student => `<option value="${esc(student.id)}">${esc(student.name)} · ${esc((student.classIds || []).map(id => classes.find(cls => cls.id === id)?.name).filter(Boolean).join(", "))}</option>`).join("")}</select></div><div><label for="request-parent-relationship">Quan hệ</label><select id="request-parent-relationship" name="relationship" required><option value="mother">Mẹ</option><option value="father">Bố</option><option value="guardian">Người giám hộ</option><option value="other">Khác</option></select></div><div class="actions"><button type="submit">Gửi yêu cầu${parentNames.size ? " / tạo tài khoản" : ""}</button></div></form>` : '<div class="empty">Bạn cần có học sinh trong lớp được phân công trước khi gửi yêu cầu phụ huynh.</div>'}</section><section class="card"><h2>Phụ huynh của học sinh trong lớp tôi</h2><div class="table-wrap"><table><thead><tr><th>Phụ huynh</th><th>Học sinh</th><th>Lớp</th><th>Trạng thái</th></tr></thead><tbody>${rows.join("") || '<tr><td colspan="4">Chưa có yêu cầu hoặc liên kết phụ huynh.</td></tr>'}</tbody></table></div><p class="muted smalltext">Chỉ hiển thị quan hệ của học sinh thuộc lớp bạn phụ trách. Thông tin liên hệ cần được sử dụng theo quy định bảo vệ dữ liệu của nhà trường.</p></section>`;
  };
})();
