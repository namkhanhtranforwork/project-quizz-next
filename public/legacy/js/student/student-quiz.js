/**
 * Lớp học của cô - Student Quiz View (Hỗ trợ đa dạng câu hỏi & thanh tiến độ)
 */
(() => {
  "use strict";
  window.StudentViews = window.StudentViews || {};

  // Hàm chuẩn hóa loại câu hỏi
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

  const TYPE_LABELS = {
    single: { text: "Trắc nghiệm 1 đáp án", class: "badge-single", icon: "🔘" },
    multi: { text: "Chọn nhiều đáp án", class: "badge-multi", icon: "☑️" },
    boolean: { text: "Đúng / Sai", class: "badge-boolean", icon: "⚖️" },
    fill: { text: "Điền vào chỗ trống", class: "badge-fill", icon: "✍️" },
    match: { text: "Nối cột ghép đôi", class: "badge-match", icon: "🔗" },
    essay: { text: "Tự luận", class: "badge-essay", icon: "📝" }
  };

  // Kiểm tra xem câu hỏi đã được trả lời chưa
  function isQuestionAnswered(q, ans) {
    if (ans === undefined || ans === null) return false;
    const type = getQuestionType(q);
    if (type === "single" || type === "boolean") return typeof ans === "number" && ans >= 0;
    if (type === "multi") return Array.isArray(ans) && ans.length > 0;
    if (type === "fill" || type === "essay") return String(ans).trim().length > 0;
    if (type === "match") return typeof ans === "object" && Object.keys(ans).length > 0;
    return false;
  }

  function prepareShuffledOptions(questions, savedOrder, random = Math.random) {
    const preparedQuestions = JSON.parse(JSON.stringify(questions || []));
    const preparedOrder = [];

    preparedQuestions.forEach((question, questionIndex) => {
      const type = getQuestionType(question);
      const optionCount = question.opts?.length || 0;
      if (!["single", "multi"].includes(type) || optionCount < 2) {
        preparedOrder[questionIndex] = null;
        return;
      }

      const previousOrder = savedOrder?.[questionIndex];
      const isValidOrder = Array.isArray(previousOrder) &&
        previousOrder.length === optionCount &&
        new Set(previousOrder).size === optionCount &&
        previousOrder.every(index => Number.isInteger(index) && index >= 0 && index < optionCount);
      const order = isValidOrder ? [...previousOrder] : Array.from({ length: optionCount }, (_, index) => index);
      if (!isValidOrder) {
        for (let index = order.length - 1; index > 0; index--) {
          const swapIndex = Math.floor(random() * (index + 1));
          [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
        }
      }

      question.opts = order.map(index => question.opts[index]);
      if (Array.isArray(question.a)) {
        question.a = question.a.map(index => order.indexOf(Number(index)));
      } else if (Number.isInteger(Number(question.a))) {
        question.a = order.indexOf(Number(question.a));
      }
      preparedOrder[questionIndex] = order;
    });

    return { questions: preparedQuestions, order: preparedOrder };
  }

  window.StudentViews.prepareShuffledOptions = prepareShuffledOptions;

  window.StudentViews.quiz = ({ esc, clsName, currentQuiz, answers, uiState }) => {
    const questions = currentQuiz.questions || [];
    const totalCount = questions.length;
    let answeredCount = 0;

    questions.forEach((q, i) => {
      if (isQuestionAnswered(q, answers[i])) answeredCount++;
    });

    const progressPercent = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0;
    const duration = currentQuiz.durationMinutes ? Number(currentQuiz.durationMinutes) : 0;

    // Quản lý timer đếm ngược nếu có durationMinutes
    if (duration > 0 && typeof window !== "undefined") {
      const timerKey = `timer_start:${currentQuiz.id}`;
      let startTime = Number(sessionStorage.getItem(timerKey));
      if (!startTime) {
        startTime = Date.now();
        sessionStorage.setItem(timerKey, String(startTime));
      }
      const totalSeconds = duration * 60;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remainSeconds = Math.max(0, totalSeconds - elapsedSeconds);

      if (window._quizTimerInterval) clearInterval(window._quizTimerInterval);
      window._quizTimerInterval = setInterval(() => {
        const el = document.getElementById("quiz-countdown");
        const curStart = Number(sessionStorage.getItem(timerKey)) || startTime;
        const curRemain = Math.max(0, totalSeconds - Math.floor((Date.now() - curStart) / 1000));
        if (el) {
          const m = Math.floor(curRemain / 60).toString().padStart(2, "0");
          const s = (curRemain % 60).toString().padStart(2, "0");
          el.textContent = `⏱️ ${m}:${s}`;
          if (curRemain <= 60) el.style.color = "#d9381e";
        }
        if (curRemain <= 0) {
          clearInterval(window._quizTimerInterval);
          sessionStorage.removeItem(timerKey);
          alert("Đã hết thời gian làm bài! Hệ thống sẽ tự động nộp bài của em.");
          const submitBtn = document.querySelector('[data-action="submit-quiz"]');
          if (submitBtn) submitBtn.click();
        }
      }, 1000);
    } else if (typeof window !== "undefined" && window._quizTimerInterval) {
      clearInterval(window._quizTimerInterval);
    }

    return `
      <section class="card">
        <!-- Header bài tập -->
        <div class="quiz-header-bar">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span class="pill">${esc(clsName ? clsName(currentQuiz.classId) : "Lớp học")}</span>
              <span class="muted" style="font-size: 13px;">Hạn: ${esc(currentQuiz.due || "Không giới hạn")}</span>
              ${duration > 0 ? `<span id="quiz-countdown" class="pill" style="background:#fff3e0;color:#e65100;font-weight:700;">⏱️ ${duration}:00</span>` : ""}
            </div>
            <h1 style="font-size: 26px; margin: 0 0 4px;">${esc(currentQuiz.title)}</h1>
            <p class="muted" style="margin: 0; font-size: 14px;">
              Tổng cộng <b>${totalCount} câu hỏi</b> · Đã làm: <b>${answeredCount}/${totalCount}</b> câu (${progressPercent}%)
            </p>
          </div>
          <div class="actions">
            <button class="ghost small" data-action="back-assignments">← Quay lại danh sách</button>
          </div>
        </div>

        <!-- Thanh tiến độ -->
        <div class="quiz-progress-track">
          <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>

        <!-- Bảng điều hướng nhanh từng câu (Jump Palette) -->
        <div class="quiz-nav-strip">
          ${questions.map((q, i) => {
            const answered = isQuestionAnswered(q, answers[i]);
            return `
              <button
                type="button"
                class="quiz-nav-btn ${answered ? 'answered' : ''}"
                data-jump-question="${i}"
                title="Câu ${i + 1}: ${answered ? 'Đã làm' : 'Chưa làm'}"
              >
                ${i + 1}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Danh sách câu hỏi đa dạng dạng bài -->
        <div class="quiz-questions-list">
          ${questions.map((q, i) => {
            const type = getQuestionType(q);
            const typeInfo = TYPE_LABELS[type] || TYPE_LABELS.single;
            const ans = answers[i];

            return `
              <article class="quiz-q-card" id="q-card-${i}">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="quiz-badge-type ${typeInfo.class}">
                    <span>${typeInfo.icon}</span>
                    <span>${typeInfo.text}</span>
                  </span>
                  <span class="muted" style="font-size: 13px; font-weight: 700;">
                    Câu ${i + 1} / ${totalCount}
                  </span>
                </div>

                <div class="quiz-q-prompt">
                  ${esc(q.q)}
                </div>

                <!-- Render theo dạng câu hỏi -->
                <div class="quiz-q-body">
                  ${renderQuestionBody(q, i, type, ans, esc)}
                </div>
              </article>
            `;
          }).join('')}
        </div>

        <!-- Thanh nút Nộp bài -->
        <div class="card" style="background: #fbfdf9; margin-top: 24px; text-align: center; border: 2px dashed var(--primary);">
          <div style="margin-bottom: 14px;">
            <p style="font-size: 15px; font-weight: 700; margin: 0 0 4px;">
              ${answeredCount === totalCount ? "🎉 Em đã hoàn thành tất cả các câu hỏi!" : `⚠️ Em còn ${totalCount - answeredCount} câu chưa trả lời.`}
            </p>
            <p class="muted" style="font-size: 13px; margin: 0;">
              Sau khi bấm nộp bài, hệ thống sẽ tự động chấm điểm và hiển thị kết quả chi tiết kèm lời giải ngay lập tức.
            </p>
          </div>
          <div class="actions" style="justify-content: center;">
            <button data-action="submit-quiz" style="font-size: 16px; padding: 12px 32px;">
              <span>🚀 Nộp bài &amp; Xem điểm ngay</span>
            </button>
          </div>
        </div>
      </section>
    `;
  };

  // Hàm render giao diện tương tác cho từng dạng câu hỏi
  function renderQuestionBody(q, i, type, ans, esc) {
    // 1. Trắc nghiệm 1 đáp án (Single choice)
    if (type === "single") {
      const opts = q.opts || [];
      return `
        <div class="quiz-options-group" role="group" aria-label="Các đáp án">
          ${opts.map((o, j) => `
            <button
              type="button"
              class="option ${ans === j ? 'selected' : ''}"
              data-answer="${i}"
              data-choice="${j}"
            >
              <b>${String.fromCharCode(65 + j)}.</b> ${esc(o)}
            </button>
          `).join('')}
        </div>
      `;
    }

    // 2. Trắc nghiệm nhiều đáp án đúng (Multi select - Checkbox)
    if (type === "multi") {
      const opts = q.opts || [];
      const selectedArr = Array.isArray(ans) ? ans : [];
      return `
        <p class="smalltext" style="color: var(--primary); font-weight: 700; margin: 0 0 8px;">
          👉 Nhấp vào ô vuông để chọn một hoặc nhiều phương án đúng:
        </p>
        <div class="quiz-options-group" role="group" aria-label="Các đáp án, có thể chọn nhiều">
          ${opts.map((o, j) => {
            const isSelected = selectedArr.includes(j);
            return `
              <button
                type="button"
                class="option-checkbox ${isSelected ? 'selected' : ''}"
                data-multi-answer="${i}"
                data-multi-choice="${j}"
              >
                <span class="check-indicator">${isSelected ? '✓' : ''}</span>
                <span><b>${String.fromCharCode(65 + j)}.</b> ${esc(o)}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    // 3. Đúng / Sai (Boolean True / False)
    if (type === "boolean") {
      return `
        <div class="quiz-tf-group">
          <button
            type="button"
            class="btn-tf btn-tf-true ${ans === 0 ? 'selected' : ''}"
            data-answer="${i}"
            data-choice="0"
          >
            <span style="font-size: 20px;">✓</span>
            <span>ĐÚNG</span>
          </button>
          <button
            type="button"
            class="btn-tf btn-tf-false ${ans === 1 ? 'selected' : ''}"
            data-answer="${i}"
            data-choice="1"
          >
            <span style="font-size: 20px;">✗</span>
            <span>SAI</span>
          </button>
        </div>
      `;
    }

    // 4. Điền vào chỗ trống (Fill in the blank)
    if (type === "fill") {
      return `
        <div class="quiz-fill-wrap">
          <label style="font-size: 13px; color: var(--muted); margin-bottom: 6px;">
            ✍️ Gõ từ hoặc số thích hợp vào ô trống dưới đây:
          </label>
          <input
            type="text"
            class="quiz-fill-input"
            data-fill-answer="${i}"
            value="${esc(ans || '')}"
            placeholder="Nhập câu trả lời của em..."
            autocomplete="off"
          />
        </div>
      `;
    }

    // 5. Nối cột ghép đôi (Matching)
    if (type === "match") {
      const pairs = q.pairs || [];
      const pairedMap = (typeof ans === "object" && ans !== null) ? ans : {};
      const activeLeft = window.uiState?.activeMatchLeft?.[i] ?? window.__activeMatchLeft?.[i];

      // Danh sách vế trái và vế phải
      const leftItems = pairs.map((p, idx) => ({ idx, text: p.left || `Vế ${idx + 1}` }));
      const rightItems = pairs.map((p, idx) => ({ idx, text: p.right || `Vế ${idx + 1}` }));

      return `
        <div class="quiz-match-wrap">
          <p class="quiz-match-instructions">
            💡 <b>Hướng dẫn ghép cặp:</b> Nhấp chọn 1 mục ở Cột A (bên trái), sau đó nhấp vào mục tương ứng ở Cột B (bên phải) để nối.
          </p>
          <div class="quiz-match-grid">
            <!-- Cột A (Trái) -->
            <div class="quiz-match-col">
              <div style="font-weight: 700; font-size: 13.5px; color: var(--primary); margin-bottom: 4px;">Cột A</div>
              ${leftItems.map(l => {
                const isSelected = activeLeft === l.idx;
                const isPaired = pairedMap[l.idx] !== undefined;
                return `
                  <div
                    class="quiz-match-item ${isSelected ? 'selected-active' : ''} ${isPaired ? 'paired-done' : ''}"
                    data-match-left="${i}"
                    data-left-idx="${l.idx}"
                  >
                    <span>${esc(l.text)}</span>
                    ${isPaired ? `<span class="quiz-match-tag">Ghép B${Number(pairedMap[l.idx]) + 1}</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Cột B (Phải) -->
            <div class="quiz-match-col">
              <div style="font-weight: 700; font-size: 13.5px; color: var(--primary); margin-bottom: 4px;">Cột B</div>
              ${rightItems.map(r => {
                // Kiểm tra xem mục phải này đã được ghép với mục trái nào chưa
                const matchedLeftIdx = Object.keys(pairedMap).find(k => Number(pairedMap[k]) === r.idx);
                const isPaired = matchedLeftIdx !== undefined;
                return `
                  <div
                    class="quiz-match-item ${isPaired ? 'paired-done' : ''}"
                    data-match-right="${i}"
                    data-right-idx="${r.idx}"
                  >
                    <span>${esc(r.text)}</span>
                    ${isPaired ? `<span class="quiz-match-tag">Ghép A${Number(matchedLeftIdx) + 1}</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          ${Object.keys(pairedMap).length > 0 ? `
            <div style="margin-top: 10px;">
              <button type="button" class="ghost small" data-reset-match="${i}">↺ Ghép lại câu này</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    // 6. Câu hỏi tự luận (Short essay)
    if (type === "essay") {
      return `
        <div class="quiz-essay-wrap">
          <label style="font-size: 13px; color: var(--muted); margin-bottom: 6px;">
            📝 Viết câu trả lời tự luận của em (giáo viên sẽ chấm điểm và nhận xét chi tiết):
          </label>
          <textarea
            class="quiz-essay-textarea"
            data-essay-answer="${i}"
            placeholder="Em hãy gõ câu trả lời của mình tại đây..."
            rows="4"
          >${esc(ans || '')}</textarea>
        </div>
      `;
    }

    return "";
  }
})();
