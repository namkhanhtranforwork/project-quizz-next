/* Teacher view module: assignments. Generated from the existing MVP renderer. */
(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};
  window.TeacherViews.assignments = function (ctx) {
    const { esc, clsName, classes, assignments, submissions, classId, uiState, subjects, state, session } = ctx;
    const editId = uiState?.teacherAssignmentEditId ?? window.__teacherAssignmentEditId ?? "";
    const editing = assignments.find(a => a.id === editId) || null;
    const selectedClassId = editing?.classId || (classes.some(c => c.id === classId) ? classId : classes[0]?.id || "");
    const activeSubjects = (subjects || state.subjects || []).filter(subject => subject.active !== false);
    const availableSubjectIds = new Set(activeSubjects
      .filter(subject => ctx.isAdmin || ctx.canTeachSubject?.(state, session, selectedClassId, subject.id))
      .map(subject => subject.id));
    const selectedClassSubjects = activeSubjects.filter(subject => availableSubjectIds.has(subject.id));
    const classOption = cls => {
      const classSubjects = activeSubjects
        .filter(subject => ctx.isAdmin || ctx.canTeachSubject?.(state, session, cls.id, subject.id));
      const classLabel = classSubjects.length
        ? `Môn được phân công: ${classSubjects.map(subject => subject.name).join(", ")}`
        : "Chưa được phân công môn học";
      const subjectIds = classSubjects.map(subject => esc(subject.id)).join(",");
      return `<option value="${esc(cls.id)}" data-subject-ids="${subjectIds}" ${cls.id === selectedClassId ? "selected" : ""}>${esc(cls.name)} · ${esc(classLabel)}</option>`;
    };

    const hasSubs = editing ? submissions.some(s => s.assignmentId === editing.id) : false;
    const draftId = editing?.id || "";
    if (uiState.teacherAssignmentDraftId !== draftId) {
      uiState.teacherAssignmentDraftId = draftId;
      uiState.teacherAssignmentQuestions = JSON.parse(JSON.stringify(editing?.questions || []));
      uiState.teacherAssignmentQuestionEditIndex = null;
    }
    const questions = uiState.teacherAssignmentQuestions || [];
    const questionEditor = window.TeacherViews.renderQuestionEditor(esc, "assignment", questions);
    const miniGames = editing?.minigames || {};

    return `<section class="card">
      <div class="row">
        <div>
          <h2>Bài tập &amp; đề kiểm tra</h2>
          <p class="muted">Tạo bài tập với 6 dạng câu hỏi đa dạng (trắc nghiệm, chọn nhiều, đúng/sai, điền khuyết, nối cột, tự luận); tự động chấm điểm.</p>
        </div>
      </div>
      ${classes.length ? `<div class="form-grid"><div><label for="assignment-class-picker">Chọn lớp để tạo bài</label><select id="assignment-class-picker" ${editing ? "disabled" : ""}>${classes.map(classOption).join("")}</select><p class="smalltext">Danh sách hiển thị rõ các môn đã được phân công trong từng lớp.</p></div></div>
      <section class="teacher-create-panel"><h3>${editing ? "Sửa bài tập" : "Tạo bài tập mới"}</h3>
        ${hasSubs ? '<div class="notice"><b>Lưu ý:</b> Bài này đã có học sinh nộp. Câu hỏi bị khóa để bảo đảm tính toàn vẹn; muốn đổi câu hỏi hãy dùng nút <b>Nhân bản</b>.</div>' : ''}
        <form id="assignment-form" class="form-grid">
          <input type="hidden" id="assignment-edit-id" value="${esc(editing?.id || "")}">
          <input type="hidden" id="assignment-class" value="${esc(selectedClassId)}">
          <div><label for="assignment-title">Tên bài tập</label><input id="assignment-title" required maxlength="160" value="${esc(editing?.title || "")}" placeholder="Ví dụ: Ôn tập Toán & Tiếng Việt tuần 1"></div>
          <div><label for="assignment-subject">Môn học</label><select id="assignment-subject" ${editing ? "disabled" : "required"}><option value="">${editing ? "Chưa phân loại" : selectedClassSubjects.length ? "Chọn môn đã được phân công" : "Chưa có môn được phân công"}</option>${activeSubjects.map(subject => `<option value="${esc(subject.id)}" ${subject.id === editing?.subjectId ? "selected" : ""} ${!editing && !availableSubjectIds.has(subject.id) ? "disabled hidden" : ""}>${esc(subject.name)}</option>`).join("")}</select><p id="assignment-subject-help" class="smalltext">${selectedClassSubjects.length ? `Chỉ chọn được môn đã phân công: ${selectedClassSubjects.map(subject => esc(subject.name)).join(", ")}.` : "Chưa có môn học được phân công trong lớp này. Hãy nhờ GVCN hoặc Admin cập nhật phân công."}</p></div>
          <div><label for="assignment-due">Hạn nộp</label><input id="assignment-due" type="date" value="${esc(editing?.due || "")}" ${editing ? "" : `min="${new Date().toISOString().slice(0,10)}"`}></div>
          <div><label for="assignment-duration">Thời gian làm bài (phút, tùy chọn)</label><input id="assignment-duration" type="number" min="1" max="180" value="${esc(editing?.durationMinutes || "")}" placeholder="Ví dụ: 15 (để trống nếu không giới hạn)"></div>
          <div><label for="assignment-allow-late">Quy tắc nộp trễ</label><select id="assignment-allow-late"><option value="true" ${editing?.allowLate !== false ? "selected" : ""}>Cho phép nộp trễ</option><option value="false" ${editing?.allowLate === false ? "selected" : ""}>Chặn nộp sau hạn</option></select></div>
          <div class="wide">
            <label for="assignment-import-file">Nhập đề từ Word, Excel hoặc CSV</label>
            <input id="assignment-import-file" type="file" accept=".docx,.xlsx,.xls,.csv" ${hasSubs ? "disabled" : ""}>
            <p class="smalltext">Hỗ trợ Word (.docx), Excel (.xlsx/.xls) và CSV theo mẫu đề; câu hỏi được đưa vào danh sách để kiểm tra trước khi lưu.</p>
          </div>
          <div class="wide"><label>Mẫu câu hỏi</label><div class="template-helper-bar">
            <button type="button" class="btn-template-sample" data-insert-template="single" ${hasSubs ? "disabled" : ""}>+ Mẫu Trắc nghiệm 1 đáp án</button>
            <button type="button" class="btn-template-sample" data-insert-template="multi" ${hasSubs ? "disabled" : ""}>+ Mẫu Chọn nhiều đáp án</button>
            <button type="button" class="btn-template-sample" data-insert-template="boolean" ${hasSubs ? "disabled" : ""}>+ Mẫu Đúng / Sai</button>
            <button type="button" class="btn-template-sample" data-insert-template="fill" ${hasSubs ? "disabled" : ""}>+ Mẫu Điền vào chỗ trống</button>
            <button type="button" class="btn-template-sample" data-insert-template="match" ${hasSubs ? "disabled" : ""}>+ Mẫu Nối cột ghép đôi</button>
            <button type="button" class="btn-template-sample" data-insert-template="essay" ${hasSubs ? "disabled" : ""}>+ Mẫu Câu tự luận</button>
          </div></div>
          ${hasSubs ? `<fieldset class="assignment-question-lock" disabled>${questionEditor}</fieldset>` : questionEditor}
          <section class="wide card assignment-minigame-settings">
            <h3>Minigame khi trả lời sai (tùy chọn)</h3>
            <label><input type="checkbox" id="assignment-minigame-enabled" ${editing?.minigameEnabled ? "checked" : ""} ${hasSubs ? "disabled" : ""}> Bật minigame khi học sinh trả lời sai</label>
            <div id="assignment-minigame-options" ${editing?.minigameEnabled ? "" : "hidden"}>
              <label><input type="checkbox" name="assignment-minigame" value="unscramble" ${miniGames.unscramble ? "checked" : ""} ${hasSubs ? "disabled" : ""}> Xếp lại chữ cái (trắc nghiệm 1 đáp án, điền từ)</label>
              <label><input type="checkbox" name="assignment-minigame" value="eliminate" ${miniGames.eliminate ? "checked" : ""} ${hasSubs ? "disabled" : ""}> Loại bớt đáp án sai (trắc nghiệm 1 đáp án)</label>
            </div>
          </section>
          <div class="actions">
            <button type="submit">${editing ? "Lưu thay đổi bài tập" : "Lưu & Giao bài tập"}</button>
            ${editing ? ` <button type="button" class="ghost" data-action="cancel-edit-assignment">Hủy sửa</button>` : ""}
          </div>
        </form>
      </section>` : '<div class="empty">Bạn cần được phân công lớp trước khi tạo bài tập.</div>'}
    </section>
    <section class="card"><div class="row"><h2>Bài đã giao</h2><span class="pill">${assignments.length} bài</span></div>
      ${assignments.length ? `<div class="table-wrap"><table><thead><tr><th>Bài tập</th><th>Môn</th><th>Lớp</th><th>Số câu</th><th>Thời gian</th><th>Hạn nộp</th><th>Bài nộp</th><th>Thao tác</th></tr></thead><tbody>${assignments.map(a => `<tr>
        <td><b>${esc(a.title)}</b>${a.archived ? '<div><span class="pill off">Đã lưu trữ</span></div>' : ''}<div class="smalltext">Tạo ${esc(a.createdAt ? new Date(a.createdAt).toLocaleDateString("vi-VN") : "—")}${a.updatedAt ? ` · Sửa ${esc(new Date(a.updatedAt).toLocaleDateString("vi-VN"))}` : ""}</div></td>
        <td>${esc(state.subjects.find(subject => subject.id === a.subjectId)?.name || "Chưa phân loại")}</td><td>${esc(clsName(a.classId))}</td><td>${a.questions?.length || 0}</td><td>${a.durationMinutes ? `${a.durationMinutes} phút` : "Không giới hạn"}</td><td>${esc(a.due || "Không đặt hạn")}${a.allowLate === false ? ' <span class="pill off" style="font-size:11px;">Chặn nộp trễ</span>' : ''}</td><td>${submissions.filter(s => s.assignmentId === a.id).length}</td>
        <td>${a.archived ? "" : `<button class="small secondary" data-action="edit-assignment" data-id="${esc(a.id)}">Sửa</button> <button class="small secondary" data-action="clone-assignment" data-id="${esc(a.id)}" title="Nhân bản thành bài mới">Nhân bản</button>`} <button class="small ghost" data-action="view-assignment-submissions" data-id="${esc(a.id)}">Bài nộp</button> <button class="small ${a.archived ? "secondary" : "danger"}" data-action="delete-assignment" data-id="${esc(a.id)}">${a.archived ? "Khôi phục" : "Lưu trữ"}</button></td>
      </tr>`).join("")}</tbody></table></div>` : '<div class="empty">Chưa có bài tập. Hãy tạo bài đầu tiên ở biểu mẫu phía trên.</div>'}
    </section>`;
  };
})();
