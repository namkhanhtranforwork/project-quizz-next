(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};

  window.TeacherViews.profile = function (ctx) {
    const { state, esc, classes, session } = ctx;
    const teacher = state.users.find(user => user.id === session.id && user.role === "teacher");
    if (!teacher) {
      return '<section class="card notice error"><h2>Không tìm thấy hồ sơ giáo viên</h2><p>Hãy đăng xuất và đăng nhập lại.</p></section>';
    }

    const assignments = state.classTeacherAssignments || [];
    const describeClassRole = classId => {
      const roles = assignments
        .filter(item => item.classId === classId && item.teacherId === teacher.id && item.status === "active" && !item.revokedAt)
        .map(item => item.role === "homeroom_teacher"
          ? "Giáo viên chủ nhiệm"
          : `Giáo viên bộ môn${item.subjectId ? ` · ${state.subjects.find(subject => subject.id === item.subjectId)?.name || "Môn học"}` : ""}`);
      return [...new Set(roles)].join(", ") || "Được phân công";
    };
    const readableAction = action => ({
      CODE_LOGIN: "Đăng nhập",
      LOGOUT: "Đăng xuất",
      UPDATE_TEACHER_PROFILE: "Cập nhật hồ sơ cá nhân",
      TEACHER_CREATE_STUDENT: "Tạo hồ sơ học sinh",
      TEACHER_REQUEST_PARENT_LINK: "Gửi yêu cầu liên kết phụ huynh",
      ASSIGN_CLASS_TEACHER: "Được phân công lớp/môn",
      REVOKE_CLASS_TEACHER: "Thu hồi phân công lớp/môn",
      CREATE_ASSIGNMENT: "Tạo và giao bài tập",
      UPDATE_ASSIGNMENT: "Cập nhật bài tập",
      CREATE_QUIZ: "Tạo Quiz",
      UPDATE_QUIZ_VERSION: "Cập nhật phiên bản Quiz",
      ASSIGN_QUIZ_TO_CLASSES: "Giao Quiz cho lớp",
      CREATE_CLASSROOM_LAYOUT: "Tạo sơ đồ lớp",
      ASSIGN_CLASSROOM_SEAT: "Sắp xếp chỗ ngồi",
      MOVE_CLASSROOM_ELEMENT: "Sắp xếp sơ đồ lớp",
      GRADE_AND_RETURN_SUBMISSION: "Chấm và trả bài",
      UPDATE_RETURNED_GRADE: "Cập nhật điểm đã trả"
    }[action] || String(action || "Hoạt động").replaceAll("_", " "));
    const activity = (state.audit || []).filter(entry => {
      if (entry.actor === teacher.id) return true;
      const detail = entry.detail && typeof entry.detail === "object" ? entry.detail : {};
      return detail.teacherId === teacher.id || detail.userId === teacher.id;
    }).slice(0, 50);

    return `<section class="teacher-account">
      <section class="card teacher-account-summary">
        <div><p class="eyebrow">HỒ SƠ CÁ NHÂN</p><h2>${esc(teacher.name || "Giáo viên")}</h2><p class="muted">Cập nhật thông tin liên hệ và theo dõi các lớp được phân công.</p></div>
        <div class="teacher-account-stats"><div><b>${classes.length}</b><span>Lớp được phân công</span></div><div><b>${activity.length}</b><span>Hoạt động gần đây</span></div></div>
      </section>
      <section class="card">
        <div class="row"><div><h2>Thông tin cá nhân</h2><p class="muted">Chỉ chỉnh sửa thông tin của tài khoản giáo viên đang đăng nhập.</p></div></div>
        <form id="teacher-profile-form" class="teacher-profile-form">
          <div class="form-grid">
            <div><label for="teacher-profile-name">Họ tên</label><input id="teacher-profile-name" name="name" maxlength="120" required value="${esc(teacher.name || "")}"></div>
            <div><label for="teacher-profile-email">Email</label><input id="teacher-profile-email" name="email" type="email" maxlength="254" value="${esc(teacher.email || "")}"></div>
            <div><label for="teacher-profile-phone">Số điện thoại</label><input id="teacher-profile-phone" name="phone" maxlength="30" value="${esc(teacher.phone || "")}"></div>
          </div>
          <div class="teacher-profile-actions"><button type="submit">Lưu thông tin</button><span class="muted">Mã đăng nhập và phân công lớp do Admin quản lý.</span></div>
        </form>
      </section>
      <section class="card">
        <div class="row"><div><h2>Lớp được phân công</h2><p class="muted">Danh sách chỉ gồm lớp tài khoản này được phép truy cập.</p></div><span class="pill">${classes.length} lớp</span></div>
        ${classes.length ? `<div class="table-wrap teacher-account-table"><table><thead><tr><th>Lớp</th><th>Mã lớp</th><th>Vai trò / môn học</th><th></th></tr></thead><tbody>${classes.map(cls => `<tr><td>${esc(cls.name)}</td><td>${esc(cls.code || "—")}</td><td>${esc(describeClassRole(cls.id))}</td><td><button class="small secondary" data-tab="class:${esc(cls.id)}">Mở lớp</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Chưa được phân công lớp. Hãy liên hệ Admin.</div>'}
      </section>
      <section class="card">
        <div class="row"><div><h2>Nhật ký hoạt động</h2><p class="muted">Các hoạt động do bạn thực hiện và thay đổi phân công liên quan đến tài khoản này.</p></div><span class="pill">${activity.length} mục</span></div>
        ${activity.length ? `<div class="table-wrap teacher-account-table"><table><thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Người thực hiện</th></tr></thead><tbody>${activity.map(entry => {
          const actor = state.users.find(user => user.id === entry.actor);
          const at = entry.at && !Number.isNaN(Date.parse(entry.at)) ? new Date(entry.at).toLocaleString("vi-VN") : "Chưa ghi nhận";
          return `<tr><td>${esc(at)}</td><td>${esc(readableAction(entry.action))}</td><td>${esc(actor?.name || (entry.actor === teacher.id ? teacher.name : "Hệ thống"))}</td></tr>`;
        }).join("")}</tbody></table></div>` : '<div class="empty">Chưa có hoạt động nào được ghi nhận.</div>'}
      </section>
    </section>`;
  };
})();
