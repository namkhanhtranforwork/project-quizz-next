/**
 * Lớp học của cô - Student Result Message & Auto-Grading Review View
 */
(() => {
  "use strict";
  window.StudentViews = window.StudentViews || {};

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

  // Kiểm tra đáp án đúng theo từng dạng câu hỏi
  function checkAnswer(q, studentAns) {
    const type = getQuestionType(q);

    if (type === "single") {
      return studentAns !== undefined && Number(studentAns) === Number(q.a);
    }

    if (type === "multi") {
      if (!Array.isArray(studentAns)) return false;
      const correctArr = Array.isArray(q.a) ? q.a.map(Number).sort() : [];
      const userArr = studentAns.map(Number).sort();
      return JSON.stringify(correctArr) === JSON.stringify(userArr);
    }

    if (type === "boolean") {
      return studentAns !== undefined && Number(studentAns) === Number(q.a);
    }

    if (type === "fill") {
      if (!studentAns) return false;
      const userText = norm(studentAns);
      if (q.accepted && Array.isArray(q.accepted)) {
        return q.accepted.map(norm).includes(userText);
      }
      return userText === norm(q.a);
    }

    if (type === "match") {
      if (!studentAns || typeof studentAns !== "object") return false;
      const pairs = q.pairs || [];
      if (!pairs.length) return false;
      // Mọi mục đều phải được nối đúng với cặp ban đầu (idx = idx)
      for (let i = 0; i < pairs.length; i++) {
        if (Number(studentAns[i]) !== i) return false;
      }
      return true;
    }

    if (type === "essay") {
      return null; // Chờ giáo viên chấm
    }

    return false;
  }

  // Hiển thị nội dung đáp án học sinh đã chọn
  function formatStudentAnswer(q, studentAns, esc) {
    const type = getQuestionType(q);
    if (studentAns === undefined || studentAns === null || studentAns === "") {
      return '<span class="muted" style="color: #b8322a;">(Em chưa trả lời câu này)</span>';
    }

    if (type === "single") {
      const opt = q.opts?.[studentAns];
      return `<b>${String.fromCharCode(65 + Number(studentAns))}.</b> ${esc(opt || studentAns)}`;
    }

    if (type === "multi") {
      if (!Array.isArray(studentAns) || !studentAns.length) return '<span class="muted">(Chưa chọn phương án nào)</span>';
      return studentAns.map(idx => `<b>${String.fromCharCode(65 + Number(idx))}.</b> ${esc(q.opts?.[idx] || idx)}`).join(" &nbsp;·&nbsp; ");
    }

    if (type === "boolean") {
      return Number(studentAns) === 0
        ? '<b style="color: #1f8a4c;">✓ ĐÚNG</b>'
        : '<b style="color: #1f8a4c;">X SAI</b>';
    }

    if (type === "fill") {
      return `<code class="code" style="background: #eef6e8; padding: 3px 8px; border-radius: 6px;">${esc(studentAns)}</code>`;
    }

    if (type === "match") {
      const pairs = q.pairs || [];
      const pairedMap = typeof studentAns === "object" ? studentAns : {};
      return Object.keys(pairedMap).map(k => {
        const leftText = pairs[Number(k)]?.left || `A${Number(k) + 1}`;
        const rightText = pairs[Number(pairedMap[k])]?.right || `B${Number(pairedMap[k]) + 1}`;
        return `[${esc(leftText)} ⟷ ${esc(rightText)}]`;
      }).join(" &nbsp;·&nbsp; ");
    }

    if (type === "essay") {
      return `<div style="background: #fffef8; border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; margin-top: 4px;">${esc(studentAns)}</div>`;
    }

    return esc(String(studentAns));
  }

  // Hiển thị đáp án đúng của đề bài
  function formatCorrectAnswer(q, esc) {
    const type = getQuestionType(q);

    if (type === "single") {
      const opt = q.opts?.[q.a];
      return `<b>${String.fromCharCode(65 + Number(q.a))}.</b> ${esc(opt || q.a)}`;
    }

    if (type === "multi") {
      const correctArr = Array.isArray(q.a) ? q.a : [q.a];
      return correctArr.map(idx => `<b>${String.fromCharCode(65 + Number(idx))}.</b> ${esc(q.opts?.[idx] || idx)}`).join(" &nbsp;·&nbsp; ");
    }

    if (type === "boolean") {
      return Number(q.a) === 0 ? "✓ ĐÚNG" : "X SAI";
    }

    if (type === "fill") {
      if (q.accepted && Array.isArray(q.accepted)) {
        return q.accepted.map(a => `<code class="code">${esc(a)}</code>`).join(" hoặc ");
      }
      return `<code class="code">${esc(q.a)}</code>`;
    }

    if (type === "match") {
      const pairs = q.pairs || [];
      return pairs.map(p => `[${esc(p.left)} ⟷ ${esc(p.right)}]`).join(" &nbsp;·&nbsp; ");
    }

    if (type === "essay") {
      return "<i>(Câu hỏi tự luận - giáo viên sẽ chấm điểm và nhận xét)</i>";
    }

    return esc(String(q.a));
  }

  window.StudentViews.renderReview = ({ result, assignmentTitle, esc }) => {
    const questions = result.questionsSnapshot || [];
    const total = Number(result.total) || questions.length || 0;
    const score = Number(result.score) || 0;
    const score10 = total > 0 ? ((score / total) * 10).toFixed(1) : "0.0";
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    let mascotBadge = "🌟 Xuất sắc! Em làm bài rất cừ khôi!";
    if (percent < 50) mascotBadge = "🌱 Cố gắng lên nhé! Đọc kỹ lời giải chi tiết bên dưới để nắm chắc bài hơn!";
    else if (percent < 70) mascotBadge = "💪 Khá tốt! Hãy ôn lại các câu chưa đúng để tiến bộ nhé!";
    else if (percent < 90) mascotBadge = "👏 Rất tốt! Tiếp tục phát huy thành tích này em nhé!";

    return `
      <section class="card">
        <!-- Hero tổng kết điểm -->
        <div class="quiz-result-hero">
          <div class="quiz-score-badge">
            <span class="quiz-score-big">${score10}</span>
            <span class="quiz-score-max">thang điểm 10</span>
          </div>

          <h2 style="font-size: 26px; margin: 0 0 6px; color: var(--primary);">
            🎉 Hoàn thành bài kiểm tra!
          </h2>
          <p style="font-size: 16px; font-weight: 700; color: #176035; margin: 0 0 16px;">
            ${mascotBadge}
          </p>

          <div class="stats" style="max-width: 650px; margin: 0 auto 16px;">
            <div class="stat">
              <strong>${score}/${total}</strong>
              <span class="muted">Số câu đúng</span>
            </div>
            <div class="stat">
              <strong>${percent}%</strong>
              <span class="muted">Độ chính xác</span>
            </div>
            <div class="stat">
              <strong>${result.late ? "Nộp trễ" : "Đúng hạn"}</strong>
              <span class="muted">${new Date(result.at || Date.now()).toLocaleTimeString("vi-VN")}</span>
            </div>
          </div>

          ${result.feedback ? `
            <div class="notice info" style="max-width: 650px; margin: 12px auto; text-align: left;">
              <b>💬 Lời nhận xét:</b> ${esc(result.feedback)}
            </div>
          ` : ''}

          <div class="actions" style="justify-content: center; margin-top: 16px;">
            <button data-action="back-assignments">← Quay lại danh sách bài tập</button>
            <button class="secondary" data-tab="results">Xem bảng điểm cá nhân</button>
          </div>
        </div>

        <!-- Chi tiết bài làm từng câu -->
        <div style="margin-top: 24px;">
          <div class="row">
            <div>
              <h3 style="font-size: 20px; margin: 0;">🔍 Chi tiết từng câu hỏi &amp; Lời giải</h3>
              <p class="muted" style="margin: 4px 0 0;">
                Kiểm tra câu đúng, câu sai và đối chiếu với đáp án chính xác:
              </p>
            </div>
          </div>

          <div class="quiz-review-list" style="margin-top: 16px;">
            ${questions.map((q, i) => {
              const studentAns = result.answers?.[i];
              const isCorrect = checkAnswer(q, studentAns);
              const isEssay = getQuestionType(q) === "essay";

              let itemClass = "quiz-review-item";
              let badgeHtml = "";

              if (isEssay) {
                itemClass += "";
                badgeHtml = '<span class="review-badge-status badge-status-essay">📝 Câu tự luận (Đã ghi nhận bài làm)</span>';
              } else if (isCorrect) {
                itemClass += " is-correct";
                badgeHtml = '<span class="review-badge-status badge-status-correct">✓ Chính xác (+1 điểm)</span>';
              } else {
                itemClass += " is-wrong";
                badgeHtml = '<span class="review-badge-status badge-status-wrong">✗ Chưa chính xác (0 điểm)</span>';
              }

              return `
                <article class="${itemClass}">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div>${badgeHtml}</div>
                    <span class="muted" style="font-size: 13px; font-weight: 700;">Câu ${i + 1}</span>
                  </div>

                  <div class="quiz-q-prompt" style="margin-bottom: 12px;">
                    ${esc(q.q)}
                  </div>

                  <!-- Câu trả lời của học sinh -->
                  <div style="padding: 10px 14px; background: #ffffff; border: 1.5px solid var(--border); border-radius: 10px; margin-bottom: 8px;">
                    <span class="muted" style="font-size: 12.5px; display: block; margin-bottom: 2px;">Câu trả lời của em:</span>
                    <div>${formatStudentAnswer(q, studentAns, esc)}</div>
                  </div>

                  <!-- Đáp án đúng nếu làm sai -->
                  ${!isCorrect && !isEssay ? `
                    <div style="padding: 10px 14px; background: #f0faf0; border: 1.5px solid #a3dd9e; border-radius: 10px; color: #156d3b;">
                      <span style="font-size: 12.5px; font-weight: 700; display: block; margin-bottom: 2px;">👉 Đáp án đúng:</span>
                      <div>${formatCorrectAnswer(q, esc)}</div>
                    </div>
                  ` : ''}

                  <!-- Lời giải thích nếu có -->
                  ${q.explanation ? `
                    <div style="margin-top: 8px; font-size: 13px; color: #665000; background: #fffadc; padding: 8px 12px; border-radius: 8px;">
                      💡 <b>Lời giải:</b> ${esc(q.explanation)}
                    </div>
                  ` : ''}
                </article>
              `;
            }).join('')}
          </div>

          <div class="actions" style="justify-content: center; margin-top: 24px;">
            <button data-action="back-assignments">← Hoàn tất &amp; Về danh sách bài tập</button>
          </div>
        </div>
      </section>
    `;
  };

  window.StudentViews.resultMessage = ({ app, lastResult, state, esc }) => {
    const assignment = state.assignments.find(a => a.id === lastResult?.assignmentId);
    app.innerHTML = window.StudentViews.renderReview({
      result: lastResult,
      assignmentTitle: assignment?.title || "Bài kiểm tra",
      esc
    });
  };
})();
