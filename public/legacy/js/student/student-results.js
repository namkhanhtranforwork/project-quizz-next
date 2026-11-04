/**
 * Lớp học của cô - Student Results View (Bảng điểm & Xem lại chi tiết từng bài làm)
 */
(() => {
  "use strict";
  window.StudentViews = window.StudentViews || {};

  window.StudentViews.results = ({ state, session, esc, clsName, uiState }) => {
    const focusSubId = uiState?.studentReviewSubId ?? window.__studentReviewSubId ?? "";
    if (focusSubId) {
      const sub = state.submissions.find(s => s.id === focusSubId);
      if (sub) {
        const assignment = state.assignments.find(a => a.id === sub.assignmentId);
        return `
          <div style="margin-bottom: 14px;">
            <button class="ghost small" data-action="close-student-review">← Quay lại danh sách kết quả</button>
          </div>
          ${window.StudentViews.renderReview({
            result: sub,
            assignmentTitle: assignment?.title || "Bài kiểm tra",
            esc
          })}
        `;
      }
    }

    const rows = state.submissions
      .filter(s => s.studentId === session.id)
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""));

    return `
      <section class="card">
        <div class="row">
          <div>
            <h2>Kết quả học tập của tôi</h2>
            <p class="muted">Theo dõi điểm số, thời gian nộp bài và xem lại chi tiết bài làm:</p>
          </div>
        </div>

        ${rows.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bài tập</th>
                  <th>Lớp</th>
                  <th>Kết quả tự động</th>
                  <th>Thời gian nộp</th>
                  <th>Nhận xét của cô</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(s => {
                  const assignment = state.assignments.find(a => a.id === s.assignmentId);
                  const returned = s.status === "returned" || !s.status;
                  const total = Number(s.total) || 0;
                  const score = Number(s.score) || 0;
                  const score10 = total > 0 ? ((score / total) * 10).toFixed(1) + "/10" : "—";

                  return `
                    <tr>
                      <td>
                        <b>${esc(assignment?.title || "Bài đã lưu trữ")}</b>
                        ${s.late ? '<span class="pill off" style="margin-left: 6px;">Nộp trễ</span>' : ''}
                      </td>
                      <td>${esc(clsName ? clsName(assignment?.classId) : "—")}</td>
                      <td>
                        <strong style="color: var(--primary); font-size: 15px;">${score}/${total}</strong>
                        <span class="muted" style="font-size: 13px;">(${score10})</span>
                      </td>
                      <td>${esc(s.at ? new Date(s.at).toLocaleString("vi-VN") : "—")}</td>
                      <td>
                        ${s.feedback ? `<span style="color: #176035;">${esc(s.feedback)}</span>` : '<span class="muted">Chưa có nhận xét</span>'}
                      </td>
                      <td>
                        <button class="small secondary" data-action="view-student-review" data-id="${esc(s.id)}">
                          🔍 Xem lời giải
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty">
            <p>Bạn chưa nộp bài nào.</p>
            <button class="secondary" data-tab="student-home">Xem danh sách bài tập để làm bài →</button>
          </div>
        `}
      </section>
    `;
  };
})();
