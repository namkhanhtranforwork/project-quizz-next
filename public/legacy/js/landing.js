/**
 * Lớp học của cô - Landing Page V2 Interactive Logic
 * Quản lý trạng thái và trải nghiệm tương tác trên trang chủ
 */

(() => {
  "use strict";

  const Core = window.Core || {};
  const STORE_KEY = Core.STORE_KEY || "lhcc_v2_state";
  const SESSION_KEY = Core.SESSION_KEY || "lhcc_v2_session";

  function loadState() {
    if (Core.loadState) {
      try {
        return Core.loadState();
      } catch (error) {
        showToast(error.message, false);
        throw error;
      }
    }
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return Object.assign(
        { users: [], classes: [], assignments: [], submissions: [], audit: [] },
        data
      );
    } catch {
      return { users: [], classes: [], assignments: [], submissions: [], audit: [] };
    }
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  // Cập nhật thông số thống kê trực tiếp
  function updateLiveStats() {
    const state = loadState();
    const classCountEl = document.getElementById("stat-classes");
    const studentCountEl = document.getElementById("stat-students");
    const teacherCountEl = document.getElementById("stat-teachers");
    const assignmentCountEl = document.getElementById("stat-assignments");
    const submissionCountEl = document.getElementById("stat-submissions");

    const students = state.users.filter(u => u.role === "student");
    const teachers = state.users.filter(u => u.role === "teacher");

    if (classCountEl) classCountEl.textContent = state.classes.length;
    if (studentCountEl) studentCountEl.textContent = students.length;
    if (teacherCountEl) teacherCountEl.textContent = teachers.length;
    if (assignmentCountEl) assignmentCountEl.textContent = state.assignments.length;
    if (submissionCountEl) submissionCountEl.textContent = state.submissions.length;
  }

  // Kiểm tra phiên đăng nhập còn hiệu lực
  function initSessionBanner() {
    const banner = document.getElementById("session-banner");
    if (!banner) return;

    const session = loadSession();
    if (!session) {
      banner.style.display = "none";
      return;
    }

    const state = loadState();
    const user = state.users.find(u => u.id === session.id);
    const roleMap = {
      admin: "Quản trị viên",
      teacher: "Giáo viên",
      student: "Học sinh",
      parent: "Phụ huynh"
    };

    const targetUrl = session.role === "admin" ? "admin.html" : session.role === "teacher" ? "teacher.html" : session.role === "parent" ? "parent.html" : "student.html";
    const displayName = user ? user.name : (session.role === "admin" ? "Quản trị viên" : "Người dùng");

    banner.innerHTML = `
      <span>👋 Chào mừng bạn trở lại, <strong>${displayName}</strong> (${roleMap[session.role] || session.role})!</span>
      <a href="${targetUrl}">Vào bảng điều khiển ${roleMap[session.role] || ""} →</a>
      <button class="banner-logout" id="btn-banner-logout">Đăng xuất</button>
    `;
    banner.style.display = "flex";

    const logoutBtn = document.getElementById("btn-banner-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem(SESSION_KEY);
        banner.style.display = "none";
        showToast("Đã đăng xuất phiên làm việc.", true);
      });
    }
  }

  const MINI_QUIZ_DATA = [
    {
      q: "Câu 1: Hình tam giác có tất cả mấy cạnh?",
      options: ["2 cạnh", "3 cạnh", "4 cạnh", "5 cạnh"],
      correct: 1,
      hint: "Chính xác! Hình tam giác luôn có đúng 3 cạnh và 3 đỉnh!"
    },
    {
      q: "Câu 2: Từ ngữ nào sau đây được viết đúng chính tả tiếng Việt?",
      options: ["Xinh sắn", "Xinh xắn", "Sinh xắn", "Sinh sắn"],
      correct: 1,
      hint: "Rất giỏi! 'Xinh xắn' là từ láy âm đầu x mô tả nét đẹp nhỏ nhắn dễ thương!"
    }
  ];

  let miniQuizAnswers = {};

  function initMiniQuiz() {
    const container = document.getElementById("mini-quiz-questions");
    const scoreText = document.getElementById("mini-quiz-score");
    if (!container || !scoreText) return;

    function renderQuestions() {
      container.innerHTML = MINI_QUIZ_DATA.map((item, idx) => {
        const selected = miniQuizAnswers[idx];
        const hasAnswered = selected !== undefined;
        const isCorrect = selected === item.correct;

        return `
          <div class="mini-quiz-question-box">
            <div class="mini-quiz-question-title">${item.q}</div>
            <div class="mini-quiz-options">
              ${item.options
                .map((opt, optIdx) => {
                  let btnClass = "mini-quiz-opt-btn";
                  if (hasAnswered) {
                    if (optIdx === item.correct) btnClass += " correct-picked";
                    else if (optIdx === selected) btnClass += " wrong-picked";
                  }
                  return `
                    <button class="${btnClass}" data-q="${idx}" data-opt="${optIdx}" ${hasAnswered ? "disabled" : ""}>
                      <span>${String.fromCharCode(65 + optIdx)}.</span>
                      <span>${opt}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
            ${
              hasAnswered
                ? `
                <div class="mini-quiz-feedback show" style="background: ${isCorrect ? "#eaf8e5" : "#fdf0ee"}; color: ${isCorrect ? "#175d33" : "#8c2822"};">
                  ${isCorrect ? "🎉 " + item.hint : "💡 Chưa chính xác rồi! Đáp án đúng là " + String.fromCharCode(65 + item.correct) + ". " + item.options[item.correct]}
                </div>
              `
                : ""
            }
          </div>
        `;
      }).join("");

      // Tính điểm
      let correctCount = 0;
      Object.keys(miniQuizAnswers).forEach(k => {
        if (miniQuizAnswers[k] === MINI_QUIZ_DATA[k].correct) correctCount++;
      });
      scoreText.textContent = `${correctCount}/${MINI_QUIZ_DATA.length}`;

      // Bắt sự kiện chọn đáp án
      container.querySelectorAll(".mini-quiz-opt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const qIdx = Number(btn.dataset.q);
          const optIdx = Number(btn.dataset.opt);
          miniQuizAnswers[qIdx] = optIdx;
          renderQuestions();
        });
      });
    }

    renderQuestions();

    const resetBtn = document.getElementById("btn-reset-mini-quiz");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        miniQuizAnswers = {};
        renderQuestions();
      });
    }
  }

  // Accordion FAQ
  function initFAQ() {
    document.querySelectorAll(".faq-item-v2").forEach(item => {
      const btn = item.querySelector(".faq-question-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          const isOpen = item.classList.contains("open");
          document.querySelectorAll(".faq-item-v2").forEach(i => i.classList.remove("open"));
          if (!isOpen) item.classList.add("open");
        });
      }
    });
  }

  // Mobile menu toggle
  function initMobileMenu() {
    const toggle = document.querySelector(".mobile-nav-toggle");
    const menu = document.querySelector(".v2-nav-menu");
    if (toggle && menu) {
      toggle.addEventListener("click", () => {
        menu.classList.toggle("open");
      });
      // Đóng khi click link
      menu.querySelectorAll("a").forEach(a => {
        a.addEventListener("click", () => {
          menu.classList.remove("open");
        });
      });
    }
  }

  // Toast thông báo nổi
  function showToast(message, isSuccess = false) {
    let toast = document.getElementById("landing-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "landing-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #172a1e;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        z-index: 9999;
        transition: transform 0.2s ease, opacity 0.2s ease;
        opacity: 0;
        transform: translateY(10px);
        max-width: 90vw;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    if (isSuccess) {
      toast.style.background = "#1f8a4c";
      toast.style.border = "1px solid #2cc269";
    } else {
      toast.style.background = "#1f2a22";
      toast.style.border = "1px solid #3d5444";
    }

    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
    }, 3500);
  }

  // Khởi chạy khi DOM sẵn sàng
  document.addEventListener("DOMContentLoaded", () => {
    updateLiveStats();
    initSessionBanner();
    initMiniQuiz();
    initFAQ();
    initMobileMenu();

  });
})();
