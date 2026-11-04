/* Teacher grading workflow. Shared state/actions are injected by app.js. */
(function () {
  "use strict";
  window.TeacherGrading = {
    save(ctx) {
      const { id, state, session, allowedClass, persist, log, toast, render, setFocus, setActiveTab } = ctx;
      const sub = state.submissions.find(s => s.id === id || (s.id == null && `${s.studentId}|${s.assignmentId}|${s.at}` === id));
      if (!sub) { toast("Không tìm thấy bài nộp."); return; }
      const assignment = state.assignments.find(a => a.id === sub.assignmentId);
      if (!assignment || !allowedClass(state.classes.find(c => c.id === assignment.classId))) { toast("Bạn không có quyền chấm bài này."); return; }

      // Collect per-essay scores
      const questions = sub.questionsSnapshot || assignment.questions || [];
      const manualScores = {};
      let manualTotal = 0;
      questions.forEach((q, i) => {
        const type = q.type || (Array.isArray(q.a) && q.a.length > 1 ? "multi" : (!q.opts || !q.opts.length ? (q.pairs ? "match" : q.a ? "fill" : "essay") : "single"));
        if (type === "essay") {
          const el = document.getElementById(`essay-score-${id}-${i}`);
          const maxPts = Number(q.points || 1);
          const pts = el ? Math.min(Math.max(Number(el.value) || 0, 0), maxPts) : 0;
          manualScores[i] = pts;
          manualTotal += pts;
        }
      });

      const autoScore = Number(sub.score) || 0; // preserved from submission
      const essayCount = sub.essayCount || 0;

      // If there are essay questions, total score = auto + manual
      let finalScore, finalTotal;
      if (essayCount > 0) {
        // autoTotal is stored in sub.total (no essays), manual essays get separate points
        const essayMaxTotal = Object.keys(manualScores).reduce((sum, i) => {
          const q = questions[Number(i)];
          return sum + Number(q?.points || 1);
        }, 0);
        finalScore = autoScore + manualTotal;
        finalTotal = (sub.total || 0) + essayMaxTotal;
      } else {
        // Fallback: read from score input (backward compat)
        const scoreEl = document.getElementById(`grade-score-${id}`);
        finalScore = Number(scoreEl?.value);
        finalTotal = Number(sub.total) || 0;
        if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > finalTotal) {
          toast(`Điểm phải từ 0 đến ${finalTotal}.`); return;
        }
      }

      const feedbackEl = document.getElementById(`grade-feedback-${id}`);
      const feedback = (feedbackEl?.value || "").trim();
      const wasReturned = sub.status === "returned";
      if (wasReturned && (finalScore !== Number(sub.score) || feedback !== (sub.feedback || "")) &&
          !window.confirm("Bài này đã được trả cho học sinh. Lưu thay đổi điểm/nhận xét và ghi vào lịch sử chấm?")) return;
      const previous = { score: Number(sub.score) || 0, feedback: sub.feedback || "", gradedAt: sub.gradedAt || "" };
      if (wasReturned && (finalScore !== previous.score || feedback !== previous.feedback)) {
        sub.gradeHistory = sub.gradeHistory || [];
        sub.gradeHistory.push({ ...previous, changedBy: session.id, changedAt: new Date().toISOString() });
      }
      if (essayCount > 0) {
        sub.manualScores = manualScores;
        sub.total = finalTotal;
      }
      sub.score = finalScore; sub.feedback = feedback; sub.status = "returned";
      sub.gradedBy = session.id; sub.gradedAt = new Date().toISOString(); sub.returnedAt = sub.gradedAt;
      persist(); log(wasReturned ? "UPDATE_RETURNED_GRADE" : "GRADE_AND_RETURN_SUBMISSION", { submissionId: id, assignmentId: sub.assignmentId, studentId: sub.studentId, score: finalScore, total: finalTotal, previousScore: wasReturned ? previous.score : undefined });
      setFocus(""); setActiveTab("submissions"); render(); toast("Đã lưu điểm và trả bài cho học sinh.", true);
    }
  };
})();
