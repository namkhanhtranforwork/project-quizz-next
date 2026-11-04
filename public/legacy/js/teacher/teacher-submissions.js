/* Teacher view module: submissions. Generated from the existing MVP renderer. */
(function () {
  "use strict";
  window.TeacherViews = window.TeacherViews || {};

  function norm(str) {
    return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function getQuestionType(q) {
    if (q.type) return q.type;
    if (Array.isArray(q.a) && q.a.length > 1) return "multi";
    if (q.opts && q.opts.length === 2 && (
      (q.opts[0].toLowerCase().includes("đúng") && q.opts[1].toLowerCase().includes("sai")) ||
      (q.opts[0].toLowerCase().includes("sai") && q.opts[1].toLowerCase().includes("đúng"))
    )) return "boolean";
    if (q.pairs && Array.isArray(q.pairs)) return "match";
    if ((!q.opts || q.opts.length === 0) && (typeof q.a === "string" || Array.isArray(q.accepted))) return "fill";
    if (!q.opts || q.opts.length === 0) return "essay";
    return "single";
  }

  function formatStudentAnswer(q, studentAns, esc) {
    const type = getQuestionType(q);
    if (studentAns === undefined || studentAns === null || studentAns === "") return '<span class="muted" style="color: #b8322a;">(Học sinh chưa trả lời)</span>';
    if (type === "single") return `<b>${String.fromCharCode(65 + Number(studentAns))}.</b> ${esc(q.opts?.[studentAns] || studentAns)}`;
    if (type === "multi") {
      if (!Array.isArray(studentAns)) return '<span class="muted">(Chưa chọn)</span>';
      return studentAns.map(idx => `<b>${String.fromCharCode(65 + Number(idx))}.</b> ${esc(q.opts?.[idx] || idx)}`).join(" &nbsp;·&nbsp; ");
    }
    if (type === "boolean") return Number(studentAns) === 0 ? '<b style="color: #1f8a4c;">✓ ĐÚNG</b>' : '<b style="color: #1f8a4c;">X SAI</b>';
    if (type === "fill") return `<code class="code" style="background: #eef6e8; padding: 2px 6px;">${esc(studentAns)}</code>`;
    if (type === "match") {
      const pairs = q.pairs || [];
      const pairedMap = typeof studentAns === "object" ? studentAns : {};
      return Object.keys(pairedMap).map(k => `[${esc(pairs[Number(k)]?.left || `A${Number(k)+1}`)} ⟷ ${esc(pairs[Number(pairedMap[k])]?.right || `B${Number(pairedMap[k])+1}`)}]`).join(" &nbsp;·&nbsp; ");
    }
    if (type === "essay") return `<div style="background: #fff; border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; margin-top: 4px;">${esc(studentAns)}</div>`;
    return esc(String(studentAns));
  }

  function formatCorrectAnswer(q, esc) {
    const type = getQuestionType(q);
    if (type === "single") return `<b>${String.fromCharCode(65 + Number(q.a))}.</b> ${esc(q.opts?.[q.a] || q.a)}`;
    if (type === "multi") {
      const arr = Array.isArray(q.a) ? q.a : [q.a];
      return arr.map(idx => `<b>${String.fromCharCode(65 + Number(idx))}.</b> ${esc(q.opts?.[idx] || idx)}`).join(" &nbsp;·&nbsp; ");
    }
    if (type === "boolean") return Number(q.a) === 0 ? "✓ ĐÚNG" : "X SAI";
    if (type === "fill") {
      if (q.accepted && Array.isArray(q.accepted)) return q.accepted.map(a => `<code class="code">${esc(a)}</code>`).join(" hoặc ");
      return `<code class="code">${esc(q.a)}</code>`;
    }
    if (type === "match") return (q.pairs || []).map(p => `[${esc(p.left)} ⟷ ${esc(p.right)}]`).join(" &nbsp;·&nbsp; ");
    if (type === "essay") return "<i>(Câu tự luận - giáo viên chấm và nhận xét)</i>";
    return esc(String(q.a));
  }

  function isAnswerCorrect(q, studentAns) {
    const type = getQuestionType(q);
    if (type === "single") return studentAns !== undefined && Number(studentAns) === Number(q.a);
    if (type === "multi") {
      if (!Array.isArray(studentAns)) return false;
      const cArr = Array.isArray(q.a) ? q.a.map(Number).sort() : [];
      const sArr = studentAns.map(Number).sort();
      return JSON.stringify(cArr) === JSON.stringify(sArr);
    }
    if (type === "boolean") return studentAns !== undefined && Number(studentAns) === Number(q.a);
    if (type === "fill") {
      if (!studentAns) return false;
      const txt = norm(studentAns);
      if (q.accepted && Array.isArray(q.accepted)) return q.accepted.map(norm).includes(txt);
      return txt === norm(q.a);
    }
    if (type === "match") {
      if (!studentAns || typeof studentAns !== "object") return false;
      const pairs = q.pairs || [];
      for (let i = 0; i < pairs.length; i++) {
        if (Number(studentAns[i]) !== i) return false;
      }
      return true;
    }
    if (type === "essay") return null;
    return false;
  }

  window.TeacherViews.submissions = function (ctx) {
    const { state, esc, clsName, submissions, uiState } = ctx;
    const focusId = uiState?.teacherSubmissionFocus ?? window.__teacherSubmissionFocus ?? "";
    const focusStudentId = uiState?.teacherStudentFocus ?? window.__teacherStudentFocus ?? "";
    const visibleSubmissions = focusStudentId ? submissions.filter(s => s.studentId === focusStudentId) : submissions;
    const focusedStudent = focusStudentId ? state.users.find(u => u.id === focusStudentId) : null;

    return `<section class="card">
      <div class="row">
        <div>
          <h2>Bài nộp &amp; chấm điểm</h2>
          <p class="muted">${focusedStudent ? `Đang xem bài nộp của ${esc(focusedStudent.name)}.` : "Kiểm tra bài làm, xác nhận điểm tự động và trả phản hồi cho học sinh."}</p>
        </div>
        <div class="actions">
          <button class="secondary" data-action="export-teacher-submissions">Xuất CSV</button>
          ${focusedStudent ? '<button class="ghost" data-action="clear-student-filter">Xem tất cả</button>' : ''}
        </div>
      </div>
      ${visibleSubmissions.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Bài tập</th>
                <th>Lớp</th>
                <th>Điểm số</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${visibleSubmissions.slice().sort((a,b) => (b.at||"").localeCompare(a.at||"")).map(s => {
                const u = state.users.find(u => u.id === s.studentId);
                const a = state.assignments.find(a => a.id === s.assignmentId);
                const questions = s.questionsSnapshot || a?.questions || [];
                const autoTotal = Number(s.total) || 0;
                const autoScore = Number(s.score) || 0;
                const essayCount = Number(s.essayCount) || 0;
                const isSubmitted = s.status === "submitted";
                const isReturned = s.status === "returned" || !s.status;
                const score10 = autoTotal > 0 ? ((autoScore / autoTotal) * 10).toFixed(1) + "/10" : (essayCount > 0 ? "Chờ chấm" : "—");

                return `
                  <tr class="${focusId === s.id ? "highlight-row" : ""}">
                    <td><b>${esc(u?.name || "Học sinh không tồn tại")}</b></td>
                    <td>${esc(a?.title || "Bài tập đã lưu trữ")}</td>
                    <td>${esc(clsName(a?.classId))}</td>
                    <td>
                      <strong style="color: var(--primary); font-size: 15px;">${autoScore}/${autoTotal}</strong>
                      ${essayCount > 0 ? `<span class="muted" style="font-size: 12px; display: block;">+ ${essayCount} câu tự luận</span>` : `<span class="muted" style="font-size: 13px;">(${score10})</span>`}
                    </td>
                    <td>
                      <span class="pill ${isReturned ? "" : "off"}">
                        ${s.late ? "Nộp trễ · " : ""}${isSubmitted ? "⏳ Chờ chấm TL" : "Đã trả bài"}
                      </span>
                    </td>
                    <td>
                      <button class="small secondary" data-action="toggle-grade" data-id="${s.id}">
                        ${focusId === s.id ? "Đang chọn" : isReturned ? "Xem / Sửa điểm" : "Chấm / Phản hồi"}
                      </button>
                    </td>
                  </tr>
                  ${focusId === s.id ? `
                    <tr>
                      <td colspan="6">
                        <div class="grade-panel">
                          <h3>Chi tiết bài nộp &amp; Tự động chấm điểm</h3>
                          <p class="muted">
                            Nộp lúc: ${esc(s.at ? new Date(s.at).toLocaleString("vi-VN") : "—")}${s.late ? " · Nộp sau hạn" : ""}.
                            ${essayCount > 0 ? `Bài có <b>${essayCount} câu tự luận</b> — cho điểm từng câu ở bên dưới, sau đó bấm lưu.` : "Hệ thống đã tự động chấm các câu trắc nghiệm."}
                          </p>

                          ${questions.length ? `
                            <div class="submitted-answers" style="margin: 14px 0;">
                              ${questions.map((q, i) => {
                                const ans = s.answers?.[i];
                                const correct = isAnswerCorrect(q, ans);
                                const isEssay = getQuestionType(q) === "essay";
                                const maxPts = Number(q.points || 1);
                                const savedEssayScore = s.manualScores?.[i] !== undefined ? s.manualScores[i] : 0;

                                let statusBadge = "";
                                if (isEssay) {
                                  statusBadge = '<span class="pill" style="background: #fff8db; color: #705300;">📝 Tự luận (Cho điểm bên dưới)</span>';
                                } else if (correct) {
                                  statusBadge = '<span class="pill" style="background: #e8f9e6; color: #176035;">✓ Tự động chấm: Đúng (+1đ)</span>';
                                } else {
                                  statusBadge = '<span class="pill off">✗ Tự động chấm: Chưa đúng (0đ)</span>';
                                }

                                return `
                                  <div class="question" style="background: #fff; margin: 10px 0; padding: 14px; border-radius: 12px; border: 1.5px solid var(--border);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                      <b>Câu ${i + 1}. ${esc(q.q)}</b>
                                      <div>${statusBadge}</div>
                                    </div>
                                    <div style="padding: 10px 14px; background: #ffffff; border: 1.5px solid var(--border); border-radius: 10px; margin: 8px 0;">
                                      <span class="muted" style="font-size: 12.5px; display: block; margin-bottom: 2px;">Câu trả lời của em:</span>
                                      <div>${formatStudentAnswer(q, ans, esc)}</div>
                                    </div>
                                    ${!correct && !isEssay ? `
                                      <div style="padding: 10px 14px; background: #f0faf0; border: 1.5px solid #a3dd9e; border-radius: 10px; color: #156d3b; margin: 8px 0;">
                                        <span style="font-size: 12.5px; font-weight: 700; display: block; margin-bottom: 2px;">👉 Đáp án đúng:</span>
                                        <div>${formatCorrectAnswer(q, esc)}</div>
                                      </div>
                                    ` : ""}
                                    ${isEssay ? `
                                      <div style="margin-top: 10px; padding: 10px; background: #fffbec; border-radius: 8px; border: 1px solid #f0d060;">
                                        <label for="essay-score-${s.id}-${i}" style="font-weight: 700; font-size: 13px;">
                                          Điểm câu tự luận này (0 – ${maxPts}):
                                        </label>
                                        <input id="essay-score-${s.id}-${i}" type="number" min="0" max="${maxPts}" step="0.5"
                                          value="${savedEssayScore}" style="width: 80px; margin-left: 8px;">
                                      </div>
                                    ` : ""}
                                  </div>
                                `;
                              }).join("")}
                            </div>
                          ` : ""}

                          <div class="form-grid">
                            ${essayCount === 0 ? `
                              <div>
                                <label for="grade-score-${s.id}">Điểm tổng kết (tối đa ${autoTotal})</label>
                                <input id="grade-score-${s.id}" type="number" min="0" max="${autoTotal}" step="0.5" value="${autoScore}">
                              </div>
                            ` : `
                              <div>
                                <p class="muted" style="font-size: 13px; margin: 0;">Điểm tự động: <b>${autoScore}/${autoTotal}</b> · Điểm tự luận: nhập ở từng câu bên trên.</p>
                              </div>
                            `}
                            <div class="wide">
                              <label for="grade-feedback-${s.id}">Lời khen &amp; Nhận xét của cô dành cho học sinh</label>
                              <textarea id="grade-feedback-${s.id}" rows="3" placeholder="Ghi nhận xét, lời khen hoặc hướng dẫn học sinh cải thiện...">${esc(s.feedback || "")}</textarea>
                            </div>
                          </div>

                          <div class="actions" style="margin-top: 14px;">
                            <button data-action="save-grade" data-id="${s.id}">
                              ${isReturned ? "Lưu cập nhật điểm" : "Lưu điểm &amp; Trả bài ngay"}
                            </button>
                            <button class="ghost" data-action="close-grade">Đóng chi tiết</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ` : ""}
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty">Chưa có bài nộp trong các lớp được phân công.</div>'}
    </section>`;
  };
})();
