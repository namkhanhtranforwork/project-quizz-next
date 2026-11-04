(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};

  const TYPE_LABELS = {
    single: "Trắc nghiệm 1 đáp án",
    multi: "Chọn nhiều đáp án",
    boolean: "Đúng / Sai",
    fill: "Điền vào chỗ trống",
    match: "Nối cột ghép đôi",
    essay: "Tự luận"
  };

  function questionType(question) {
    const type = question.type || "single";
    return ({ mc: "single", tf: "boolean" })[type] || type;
  }

  function questionText(question) {
    return question.q || question.text || "";
  }

  function questionSummary(question) {
    const text = questionText(question).replace(/\s+/g, " ").trim();
    return text.length > 100 ? `${text.slice(0, 97)}...` : text;
  }

  function renderQuestionList(questions, esc, prefix = "quiz") {
    if (!questions.length) return '<p class="quiz-question-empty">Chưa có câu hỏi nào trong đề — bấm 1 nút mẫu ở trên để bắt đầu.</p>';
    return `<ol class="quiz-question-list">${questions.map((question, index) => `
      <li class="quiz-question-item">
        <div><b>${index + 1}. ${esc(TYPE_LABELS[questionType(question)] || "Câu hỏi")}</b><div class="smalltext">${esc(questionSummary(question))}</div></div>
        <div class="actions">
          <button type="button" class="small secondary" data-action="${prefix}-preview-question" data-index="${index}">Xem trước</button>
          <button type="button" class="small secondary" data-action="${prefix}-edit-question" data-index="${index}">Sửa</button>
          <button type="button" class="small danger" data-action="${prefix}-delete-question" data-index="${index}">Xóa</button>
        </div>
      </li>`).join("")}</ol>`;
  }

  function renderBuilder(esc, prefix = "quiz") {
    const options = type => [0, 1, 2, 3].map(index => `
      <div class="quiz-answer-row">
        <input type="${type === "single" ? "radio" : "checkbox"}" ${type === "single" ? `name="${prefix}-correct-single"` : `data-question-correct-multi="${index}"`} value="${index}" aria-label="Đáp án ${index + 1} đúng">
        <input id="${prefix}-option-${type}-${index}" data-question-option="${index}" data-option-type="${type}" maxlength="300" placeholder="Đáp án ${index + 1}" aria-label="Nội dung đáp án ${index + 1}">
      </div>`).join("");
    const matchPairs = [0, 1].map(index => `
      <div class="quiz-match-editor-row" data-pair-row="${index}">
        <label for="${prefix}-pair-left-${index}">Vế trái ${index + 1}</label><input id="${prefix}-pair-left-${index}" data-pair-left="${index}" maxlength="300">
        <label for="${prefix}-pair-right-${index}">Vế phải ${index + 1}</label><input id="${prefix}-pair-right-${index}" data-pair-right="${index}" maxlength="300">
        ${index > 1 ? `<button type="button" class="small ghost" data-action="${prefix}-remove-pair" data-index="${index}">Xóa cặp</button>` : ""}
      </div>`).join("");

    return `<div class="wide quiz-question-builder">
      <div class="quiz-question-type-picker"><label for="${prefix}-question-type">Chọn dạng câu hỏi</label><select id="${prefix}-question-type">
        ${Object.entries(TYPE_LABELS).map(([type, label]) => `<option value="${type}">${esc(label)}</option>`).join("")}
      </select></div>
      <div class="quiz-question-prompt"><label for="${prefix}-question-prompt">Câu hỏi</label><input id="${prefix}-question-prompt" maxlength="2000" placeholder="Nhập câu hỏi..."></div>
      <fieldset data-question-fields="single">
        <legend>4 đáp án (chọn ô tròn cho đáp án đúng)</legend><div class="quiz-single-answer-grid">${options("single")}</div>
      </fieldset>
      <fieldset data-question-fields="multi" hidden>
        <legend>4 đáp án (chọn các ô cho đáp án đúng)</legend>${options("multi")}
      </fieldset>
      <fieldset data-question-fields="boolean" hidden><legend>Đáp án đúng</legend>
        <label><input type="radio" name="${prefix}-boolean-correct" value="0"> Đúng</label>
        <label><input type="radio" name="${prefix}-boolean-correct" value="1"> Sai</label>
      </fieldset>
      <fieldset data-question-fields="fill" hidden><legend>Đáp án</legend>
        <label for="${prefix}-fill-answer">Đáp án đúng</label><input id="${prefix}-fill-answer" maxlength="500" placeholder="Nhập đáp án đúng">
      </fieldset>
      <fieldset data-question-fields="match" hidden><legend>Các cặp ghép (tối thiểu 2)</legend>
        <div id="${prefix}-match-pairs">${matchPairs}</div>
        <button type="button" class="secondary" data-action="${prefix}-add-pair">+ Thêm cặp</button>
      </fieldset>
      <fieldset data-question-fields="essay" hidden><legend>Đáp án tham khảo</legend>
        <label for="${prefix}-essay-sample">Đáp án tham khảo (tùy chọn)</label><textarea id="${prefix}-essay-sample" rows="3" maxlength="2000"></textarea>
      </fieldset>
      </div>
      <div class="quiz-question-add"><button type="button" id="${prefix}-question-save" data-action="${prefix}-save-question">+ Thêm câu hỏi vào đề</button>
        <button type="button" class="ghost" data-action="${prefix}-cancel-question-edit" hidden>Hủy sửa</button></div>
      <p class="smalltext quiz-question-hint">Câu hỏi chỉ được thêm khi đủ nội dung và đáp án bắt buộc. Dữ liệu đáp án gốc không bị tráo.</p>`;
  }
  function renderQuestionEditor(esc, prefix, questions) {
    return `${renderBuilder(esc, prefix)}
      <div class="wide quiz-question-list-panel"><h3 id="${prefix}-question-heading" ${questions.length ? "" : "hidden"}>Câu hỏi trong đề (${questions.length})</h3><div id="${prefix}-question-list">${renderQuestionList(questions, esc, prefix)}</div></div>
      <div id="${prefix}-question-preview" class="notice" hidden></div>`;
  }
  window.TeacherViews.renderQuestionEditor = renderQuestionEditor;

  window.TeacherViews.quizBank = function (ctx) {
    const { state, esc, quizzes, classes, session, uiState } = ctx;
    const ownQuizzes = quizzes.filter(quiz => quiz.ownerId === session.id || session.role === "admin");
    const selected = ownQuizzes.find(quiz => quiz.id === uiState.teacherQuizEditId) || null;
    const version = selected && state.quizVersions.find(item =>
      item.quizId === selected.id && item.version === selected.currentVersion
    );
    if (uiState.teacherQuizDraftId !== (selected?.id || "")) {
      uiState.teacherQuizDraftId = selected?.id || "";
      uiState.teacherQuizQuestions = JSON.parse(JSON.stringify(version?.questions || []));
      uiState.teacherQuizQuestionEditIndex = null;
    }
    const draftQuestions = uiState.teacherQuizQuestions || [];
    const ownedIds = new Set(ownQuizzes.map(quiz => quiz.id));
    const bankAssignments = state.quizAssignments.filter(item => ownedIds.has(item.quizId));
    const availableSubjectIds = new Set(state.subjects
      .filter(subject => subject.active !== false && (ctx.isAdmin || classes.some(cls => ctx.canTeachSubject(state, session, cls.id, subject.id))))
      .map(subject => subject.id));

    return `<section class="card">
      <div class="row"><div><h2>Ngân hàng Quiz</h2><p class="muted">Tạo câu hỏi theo từng dạng, xem trước và lưu phiên bản mới mà không thay đổi đề đã giao.</p></div><button class="secondary" data-action="new-quiz">Tạo Quiz mới</button></div>
      ${ownQuizzes.length ? `<div class="table-wrap"><table><thead><tr><th>Quiz</th><th>Môn</th><th>Phiên bản</th><th>Lượt giao</th><th>Thao tác</th></tr></thead><tbody>${ownQuizzes.map(quiz => `<tr><td><b>${esc(quiz.title)}</b><div class="smalltext">${esc(quiz.description || "")}</div></td><td>${esc(state.subjects.find(subject => subject.id === quiz.subjectId)?.name || "Chưa phân loại")}</td><td>v${Number(quiz.currentVersion) || 1}</td><td>${bankAssignments.filter(item => item.quizId === quiz.id).length}</td><td><button class="small secondary" data-action="edit-quiz" data-id="${esc(quiz.id)}">Sửa / giao</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Chưa có Quiz trong ngân hàng. Tạo Quiz để dùng lại cho nhiều lớp.</div>'}
    </section>
    <section class="card"><h2>${selected ? "Cập nhật Quiz gốc" : "Tạo Quiz gốc"}</h2>
      <form id="teacher-quiz-form" class="form-grid">
        <input type="hidden" name="quizId" value="${esc(selected?.id || "")}">
        <div><label for="quiz-title">Tên Quiz</label><input id="quiz-title" name="title" required maxlength="160" value="${esc(selected?.title || "")}"></div>
        <div><label for="quiz-subject">Môn học</label><select id="quiz-subject" name="subjectId" required><option value="">Chọn môn học đã được phân công</option>${state.subjects.filter(subject => subject.active !== false && availableSubjectIds.has(subject.id)).map(subject => `<option value="${esc(subject.id)}" ${subject.id === selected?.subjectId ? "selected" : ""}>${esc(subject.name)}</option>`).join("")}</select><p class="smalltext">Chỉ hiển thị môn được phân công tại ít nhất một lớp bạn có quyền.</p></div>
        <div class="wide"><label for="quiz-description">Mô tả (tùy chọn)</label><input id="quiz-description" name="description" maxlength="500" value="${esc(selected?.description || "")}"></div>
        <div class="wide"><label for="quiz-import-file">Nhập câu hỏi từ Word, Excel hoặc CSV</label><input id="quiz-import-file" type="file" accept=".docx,.xlsx,.xls,.csv"><p class="smalltext">Nội dung import được chuyển thành câu hỏi có cấu trúc để kiểm tra trước khi lưu.</p></div>
        ${renderQuestionEditor(esc, "quiz", draftQuestions)}
        <div class="actions"><button type="submit">${selected ? "Lưu phiên bản mới" : "Tạo Quiz"}</button>${selected ? '<button type="button" class="ghost" data-action="new-quiz">Hủy</button>' : ""}</div>
      </form>
    </section>
    ${selected ? `<section class="card"><h2>Giao “${esc(selected.title)}” cho lớp</h2><p class="muted">Môn: <b>${esc(state.subjects.find(subject => subject.id === selected.subjectId)?.name || "Chưa phân loại")}</b>. Chỉ lớp được phân công môn này mới chọn được.</p>
      ${classes.length ? `<form id="teacher-quiz-assign-form"><input type="hidden" name="quizId" value="${esc(selected.id)}"><div class="quiz-class-config-list">${classes.map(cls => {
        const permitted = ctx.isAdmin || ctx.canTeachSubject(state, session, cls.id, selected.subjectId);
        const subjectName = state.subjects.find(subject => subject.id === selected.subjectId)?.name || "đã chọn";
        return `<div class="quiz-class-config ${permitted ? "" : "is-disabled"}"><label><input type="checkbox" name="classIds" value="${esc(cls.id)}" ${permitted ? "" : "disabled"}> ${esc(cls.name)}</label><div class="form-grid"><div><label for="quiz-title-${esc(cls.id)}">Tên bài giao</label><input id="quiz-title-${esc(cls.id)}" name="title-${esc(cls.id)}" value="${esc(selected.title)}" ${permitted ? "" : "disabled"}></div><div><label for="quiz-due-${esc(cls.id)}">Hạn nộp</label><input id="quiz-due-${esc(cls.id)}" name="due-${esc(cls.id)}" type="date" min="${new Date().toISOString().slice(0, 10)}" ${permitted ? "" : "disabled"}></div><div><label for="quiz-duration-${esc(cls.id)}">Thời gian làm bài (phút)</label><input id="quiz-duration-${esc(cls.id)}" name="duration-${esc(cls.id)}" type="number" min="1" max="180" placeholder="Không giới hạn" ${permitted ? "" : "disabled"}></div><div><label for="quiz-late-${esc(cls.id)}">Quy tắc nộp trễ</label><select id="quiz-late-${esc(cls.id)}" name="late-${esc(cls.id)}" ${permitted ? "" : "disabled"}><option value="allow">Cho phép</option><option value="deny">Không cho phép</option></select></div></div><p class="smalltext">${permitted ? `Đã được phân công môn ${esc(subjectName)} tại lớp này.` : `Chưa được phân công môn ${esc(subjectName)} tại lớp ${esc(cls.name)}. Hãy nhờ GVCN hoặc Admin cập nhật phân công.`}</p></div>`;
      }).join("")}</div><div class="actions"><button type="submit">Giao Quiz cho lớp đã chọn</button></div></form>` : '<div class="empty">Bạn chưa được phân công lớp nào.</div>'}
    </section>` : ""}
    <section class="card"><h2>Lịch sử giao Quiz</h2>${bankAssignments.length ? `<div class="table-wrap"><table><thead><tr><th>Quiz</th><th>Lớp</th><th>Hạn nộp</th><th>Trạng thái</th><th>Bài nộp</th></tr></thead><tbody>${bankAssignments.map(item => `<tr><td>${esc(item.title)}</td><td>${esc(ctx.clsName(item.classId))}</td><td>${esc(item.dueAt || "Không đặt hạn")}</td><td>${esc(item.status)}</td><td>${ctx.submissions.filter(submission => submission.assignmentId === item.id).length}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Chưa giao Quiz nào.</div>'}</section>`;
  };
})();
