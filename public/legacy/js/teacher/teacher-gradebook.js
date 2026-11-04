/* Teacher view module: gradebook. */
(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};
  window.TeacherViews.gradebook = function (ctx) {
    const { state, esc, classes, assignments, submissions } = ctx;
    const selectedClass = document.getElementById("gradebook-class")?.value || classes[0]?.id || "";
    const currentClass = classes.find(c => c.id === selectedClass);
    if (!currentClass) {
      return `<section class="card"><h2>Sổ điểm</h2><div class="empty">Bạn cần được phân công lớp trước khi xem sổ điểm.</div></section>`;
    }

    // Học sinh hiện tại trong lớp
    const currentStudents = state.users
      .filter(u => u.role === "student" && u.active !== false && (u.classIds || []).includes(currentClass.id))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    const classAssignments = assignments
      .filter(a => a.classId === currentClass.id)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    // Học sinh đã rời lớp nhưng còn bài nộp
    const assignmentIdSet = new Set(classAssignments.map(a => a.id));
    const formerStudentIds = new Set();
    submissions.forEach(s => {
      if (assignmentIdSet.has(s.assignmentId)) {
        const u = state.users.find(u => u.id === s.studentId);
        if (u && !(u.classIds || []).includes(currentClass.id)) {
          formerStudentIds.add(u.id);
        }
      }
    });
    const formerStudents = Array.from(formerStudentIds)
      .map(id => state.users.find(u => u.id === id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    const allStudents = [...currentStudents, ...formerStudents];

    function renderStudentRow(student, isFormer) {
      return `<tr>
        <th>${esc(student.name)}${isFormer ? ' <span class="pill off" style="font-size: 11px;">đã rời lớp</span>' : ""}</th>
        ${classAssignments.map(assignment => {
          const submission = submissions.find(s => s.assignmentId === assignment.id && s.studentId === student.id);
          if (!submission) return `<td>${assignment.archived ? "—" : "Chưa nộp"}</td>`;
          if (submission.status === "submitted") return `<td><span class="pill off">Chờ chấm${submission.late ? " · Trễ" : ""}</span></td>`;
          return `<td>${Number(submission.score) || 0}/${Number(submission.total) || 0}${submission.late ? '<div class="smalltext">Nộp trễ</div>' : ""}</td>`;
        }).join("")}
      </tr>`;
    }

    return `<section class="card"><div class="row"><div><h2>Sổ điểm</h2><p class="muted">Hiển thị điểm đã trả; bài chờ chấm và chưa nộp được ghi rõ. Học sinh đã rời lớp có bài nộp vẫn hiện.</p></div><div><label for="gradebook-class">Lớp</label><select id="gradebook-class">${classes.map(c => `<option value="${esc(c.id)}" ${c.id === currentClass.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div></div>
      ${!allStudents.length ? '<div class="empty">Lớp chưa có học sinh nào (kể cả học sinh đã rời lớp).</div>' : !classAssignments.length ? '<div class="empty">Lớp chưa có bài tập.</div>' : `<div class="table-wrap"><table><thead><tr><th>Học sinh</th>${classAssignments.map(a => `<th>${esc(a.title)}${a.archived ? '<div class="smalltext">Đã lưu trữ</div>' : ""}<div class="smalltext">Điểm / ${Number(a.questions?.length) || 0}</div></th>`).join("")}</tr></thead><tbody>${currentStudents.map(s => renderStudentRow(s, false)).join("")}${formerStudents.map(s => renderStudentRow(s, true)).join("")}</tbody></table></div>`}</section>`;
  };
})();
