/**
 * Lớp học của cô - Student Shell Controller
 */
(() => {
  "use strict";
  window.StudentViews = window.StudentViews || {};

  window.StudentViews.render = ctx => {
    const { app, state, session, esc, clsName, currentUserName, activeTab, currentQuiz, answers, lastResult } = ctx;
    const student = state.users.find(u => u.id === session.id);
    const studentClassIds = student
      ? (window.Core?.getStudentClassIds?.(state, student.id) || student.classIds || [])
      : [];
    const classes = state.classes.filter(c => studentClassIds.includes(c.id));
    const assignments = state.assignments.filter(a => !a.archived && classes.some(c => c.id === a.classId));

    const submittedCount = assignments.filter(a => state.submissions.some(s => s.assignmentId === a.id && s.studentId === session.id)).length;
    const assignmentsById = new Map(state.assignments.map(assignment => [assignment.id, assignment]));
    const leaderboardFor = (studentIds, classId = null, includedAssignmentIds = null) => {
      const pointsByStudent = new Map();
      state.submissions.forEach(submission => {
        if (submission.status && submission.status !== "returned") return;
        if (includedAssignmentIds && !includedAssignmentIds.has(submission.assignmentId)) return;
        if (classId && assignmentsById.get(submission.assignmentId)?.classId !== classId) return;
        const score = Number(submission.score);
        const total = Number(submission.total);
        if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return;
        const result = pointsByStudent.get(submission.studentId) || { points: 0, completed: 0 };
        result.points += score;
        result.completed += 1;
        pointsByStudent.set(submission.studentId, result);
      });

      const ranked = [...new Set(studentIds)]
        .map(id => state.users.find(user => user.id === id && user.role === "student" && user.active !== false))
        .filter(Boolean)
        .map(user => ({
          id: user.id,
          name: user.name || "Học sinh",
          ...(pointsByStudent.get(user.id) || { points: 0, completed: 0 })
        }))
        .sort((a, b) => b.points - a.points || b.completed - a.completed || a.name.localeCompare(b.name, "vi"));

      let previous;
      let rank = 0;
      return ranked.map((entry, index) => {
        if (!previous || entry.points !== previous.points || entry.completed !== previous.completed) {
          rank = index + 1;
        }
        previous = entry;
        return { ...entry, rank };
      });
    };
    const renderLeaderboard = (title, rows) => {
      const topRows = rows.slice(0, 10);
      const ownRow = rows.find(row => row.id === session.id);
      if (ownRow && !topRows.some(row => row.id === ownRow.id)) topRows.push(ownRow);
      return `<section class="card student-leaderboard-card">
        <div class="row"><div><h2>${esc(title)}</h2><p class="muted">Tổng điểm từ các bài đã chấm; bài chờ chấm không tính. Nếu bằng điểm, bạn hoàn thành nhiều bài đã chấm hơn sẽ xếp trên.</p></div><span class="pill">${rows.length} học sinh</span></div>
        ${topRows.length ? `<div class="table-wrap"><table class="student-leaderboard-table"><thead><tr><th>Hạng</th><th>Học sinh</th><th>Tổng điểm</th><th>Bài đã chấm</th></tr></thead><tbody>${topRows.map(row => `<tr class="${row.id === session.id ? "is-current-student" : ""}"><td><span class="student-rank-badge">${row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}</span></td><td>${esc(row.name)}${row.id === session.id ? ' <span class="student-you-label">Bạn</span>' : ""}</td><td><strong>${row.points.toLocaleString("vi-VN")}</strong></td><td>${row.completed}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Chưa có học sinh để xếp hạng.</p>'}
      </section>`;
    };
    const classLeaderboards = classes.map(cls => {
      const ids = window.Core?.getClassStudentIds?.(state, cls.id)
        || state.users.filter(user => user.role === "student" && (user.classIds || []).includes(cls.id)).map(user => user.id);
      return renderLeaderboard(`🏫 Lớp ${cls.name}`, leaderboardFor(ids, cls.id));
    }).join("");
    const schoolStudentIds = state.users.filter(user => user.role === "student" && user.active !== false).map(user => user.id);
    const schoolCompetition = state.schoolCompetition;
    const schoolCompetitionAssignmentIds = new Set(
      Array.isArray(schoolCompetition?.assignmentIds) ? schoolCompetition.assignmentIds : []
    );
    const leaderboardBody = `<div class="student-leaderboards">
      ${classLeaderboards || '<section class="card"><p class="empty">Em chưa được xếp vào lớp nào nên chưa có bảng xếp hạng lớp.</p></section>'}
      ${schoolCompetition?.active && schoolCompetitionAssignmentIds.size
        ? renderLeaderboard(`🏆 ${schoolCompetition.name || "Cuộc thi cấp trường"}`, leaderboardFor(schoolStudentIds, null, schoolCompetitionAssignmentIds))
        : ""}
    </div>`;
    let body;
    if (activeTab === "results") {
      body = window.StudentViews.results(ctx);
    } else if (activeTab === "leaderboard") {
      body = leaderboardBody;
    } else if (currentQuiz) {
      body = window.StudentViews.quiz(ctx);
    } else {
      body = `
        <div class="student-assignment-grid">
          ${assignments.map(a => {
            const hasSubmitted = state.submissions.some(s => s.assignmentId === a.id && s.studentId === session.id);
            const mySub = state.submissions.find(s => s.assignmentId === a.id && s.studentId === session.id);

            return `
              <section class="card student-assignment-card">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <span class="pill">${esc(clsName(a.classId))}</span>
                    ${hasSubmitted ? '<span class="pill" style="background: #e8f9e6; color: #176035;">✓ Đã nộp bài</span>' : ''}
                  </div>
                  <h2 style="font-size: 20px; margin: 0 0 8px;">${esc(a.title)}</h2>
                  <p class="muted" style="font-size: 13.5px; margin: 0 0 12px;">
                    📝 ${a.questions?.length || 0} câu hỏi · Hạn: ${esc(a.due || "Không giới hạn")}
                  </p>
                  ${hasSubmitted && mySub ? `
                    <div style="background: var(--primary-soft); padding: 8px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 12px;">
                      ${mySub.status === "submitted"
                        ? `⏳ <b>Chờ cô chấm tự luận</b> · Điểm tự động: <b>${mySub.score}/${mySub.total}</b>`
                        : `Điểm: <b>${mySub.score}/${mySub.total}</b>${mySub.total ? ` (${((mySub.score / mySub.total) * 10).toFixed(1)}/10)` : ""}`
                      }
                    </div>
                  ` : ""}
                </div>

                <div class="actions" style="margin-top: 10px;">
                  ${hasSubmitted ? `
                    <button class="secondary" data-action="view-student-review" data-id="${esc(mySub?.id)}">
                      🔍 Xem lại bài &amp; lời giải
                    </button>
                  ` : `
                    <button data-action="start-quiz" data-id="${esc(a.id)}">
                      ✍️ Bắt đầu làm bài
                    </button>
                  `}
                </div>
              </section>
            `;
          }).join("") || '<section class="card empty student-assignment-empty">Chưa có bài tập nào được giao cho lớp của bạn.</section>'}
        </div>
      `;
    }

    app.innerHTML = `
      <header class="workspace-heading">
        <div><p class="eyebrow">GÓC HỌC TẬP CỦA EM</p>
          <h1>${activeTab === "results" ? "Kết quả của tôi" : activeTab === "leaderboard" ? "Bảng xếp hạng" : currentQuiz ? "Đang làm bài" : "Bài tập của em"}</h1>
          <p class="muted">${activeTab === "leaderboard" ? `Chào ${esc(currentUserName())}! Cùng xem thứ hạng của em trong lớp và toàn trường.` : `Chào ${esc(currentUserName())}! Em chỉ xem bài tập và kết quả của chính mình.`}</p>
        </div><span class="workspace-role-chip">🎒 Học sinh</span>
      </header>

      <nav class="tabs workspace-tabs" aria-label="Điều hướng học sinh">
        <button class="${activeTab !== 'results' && activeTab !== 'leaderboard' ? 'active' : ''}" data-tab="student-home">
          📚 Danh sách bài tập
        </button>
        <button class="${activeTab === 'results' ? 'active' : ''}" data-tab="results">
          🏆 Kết quả của tôi
        </button>
        <button class="${activeTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
          🥇 Bảng xếp hạng
        </button>
      </nav>
      ${activeTab === "overview" && !currentQuiz ? `<section class="student-summary" aria-label="Tóm tắt bài tập"><span><b>${assignments.length}</b> bài được giao</span><span><b>${assignments.length - submittedCount}</b> chưa nộp</span><span><b>${submittedCount}</b> đã nộp</span></section><h2 class="workspace-section-title">Danh sách bài tập</h2>` : ""}
      <div class="workspace-content">${body}</div>
    `;
  };
})();
