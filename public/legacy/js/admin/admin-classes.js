(() => {
  window.AdminViews = window.AdminViews || {};
  window.AdminViews.classes = ({ state, esc }) => {
    const teachers = state.users.filter(user => user.role === "teacher" && user.active !== false);
    const unassigned = state.classes.filter(cls =>
      !(cls.teacherIds || []).some(id => teachers.some(user => user.id === id))
    );
    const activeStudents = state.users.filter(user => user.role === "student" && user.active !== false);
    const assignmentDetails = cls => {
      const active = (state.classTeacherAssignments || []).filter(item =>
        item.classId === cls.id && item.status === "active" && !item.revokedAt
      );
      if (active.length) {
        return active.map(item => {
          const teacher = state.users.find(user => user.id === item.teacherId);
          const subject = state.subjects.find(value => value.id === item.subjectId);
          const label = item.role === "homeroom_teacher"
            ? "GVCN"
            : `Môn ${subject?.name || "chưa phân loại"}`;
          return `${teacher?.name || "Giáo viên không hoạt động"} · ${label}`;
        }).join("; ");
      }

      const legacyTeachers = (cls.teacherIds || [])
        .map(id => state.users.find(user => user.id === id)?.name)
        .filter(Boolean);
      return legacyTeachers.length
        ? `${legacyTeachers.join(", ")} · Chưa có phân công môn cụ thể`
        : "Chưa phân công";
    };
    const classSize = cls => {
      if (window.Core?.getActiveClassStudentIds) {
        return window.Core.getActiveClassStudentIds(state, cls.id).length;
      }
      return new Set(activeStudents.filter(student => (student.classIds || []).includes(cls.id)).map(student => student.id)).size;
    };

    return `
      <section class="card">
        <div class="admin-panel-heading">
          <span class="admin-step-badge">Bước 1</span>
          <div>
            <h2>Tạo lớp</h2>
            <p class="muted">Tạo lớp trước; phân công giáo viên chủ nhiệm và giáo viên bộ môn trong phần xem chi tiết của từng lớp.</p>
          </div>
        </div>
        <form id="class-form" class="form-grid">
          <div><label for="class-name">Tên lớp</label><input id="class-name" required placeholder="Ví dụ: 4A"></div>
          <div><label for="class-code">Mã lớp duy nhất</label><input id="class-code" required placeholder="Ví dụ: LOP-4A"></div>
          <div>
            <label for="teacher-id">Giáo viên chủ nhiệm (tùy chọn)</label>
            <select id="teacher-id">
              <option value="">Chưa phân công</option>
              ${teachers.map(teacher => `<option value="${esc(teacher.id)}">${esc(teacher.name)} (${esc(teacher.publicCode)})</option>`).join("")}
            </select>
          </div>
          <div class="admin-form-submit"><button type="submit">Tạo lớp</button></div>
        </form>
      </section>
      <section class="card">
        <div class="row">
          <div>
            <h2>Danh sách lớp</h2>
            <p class="muted">${state.classes.length} lớp · ${unassigned.length} lớp chưa phân công giáo viên</p>
          </div>
          <span class="pill ${unassigned.length ? "off" : ""}">${unassigned.length ? `${unassigned.length} cần phân công` : "Đã phân công"}</span>
        </div>
        ${state.classes.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Lớp</th><th>Mã lớp</th><th>Giáo viên / môn học</th><th>Sĩ số</th><th>Thao tác</th></tr></thead>
              <tbody>
                ${state.classes.map(cls => `
                  <tr>
                    <td><b>${esc(cls.name)}</b></td>
                    <td class="code">${esc(cls.code)}</td>
                    <td>${esc(assignmentDetails(cls))}</td>
                    <td><strong>${classSize(cls)}</strong> học sinh</td>
                    <td>
                      <div class="actions">
                        <button class="small secondary" data-action="view-class-details" data-id="${esc(cls.id)}">Xem chi tiết</button>
                        <button class="small secondary" data-action="export-class" data-id="${esc(cls.id)}">Xuất danh sách</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">Chưa có lớp học. Tạo lớp ở trên để bắt đầu.</div>'}
      </section>
      <section class="card">
        <div class="admin-panel-heading">
          <span class="admin-step-badge">Tùy chọn</span>
          <div>
            <h2>Bổ sung học sinh đã có tài khoản</h2>
            <p class="muted">Dùng khi cần xếp thêm học sinh đã có hồ sơ vào một lớp, không làm mất lớp hoặc dữ liệu cũ.</p>
          </div>
        </div>
        ${activeStudents.length && state.classes.length ? `
          <form id="add-student-form" class="form-grid">
            <div>
              <label for="student-select">Học sinh</label>
              <select id="student-select" required>
                <option value="">Chọn học sinh</option>
                ${activeStudents.map(student => `<option value="${esc(student.id)}">${esc(student.name)} · ${esc(student.publicCode || "")}</option>`).join("")}
              </select>
            </div>
            <div>
              <label for="target-class">Lớp cần thêm</label>
              <select id="target-class" required>
                <option value="">Chọn lớp</option>
                ${state.classes.map(cls => `<option value="${esc(cls.id)}">${esc(cls.name)} · ${esc(cls.code)}</option>`).join("")}
              </select>
            </div>
            <div class="admin-form-submit"><button type="submit">Thêm học sinh vào lớp</button></div>
          </form>
        ` : '<p class="empty">Cần có ít nhất một học sinh và một lớp để xếp danh sách.</p>'}
      </section>
      <section class="admin-next-step">
        <div>
          <span class="admin-step-badge">Bước 2</span>
          <div><h3>Nhập tài khoản</h3><p class="muted">Nhập danh sách giáo viên và học sinh. Dùng mã lớp ở trên để xếp học sinh tự động.</p></div>
        </div>
        <button class="secondary" data-tab="import">Đến nhập dữ liệu</button>
      </section>
    `;
  };
})();
