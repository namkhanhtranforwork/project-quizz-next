/* Admin controls for the school-wide competition leaderboard. */
(() => {
  "use strict";
  window.AdminViews = window.AdminViews || {};

  window.AdminViews.competition = function (ctx) {
    const { state, esc } = ctx;
    const competition = state.schoolCompetition || {};
    const selectedAssignmentIds = new Set(competition.assignmentIds || []);
    const assignments = state.assignments.filter(assignment => !assignment.archived);
    const status = competition.active
      ? '<span class="pill">Đang bật</span>'
      : '<span class="pill off">Đang tắt</span>';

    return `<section class="card">
      <div class="row"><div><h2>Bảng xếp hạng toàn trường</h2><p class="muted">Tạo cuộc thi bằng cách chọn các bài đã giao sẽ được tính điểm. Bảng toàn trường của học sinh chỉ hiển thị khi cuộc thi được bật.</p></div>${status}</div>
      <form id="admin-school-competition-form">
        <div class="form-grid">
          <div class="wide"><label for="school-competition-name">Tên cuộc thi</label><input id="school-competition-name" name="name" required maxlength="120" value="${esc(competition.name || "")}" placeholder="Ví dụ: Đua top Toán tháng 11"></div>
        </div>
        <fieldset class="school-competition-assignments">
          <legend>Bài thi được tính điểm</legend>
          <p class="muted smalltext">Chỉ bài nộp đã được chấm mới được tính. Hãy giao bài thi cho các lớp trước khi chọn.</p>
          ${assignments.length ? `<div class="school-competition-assignment-list">${assignments.map(assignment => {
            const cls = state.classes.find(item => item.id === assignment.classId);
            return `<label class="school-competition-assignment"><input type="checkbox" name="assignmentIds" value="${esc(assignment.id)}" ${selectedAssignmentIds.has(assignment.id) ? "checked" : ""}><span><b>${esc(assignment.title || "Bài thi")}</b><small>${esc(cls?.name || "Không rõ lớp")} · ${esc(assignment.subjectName || state.subjects.find(subject => subject.id === assignment.subjectId)?.name || "Chưa phân môn")}</small></span></label>`;
          }).join("")}</div>` : '<p class="empty">Chưa có bài tập/đề thi đang hoạt động. Hãy tạo và giao bài trước.</p>'}
        </fieldset>
        <label class="checkbox-row school-competition-toggle"><input type="checkbox" name="active" ${competition.active ? "checked" : ""}> Bật bảng xếp hạng toàn trường cho cuộc thi này</label>
        <div class="actions"><button type="submit">Lưu cuộc thi</button></div>
      </form>
    </section>
    <section class="card">
      <h2>Cách tính và hiển thị</h2>
      <ul>
        <li>Điểm chỉ cộng từ các bài đã chọn ở trên và đã được giáo viên chấm/trả.</li>
        <li>Bài chờ chấm không được tính; đồng điểm thì ưu tiên học sinh hoàn thành nhiều bài hơn.</li>
        <li>Học sinh vẫn xem được bảng xếp hạng trong lớp; bảng toàn trường chỉ xuất hiện khi cuộc thi đang bật.</li>
      </ul>
      <p class="notice">Đây là cài đặt của bản demo lưu trên trình duyệt Admin, chưa đồng bộ với các thiết bị khác.</p>
    </section>`;
  };
})();
