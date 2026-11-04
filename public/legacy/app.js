/* Lớp học của cô — MVP front-end.
   Demo lưu localStorage; cần backend + kiểm soát quyền phía server trước khi triển khai thật. */
(() => {
  "use strict";
  const Core = window.Core || {};
  const STORE_KEY = Core.STORE_KEY || "lhcc_v2_state";
  const SESSION_KEY = Core.SESSION_KEY || "lhcc_v2_session";
  const app = document.getElementById("app");
  const headerActions = document.getElementById("header-actions");
  const toastEl = document.getElementById("toast");
  const pageRole = document.body.dataset.page || "landing";
  let state;
  try {
    state = Core.loadState ? Core.loadState() : loadState();
  } catch (error) {
    if (app) {
      app.innerHTML = '<section class="card notice error"><h1>Không thể nâng cấp dữ liệu</h1><p></p><p>Dữ liệu cũ chưa bị ghi đè. Hãy sao lưu hoặc giải phóng dung lượng trình duyệt rồi tải lại.</p></section>';
      app.querySelector("p").textContent = error.message;
    }
    throw error;
  }
  let session = loadSession();

  // Khởi tạo các hàm Core dự phòng nếu chưa nạp module
  const uid = Core.uid || function(prefix="id") {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
    return prefix + "_" + Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
  };
  const makeLoginCode = Core.makeLoginCode || function(role) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(15);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
    const raw = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
    const groups = raw.match(/.{1,5}/g).join("-");
    return (role === "teacher" ? "GV" : role === "parent" ? "PH" : "HS") + "-" + groups;
  };
  const normalizeLoginCode = Core.normalizeLoginCode || function(code) {
    return String(code || "").normalize("NFKC").toUpperCase().replace(/[\u2010-\u2015\u2212]/g, "-").replace(/[\s\uFEFF]/g, "").replace(/[^A-Z0-9-]/g, "");
  };
  const hashCode = Core.hashCode || function(code) {
    const normalized = normalizeLoginCode(code);
    let h = 2166136261;
    for (let i=0;i<normalized.length;i++) { h ^= normalized.charCodeAt(i); h = Math.imul(h,16777619); }
    return (h >>> 0).toString(16);
  };
  const legacyHashCode = Core.legacyHashCode || function(code) {
    const raw = String(code || "").trim().toUpperCase().replace(/\s+/g, "");
    let h = 2166136261;
    for (let i=0;i<raw.length;i++) { h ^= raw.charCodeAt(i); h = Math.imul(h,16777619); }
    return (h >>> 0).toString(16);
  };
  const emptyState = Core.emptyState || function() {
    return { users: [], classes: [], assignments: [], submissions: [], audit: [], classTeachers: [], classStudents: [], schemaVersion: 2 };
  };
  function loadState() {
    return Core.loadState ? Core.loadState() : emptyState();
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }
  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }
  function saveSession(value) {
    session = value;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }
  function toast(message, success = false) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle("success", success);
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 3500);
  }
  function showRenderError(error) {
    console.error("Không thể tải giao diện cổng học tập.", error);
    if (!app) return;
    const section = document.createElement("section");
    section.className = "card notice error";
    const heading = document.createElement("h1");
    heading.textContent = "Không thể tải giao diện";
    const message = document.createElement("p");
    message.textContent = error instanceof Error ? error.message : String(error);
    const help = document.createElement("p");
    help.textContent = "Hãy tải lại trang. Nếu lỗi tiếp tục, mở F12 → Console và gửi dòng lỗi màu đỏ đầu tiên cho người quản trị.";
    section.append(heading, message, help);
    app.replaceChildren(section);
  }
  function persist() {
    if (Core.persist) Core.persist(state);
    else localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
  function log(action, detail={}) {
    if (Core.log) Core.log(state, session, action, detail);
    else {
      state.audit.unshift({id:uid("log"), at:new Date().toISOString(), actor:session?.id || "system", action, detail});
      state.audit = state.audit.slice(0,500);
      persist();
    }
  }
  function isAdmin() {
    return Core.isAdmin ? Core.isAdmin(session) : session?.role === "admin";
  }
  let lockExpiryTimer = null;
  function expireTimedLocks() {
    const now=Date.now();
    const expired=state.users.filter(user=>user.active===false&&user.lockedUntil&&Date.parse(user.lockedUntil)<=now);
    if(!expired.length)return false;
    for(const user of expired){
      user.active=true;
      user.lockEndedAt=user.lockedUntil;
      user.lockEndReason="expired";
    }
    persist();
    for(const user of expired) log("UNLOCK_USER",{userId:user.id,reason:"expired",lockReason:user.lockReason||""});
    return true;
  }
  function scheduleLockExpiry() {
    clearTimeout(lockExpiryTimer);
    const nextExpiry=state.users.filter(user=>user.active===false&&user.lockedUntil)
      .map(user=>Date.parse(user.lockedUntil)).filter(time=>Number.isFinite(time)&&time>Date.now())
      .sort((a,b)=>a-b)[0];
    if(!nextExpiry)return;
    lockExpiryTimer=setTimeout(()=>{
      if(expireTimedLocks())render();
      else scheduleLockExpiry();
    },Math.min(nextExpiry-Date.now(),2147483647));
  }
  function requireActiveSession() {
    if(expireTimedLocks())scheduleLockExpiry();
    if (Core.requireActiveSession) {
      return Core.requireActiveSession(session, state, () => {
        session = null;
        sessionStorage.removeItem(SESSION_KEY);
        try { toast("Tài khoản đã bị khóa hoặc không còn hiệu lực. Vui lòng đăng nhập lại."); } catch {}
        if (pageRole !== "landing") { setTimeout(() => location.href = "index.html", 1800); }
      });
    }
    if (!session) return false;
    if (session.role === "admin") return true;
    const user = state.users.find(u => u.id === session.id);
    if (!user || user.active === false) {
      session = null;
      sessionStorage.removeItem(SESSION_KEY);
      try { toast("Tài khoản đã bị khóa hoặc không còn hiệu lực. Vui lòng đăng nhập lại."); } catch {}
      if (pageRole !== "landing") { setTimeout(() => location.href = "index.html", 1800); }
      return false;
    }
    return true;
  }

  // Normalize partially malformed/older localStorage data so one missing array cannot prevent boot.
  for (const key of ["users", "classes", "assignments", "submissions", "audit", "classTeachers", "classStudents", "studentGuardians", "subjects", "classTeacherAssignments", "quizzes", "quizVersions", "quizAssignments", "classroomLayouts"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (!state.schoolCompetition || typeof state.schoolCompetition !== "object" || Array.isArray(state.schoolCompetition)) {
    state.schoolCompetition = null;
  } else {
    if (!Array.isArray(state.schoolCompetition.assignmentIds)) state.schoolCompetition.assignmentIds = [];
    state.schoolCompetition.active = state.schoolCompetition.active === true;
  }

  // Migrate older demo submissions so the new grading screen can address each record reliably.
  let migratedSubmissionIds = false;
  state.submissions.forEach(s=>{if(!s.id){s.id=uid("submission");migratedSubmissionIds=true;}});
  if(migratedSubmissionIds){try{persist();}catch{}}
  // Đối tượng uiState duy nhất gom toàn bộ state giao diện
  const uiState = {
    teacherSubmissionFocus: "",
    teacherStudentFocus: "",
    teacherAssignmentEditId: "",
    studentReviewSubId: "",
    activeMatchLeft: {}
  };
  function questionPrefix(kind) { return kind === "assignment" ? "assignment" : "quiz"; }
  function questionDraftQuestions(kind = "quiz") {
    const key = kind === "assignment" ? "teacherAssignmentQuestions" : "teacherQuizQuestions";
    if (!Array.isArray(uiState[key])) uiState[key] = [];
    return uiState[key];
  }
  function renderQuestionDraftList(kind = "quiz") {
    const prefix = questionPrefix(kind);
    const target = document.getElementById(`${prefix}-question-list`);
    if (!target) return;
    const labels = { single: "Trắc nghiệm 1 đáp án", multi: "Chọn nhiều đáp án", boolean: "Đúng / Sai", fill: "Điền vào chỗ trống", match: "Nối cột ghép đôi", essay: "Tự luận" };
    const questions = questionDraftQuestions(kind);
    target.innerHTML = questions.length ? `<ol class="quiz-question-list">${questions.map((question, index) => {
      const text = String(question.q || question.text || "").replace(/\s+/g, " ").trim();
      const type = ({ mc: "single", tf: "boolean" })[question.type] || question.type || "single";
      return `<li class="quiz-question-item"><div><b>${index + 1}. ${esc(labels[type] || "Câu hỏi")}</b><div class="smalltext">${esc(text.length > 100 ? `${text.slice(0, 97)}...` : text)}</div></div><div class="actions"><button type="button" class="small secondary" data-action="${prefix}-preview-question" data-index="${index}">Xem trước</button> <button type="button" class="small secondary" data-action="${prefix}-edit-question" data-index="${index}">Sửa</button> <button type="button" class="small danger" data-action="${prefix}-delete-question" data-index="${index}">Xóa</button></div></li>`;
    }).join("")}</ol>` : '<p class="quiz-question-empty">Chưa có câu hỏi nào trong đề — bấm 1 nút mẫu ở trên để bắt đầu.</p>';
    const heading = document.getElementById(`${prefix}-question-heading`);
    if (heading) {
      heading.textContent = `Câu hỏi trong đề (${questions.length})`;
      heading.hidden = questions.length === 0;
    }
  }
  function showQuestionType(type, form) {
    form?.querySelectorAll("[data-question-fields]").forEach(fieldset => { fieldset.hidden = fieldset.dataset.questionFields !== type; });
  }
  function pairEditorMarkup(count, values = [], prefix = "quiz") {
    return Array.from({ length: count }, (_, index) => `<div class="quiz-match-editor-row" data-pair-row="${index}">
      <label for="${prefix}-pair-left-${index}">Vế trái ${index + 1}</label><input id="${prefix}-pair-left-${index}" data-pair-left="${index}" maxlength="300" value="${esc(values[index]?.left || "")}">
      <label for="${prefix}-pair-right-${index}">Vế phải ${index + 1}</label><input id="${prefix}-pair-right-${index}" data-pair-right="${index}" maxlength="300" value="${esc(values[index]?.right || "")}">
      ${index > 1 ? `<button type="button" class="small ghost" data-action="${prefix}-remove-pair" data-index="${index}">Xóa cặp</button>` : ""}
    </div>`).join("");
  }
  function clearQuestionBuilder(kind = "quiz") {
    const prefix = questionPrefix(kind);
    const form = document.getElementById(kind === "assignment" ? "assignment-form" : "teacher-quiz-form");
    if (!form) return;
    form.querySelector(`#${prefix}-question-prompt`).value = "";
    form.querySelectorAll("[data-question-option]").forEach(input => { input.value = ""; });
    form.querySelectorAll(`input[name="${prefix}-correct-single"], input[name="${prefix}-boolean-correct"], [data-question-correct-multi]`).forEach(input => { input.checked = false; });
    form.querySelector(`#${prefix}-fill-answer`).value = "";
    form.querySelector(`#${prefix}-essay-sample`).value = "";
    const pairs = form.querySelector(`#${prefix}-match-pairs`);
    if (pairs) pairs.innerHTML = pairEditorMarkup(2, [], prefix);
    form.querySelector(`#${prefix}-question-type`).value = "single";
    showQuestionType("single", form);
    const saveButton = form.querySelector(`#${prefix}-question-save`);
    if (saveButton) saveButton.textContent = "+ Thêm câu hỏi vào đề";
    const cancelButton = form.querySelector(`[data-action="${prefix}-cancel-question-edit"]`);
    if (cancelButton) cancelButton.hidden = true;
    uiState[kind === "assignment" ? "teacherAssignmentQuestionEditIndex" : "teacherQuizQuestionEditIndex"] = null;
  }
  function loadQuestionIntoBuilder(index, kind = "quiz") {
    const prefix = questionPrefix(kind);
    const question = questionDraftQuestions(kind)[index];
    const form = document.getElementById(kind === "assignment" ? "assignment-form" : "teacher-quiz-form");
    if (!question || !form) return;
    let type = ({ mc: "single", tf: "boolean" })[question.type] || question.type || "single";
    if (!["single", "multi", "boolean", "fill", "match", "essay"].includes(type)) type = "single";
    form.querySelector(`#${prefix}-question-type`).value = type;
    showQuestionType(type, form);
    form.querySelector(`#${prefix}-question-prompt`).value = question.q || question.text || "";
    if (type === "single" || type === "multi") {
      (question.opts || question.options || []).forEach((option, optionIndex) => {
        const input = form.querySelector(`[data-option-type="${type}"][data-question-option="${optionIndex}"]`);
        if (input) input.value = option;
      });
      if (type === "single") {
        const correct = form.querySelector(`input[name="${prefix}-correct-single"][value="${Number(question.a ?? question.correctIndex)}"]`);
        if (correct) correct.checked = true;
      } else {
        const correct = question.a || question.correctIndexes || [];
        (Array.isArray(correct) ? correct : [correct]).forEach(optionIndex => {
          const input = form.querySelector(`[data-question-correct-multi="${Number(optionIndex)}"]`);
          if (input) input.checked = true;
        });
      }
    } else if (type === "boolean") {
      const value = question.a !== undefined ? Number(question.a) : question.correctBool === false ? 1 : 0;
      const correct = form.querySelector(`input[name="${prefix}-boolean-correct"][value="${value}"]`);
      if (correct) correct.checked = true;
    } else if (type === "fill") {
      form.querySelector(`#${prefix}-fill-answer`).value = question.a || question.answer || "";
    } else if (type === "match") {
      const pairs = question.pairs || [];
      form.querySelector(`#${prefix}-match-pairs`).innerHTML = pairEditorMarkup(Math.max(2, pairs.length), pairs, prefix);
    } else if (type === "essay") {
      form.querySelector(`#${prefix}-essay-sample`).value = question.sample || "";
    }
    uiState[kind === "assignment" ? "teacherAssignmentQuestionEditIndex" : "teacherQuizQuestionEditIndex"] = index;
    form.querySelector(`#${prefix}-question-save`).textContent = "Lưu câu hỏi vào đề";
    form.querySelector(`[data-action="${prefix}-cancel-question-edit"]`).hidden = false;
    form.querySelector(`#${prefix}-question-prompt`).focus();
  }
  function buildQuestion(form, kind = "quiz") {
    const prefix = questionPrefix(kind);
    const type = form.querySelector(`#${prefix}-question-type`).value;
    const q = form.querySelector(`#${prefix}-question-prompt`).value.trim();
    if (!q) throw new Error("Hãy nhập nội dung câu hỏi.");
    const question = { id: uid("question"), type, q };
    if (type === "single" || type === "multi") {
      const options = Array.from(form.querySelectorAll(`[data-option-type="${type}"]`)).map(input => input.value.trim());
      if (options.length !== 4 || options.some(option => !option)) throw new Error("Hãy nhập đủ 4 đáp án.");
      if (type === "single") {
        const correct = form.querySelector(`input[name="${prefix}-correct-single"]:checked`);
        if (!correct) throw new Error("Hãy chọn đáp án đúng.");
        question.opts = options; question.a = Number(correct.value);
      } else {
        const correct = Array.from(form.querySelectorAll("[data-question-correct-multi]:checked")).map(input => Number(input.dataset.questionCorrectMulti));
        if (!correct.length) throw new Error("Hãy chọn ít nhất một đáp án đúng.");
        question.opts = options; question.a = correct;
      }
    } else if (type === "boolean") {
      const correct = form.querySelector(`input[name="${prefix}-boolean-correct"]:checked`);
      if (!correct) throw new Error("Hãy chọn Đúng hoặc Sai là đáp án đúng.");
      question.opts = ["Đúng", "Sai"]; question.a = Number(correct.value);
    } else if (type === "fill") {
      if (!q.includes("___")) throw new Error("Câu điền khuyết cần có vị trí trống ký hiệu bằng ___ .");
      question.a = form.querySelector(`#${prefix}-fill-answer`).value.trim();
      if (!question.a) throw new Error("Hãy nhập đáp án đúng.");
      question.accepted = [question.a];
    } else if (type === "match") {
      question.pairs = Array.from(form.querySelectorAll("[data-pair-row]")).map(row => ({
        left: row.querySelector("[data-pair-left]").value.trim(), right: row.querySelector("[data-pair-right]").value.trim()
      }));
      if (question.pairs.length < 2 || question.pairs.some(pair => !pair.left || !pair.right)) throw new Error("Nối cột cần ít nhất 2 cặp, mỗi vế đều phải có nội dung.");
      question.a = question.pairs.map((_, index) => index);
    } else if (type === "essay") {
      question.opts = []; question.a = ""; question.sample = form.querySelector(`#${prefix}-essay-sample`).value.trim();
    } else throw new Error("Dạng câu hỏi không hợp lệ.");
    return question;
  }
  async function importQuizBankFile(file) {
    const name = file.name.toLowerCase();
    let textContent = "";
    if (name.endsWith(".docx")) {
      if (!window.mammoth) throw new Error("Chưa tải được thư viện đọc Word. Hãy kiểm tra kết nối mạng rồi thử lại.");
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      textContent = result.value || "";
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      if (!window.XLSX) throw new Error("Chưa tải được thư viện đọc Excel. Hãy kiểm tra kết nối mạng rồi thử lại.");
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Tệp không có trang tính để đọc.");
      textContent = spreadsheetToQuizText(window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }));
    } else {
      throw new Error("Chỉ hỗ trợ tệp .docx, .xlsx, .xls hoặc .csv.");
    }
    const parsedQuestions = parseQuiz(textContent);
    if (!parsedQuestions.length) throw new Error("Không nhận diện được câu hỏi hợp lệ. Hãy kiểm tra nội dung và đáp án trong tệp.");
    uiState.teacherQuizQuestions = [...questionDraftQuestions("quiz"), ...parsedQuestions.map(question => ({ ...question, id: uid("question") }))];
    renderQuestionDraftList("quiz");
    toast(`Đã nhập ${parsedQuestions.length} câu hỏi có cấu trúc. Hãy kiểm tra danh sách trước khi lưu.`, true);
  }
  // Đồng bộ tương thích ngược với window.__*
  Object.defineProperty(window, "__teacherSubmissionFocus", {
    get: () => uiState.teacherSubmissionFocus,
    set: v => { uiState.teacherSubmissionFocus = v; },
    configurable: true
  });
  Object.defineProperty(window, "__teacherStudentFocus", {
    get: () => uiState.teacherStudentFocus,
    set: v => { uiState.teacherStudentFocus = v; },
    configurable: true
  });
  Object.defineProperty(window, "__teacherAssignmentEditId", {
    get: () => uiState.teacherAssignmentEditId,
    set: v => { uiState.teacherAssignmentEditId = v; },
    configurable: true
  });
  Object.defineProperty(window, "__studentReviewSubId", {
    get: () => uiState.studentReviewSubId,
    set: v => { uiState.studentReviewSubId = v; },
    configurable: true
  });
  Object.defineProperty(window, "__activeMatchLeft", {
    get: () => uiState.activeMatchLeft,
    set: v => { uiState.activeMatchLeft = v || {}; },
    configurable: true
  });

  let activeTab = "overview";
  let adminDataTab = "logs";
  let pendingImport = null;
  let pendingBackupRestore = null;
  let parentProvisionResult = null;
  let loginCodeReveal = null;
  let currentQuiz = null;
  let assignmentEditId = null;
  let answers = {};
  let lastResult = null;
  function getStudentClassIds(userId) {
    if (Core.getStudentClassIds) return Core.getStudentClassIds(state, userId);
    return state.users.find(u => u.id === userId)?.classIds || [];
  }
  function getClassStudentIds(classId) {
    if (Core.getClassStudentIds) return Core.getClassStudentIds(state, classId);
    return state.users.filter(u => u.role === "student" && (u.classIds || []).includes(classId)).map(u => u.id);
  }
  function getClassTeacherIds(classId) {
    if (Core.getClassTeacherIds) return Core.getClassTeacherIds(state, classId);
    return state.classes.find(c => c.id === classId)?.teacherIds || [];
  }
  function myClassIds() {
    return state.classes.filter(c => getClassTeacherIds(c.id).includes(session?.id)).map(c => c.id);
  }
  function allowedClass(c) {
    if (Core.allowedClass) return Core.allowedClass(c, session, state);
    return isAdmin() || (session?.role === "teacher" && (c.teacherIds || []).includes(session.id));
  }
  function currentUserName() { return state.users.find(user => user.id === session?.id)?.name || ""; }
  function roleName(role) { return ({admin:"Quản trị viên",teacher:"Giáo viên",student:"Học sinh",parent:"Phụ huynh"})[role] || role; }
  function userStatus(u) { return u.active === false ? '<span class="pill off">Đã khóa</span>' : '<span class="pill">Đang hoạt động</span>'; }
  function clsName(id) { return state.classes.find(c=>c.id===id)?.name || "Lớp không tồn tại"; }
  function header() {
    if (!headerActions) return;
    if (!session) {
      headerActions.innerHTML = pageRole === "landing"
        ? '<a class="button-link" href="/admin" target="_top">Đăng nhập Admin</a>'
        : '<a class="ghost small" href="index.html">← Trang chủ</a>';
      return;
    }
    headerActions.innerHTML = `<span class="muted">${esc(currentUserName() || "Quản trị viên")} · ${esc(roleName(session.role))}</span><button class="ghost small" data-action="logout">Đăng xuất</button>`;
  }
  function render() {
    if(expireTimedLocks())scheduleLockExpiry();
    header();
    if (!session) {
      if (["admin", "teacher", "student", "parent", "learner"].includes(pageRole)) return renderLogin(pageRole);
      return renderHome();
    }
    if (!requireActiveSession()) return renderLogin(pageRole);
    const sharedLearnerRole = pageRole === "learner" && ["student", "parent"].includes(session.role);
    if (pageRole !== "landing" && pageRole !== session.role && !sharedLearnerRole) {
      app.innerHTML = `<section class="card login-wrap"><h1>Không đúng khu vực</h1><p>Tài khoản hiện tại là ${esc(roleName(session.role))}. Hãy đăng xuất rồi đăng nhập đúng khu vực.</p><div class="actions"><button data-action="logout">Đăng xuất</button><a class="button-link" href="index.html">Về landing page</a></div></section>`;
      return;
    }
    if (isAdmin()) return renderAdmin();
    if (session.role === "teacher") return renderTeacher();
    if (session.role === "student") return renderStudent();
    if (session.role === "parent") return renderParent();
    saveSession(null);
  }
  function renderHome() {
    app.innerHTML = `
      <section class="hero"><div class="hero-icon">🐸</div><div><h1>Lớp học của cô</h1><div class="bubble">Một nơi vui vẻ để giao bài, học tập và tiến bộ mỗi ngày.</div></div></section>
      <div class="notice">Bản MVP chạy thử trên trình duyệt: dữ liệu được lưu trong trình duyệt hiện tại. Đây chưa phải hệ thống nhiều người dùng thật; cần backend và phân quyền phía máy chủ trước khi triển khai cho trường/lớp.</div>
      <div class="grid">
        <section class="card role-card"><div class="role-icon">🛡️</div><h2>Quản trị viên</h2><p class="muted">Quản lý hồ sơ, nhập Excel, tạo mã đăng nhập và phân lớp.</p><button data-action="admin-login">Đăng nhập Admin</button></section>
        <section class="card role-card"><div class="role-icon">🍎</div><h2>Giáo viên</h2><p class="muted">Đăng nhập bằng mã riêng; quản lý lớp được phân công, học sinh và bài tập của lớp.</p><button class="secondary" data-action="code-login" data-role="teacher">Đăng nhập Giáo viên</button></section>
        <section class="card role-card"><div class="role-icon">🎒</div><h2>Học sinh</h2><p class="muted">Làm bài tập, xem điểm số và nhận xét học tập của mình.</p><a class="button-link" href="student.html">Vào cổng Học sinh</a></section>
        <section class="card role-card"><div class="role-icon">👨‍👩‍👧</div><h2>Phụ huynh</h2><p class="muted">Theo dõi tiến độ học tập và thông tin lớp của hồ sơ con đã xác minh.</p><a class="button-link" href="parent.html">Vào cổng Phụ huynh</a></section>
      </div>`;
  }
  function renderAdmin() {
    const classes = state.classes;
    const classId = uiState.teacherLayoutClassId || classes[0]?.id || "";
    const current = classes.find(item => item.id === classId);
    const classroomContext = {
      app, state, esc, classes, session, classId, current, uiState, isEditor: true,
      isAdmin: true, submissions: state.submissions, clsName, persist, log, toast, render,
      canTeachSubject: Core.canTeachSubject
    };
    const quizBankContext = {
      state, esc, classes, session, uiState, quizzes: state.quizzes, submissions: state.submissions,
      clsName, parseQuiz, isAdmin: true, canTeachSubject: Core.canTeachSubject
    };
    window.AdminViews.render({
      app, state, esc, roleName, clsName, userStatus,
      adminDataTab,
      activeTab, setActiveTab: value => { activeTab = value; },
      render, downloadBlob, parentProvisionResult, classroomContext, quizBankContext
    });
    if (activeTab === "classroom") window.TeacherViews.bindClassroom(classroomContext);
  }
  function renderTeacher() {
    const classes = state.classes.filter(allowedClass);
    const classIds = new Set(classes.map(c=>c.id));
    const studentIds = new Set(classes.flatMap(cls => Core.getActiveClassStudentIds
      ? Core.getActiveClassStudentIds(state, cls.id)
      : state.users.filter(user=>user.role==="student"&&user.active!==false&&(user.classIds||[]).includes(cls.id)).map(user=>user.id)));
    const students = state.users.filter(user=>studentIds.has(user.id));
    const assignments = state.assignments.filter(a=>classIds.has(a.classId));
    const assignmentIds = new Set(assignments.map(a=>a.id));
    const submissions = state.submissions.filter(s=>assignmentIds.has(s.assignmentId));
    const activeAssignmentIds = new Set(assignments.filter(a=>!a.archived).map(a=>a.id));
    const pending = submissions.filter(s=>s.status==="submitted"&&activeAssignmentIds.has(s.assignmentId));
    const today = new Date(); today.setHours(0,0,0,0);
    const dueSoon = assignments.filter(a=>{
      if(a.archived||!a.due)return false;
      const dueDate=new Date(a.due+"T00:00:00");
      return !Number.isNaN(dueDate.getTime())&&dueDate>=today&&dueDate-today<=7*86400000;
    });
    const classId = activeTab.startsWith("class:") ? activeTab.slice(6) : (classes[0]?.id || "");
    const current = classes.find(c=>c.id===classId);
    const ctx = {
      state, esc, clsName, currentUserName, classes, students, assignments, submissions, pending, dueSoon,
      classId, current, activeTab, app, session, allowedClass, uiState, subjects: state.subjects,
      quizzes: state.quizzes, parseQuiz, isAdmin: isAdmin(),
      canTeachSubject: Core.canTeachSubject, classStudentCount: cls => Core.getActiveClassStudentIds
        ? Core.getActiveClassStudentIds(state, cls.id).length
        : state.users.filter(user=>user.role==="student"&&user.active!==false&&(user.classIds||[]).includes(cls.id)).length,
      persist, log, toast, render
    };
    let body;
    if (activeTab==="overview" || (!current && activeTab.startsWith("class:"))) body = window.TeacherViews.dashboard(ctx);
    else if (activeTab==="classes") body = window.TeacherViews.classes(ctx);
    else if (activeTab==="students" || activeTab==="parents") body = window.TeacherViews.students(ctx);
    else if (activeTab==="assignments") body = window.TeacherViews.assignments(ctx);
    else if (activeTab==="quiz-bank") body = window.TeacherViews.quizBank(ctx);
    else if (activeTab==="classroom") body = window.TeacherViews.classroom({ ...ctx, isEditor: current ? Core.canEditClassroom(state, session, current.id) : false });
    else if (activeTab==="submissions") body = window.TeacherViews.submissions(ctx);
    else if (activeTab==="gradebook") body = window.TeacherViews.gradebook(ctx);
    else if (activeTab==="profile") body = window.TeacherViews.profile(ctx);
    else if (activeTab.startsWith("class:") && current) body = window.TeacherViews.class_detail(ctx);
    else body = `<section class="card"><h2>Không tìm thấy mục này</h2><p class="muted">Hãy chọn một mục trong thanh điều hướng.</p></section>`;
    const nav = [{id:"overview",label:"Tổng quan"},{id:"classes",label:"Lớp học"},{id:"students",label:"Học sinh & phụ huynh"},{id:"assignments",label:"Bài tập"},{id:"quiz-bank",label:"Ngân hàng Quiz"},{id:"classroom",label:"Sơ đồ lớp"},{id:"submissions",label:`Bài nộp${pending.length?` (${pending.length})`:""}`},{id:"gradebook",label:"Sổ điểm"},{id:"profile",label:"Tài khoản"}];
    const activeClass = activeTab.startsWith("class:") ? current : null;
    const pageTitle = activeClass ? `Lớp học: ${activeClass.name}` : (nav.find(item => item.id === activeTab)?.label.replace(/\s\(\d+\)$/, "") || (activeTab==="parents"?"Học sinh & phụ huynh":"Tổng quan"));
    const pageDescription = activeClass ? `Thông tin, học sinh và bài tập của ${activeClass.name}.` : ({
      overview:"Theo dõi lớp học và ưu tiên các việc cần xử lý.",
      classes:"Xem các lớp được phân công và mở trang chi tiết từng lớp.",
      students:"Quản lý học sinh, xem chi tiết và theo dõi liên kết phụ huynh trong các lớp được phân công.",
      parents:"Quản lý học sinh và phụ huynh liên kết trong các lớp được phân công.",
      assignments:"Tạo, chỉnh sửa và quản lý bài tập theo lớp/môn.",
      "quiz-bank":"Tạo Quiz gốc, lưu phiên bản và giao lại cho nhiều lớp.",
      classroom:"Tạo sơ đồ, kéo thả bàn và sắp xếp học sinh.",
      submissions:"Xem bài nộp và xử lý các bài đang chờ.",
      gradebook:"Theo dõi điểm số theo lớp và bài tập.",
      profile:"Cập nhật thông tin cá nhân, xem lớp được phân công và nhật ký hoạt động."
    }[activeTab] || "Quản lý lớp được phân công và hoạt động học tập.");
    app.innerHTML = `<header class="workspace-heading teacher-page-heading"><div><p class="eyebrow">KHÔNG GIAN GIÁO VIÊN</p><h1>${esc(pageTitle)}</h1><p class="muted">${esc(pageDescription)}</p></div><span class="teacher-profile-chip">🍎 ${esc(currentUserName())}</span></header><nav class="tabs teacher-tabs workspace-tabs" aria-label="Điều hướng giáo viên">${nav.map(n=>`<button class="${activeTab===n.id?"active":""}" data-tab="${n.id}">${n.label}</button>`).join("")}</nav>${classes.length?`<section class="workspace-shortcuts" aria-label="Lối tắt lớp học"><span class="workspace-nav-label">Lớp của tôi</span><div class="workspace-shortcut-list">${classes.map(c=>`<button class="small ${activeTab==="class:"+c.id?"secondary":"ghost"}" data-tab="class:${c.id}">${esc(c.name)}</button>`).join("")}</div></section>`:""}<div class="workspace-content">${body}</div>`;
    app.innerHTML = `<header class="workspace-heading teacher-page-heading"><div><p class="eyebrow">KHÔNG GIAN GIÁO VIÊN</p><h1>${esc(pageTitle)}</h1><p class="muted">${esc(pageDescription)}</p></div><span class="teacher-profile-chip">🍎 ${esc(currentUserName())}</span></header><nav class="tabs teacher-tabs workspace-tabs" aria-label="Điều hướng giáo viên">${nav.map(n=>`<button class="${activeTab===n.id?"active":""}" data-tab="${n.id}">${n.label}</button>`).join("")}</nav>${classes.length?`<section class="workspace-shortcuts" aria-label="Lối tắt lớp học"><span class="workspace-nav-label">Lớp của tôi</span><div class="workspace-shortcut-list">${classes.map(c=>`<button class="small ${activeTab==="class:"+c.id?"secondary":"ghost"}" data-tab="class:${c.id}">${esc(c.name)}</button>`).join("")}</div></section>`:""}<div class="workspace-content">${body}</div>`;
    if (activeTab === "classroom") {
      const selectedClass = classes.find(item => item.id === (uiState.teacherLayoutClassId || classId)) || classes[0];
      window.TeacherViews.bindClassroom({ ...ctx, isEditor: selectedClass ? Core.canEditClassroom(state, session, selectedClass.id) : false });
    }
  }
  function classIdsSafeForCurrentTeacher(){return state.classes.filter(allowedClass).map(c=>c.id);}
  function saveSubmissionGrade(id) {
    if(!requireActiveSession()) return;
    window.TeacherGrading.save({
      id, state, session, allowedClass, persist, log, toast, render,
      setFocus: value => { window.__teacherSubmissionFocus = value; },
      setActiveTab: value => { activeTab = value; }
    });
  }
  function renderParent() {
    if (!window.ParentViews || typeof window.ParentViews.render !== "function") { app.innerHTML = `<section class="card"><h1>Không tải được cổng phụ huynh</h1><p>Hãy tải lại trang.</p></section>`; return; }
    window.ParentViews.render({ app, state, session, activeTab });
  }

  function renderStudent() {
    window.StudentViews.render({
      app, state, session, esc, clsName, currentUserName,
      activeTab, currentQuiz, answers, lastResult, render, uiState
    });
  }
  function parseQuiz(text) {
    if (!text || !text.trim()) return [];
    return text.trim().split(/\n\s*\n/).map(block => {
      const lines = block.split("\n").map(x => x.trim()).filter(Boolean);
      if (!lines.length) return null;
      let q = lines[0];
      const rest = lines.slice(1);

      let explanation = "";
      const contentLines = [];
      rest.forEach(l => {
        if (l.startsWith("! Lời giải:") || l.startsWith("! Giải thích:") || l.startsWith("! ")) {
          explanation = l.replace(/^!\s*(Lời giải:|Giải thích:)?\s*/i, "").trim();
        } else {
          contentLines.push(l);
        }
      });

      // 1. Dạng tự luận [Tự luận]
      if (q.includes("[Tự luận]") || contentLines.some(l => l.includes("[Tự luận]"))) {
        q = q.replace(/\[Tự luận\]/gi, "").trim();
        return { q, type: "essay", opts: [], a: "", explanation };
      }

      // 2. Dạng nối cột [Nối cột] hoặc các dòng "* vế 1 = vế 2"
      const isMatchTag = q.includes("[Nối cột]") || q.includes("[Ghép đôi]");
      const matchLines = contentLines.filter(l => l.includes("=") || l.includes("⟷") || l.includes("->"));
      if (isMatchTag || (matchLines.length >= 2 && matchLines.length === contentLines.length)) {
        q = q.replace(/\[Nối cột\]/gi, "").replace(/\[Ghép đôi\]/gi, "").trim();
        const pairs = contentLines.map(l => {
          let line = l.startsWith("*") ? l.slice(1).trim() : l.trim();
          const parts = line.split(/[=⟷]|->/);
          if (parts.length >= 2) return { left: parts[0].trim(), right: parts[1].trim() };
          return null;
        }).filter(Boolean);
        if (pairs.length >= 2) {
          return { q, type: "match", pairs, a: pairs.map((_, i) => i), explanation };
        }
      }

      // 3. Dạng điền vào chỗ trống [Điền khuyết] / [Điền từ]
      const isFillTag = q.includes("[Điền khuyết]") || q.includes("[Điền từ]") || q.includes("[Điền số]");
      const starLines = contentLines.filter(l => l.startsWith("*"));
      const isABC = contentLines.some(l => /^[A-Da-d][.)]/.test(l.replace(/^\*/, "").trim()));
      if ((isFillTag || (!isABC && starLines.length === 1 && contentLines.length === 1)) && !isABC) {
        q = q.replace(/\[Điền khuyết\]/gi, "").replace(/\[Điền từ\]/gi, "").replace(/\[Điền số\]/gi, "").trim();
        const rawAns = starLines.length ? starLines[0].slice(1).trim() : (contentLines[0] || "").trim();
        const accepted = rawAns.split(/\s*[/|;]\s*/).filter(Boolean);
        return { q, type: "fill", opts: [], a: accepted[0] || rawAns, accepted, explanation };
      }

      // 4. Dạng Đúng / Sai
      const isBooleanTag = q.includes("[Đúng/Sai]") || q.includes("[Đúng-Sai]");
      if (isBooleanTag || (contentLines.length === 2 && contentLines.some(l => /đúng/i.test(l)) && contentLines.some(l => /sai/i.test(l)))) {
        q = q.replace(/\[Đúng\/Sai\]/gi, "").replace(/\[Đúng-Sai\]/gi, "").trim();
        let correctIdx = 0;
        contentLines.forEach(l => {
          if (l.startsWith("*")) correctIdx = /đúng/i.test(l) ? 0 : 1;
        });
        return { q, type: "boolean", opts: ["Đúng", "Sai"], a: correctIdx, explanation };
      }

      // 5. Trắc nghiệm 1 hoặc nhiều đáp án (Single & Multi-choice)
      if (contentLines.length >= 2) {
        const opts = [];
        const correctIndices = [];
        contentLines.forEach(line => {
          const star = line.startsWith("*");
          if (star) line = line.slice(1).trim();
          const value = line.replace(/^[A-Da-d][.)]\s*/, "").trim();
          if (star) correctIndices.push(opts.length);
          opts.push(value);
        });

        if (opts.length >= 2 && correctIndices.length >= 1 && opts.every(Boolean)) {
          if (correctIndices.length > 1) {
            return { q, type: "multi", opts, a: correctIndices, explanation };
          }
          return { q, type: "single", opts, a: correctIndices[0], explanation };
        }
      }

      return null;
    }).filter(Boolean);
  }
  function renderResult() {
    window.StudentViews.resultMessage({ app, lastResult, state, esc });
  }
  function renderLogin(kind) {
    const admin = kind==="admin";
    const learnerPortal = kind === "learner";
    app.innerHTML = `<section class="card login-wrap"><h1>${admin?"Đăng nhập Admin":kind==="teacher"?"Đăng nhập Giáo viên":learnerPortal?"Cổng Học sinh &amp; Phụ huynh":kind==="parent"?"Đăng nhập Phụ huynh":"Đăng nhập Học sinh"}</h1><p class="muted">${admin?"Sử dụng tài khoản và mật khẩu quản trị.":learnerPortal?"Chọn vai trò rồi nhập mã đăng nhập riêng do Admin cấp.":"Nhập mã đăng nhập riêng do Admin cấp."}</p>
      ${admin?`<form id="login-form"><label for="login-user">Tài khoản</label><input id="login-user" autocomplete="username" required><label for="login-password">Mật khẩu</label><input id="login-password" type="password" autocomplete="current-password" required><div class="actions"><button type="submit">Đăng nhập</button><button type="button" class="ghost" data-action="home">Quay lại</button></div></form>`:
      `<form id="login-form">${learnerPortal?'<label for="login-role">Vai trò</label><select id="login-role" name="role"><option value="student">Học sinh</option><option value="parent">Phụ huynh</option></select>':""}<label for="login-code">Mã đăng nhập</label><input id="login-code" autocomplete="off" required placeholder="${kind==="teacher"?"GV-XXXXX-XXXXX-XXXXX":kind==="parent"?"PH-XXXXX-XXXXX-XXXXX":learnerPortal?"HS-XXXXX-XXXXX-XXXXX hoặc PH-XXXXX-XXXXX-XXXXX":"HS-XXXXX-XXXXX-XXXXX"}"><div class="actions"><button type="submit">Đăng nhập</button><button type="button" class="ghost" data-action="home">Quay lại</button></div></form>`}
      ${admin?'<div class="notice">Bản demo: đăng nhập mặc định <b>admin</b> / <b>Admin@123</b>. Không dùng thông tin này trong môi trường thật.</div>':'<div class="notice">Mã đăng nhập chỉ được tạo khi Admin nhập Excel hoặc cấp mã mới trong khu vực quản trị.</div>'}</section>`;
  }
  function normalizeKey(obj, keys) {
    const map = {};
    Object.keys(obj).forEach(k=>map[k.toLowerCase().trim().replace(/[\s_-]/g,"")] = obj[k]);
    for(const key of keys) { const v=map[key.toLowerCase().replace(/[\s_-]/g,"")]; if(v!==undefined && String(v).trim()!=="")return String(v).trim(); }
    return "";
  }
  function downloadBlob(filename, content, type="text/csv;charset=utf-8") {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadTemplate(role) {
    let rows;
    if(role==="teacher") rows=[["name","staff_code","email","phone","class_codes"],["Nguyễn Thị A","GV001","gv@example.com","0900000000","LOP-4A"]];
    else if(role==="student") rows=[["name","student_code","email","class_code","class_codes","parent_name","parent_email","parent_phone","parent_relationship"],["Nguyễn Văn B","HS001","","LOP-4A","","Nguyễn Thị C","phuhuynh@example.com","0900000000","mother"]];
    else rows=[["student_code","class_code"],["HS001","LOP-4A"],["HS002","LOP-4B"]];
    if(window.XLSX) {
      const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"Data"); XLSX.writeFile(wb,`mau_${role}_lop_hoc_cua_co.xlsx`);
    } else {
      const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
      downloadBlob(`mau_${role}_lop_hoc_cua_co.csv`,csv);
    }
  }
  function readImportFile(file) {
    return new Promise((resolve,reject)=>{
      if(file.size>10*1024*1024){reject(new Error("File nhập vượt quá 10 MB. Hãy chia nhỏ dữ liệu rồi thử lại."));return;}
      const ext=file.name.split(".").pop().toLowerCase();
      if(ext==="csv") {
        const reader=new FileReader();
        reader.onload=()=> {
          try {
            const text=String(reader.result).replace(/^\uFEFF/,"");
            const rows=[]; let row=[],value="",quoted=false;
            for(let i=0;i<text.length;i++){
              const ch=text[i];
              if(ch==='"'&&quoted&&text[i+1]==='"'){value+='"';i++;}
              else if(ch==='"')quoted=!quoted;
              else if(ch===","&&!quoted){row.push(value);value="";}
              else if((ch==="\n"||ch==="\r")&&!quoted){
                if(ch==="\r"&&text[i+1]==="\n")i++;
                row.push(value);value="";
                if(row.some(cell=>String(cell).trim()))rows.push(row);
                row=[];
              } else value+=ch;
            }
            if(quoted)throw new Error("File CSV có dấu ngoặc kép chưa đóng.");
            row.push(value);
            if(row.some(cell=>String(cell).trim()))rows.push(row);
            const headers=rows.shift()||[];
            if(!headers.length)throw new Error("File CSV không có dòng tiêu đề.");
            resolve(rows.map(cells=>Object.fromEntries(headers.map((header,index)=>[header,cells[index]||""]))));
          } catch(error) { reject(error); }
        };
        reader.onerror=()=>reject(new Error("Không đọc được file CSV"));
        reader.readAsText(file,"utf-8");
      } else if(window.XLSX) {
        const reader=new FileReader();
        reader.onload=()=>{try{const wb=XLSX.read(reader.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];resolve(XLSX.utils.sheet_to_json(ws,{defval:""}));}catch(e){reject(e)}};
        reader.onerror=()=>reject(new Error("Không đọc được file Excel"));
        reader.readAsArrayBuffer(file);
      } else reject(new Error("Chưa tải được thư viện đọc Excel. Hãy thử CSV hoặc kết nối Internet."));
    });
  }
  function previewImport(rows, role) {
    const preview=document.getElementById("import-preview");
    const seenExternal=new Set(),seenEmail=new Set(),errors=[],normalized=[];
    rows.forEach((r,i)=>{
      const name=normalizeKey(r,["name","full_name","fullname","họ tên","hoten","ho ten"]);
      const email=normalizeKey(r,["email","e-mail"]);
      const external=normalizeKey(r,role==="teacher"?["staff_code","teacher_code","ma_giao_vien","magiaovien"]:["student_code","ma_hoc_sinh","mahocsinh"]);
      const classCodes=normalizeKey(r,["class_codes","class_code","classcode","ma_lop","malop","lớp"]).split(/[;,|]/).map(s=>s.trim()).filter(Boolean);
      const parentName=role==="student"?normalizeKey(r,["parent_name","guardian_name","parent_full_name","ho_ten_phu_huynh","ten_phu_huynh","phu_huynh","phụ huynh"]):"";
      const parentEmail=role==="student"?normalizeKey(r,["parent_email","guardian_email","email_phu_huynh","email_ph","email phụ huynh"]):"";
      const parentPhone=role==="student"?normalizeKey(r,["parent_phone","guardian_phone","parent_mobile","so_dien_thoai_phu_huynh","dien_thoai_phu_huynh","phone_ph"]):"";
      const relationshipRaw=role==="student"?normalizeKey(r,["parent_relationship","guardian_relationship","relationship","quan_he","quan hệ"]):"";
      const relationshipMap={"mother":"mother","me":"mother","mẹ":"mother","father":"father","bo":"father","bố":"father","guardian":"guardian","nguoi giam ho":"guardian","người giám hộ":"guardian","other":"other","khac":"other","khác":"other"};
      const parentRelationship=relationshipMap[relationshipRaw.toLowerCase()]||"guardian";
      let error="";
      if(!name)error="Thiếu họ tên";
      else if(external&&seenExternal.has(external.toLowerCase()))error="Trùng mã hồ sơ trong file";
      else if(external&&state.users.some(u=>u.role===role&&(u.externalCode||"").toLowerCase()===external.toLowerCase()))error="Mã hồ sơ đã tồn tại";
      else if(email&&seenEmail.has(email.toLowerCase()))error="Trùng email trong file";
      else if(email&&state.users.some(u=>u.role===role&&(u.email||"").trim().toLowerCase()===email.toLowerCase()))error="Email đã tồn tại";
      if(external)seenExternal.add(external.toLowerCase());
      if(email)seenEmail.add(email.toLowerCase());
      if(!error&&email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))error="Email không hợp lệ";
      const missingClassCodes=Core.findMissingClassCodes(state,classCodes);
      if(!error&&missingClassCodes.length){
        const availableCodes=[...new Set(state.classes.map(cls=>String(cls.code||"").trim()).filter(Boolean))];
        error=`Mã lớp không tồn tại: ${missingClassCodes.join(", ")}. Tạo lớp trước khi nhập. Mã lớp hiện có: ${availableCodes.join(", ")||"chưa có lớp"}.`;
      }
      if(!error && role==="student" && (parentEmail||parentPhone) && !parentName) error="Có thông tin liên hệ phụ huynh nhưng thiếu họ tên";
      if(!error && role==="student" && parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) error="Email phụ huynh không hợp lệ";
      normalized.push({row:i+2,name,email,external,classCodes,parentName,parentEmail,parentPhone,parentRelationship,error,raw:r});
      if(error)errors.push({row:i+2,error});
    });
    pendingImport={role,rows:normalized,valid:normalized.filter(r=>!r.error)};
    const hasParentData=role==="student"&&normalized.some(row=>row.parentName||row.parentEmail||row.parentPhone);
    const parentNotice=hasParentData?'<p class="notice">Thông tin phụ huynh được tạo/liên kết với học sinh. Liên kết mới sẽ ở trạng thái <b>chờ Admin xác minh</b>; mã đăng nhập của phụ huynh mới (nếu có) chỉ xuất hiện một lần trong CSV kết quả.</p>':"";
    preview.innerHTML=`<hr><h3>Xem trước dữ liệu (${rows.length} dòng)</h3><div class="notice ${errors.length?"error":"info"}">Hợp lệ: ${normalized.length-errors.length} · Lỗi: ${errors.length}. Các dòng lỗi sẽ không được tạo.</div>${parentNotice}
      <div class="table-wrap"><table><thead><tr><th>Dòng</th><th>Học sinh</th><th>Email HS</th><th>Mã ngoài</th><th>Lớp</th>${role==="student"?'<th>Phụ huynh</th><th>Email / SĐT phụ huynh</th><th>Quan hệ</th>':""}<th>Kiểm tra</th></tr></thead><tbody>${normalized.slice(0,100).map(r=>`<tr><td>${r.row}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.external)}</td><td>${esc(r.classCodes.join(", "))}</td>${role==="student"?`<td>${esc(r.parentName)}</td><td>${esc([r.parentEmail,r.parentPhone].filter(Boolean).join(" / "))}</td><td>${esc(({mother:"Mẹ",father:"Bố",guardian:"Người giám hộ",other:"Khác"})[r.parentRelationship])}</td>`:""}<td>${r.error?`<span class="pill off">${esc(r.error)}</span>`:'<span class="pill">Hợp lệ</span>'}</td></tr>`).join("")}</tbody></table></div>
      ${normalized.length>100?`<p class="muted">Chỉ hiển thị 100 dòng đầu; tất cả dòng sẽ được xử lý.</p>`:""}
      <div class="actions"><button data-action="confirm-import" ${pendingImport.valid.length?"":"disabled"}>Tạo ${pendingImport.valid.length} hồ sơ hợp lệ${hasParentData?" và liên kết phụ huynh":""}</button><button class="ghost" data-action="cancel-import">Hủy</button></div>`;
  }
  function commitImport() {
    if(!pendingImport || !pendingImport.valid.length)return;
    const {role,valid}=pendingImport, output=[];
    const nextState=JSON.parse(JSON.stringify(state));
    valid.forEach(r=>{
      const externalExists=r.external&&nextState.users.some(u=>u.role===role&&(u.externalCode||"").toLowerCase()===r.external.toLowerCase());
      const emailExists=r.email&&nextState.users.some(u=>u.role===role&&(u.email||"").trim().toLowerCase()===r.email.toLowerCase());
      if(externalExists||emailExists){output.push({...r,importError:"Đã tồn tại trong hệ thống"});return;}
      const code=makeLoginCode(role), id=uid(role);
      const classIds=[];
      if(role==="student")r.classCodes.forEach(cc=>{const c=nextState.classes.find(c=>String(c.code||"").toLowerCase()===cc.toLowerCase());if(c&&!classIds.includes(c.id))classIds.push(c.id)});
      const teacherClassIds=[];
      if(role==="teacher")r.classCodes.forEach(cc=>{const c=nextState.classes.find(c=>String(c.code||"").toLowerCase()===cc.toLowerCase());if(c&&!teacherClassIds.includes(c.id))teacherClassIds.push(c.id)});
      const user={id,role,name:r.name,email:r.email,externalCode:r.external,publicCode:r.external||(role==="teacher"?"GV":"HS")+"-"+String(nextState.users.filter(u=>u.role===role).length+1).padStart(4,"0"),codeHash:hashCode(code),active:true,classIds,createdAt:new Date().toISOString(),codeOnce:false};
      nextState.users.push(user);
      let parentLoginCode="";
      if(role==="student"){
        classIds.forEach(classId=>{
          nextState.classStudents = nextState.classStudents || [];
          nextState.classStudents.push({ classId, userId: id, joinedAt: user.createdAt, leftAt: null });
        });
        if(r.parentName){
          nextState.studentGuardians=nextState.studentGuardians||[];
          let parent=r.parentEmail?nextState.users.find(existing=>existing.role==="parent"&&String(existing.email||"").trim().toLowerCase()===r.parentEmail.toLowerCase()):null;
          if(!parent){
            parent={id:uid("parent"),role:"parent",name:r.parentName,email:r.parentEmail,phone:r.parentPhone,publicCode:"PH-"+String(nextState.users.filter(existing=>existing.role==="parent").length+1).padStart(4,"0"),active:true,createdAt:new Date().toISOString(),createdBy:session?.id||"admin-demo"};
            parentLoginCode=makeLoginCode("parent");
            parent.codeHash=hashCode(parentLoginCode);
            nextState.users.push(parent);
          } else {
            if(!parent.name)parent.name=r.parentName;
            if(!parent.phone&&r.parentPhone)parent.phone=r.parentPhone;
          }
          const existingLink=nextState.studentGuardians.find(link=>link.parentId===parent.id&&link.studentId===user.id&&!link.revokedAt);
          if(!existingLink)nextState.studentGuardians.push({id:uid("guardian_link"),parentId:parent.id,studentId:user.id,relationship:r.parentRelationship||"guardian",status:"pending",createdAt:new Date().toISOString(),createdBy:session?.id||"admin-demo",revokedAt:null});
        }
      }
      if(role==="teacher"){
        teacherClassIds.forEach(classId=>{
          const c=nextState.classes.find(c=>c.id===classId);
          if(c){
            c.teacherIds=c.teacherIds||[];
            if(!c.teacherIds.includes(id))c.teacherIds.push(id);
          }
          nextState.classTeachers = nextState.classTeachers || [];
          nextState.classTeachers.push({ classId, userId: id, joinedAt: user.createdAt, leftAt: null });
        });
      }
      output.push({name:r.name,role,publicCode:user.publicCode,loginCode:code,classCodes:r.classCodes.join(", "),parentName:r.parentName||"",parentEmail:r.parentEmail||"",parentPhone:r.parentPhone||"",parentLoginCode,status:"Đã tạo"});
    });
    nextState.audit.unshift({id:uid("log"),at:new Date().toISOString(),actor:session?.id||"system",action:"IMPORT_"+role.toUpperCase(),detail:{processed:valid.length,created:output.filter(o=>o.loginCode).length,duplicates:output.filter(o=>o.importError).length}});
    nextState.audit=nextState.audit.slice(0,500);
    try { Core.persist ? Core.persist(nextState) : localStorage.setItem(STORE_KEY,JSON.stringify(nextState)); }
    catch(error) { toast("Không thể lưu dữ liệu nhập. Không có hồ sơ nào được áp dụng; hãy giải phóng dung lượng trình duyệt rồi thử lại."); return; }
    state=nextState;
    const csv="\ufeff"+[["Họ tên học sinh","Vai trò","Mã hồ sơ HS","Mã đăng nhập HS","Lớp","Họ tên phụ huynh","Email phụ huynh","SĐT phụ huynh","Mã đăng nhập phụ huynh","Trạng thái liên kết","Trạng thái"],...output.map(o=>[o.name,roleName(o.role||role),o.publicCode||"",o.loginCode||"",o.classCodes||"",o.parentName||"",o.parentEmail||"",o.parentPhone||"",o.parentLoginCode||"",o.parentName?"Chờ Admin xác minh":"",o.status||o.importError])].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    downloadBlob(`ket_qua_nhap_${role}_${new Date().toISOString().slice(0,10)}.csv`,csv);
    pendingImport=null;activeTab=role==="student"&&output.some(row=>row.parentName)?"parents":"users";render();toast(`Đã tạo ${output.filter(o=>o.loginCode).length} hồ sơ${output.some(row=>row.parentLoginCode)?" và tạo mã cho phụ huynh mới":""}. File CSV chứa mã vừa sinh; yêu cầu liên kết phụ huynh đang chờ xác minh.`,true);
  }
  function exportCodes() {
    const users=state.users.filter(u=>u.codeOnce);
    if(!users.length){toast("Không có mã mới để xuất.");return;}
    toast("Mã đăng nhập chỉ hiển thị lúc tạo. Hãy cấp lại mã nếu bạn không còn file kết quả.",false);
  }
  function resetCode(id, revealInDetails = false) {
    if (!requireActiveSession() || !isAdmin()) { toast("Chỉ Admin mới được cấp lại mã đăng nhập."); return; }
    const u=state.users.find(u=>u.id===id);if(!u)return;
    const code=makeLoginCode(u.role);u.codeHash=hashCode(code);u.codeOnce=true;u.codeUpdatedAt=new Date().toISOString();
    persist();log("RESET_LOGIN_CODE",{userId:id,role:u.role});
    downloadBlob(`ma_dang_nhap_${u.publicCode}.csv`,"\ufeff"+`Họ tên,Vai trò,Mã hồ sơ,Mã đăng nhập\r\n"${u.name}","${roleName(u.role)}","${u.publicCode}","${code}"`);
    if(revealInDetails) loginCodeReveal={userId:id,code};
    toast("Đã cấp mã mới và tải file. Mã cũ không còn hợp lệ.",true);
    render();
    if(revealInDetails) showUserDetails(id,null);
  }
  function lockUser(id, reason, durationHours) {
    if (!requireActiveSession() || !isAdmin()) { toast("Chỉ Admin mới được khóa tài khoản."); return; }
    const user=state.users.find(item=>item.id===id);
    const cleanReason=String(reason||"").trim();
    if(!user){toast("Không tìm thấy tài khoản cần cập nhật.");return;}
    if(!cleanReason){toast("Hãy nhập lý do khóa tài khoản.");return;}
    const hours=Number(durationHours);
    if(![1,24,168,720,0].includes(hours)){toast("Thời hạn khóa không hợp lệ.");return;}
    const lockedAt=new Date();
    user.active=false;
    user.lockReason=cleanReason;
    user.lockedAt=lockedAt.toISOString();
    user.lockedUntil=hours===0?null:new Date(lockedAt.getTime()+hours*60*60*1000).toISOString();
    user.lockEndedAt=null;
    user.lockEndReason=null;
    persist();
    log("LOCK_USER",{userId:user.id,reason:cleanReason,durationHours:hours,lockedUntil:user.lockedUntil});
    scheduleLockExpiry();
    render();
  }
  function unlockUser(id) {
    if (!requireActiveSession() || !isAdmin()) { toast("Chỉ Admin mới được mở khóa tài khoản."); return; }
    const user=state.users.find(item=>item.id===id);
    if(!user){toast("Không tìm thấy tài khoản cần cập nhật.");return;}
    user.active=true;
    user.lockEndedAt=new Date().toISOString();
    user.lockEndReason="manual";
    persist();
    log("UNLOCK_USER",{userId:user.id,reason:"manual",lockReason:user.lockReason||""});
    scheduleLockExpiry();
    render();
  }
  function showUserDetails(id, trigger) {
    if (!requireActiveSession() || !isAdmin()) return;
    const user=state.users.find(item=>item.id===id);
    if(!user){toast("Không tìm thấy tài khoản cần xem.");return;}
    const dateText=value=>value?new Date(value).toLocaleString("vi-VN"):"Chưa ghi nhận";
    const creator=user.createdBy==="admin-demo"?"Quản trị viên":state.users.find(item=>item.id===user.createdBy)?.name||"Hệ thống";
    const classes=state.classes.filter(cls=>user.role==="student"
      ?(user.classIds||[]).includes(cls.id)
      :user.role==="teacher"?(cls.teacherIds||[]).includes(user.id)
      :(state.studentGuardians||[]).some(link=>link.parentId===user.id&&link.studentId&&state.users.find(item=>item.id===link.studentId)?.classIds?.includes(cls.id)));
    const links=(state.studentGuardians||[]).filter(link=>user.role==="parent"?link.parentId===user.id:user.role==="student"?link.studentId===user.id:false);
    const revealedCode=loginCodeReveal?.userId===user.id?loginCodeReveal.code:"";
    const relationshipNames={mother:"Mẹ",father:"Bố",guardian:"Người giám hộ",other:"Khác"};
    const relationshipStatus=link=>link.revokedAt||link.status==="revoked"?"Đã thu hồi":link.status==="verified"?"Đã xác minh":"Chờ Admin xác minh";
    const linkedStudents=user.role==="parent"
      ?links.filter(link=>link.status==="verified"&&!link.revokedAt).map(link=>state.users.find(item=>item.id===link.studentId)).filter(Boolean)
      :[];
    const relatedLearningRows=user.role==="student"
      ?state.assignments.filter(assignment=>!assignment.archived&&classes.some(cls=>cls.id===assignment.classId)).map(assignment=>({
        assignment,student:user,submission:state.submissions.find(item=>item.assignmentId===assignment.id&&item.studentId===user.id)
      }))
      :user.role==="parent"
        ?linkedStudents.flatMap(student=>state.assignments.filter(assignment=>!assignment.archived&&(student.classIds||[]).includes(assignment.classId)).map(assignment=>({
          assignment,student,submission:state.submissions.find(item=>item.assignmentId===assignment.id&&item.studentId===student.id)
        })))
        :[];
    const activeAssignments=user.role==="teacher"
      ?state.assignments.filter(assignment=>!assignment.archived&&classes.some(cls=>cls.id===assignment.classId))
      :relatedLearningRows.map(row=>row.assignment);
    const submissions=user.role==="student"
      ?state.submissions.filter(submission=>submission.studentId===user.id)
      :user.role==="parent"
        ?state.submissions.filter(submission=>linkedStudents.some(student=>student.id===submission.studentId))
        :user.role==="teacher"
          ?state.submissions.filter(submission=>activeAssignments.some(assignment=>assignment.id===submission.assignmentId))
          :[];
    const userLinkIds=new Set(links.map(link=>link.id));
    const activity=state.audit.filter(entry=>{
      if(entry.actor===user.id)return true;
      const detail=entry.detail&&typeof entry.detail==="object"?entry.detail:{};
      return Object.entries(detail).some(([key,value])=>
        ["userId","studentId","parentId","teacherId"].includes(key)&&value===user.id
        ||key==="linkId"&&userLinkIds.has(value)
        ||Array.isArray(value)&&value.includes(user.id)
      );
    }).slice(0,100);
    const assignmentsPanel=(user.role==="student"||user.role==="parent")
      ?`<section class="account-detail-section"><h3>Tiến độ học tập${user.role==="parent"?" của hồ sơ đã liên kết":""}</h3><div class="account-detail-stats"><div><b>${activeAssignments.length}</b><span>Lượt bài được giao</span></div><div><b>${submissions.length}</b><span>Bài đã nộp</span></div><div><b>${submissions.filter(submission=>submission.status==="submitted").length}</b><span>Chờ chấm</span></div></div>${relatedLearningRows.length?`<div class="table-wrap account-detail-table"><table><thead><tr><th>Bài tập</th><th>Lớp / học sinh</th><th>Hạn nộp</th><th>Trạng thái</th><th>Kết quả</th></tr></thead><tbody>${relatedLearningRows.map(({assignment,student,submission})=>`<tr><td>${esc(assignment.title)}</td><td>${esc(clsName(assignment.classId))}${user.role==="parent"?`<div class="smalltext">${esc(student.name)}</div>`:""}</td><td>${esc(assignment.due||"Không giới hạn")}</td><td>${submission?(submission.status==="submitted"?"Chờ chấm":"Đã nộp"):"Chưa nộp"}</td><td>${submission?`${esc(submission.score)}/${esc(submission.total)}`:"—"}</td></tr>`).join("")}</tbody></table></div>`:'<p class="muted">Chưa có bài tập đang giao.</p>'}</section>`
      :user.role==="teacher"
        ?`<section class="account-detail-section"><h3>Bài tập và lớp được phụ trách</h3><div class="account-detail-stats"><div><b>${classes.length}</b><span>Lớp được giao</span></div><div><b>${activeAssignments.length}</b><span>Bài đang giao</span></div><div><b>${submissions.filter(submission=>submission.status==="submitted").length}</b><span>Chờ chấm</span></div></div>${activeAssignments.length?`<div class="table-wrap account-detail-table"><table><thead><tr><th>Bài tập</th><th>Lớp</th><th>Hạn nộp</th><th>Bài nộp</th><th>Chờ chấm</th></tr></thead><tbody>${activeAssignments.map(assignment=>{const assignmentSubmissions=submissions.filter(item=>item.assignmentId===assignment.id);return `<tr><td>${esc(assignment.title)}</td><td>${esc(clsName(assignment.classId))}</td><td>${esc(assignment.due||"Không giới hạn")}</td><td>${assignmentSubmissions.length}</td><td>${assignmentSubmissions.filter(item=>item.status==="submitted").length}</td></tr>`}).join("")}</tbody></table></div>`:'<p class="muted">Chưa có bài tập đang giao.</p>'}</section>`
        :'<section class="account-detail-section"><p class="muted">Tài khoản Admin không có dữ liệu học tập cá nhân.</p></section>';
    const classPanel=classes.length?`<ul class="account-detail-list">${classes.map(cls=>{
      const studentCount=state.users.filter(item=>item.role==="student"&&(item.classIds||[]).includes(cls.id)).length;
      const teacherAssignments=(state.classTeacherAssignments||[]).filter(item=>item.classId===cls.id&&item.teacherId===user.id);
      const assignmentLabel=user.role==="teacher"?teacherAssignments.map(item=>item.role==="homeroom_teacher"?"GVCN":`GV bộ môn${item.subjectId?` · ${state.subjects.find(subject=>subject.id===item.subjectId)?.name||"Môn học"}`:""}`).join(", "):"";
      return `<li><div><b>${esc(cls.name)}</b><span>${esc(cls.code)}${user.role==="teacher"?` · ${esc(assignmentLabel||"Phân công lớp")}`:` · ${studentCount} học sinh`}</span></div>${user.role==="teacher"?`<button type="button" class="small secondary" data-action="manage-class-teachers" data-id="${esc(cls.id)}">Quản lý phân công</button>`:`<button type="button" class="small ghost" data-action="open-user-classes">Mở quản lý lớp</button>`}</li>`;
    }).join("")}</ul>`:'<p class="muted">Chưa có lớp liên quan.</p>';
    const relationshipPanel=(user.role==="student"||user.role==="parent")
      ?links.length?`<ul class="account-detail-list">${links.map(link=>{
        const relatedUser=state.users.find(item=>item.id===(user.role==="student"?link.parentId:link.studentId));
        const status=relationshipStatus(link);
        const canVerify=link.status==="pending"&&!link.revokedAt&&["parent","student"].includes(user.role)&&Boolean(relatedUser)&&relatedUser.active!==false&&user.active!==false;
        const canRevoke=!link.revokedAt&&link.status!=="revoked";
        return `<li class="account-guardian-item"><div><b>${esc(relatedUser?.name||"Tài khoản không tồn tại")}</b><dl class="account-guardian-info"><div><dt>${user.role==="student"?"Email phụ huynh":"Mã hồ sơ học sinh"}</dt><dd>${esc(user.role==="student"?(relatedUser?.email||"Chưa cung cấp"):(relatedUser?.publicCode||"Chưa có mã hồ sơ"))}</dd></div>${user.role==="student"?`<div><dt>Số điện thoại</dt><dd>${esc(relatedUser?.phone||"Chưa cung cấp")}</dd></div>`:""}<div><dt>Quan hệ</dt><dd>${esc(relationshipNames[link.relationship]||"Chưa ghi nhận")}</dd></div><div><dt>Trạng thái liên kết</dt><dd>${status}</dd></div>${link.verifiedAt?`<div><dt>Ngày xác minh</dt><dd>${esc(dateText(link.verifiedAt))}</dd></div>`:""}</dl></div><div class="account-detail-actions"><span class="pill ${link.status==="verified"&&!link.revokedAt?"":"off"}">${status}</span>${canVerify?`<button type="button" class="small secondary" data-action="verify-user-link" data-id="${esc(link.id)}">Xác minh</button>`:""}${canRevoke?`<button type="button" class="small danger" data-action="revoke-user-link" data-id="${esc(link.id)}">Thu hồi</button>`:""}</div></li>`;
      }).join("")}</ul>`:'<p class="muted">Chưa có liên kết phụ huynh–học sinh.</p>'
      :'<p class="muted">Chức năng liên kết chỉ áp dụng cho tài khoản học sinh và phụ huynh.</p>';
    const relationshipTitle=user.role==="student"?"Phụ huynh liên kết":user.role==="parent"?"Hồ sơ học sinh liên kết":"Lớp và phân công";
    const lockDetails=user.active===false?`<section class="account-detail-section"><h3>Thông tin khóa</h3><dl class="account-detail-grid"><div><dt>Lý do khóa</dt><dd>${esc(user.lockReason||"Chưa ghi nhận")}</dd></div><div><dt>Thời điểm khóa</dt><dd>${esc(dateText(user.lockedAt))}</dd></div><div><dt>Thời hạn</dt><dd>${user.lockedUntil?`Đến ${esc(dateText(user.lockedUntil))}`:"Vô thời hạn — cần Admin mở khóa thủ công"}</dd></div></dl></section>`:"";
    const overlay=document.createElement("div");
    overlay.className="account-detail-overlay";
    overlay.innerHTML=`<section class="account-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="account-detail-title" tabindex="-1">
      <header class="account-detail-heading"><div><p class="eyebrow">HỒ SƠ TÀI KHOẢN</p><h2 id="account-detail-title">${esc(user.name||"Chưa có họ tên")}</h2><p class="muted">${esc(roleName(user.role))} · ${esc(user.publicCode||"Chưa có mã hồ sơ")}</p></div><button type="button" class="ghost small" data-action="close-user-details" aria-label="Đóng chi tiết">Đóng</button></header>
      <div class="account-detail-status">${userStatus(user)}${user.externalCode?`<span class="pill">Mã ngoài: ${esc(user.externalCode)}</span>`:""}</div>
      <nav class="tabs account-detail-tabs" role="tablist" aria-label="Nội dung hồ sơ">
        <button type="button" role="tab" aria-selected="true" data-detail-tab="overview">Tổng quan</button>
        <button type="button" role="tab" aria-selected="false" data-detail-tab="classes">${relationshipTitle}</button>
        <button type="button" role="tab" aria-selected="false" data-detail-tab="learning">Học tập</button>
        <button type="button" role="tab" aria-selected="false" data-detail-tab="activity">Nhật ký (${activity.length})</button>
        <button type="button" role="tab" aria-selected="false" data-detail-tab="actions">Thao tác</button>
      </nav>
      <div class="account-detail-panel" data-detail-panel="overview">
        ${lockDetails}
        <section class="account-detail-section"><div class="row"><h3>Thông tin cá nhân</h3><button type="button" class="small secondary" data-action="edit-user-profile">Chỉnh sửa</button></div><dl class="account-detail-grid"><div><dt>Email</dt><dd>${esc(user.email||"Chưa cung cấp")}</dd></div><div><dt>Số điện thoại</dt><dd>${esc(user.phone||"Chưa cung cấp")}</dd></div><div><dt>Ngày tạo hồ sơ</dt><dd>${esc(dateText(user.createdAt))}</dd></div><div><dt>Người tạo</dt><dd>${esc(creator)}</dd></div><div><dt>Cập nhật mã gần nhất</dt><dd>${esc(dateText(user.codeUpdatedAt))}</dd></div></dl>
          <form id="account-profile-form" class="account-profile-form" hidden><div class="form-grid"><div><label for="account-profile-name">Họ tên</label><input id="account-profile-name" name="name" maxlength="120" required value="${esc(user.name||"")}"></div><div><label for="account-profile-email">Email</label><input id="account-profile-email" name="email" type="email" maxlength="254" value="${esc(user.email||"")}"></div><div><label for="account-profile-phone">Số điện thoại</label><input id="account-profile-phone" name="phone" maxlength="30" value="${esc(user.phone||"")}"></div></div><div class="account-detail-actions"><button type="submit">Lưu thông tin</button><button type="button" class="ghost" data-action="cancel-edit-user-profile">Hủy</button></div></form>
        </section>
      </div>
      <div class="account-detail-panel" data-detail-panel="classes" hidden>
        <section class="account-detail-section"><h3>${relationshipTitle}</h3>${classPanel}</section>
        ${user.role==="student"||user.role==="parent"?`<section class="account-detail-section"><h3>${user.role==="student"?"Thông tin phụ huynh":"Hồ sơ học sinh"} (${links.length})</h3>${relationshipPanel}</section>`:""}
      </div>
      <div class="account-detail-panel" data-detail-panel="learning" hidden>${assignmentsPanel}</div>
      <div class="account-detail-panel" data-detail-panel="activity" hidden>
        <section class="account-detail-section"><h3>Lịch sử liên quan (${activity.length})</h3>${activity.length?`<div class="table-wrap account-detail-table"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hoạt động</th><th>Chi tiết</th></tr></thead><tbody>${activity.map(entry=>`<tr><td>${esc(dateText(entry.at))}</td><td>${esc(state.users.find(item=>item.id===entry.actor)?.name||"Hệ thống")}</td><td>${esc(entry.action||"Thao tác")}</td><td>${esc(JSON.stringify(entry.detail||{}))}</td></tr>`).join("")}</tbody></table></div>`:'<p class="empty">Chưa có lịch sử hoạt động liên quan trong nhật ký.</p>'}<p class="muted smalltext">Nhật ký hiện lưu tối đa 500 sự kiện trên trình duyệt này.</p></section>
      </div>
      <div class="account-detail-panel" data-detail-panel="actions" hidden>
        <section class="account-detail-section account-login-code"><div><h3>Mã đăng nhập</h3>${revealedCode?`<p class="muted">Mã mới được cấp; chỉ hiển thị tạm trong hồ sơ này và không lưu dạng rõ.</p><div class="account-login-code-value"><code>${esc(revealedCode)}</code><button type="button" class="small secondary" data-action="copy-login-code">Sao chép</button></div>`:'<p class="muted">Mã đã cấp trước đây không thể xem lại. Cấp mã mới để thay mã hiện tại và xem mã mới tại đây.</p>'}</div><button type="button" class="small ${revealedCode?"ghost":"secondary"}" data-action="reset-code">${revealedCode?"Cấp mã khác":"Cấp mã mới & xem"}</button></section>
        <section class="account-detail-section"><h3>Trạng thái tài khoản</h3><p class="muted">${user.active===false?"Tài khoản đang bị khóa.":"Tài khoản đang hoạt động."}</p>${user.active===false?'<button type="button" class="secondary" data-action="unlock-user">Mở khóa tài khoản</button>':'<button type="button" class="danger" data-action="begin-user-lock">Khóa tài khoản</button>'}</section>
      </div>
      <footer class="account-detail-footer"><span class="muted">${esc(roleName(user.role))} · ${esc(user.publicCode||"")}</span><button type="button" class="secondary" data-action="close-user-details">Đóng hồ sơ</button></footer>
    </section>`;
    document.body.appendChild(overlay);
    const dialog=overlay.querySelector(".account-detail-dialog");
    const close=()=>{overlay.remove();if(loginCodeReveal?.userId===user.id)loginCodeReveal=null;trigger?.focus();};
    overlay.addEventListener("click",event=>{if(event.target===overlay)close();});
    overlay.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();close();}});
    overlay.querySelectorAll('[data-action="close-user-details"]').forEach(button=>button.addEventListener("click",close));
    overlay.querySelectorAll("[data-detail-tab]").forEach(button=>button.addEventListener("click",()=>{
      const selected=button.dataset.detailTab;
      overlay.querySelectorAll("[data-detail-tab]").forEach(tab=>tab.setAttribute("aria-selected",String(tab===button)));
      overlay.querySelectorAll("[data-detail-panel]").forEach(panel=>{panel.hidden=panel.dataset.detailPanel!==selected;});
    }));
    overlay.querySelector('[data-action="edit-user-profile"]').addEventListener("click",()=>{
      const form=overlay.querySelector("#account-profile-form");
      form.hidden=false;
      form.querySelector('[name="name"]').focus();
    });
    overlay.querySelector('[data-action="cancel-edit-user-profile"]').addEventListener("click",()=>{
      const form=overlay.querySelector("#account-profile-form");
      form.hidden=true;
      form.reset();
    });
    overlay.querySelector("#account-profile-form").addEventListener("submit",event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const name=form.elements.name.value.trim();
      const email=form.elements.email.value.trim();
      const phone=form.elements.phone.value.trim();
      if(!name){toast("Họ tên không được để trống.");return;}
      if(email&&state.users.some(item=>item.id!==user.id&&item.role===user.role&&String(item.email||"").trim().toLowerCase()===email.toLowerCase())){
        toast("Email đã được sử dụng bởi tài khoản cùng vai trò.");return;
      }
      const changedFields=[];
      if(name!==String(user.name||""))changedFields.push("name");
      if(email!==String(user.email||""))changedFields.push("email");
      if(phone!==String(user.phone||""))changedFields.push("phone");
      if(!changedFields.length){toast("Không có thông tin nào thay đổi.");return;}
      user.name=name;user.email=email;user.phone=phone;
      persist();log("UPDATE_USER_PROFILE",{userId:user.id,changedFields});
      close();render();
      showUserDetails(user.id,null);
      toast("Đã cập nhật hồ sơ tài khoản.",true);
    });
    overlay.querySelectorAll('[data-action="verify-user-link"],[data-action="revoke-user-link"]').forEach(button=>button.addEventListener("click",event=>{
      event.stopPropagation();
      const link=(state.studentGuardians||[]).find(item=>item.id===button.dataset.id);
      if(!link||!links.some(item=>item.id===link.id)){
        toast("Liên kết không còn thuộc hồ sơ này.");return;
      }
      if(button.dataset.action==="verify-user-link"){
        const parent=state.users.find(item=>item.id===link.parentId&&item.role==="parent"&&item.active!==false);
        const student=state.users.find(item=>item.id===link.studentId&&item.role==="student"&&item.active!==false);
        if(!parent||!student||link.status!=="pending"||link.revokedAt){toast("Liên kết không còn đủ điều kiện xác minh.");return;}
        if(!confirm(`Chỉ xác minh sau khi đã kiểm tra quan hệ thực tế.\n\nXác nhận ${parent.name} với học sinh ${student.name}?`))return;
        link.status="verified";link.verifiedAt=new Date().toISOString();link.verifiedBy=session.id;
        persist();log("PARENT_LINK_VERIFIED",{linkId:link.id,parentId:link.parentId,studentId:link.studentId});
        toast("Đã xác minh liên kết phụ huynh–học sinh.",true);
      }else{
        if(link.revokedAt||link.status==="revoked"){toast("Liên kết đã được thu hồi.");return;}
        if(!confirm("Thu hồi liên kết này? Phụ huynh sẽ mất quyền xem hồ sơ học sinh qua liên kết này."))return;
        link.revokedAt=new Date().toISOString();link.revokedBy=session.id;link.status="revoked";
        persist();log("PARENT_LINK_REVOKED",{linkId:link.id,parentId:link.parentId,studentId:link.studentId});
        toast("Đã thu hồi liên kết phụ huynh–học sinh.",true);
      }
      close();render();showUserDetails(user.id,null);
    }));
    overlay.querySelectorAll('[data-action="manage-class-teachers"],[data-action="open-user-classes"]').forEach(button=>button.addEventListener("click",event=>{
      event.stopPropagation();
      const classId=button.dataset.id;
      close();
      if(button.dataset.action==="manage-class-teachers"){
        activeTab="classes";
        render();
        showClassDetails(classId);
      }
      else{activeTab="classes";render();}
    }));
    const beginLockButton=overlay.querySelector('[data-action="begin-user-lock"]');
    if(beginLockButton)beginLockButton.addEventListener("click",event=>{
      event.stopPropagation();
      const section=document.createElement("section");
      section.className="account-detail-section";
      section.id="account-lock-form-area";
      section.innerHTML=`<h3>Khóa tài khoản</h3><form id="account-lock-form"><label for="account-lock-reason">Lý do khóa</label><textarea id="account-lock-reason" name="reason" maxlength="500" required placeholder="Nhập lý do để lưu trong hồ sơ và nhật ký quản trị"></textarea><label for="account-lock-duration">Thời hạn</label><select id="account-lock-duration" name="duration"><option value="1">1 giờ</option><option value="24">1 ngày</option><option value="168">7 ngày</option><option value="720">30 ngày</option><option value="0">Vô thời hạn (mở khóa thủ công)</option></select><p class="muted smalltext">Tài khoản sẽ tự mở khóa khi hết thời hạn đã chọn.</p><div class="account-detail-actions"><button type="submit" class="danger">Xác nhận khóa</button><button type="button" class="ghost" data-action="cancel-user-lock">Hủy</button></div></form>`;
      overlay.querySelector(".account-detail-footer").before(section);
      beginLockButton.disabled=true;
      const lockForm=section.querySelector("#account-lock-form");
      lockForm.addEventListener("submit",submitEvent=>{
        submitEvent.preventDefault();
        const formData=new FormData(lockForm);
        const reason=String(formData.get("reason")||"").trim();
        if(!reason){toast("Hãy nhập lý do khóa tài khoản.");return;}
        close();
        lockUser(user.id,reason,formData.get("duration"));
      });
      section.querySelector('[data-action="cancel-user-lock"]').addEventListener("click",()=>{section.remove();beginLockButton.disabled=false;});
      section.querySelector("#account-lock-reason").focus();
    });
    const unlockButton=overlay.querySelector('[data-action="unlock-user"]');
    if(unlockButton)unlockButton.addEventListener("click",event=>{event.stopPropagation();close();unlockUser(user.id);});
    overlay.querySelector('[data-action="reset-code"]').addEventListener("click",event=>{event.stopPropagation();close();resetCode(user.id,true);});
    const copyCodeButton=overlay.querySelector('[data-action="copy-login-code"]');
    if(copyCodeButton) copyCodeButton.addEventListener("click",async event=>{
      event.stopPropagation();
      if(!navigator.clipboard?.writeText){toast("Trình duyệt không hỗ trợ sao chép tự động. Hãy chọn và sao chép mã trong hồ sơ.");return;}
      try{await navigator.clipboard.writeText(revealedCode);toast("Đã sao chép mã đăng nhập.",true);}
      catch{toast("Không thể sao chép tự động. Hãy chọn và sao chép mã trong hồ sơ.");}
    });
    dialog.focus();
  }
  function showClassDetails(classId) {
    if(!requireActiveSession()||pageRole!=="admin"||!isAdmin()){toast("Chỉ Admin mới được xem chi tiết và quản lý phân công lớp.");return;}
    const cls=state.classes.find(item=>item.id===classId);
    if(!cls){toast("Không tìm thấy lớp cần xem.");return;}
    const teachers=state.users.filter(user=>user.role==="teacher"&&user.active!==false);
    const subjects=(state.subjects||[]).filter(subject=>subject.active!==false);
    const activeAssignments=()=> (state.classTeacherAssignments||[]).filter(item=>
      item.classId===classId&&item.status==="active"&&!item.revokedAt
    );
    const assignmentRows=()=>activeAssignments().length?activeAssignments().map(record=>{
      const teacher=state.users.find(item=>item.id===record.teacherId);
      const subject=state.subjects.find(item=>item.id===record.subjectId);
      const assignmentLabel=record.role==="homeroom_teacher"
        ?"Giáo viên chủ nhiệm"
        :`Giáo viên bộ môn · ${esc(subject?.name||"Chưa phân loại")}`;
      return `<tr><td>${esc(teacher?.name||"Tài khoản không còn hoạt động")}</td><td>${assignmentLabel}</td><td><button type="button" class="small danger" data-revoke-teacher-assignment="${esc(record.id)}">Thu hồi</button></td></tr>`;
    }).join(""):'<tr><td colspan="3" class="empty">Lớp chưa có phân công giáo viên.</td></tr>';
    const classStudentIds=Core.getActiveClassStudentIds
      ?Core.getActiveClassStudentIds(state,classId)
      :state.users.filter(user=>user.role==="student"&&user.active!==false&&(user.classIds||[]).includes(classId)).map(user=>user.id);
    const students=classStudentIds.map(studentId=>state.users.find(user=>user.id===studentId)).filter(Boolean);
    const overlay=document.createElement("div");
    overlay.className="account-detail-overlay class-detail-overlay";
    overlay.innerHTML=`<section class="account-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="class-detail-title" tabindex="-1">
      <header class="account-detail-heading">
        <div><p class="eyebrow">CHI TIẾT LỚP HỌC</p><h2 id="class-detail-title">${esc(cls.name)}</h2><p class="muted">${esc(cls.code)} · ${students.length} học sinh</p></div>
        <button type="button" class="ghost small" data-close-class-details aria-label="Đóng chi tiết lớp">Đóng</button>
      </header>
      <section class="account-detail-section">
        <h3>Thông tin lớp</h3>
        <form id="admin-class-edit-form" data-id="${esc(cls.id)}" class="form-grid">
          <div><label for="edit-class-name">Tên lớp</label><input id="edit-class-name" name="name" required maxlength="120" value="${esc(cls.name)}"></div>
          <div><label for="edit-class-code">Mã lớp</label><input id="edit-class-code" name="code" required maxlength="80" value="${esc(cls.code)}"></div>
          <div class="actions"><button type="submit">Lưu thông tin lớp</button></div>
        </form>
      </section>
      <section class="account-detail-section">
        <h3>Giáo viên và môn học</h3>
        <p class="muted">Thêm hoặc thu hồi giáo viên chủ nhiệm, giáo viên bộ môn ngay tại chi tiết lớp. Lịch sử bài giao và kết quả học tập không bị xóa khi thu hồi.</p>
        <div class="table-wrap"><table><thead><tr><th>Giáo viên</th><th>Vai trò / môn học</th><th></th></tr></thead><tbody>${assignmentRows()}</tbody></table></div>
        ${teachers.length?`<form id="admin-class-detail-assignment-form" class="form-grid">
          <input type="hidden" name="classId" value="${esc(classId)}">
          <div><label for="assign-teacher-id">Giáo viên</label><select id="assign-teacher-id" name="teacherId" required><option value="">Chọn giáo viên</option>${teachers.map(teacher=>`<option value="${esc(teacher.id)}">${esc(teacher.name)} · ${esc(teacher.publicCode||"")}</option>`).join("")}</select></div>
          <div><label for="assign-teacher-role">Vai trò</label><select id="assign-teacher-role" name="role"><option value="subject_teacher">Giáo viên bộ môn</option><option value="homeroom_teacher">Giáo viên chủ nhiệm</option></select></div>
          <div id="assign-subject-field"><label for="assign-subject-id">Môn học</label><select id="assign-subject-id" name="subjectId" ${subjects.length?"required":"disabled"}><option value="">Chọn môn học</option>${subjects.map(subject=>`<option value="${esc(subject.id)}">${esc(subject.name)}</option>`).join("")}</select>${subjects.length?"":'<small class="muted">Chưa có môn học đang hoạt động.</small>'}</div>
          <div class="admin-form-submit"><button type="submit">Thêm phân công</button></div>
        </form>`:'<p class="empty">Chưa có giáo viên đang hoạt động để phân công.</p>'}
      </section>
      <section class="account-detail-section">
        <h3>Danh sách học sinh (${students.length})</h3>
        ${students.length?`<ul class="account-detail-list">${students.map(student=>`<li>${esc(student.name)} <span class="muted">${esc(student.publicCode||"")}</span></li>`).join("")}</ul>`:'<p class="empty">Lớp chưa có học sinh.</p>'}
      </section>
    </section>`;
    document.body.appendChild(overlay);
    const modal=overlay.querySelector(".account-detail-dialog");
    const closeModal=()=>{if(overlay.parentNode)overlay.remove();};
    overlay.addEventListener("click",event=>{if(event.target===overlay)closeModal();});
    modal.querySelector("[data-close-class-details]").addEventListener("click",closeModal);
    const assignmentRole=modal.querySelector("#assign-teacher-role");
    const assignmentSubject=modal.querySelector("#assign-subject-id");
    const syncAssignmentFields=()=>{
      const needsSubject=assignmentRole.value==="subject_teacher";
      modal.querySelector("#assign-subject-field").hidden=!needsSubject;
      assignmentSubject.required=needsSubject&&subjects.length>0;
    };
    assignmentRole?.addEventListener("change",syncAssignmentFields);
    if(assignmentRole)syncAssignmentFields();
    modal.querySelector("#admin-class-detail-assignment-form")?.addEventListener("submit",event=>{
      event.preventDefault();
      if(!requireActiveSession()||pageRole!=="admin"||!isAdmin()){toast("Chỉ Admin mới được phân công giáo viên.");return;}
      try{
        const form=event.currentTarget;
        const role=form.elements.role.value;
        const record=Core.assignTeacher(state,session,{
          classId:form.elements.classId.value,
          teacherId:form.elements.teacherId.value,
          subjectId:role==="subject_teacher"?form.elements.subjectId.value:null,
          role
        });
        cls.teacherIds=Array.from(new Set([...(cls.teacherIds||[]),record.teacherId]));
        state.classTeachers=state.classTeachers||[];
        const relation=state.classTeachers.find(item=>item.classId===classId&&item.userId===record.teacherId);
        if(relation)relation.leftAt=null;
        else state.classTeachers.push({classId,userId:record.teacherId,joinedAt:record.assignedAt,leftAt:null});
        persist();
        log("ASSIGN_CLASS_TEACHER",{classId,teacherId:record.teacherId,subjectId:record.subjectId,role});
        closeModal();
        render();
        showClassDetails(classId);
        toast("Đã lưu phân công giáo viên.",true);
      }catch(error){toast(error.message);}
    });
    modal.addEventListener("click",event=>{
      const revokeButton=event.target.closest("[data-revoke-teacher-assignment]");
      if(!revokeButton)return;
      const record=activeAssignments().find(item=>item.id===revokeButton.dataset.revokeTeacherAssignment);
      if(!record||!confirm("Thu hồi phân công này? Bài đã giao và kết quả cũ vẫn được giữ."))return;
      try{
        Core.revokeTeacherAssignment(state,session,record.id);
        if(!Core.activeTeacherAssignment(state,classId,record.teacherId).length){
          cls.teacherIds=(cls.teacherIds||[]).filter(id=>id!==record.teacherId);
          (state.classTeachers||[]).forEach(item=>{
            if(item.classId===classId&&item.userId===record.teacherId&&!item.leftAt)item.leftAt=record.revokedAt;
          });
        }
        persist();
        log("REVOKE_CLASS_TEACHER",{classId,teacherId:record.teacherId,subjectId:record.subjectId,role:record.role});
        closeModal();
        render();
        showClassDetails(classId);
        toast("Đã thu hồi phân công. Lịch sử bài giao được giữ nguyên.",true);
      }catch(error){toast(error.message);}
    });
    modal.focus();
  }
  function createClass(form) {
    const name=form.querySelector("#class-name").value.trim(),code=form.querySelector("#class-code").value.trim();
    const teacherId=form.querySelector("#teacher-id")?.value||"";
    if(!name||!code)return;
    if(state.classes.some(c=>c.code.toLowerCase()===code.toLowerCase())){toast("Mã lớp đã tồn tại.");return;}
    const createdAt=new Date().toISOString();
    const cls={id:uid("class"),name,code,teacherIds:teacherId?[teacherId]:[],createdAt};
    state.classes.push(cls);
    if(teacherId){
      const record=Core.assignTeacher(state,session,{classId:cls.id,teacherId,role:"homeroom_teacher"});
      state.classTeachers.push({classId:cls.id,userId:teacherId,joinedAt:record.assignedAt,leftAt:null});
    }
    persist();log("CREATE_CLASS",{name,code,teacherId});activeTab="classes";render();toast("Đã tạo lớp học.",true);
  }
  function addStudentToClass(form) {
    if(!requireActiveSession()) return;
    const classId=form.querySelector("#target-class").value, studentId=form.querySelector("#student-select").value;
    const c=state.classes.find(c=>c.id===classId),u=state.users.find(u=>u.id===studentId);
    if(!c||!u||u.role!=="student")return;
    if(!isAdmin()&&!allowedClass(c)){toast("Bạn không có quyền sửa lớp này.");return;}
    u.classIds=u.classIds||[];if(!u.classIds.includes(classId))u.classIds.push(classId);
    state.classStudents = state.classStudents || [];
    const csRec = state.classStudents.find(cs => cs.classId === classId && cs.userId === studentId);
    if (csRec) csRec.leftAt = null;
    else state.classStudents.push({ classId, userId: studentId, joinedAt: new Date().toISOString(), leftAt: null });
    persist();log("ADD_STUDENT_TO_CLASS",{studentId,classId});render();toast("Đã thêm học sinh vào lớp.",true);
  }
  function nextPublicCode(role) {
    const prefix = role === "parent" ? "PH" : role === "teacher" ? "GV" : "HS";
    let number = state.users.filter(user => user.role === role).length + 1;
    let code = `${prefix}-${String(number).padStart(4, "0")}`;
    while (state.users.some(user => user.publicCode === code)) {
      number++;
      code = `${prefix}-${String(number).padStart(4, "0")}`;
    }
    return code;
  }
  function createTeacherStudent(form) {
    if (!requireActiveSession() || pageRole !== "teacher" || session?.role !== "teacher") return;
    const name = form.elements.studentName.value.trim();
    const email = form.elements.studentEmail.value.trim();
    const classId = form.elements.classId.value;
    const cls = state.classes.find(item => item.id === classId);
    if (!name || !cls || !allowedClass(cls)) {
      toast("Hãy chọn lớp được phân công và nhập họ tên học sinh.");
      return;
    }

    const student = {
      id: uid("student"),
      role: "student",
      name,
      email,
      publicCode: nextPublicCode("student"),
      codeHash: "",
      active: true,
      classIds: [classId],
      createdAt: new Date().toISOString(),
      createdBy: session.id
    };
    const loginCode = makeLoginCode("student");
    student.codeHash = hashCode(loginCode);
    state.users.push(student);
    state.classStudents = state.classStudents || [];
    state.classStudents.push({ classId, userId: student.id, joinedAt: student.createdAt, leftAt: null });
    persist();
    log("TEACHER_CREATE_STUDENT", { studentId: student.id, classId });
    const csv = "\ufeff" + [
      ["Họ tên", "Vai trò", "Mã hồ sơ", "Email", "Lớp", "Mã đăng nhập"],
      [student.name, "Học sinh", student.publicCode, student.email, cls.name, loginCode]
    ].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadBlob(`ma_dang_nhap_${student.publicCode}.csv`, csv);
    render();
    toast("Đã tạo học sinh. File CSV chứa mã đăng nhập một lần đã được tải xuống.", true);
  }
  function requestTeacherParentLink(form) {
    if (!requireActiveSession() || pageRole !== "teacher" || session?.role !== "teacher") return;
    const name = form.elements.parentName.value.trim();
    const email = form.elements.parentEmail.value.trim();
    const phone = form.elements.parentPhone.value.trim();
    const studentId = form.elements.studentId.value;
    const relationship = form.elements.relationship.value;
    const student = state.users.find(user => user.id === studentId && user.role === "student" && user.active !== false);
    const classIds = student ? (student.classIds || []).filter(id => allowedClass(state.classes.find(cls => cls.id === id))) : [];
    if (!name || !student || !classIds.length) {
      toast("Chỉ có thể gửi yêu cầu cho học sinh thuộc lớp bạn được phân công.");
      return;
    }

    state.studentGuardians = state.studentGuardians || [];
    let parent = email
      ? state.users.find(user => user.role === "parent" && String(user.email || "").trim().toLowerCase() === email.toLowerCase())
      : null;
    if (parent && parent.active === false) {
      toast("Tài khoản phụ huynh đang bị khóa. Hãy liên hệ Admin.");
      return;
    }
    if (parent && !parent.name) parent.name = name;
    const duplicateLink = parent && state.studentGuardians.some(link =>
      link.parentId === parent.id && link.studentId === student.id && !link.revokedAt
    );
    if (duplicateLink) {
      toast("Đã có yêu cầu hoặc liên kết còn hiệu lực với phụ huynh này.");
      return;
    }

    let loginCode = "";
    if (!parent) {
      parent = {
        id: uid("parent"),
        role: "parent",
        name,
        email,
        phone,
        publicCode: nextPublicCode("parent"),
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: session.id
      };
      loginCode = makeLoginCode("parent");
      parent.codeHash = hashCode(loginCode);
      state.users.push(parent);
    }
    const link = {
      id: uid("guardian_link"),
      parentId: parent.id,
      studentId: student.id,
      relationship,
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: session.id,
      revokedAt: null
    };
    state.studentGuardians.push(link);
    persist();
    log("TEACHER_REQUEST_PARENT_LINK", { parentId: parent.id, studentId: student.id, linkId: link.id });
    if (loginCode) {
      const csv = "\ufeff" + [
        ["Họ tên", "Vai trò", "Mã hồ sơ", "Email", "Mã đăng nhập", "Trạng thái liên kết"],
        [parent.name, "Phụ huynh", parent.publicCode, parent.email, loginCode, "Chờ Admin xác minh"]
      ].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
      downloadBlob(`ma_dang_nhap_${parent.publicCode}.csv`, csv);
    }
    activeTab = "parents";
    render();
    toast(loginCode
      ? "Đã tạo tài khoản và gửi yêu cầu liên kết. Phụ huynh chỉ xem được dữ liệu sau khi Admin xác minh; mã nằm trong file CSV vừa tải."
      : "Đã gửi yêu cầu liên kết đến tài khoản phụ huynh hiện có. Chờ Admin xác minh.", true);
  }
  function removeStudent(id,classId) {
    if(!requireActiveSession()) return;
    const c=state.classes.find(c=>c.id===classId),u=state.users.find(u=>u.id===id);
    if(!c||!u||(!isAdmin()&&!allowedClass(c)))return;
    if(!confirm(`Gỡ ${u.name} khỏi lớp ${c.name}? Bài nộp và điểm đã có sẽ được giữ lại.`))return;
    u.classIds=(u.classIds||[]).filter(x=>x!==classId);
    state.classStudents = state.classStudents || [];
    state.classStudents.forEach(cs => {
      if (cs.classId === classId && cs.userId === id && !cs.leftAt) {
        cs.leftAt = new Date().toISOString();
      }
    });
    persist();log("REMOVE_STUDENT_FROM_CLASS",{studentId:id,classId});render();toast("Đã gỡ học sinh khỏi lớp; lịch sử bài nộp được giữ lại.",true);
  }
  function createAssignment(form) {
    if(!requireActiveSession()) return;
    const classId=form.querySelector("#assignment-class").value,c=state.classes.find(c=>c.id===classId);
    if(!c||!allowedClass(c)){toast("Không có quyền tạo/sửa bài cho lớp này.");return;}
    const title=form.querySelector("#assignment-title").value.trim(),due=form.querySelector("#assignment-due").value,questions=questionDraftQuestions("assignment");
    const subjectId=form.querySelector("#assignment-subject")?.value||"";
    const editId=form.querySelector("#assignment-edit-id")?.value||"";
    const durationInput=form.querySelector("#assignment-duration")?.value;
    const durationMinutes=durationInput && Number(durationInput) > 0 ? Number(durationInput) : null;
    const allowLate=form.querySelector("#assignment-allow-late") ? form.querySelector("#assignment-allow-late").value === "true" : true;
    if(!title||!questions.length){toast("Nhập tên bài và thêm ít nhất một câu hỏi hợp lệ.");return;}
    const minigameEnabled=form.querySelector("#assignment-minigame-enabled")?.checked===true;
    const minigames=Object.fromEntries(Array.from(form.querySelectorAll('input[name="assignment-minigame"]')).map(input=>[input.value,input.checked]));
    if(!editId&&!subjectId){toast("Hãy chọn môn học cho bài tập.");return;}
    if(!isAdmin()&&subjectId&&!Core.canTeachSubject(state,session,classId,subjectId)){
      const subject=state.subjects.find(item=>item.id===subjectId)?.name||"đã chọn";
      toast(`Bạn chưa được phân công môn ${subject} trong lớp ${c.name}. Hãy nhờ GVCN hoặc Admin kiểm tra mục phân công giáo viên.`);
      return;
    }
    if(editId){
      const a=state.assignments.find(x=>x.id===editId);
      if(!a){toast("Không tìm thấy bài tập cần sửa. Hãy tải lại trang.");return;}
      if(a.archived){toast("Hãy khôi phục bài tập trước khi sửa.");return;}
      const oldClassId=a.classId;
      if(!isAdmin()&&!allowedClass(state.classes.find(x=>x.id===oldClassId))){toast("Không có quyền sửa bài tập này.");return;}
      const relatedSubmissions=state.submissions.filter(s=>s.assignmentId===a.id);
      const questionsChanged=JSON.stringify(a.questions)!==JSON.stringify(questions);
      const classChanged=a.classId!==classId;
      if(a.subjectId&&subjectId!==a.subjectId){toast("Không thể đổi môn học của bài đã giao. Hãy tạo bài giao mới trong Ngân hàng Quiz.");return;}
      if(classChanged){
        toast("Bài đã giao không thể chuyển lớp. Hãy giao Quiz từ ngân hàng cho lớp đích.");
        return;
      }
      if(questionsChanged && relatedSubmissions.length){
        toast("Bài đã có bài nộp không được sửa câu hỏi. Hãy tạo phiên bản mới trong Ngân hàng Quiz.");
        return;
      }
      if(questionsChanged){
        const quiz=state.quizzes.find(item=>item.id===a.quizId);
        if(!quiz||(!isAdmin()&&quiz.ownerId!==session.id)){
          toast("Chỉ chủ sở hữu Quiz mới được sửa nội dung gốc. Hãy tạo Quiz của riêng bạn trong ngân hàng.");
          return;
        }
        try {
          const result=Core.updateQuiz(state,session,quiz.id,{title,description:quiz.description,subjectId,questions});
          a.questions=JSON.parse(JSON.stringify(result.version.questions));
          a.quizVersionId=result.version.id;
          const quizAssignment=state.quizAssignments.find(item=>item.id===a.id);
          if(quizAssignment)quizAssignment.quizVersionId=result.version.id;
        } catch(error) {
          toast(error.message);
          return;
        }
      }
      a.title=title;a.due=due;a.durationMinutes=durationMinutes;a.allowLate=allowLate;a.minigameEnabled=minigameEnabled;a.minigames=minigames;
      if(subjectId)a.subjectId=subjectId;
      a.updatedAt=new Date().toISOString();
      const quizAssignment=state.quizAssignments.find(item=>item.id===a.id);
      if(quizAssignment){quizAssignment.title=title;quizAssignment.dueAt=due;if(subjectId)quizAssignment.subjectId=subjectId;quizAssignment.minigameEnabled=minigameEnabled;quizAssignment.minigames={...minigames};}
      persist();log("UPDATE_ASSIGNMENT",{assignmentId:a.id,classId,title,questionCount:questions.length,questionsChanged,classChanged,hasSubmissions:relatedSubmissions.length>0});
      assignmentEditId=null;window.__teacherAssignmentEditId="";uiState.teacherAssignmentDraftId=null;activeTab="assignments";render();
      toast(questionsChanged?"Đã tạo phiên bản Quiz mới; bài đã giao vẫn giữ nguyên phiên bản cũ.":"Đã cập nhật thông tin bài tập.",true);return;
    }
    try {
      const {quiz}=Core.createQuiz(state,session,{title,subjectId,questions});
      const [assignment]=Core.assignQuizToClasses(state,session,quiz.id,[{classId,title,due,durationMinutes,allowLate}]);
      assignment.minigameEnabled=minigameEnabled;
      assignment.minigames=minigames;
      const quizAssignment=state.quizAssignments.find(item=>item.id===assignment.id);
      if(quizAssignment){quizAssignment.minigameEnabled=minigameEnabled;quizAssignment.minigames={...minigames};}
    } catch(error) {
      toast(error.message);
      return;
    }
    persist();log("CREATE_ASSIGNMENT",{classId,title,subjectId,questionCount:questions.length,minigameEnabled});assignmentEditId=null;window.__teacherAssignmentEditId="";uiState.teacherAssignmentDraftId=null;activeTab="assignments";render();toast("Đã lưu Quiz, tạo phiên bản và giao bài.",true);
  }
  function editAssignment(id) {
    const a=state.assignments.find(x=>x.id===id);
    if(!a){toast("Không tìm thấy bài tập.");return;}
    if(a.archived){toast("Hãy khôi phục bài tập trước khi sửa.");return;}
    const c=state.classes.find(x=>x.id===a.classId);
    if(!isAdmin()&&!allowedClass(c)){toast("Không có quyền sửa bài tập này.");return;}
    assignmentEditId=id;window.__teacherAssignmentEditId=id;uiState.teacherAssignmentDraftId=null;activeTab="assignments";render();
    document.getElementById("assignment-form")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function cancelEditAssignment() { assignmentEditId=null;window.__teacherAssignmentEditId="";uiState.teacherAssignmentDraftId=null;activeTab="assignments";render(); }
  function spreadsheetToQuizText(rows) {
    if(!rows?.length) return "";
    const norm=v=>String(v??"").trim();
    const headers=(rows[0]||[]).map(v=>norm(v).toLocaleLowerCase("vi-VN"));
    const questionIdx=headers.findIndex(v=>v.includes("câu hỏi")||v==="câu"||v==="question"||v==="nội dung câu hỏi");
    const answerIdx=headers.findIndex(v=>v.includes("đáp án đúng")||v==="đáp án"||v==="correct answer"||v==="correct");
    const optionIdx=["a","b","c","d"].map(letter=>headers.findIndex(v=>v===letter||v===`đáp án ${letter}`||v===`phương án ${letter}`));
    const hasStructured=questionIdx>=0&&optionIdx.filter(i=>i>=0).length>=2&&answerIdx>=0;
    if(hasStructured){
      return rows.slice(1).map(row=>{
        const q=norm(row[questionIdx]);if(!q)return "";
        const correct=norm(row[answerIdx]).replace(/[.)]/g,"").toUpperCase();
        const opts=optionIdx.map((idx,j)=>({idx,label:String.fromCharCode(65+j)})).filter(o=>o.idx>=0&&norm(row[o.idx]));
        return [q,...opts.map(o=>`${correct===o.label?"*":""}${o.label}. ${norm(row[o.idx])}`)].join("\n");
      }).filter(Boolean).join("\n\n");
    }
    // Fallback: each spreadsheet row is converted to a readable line for manual editing.
    return rows.map(row=>row.map(norm).filter(Boolean).join(" | ")).filter(Boolean).join("\n\n");
  }
  async function importAssignmentFile(file) {
    const name=file.name.toLowerCase();let textContent="";
    if(name.endsWith(".docx")){
      if(!window.mammoth){throw new Error("Chưa tải được thư viện đọc Word. Hãy kiểm tra kết nối mạng rồi thử lại.");}
      const buffer=await file.arrayBuffer();const result=await window.mammoth.extractRawText({arrayBuffer:buffer});textContent=result.value||"";
    } else if(name.endsWith(".xlsx")||name.endsWith(".xls")||name.endsWith(".csv")){
      if(!window.XLSX)throw new Error("Chưa tải được thư viện đọc Excel. Hãy kiểm tra kết nối mạng rồi thử lại.");
      const buffer=await file.arrayBuffer();const workbook=XLSX.read(buffer,{type:"array"});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:""});textContent=spreadsheetToQuizText(rows);
    } else throw new Error("Chỉ hỗ trợ tệp .docx, .xlsx, .xls hoặc .csv.");
    if(!textContent.trim())throw new Error("Không tìm thấy nội dung câu hỏi trong tệp.");
    const imported = parseQuiz(textContent);
    if (!imported.length) throw new Error("Không nhận diện được câu hỏi hợp lệ trong tệp. Hãy kiểm tra mẫu câu hỏi và đáp án.");
    uiState.teacherAssignmentQuestions = [...questionDraftQuestions("assignment"), ...imported.map(question => ({ ...question, id: uid("question") }))];
    renderQuestionDraftList("assignment");
    toast(`Đã nhập ${imported.length} câu hỏi có cấu trúc. Hãy kiểm tra danh sách trước khi lưu.`,true);
  }
  function submitQuiz() {
    if(!currentQuiz) return;
    if(!requireActiveSession()) return;
    const assignment = state.assignments.find(a=>a.id===currentQuiz.id);
    if(!assignment || assignment.archived || !state.users.find(u=>u.id===session.id)?.classIds?.includes(assignment.classId)) {
      toast("Bài tập không còn khả dụng cho tài khoản này.");
      currentQuiz = null; answers = {}; activeTab = "overview"; render(); return;
    }
    if(state.submissions.some(s=>s.assignmentId===currentQuiz.id && s.studentId===session.id)) {
      toast("Bạn đã nộp bài này rồi.");
      currentQuiz = null; answers = {}; activeTab = "results"; render(); return;
    }

    const norm = str => String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
    let autoScore = 0;
    let autoTotal = 0;
    let essayCount = 0;
    const questions = currentQuiz.questions || [];

    questions.forEach((q, i) => {
      const type = q.type || (Array.isArray(q.a) && q.a.length > 1 ? "multi" : (!q.opts || !q.opts.length ? (q.pairs ? "match" : q.a ? "fill" : "essay") : "single"));
      const userAns = answers[i];

      if (type === "essay") {
        essayCount++;
        return; // essay không tính điểm tự động
      }

      autoTotal++;
      if (type === "single" || type === "boolean") {
        if (userAns !== undefined && Number(userAns) === Number(q.a)) autoScore++;
      } else if (type === "multi") {
        if (Array.isArray(userAns)) {
          const cArr = Array.isArray(q.a) ? q.a.map(Number).sort() : [];
          const uArr = userAns.map(Number).sort();
          if (JSON.stringify(cArr) === JSON.stringify(uArr)) autoScore++;
        }
      } else if (type === "fill") {
        if (userAns) {
          const txt = norm(userAns);
          const accepted = q.accepted || [q.a];
          if (accepted.map(norm).includes(txt)) autoScore++;
        }
      } else if (type === "match") {
        if (userAns && typeof userAns === "object") {
          const pairs = q.pairs || [];
          let allCorrect = pairs.length > 0;
          for (let p = 0; p < pairs.length; p++) {
            if (Number(userAns[p]) !== p) { allCorrect = false; break; }
          }
          if (allCorrect) autoScore++;
        }
      }
    });

    // Nếu có tự luận thì status = "submitted" (chờ giáo viên chấm)
    // Nếu không có tự luận thì status = "returned" (đã chấm xong)
    const hasEssay = essayCount > 0;
    const status = hasEssay ? "submitted" : "returned";

    const submittedAt = new Date();
    const dueAt = assignment.due ? new Date(`${assignment.due}T23:59:59`) : null;
    const late = Boolean(dueAt && !Number.isNaN(dueAt.getTime()) && submittedAt > dueAt);
    if (late && assignment.allowLate === false) {
      toast("Bài tập đã quá hạn nộp và giáo viên không cho phép nộp trễ.");
      return;
    }

    // Tự động tạo feedback cho bài không có tự luận
    const autoFeedback = hasEssay ? "" : (
      `Hệ thống tự động chấm: ${autoScore}/${autoTotal} câu đúng. ` +
      (autoScore === autoTotal ? "Làm bài rất xuất sắc! 🌟" : "Cố gắng hơn ở các bài sau nhé! 💪")
    );

    lastResult = {
      id: uid("submission"),
      assignmentId: currentQuiz.id,
      quizAssignmentId: currentQuiz.id,
      quizVersionId: assignment.quizVersionId || null,
      studentId: session.id,
      score: autoScore,
      total: autoTotal,
      essayCount,
      answers: JSON.parse(JSON.stringify(answers)),
      questionsSnapshot: JSON.parse(JSON.stringify(questions)),
      status,
      autoGraded: true,
      late,
      feedback: autoFeedback,
      at: submittedAt.toISOString()
    };

    // Xóa nháp sessionStorage và timer
    try {
      sessionStorage.removeItem(`draft:${currentQuiz.id}:${session.id}`);
      sessionStorage.removeItem(`timer_start:${currentQuiz.id}`);
      sessionStorage.removeItem(`option-order:${currentQuiz.id}:${session.id}`);
      if (window._quizTimerInterval) clearInterval(window._quizTimerInterval);
    } catch {}
    state.submissions.push(lastResult);
    persist();
    log("SUBMIT_ASSIGNMENT", { assignmentId: currentQuiz.id, score: autoScore, total: autoTotal, essayCount, late, status });
    currentQuiz = null;
    answers = {};
    activeTab = "results";
    renderResult();
  }
  function logout() { if(session)log("LOGOUT");saveSession(null);activeTab="overview";currentQuiz=null;if(pageRole!=="landing")location.href="index.html"; }

  function saveDraft() {
    if (currentQuiz && session?.id) {
      try {
        sessionStorage.setItem(`draft:${currentQuiz.id}:${session.id}`, JSON.stringify(answers));
      } catch {}
    }
  }

  function startQuiz(assignmentId) {
    const assignment = state.assignments.find(a => a.id === assignmentId && !a.archived && state.users.find(u => u.id === session?.id)?.classIds?.includes(a.classId));
    if (!assignment) { toast("Bài tập không còn khả dụng cho tài khoản này."); return; }
    if (state.submissions.some(s => s.assignmentId === assignment.id && s.studentId === session.id)) {
      const mySub = state.submissions.find(s => s.assignmentId === assignment.id && s.studentId === session.id);
      window.__studentReviewSubId = mySub ? mySub.id : "";
      activeTab = "results";
      render();
      return;
    }
    // Kiểm tra quy tắc nộp trễ nếu quá hạn
    const submittedAt = new Date();
    const dueAt = assignment.due ? new Date(`${assignment.due}T23:59:59`) : null;
    const isLate = Boolean(dueAt && !Number.isNaN(dueAt.getTime()) && submittedAt > dueAt);
    if (isLate && assignment.allowLate === false) {
      toast("Bài tập này đã hết hạn và không cho phép nộp bài trễ.");
      return;
    }

    currentQuiz = assignment;
    // Khôi phục nháp từ sessionStorage nếu có
    try {
      const draftKey=`draft:${assignment.id}:${session.id}`;
      const orderKey=`option-order:${assignment.id}:${session.id}`;
      const savedDraft = sessionStorage.getItem(draftKey);
      answers = savedDraft ? JSON.parse(savedDraft) : {};
      let savedOrder = null;
      try {
        const storedOrder=sessionStorage.getItem(orderKey);
        savedOrder=storedOrder?JSON.parse(storedOrder):null;
      } catch {
        savedOrder=null;
      }
      const prepared=window.StudentViews.prepareShuffledOptions(assignment.questions,savedOrder || (savedDraft ? assignment.questions.map(question=>question.opts?.map((_,index)=>index)||null) : null));
      currentQuiz={...assignment,questions:prepared.questions};
      sessionStorage.setItem(orderKey,JSON.stringify(prepared.order));
    } catch {
      answers = {};
      const prepared=window.StudentViews.prepareShuffledOptions(assignment.questions);
      currentQuiz={...assignment,questions:prepared.questions};
    }
    activeTab = "quiz";
    render();
  }

  function showTeacherStudentDetails(id) {
    if (!requireActiveSession() || pageRole !== "teacher" || session?.role !== "teacher") return;
    const student = state.users.find(user => user.id === id && user.role === "student" && user.active !== false);
    const teacherClassIds = new Set(classIdsSafeForCurrentTeacher());
    const studentClassIds = Core.getStudentClassIds
      ? Core.getStudentClassIds(state, id)
      : (student?.classIds || []);
    const classes = student
      ? state.classes.filter(cls => teacherClassIds.has(cls.id) && studentClassIds.includes(cls.id))
      : [];
    if (!student || !classes.length) {
      toast("Không có quyền xem chi tiết học sinh này.");
      return;
    }

    const classIds = new Set(classes.map(cls => cls.id));
    const assignments = state.assignments.filter(assignment => !assignment.archived && classIds.has(assignment.classId));
    const submissions = state.submissions.filter(submission =>
      submission.studentId === student.id && assignments.some(assignment => assignment.id === submission.assignmentId)
    );
    const links = (state.studentGuardians || []).filter(link => link.studentId === student.id);
    const relationshipNames = { mother: "Mẹ", father: "Bố", guardian: "Người giám hộ", other: "Khác" };
    const relationshipStatus = link => link.revokedAt || link.status === "revoked"
      ? "Đã thu hồi"
      : link.status === "verified" ? "Đã xác minh" : "Chờ Admin xác minh";
    const dateText = value => value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleString("vi-VN")
      : "Chưa ghi nhận";
    const rows = assignments.map(assignment => {
      const submission = submissions.find(item => item.assignmentId === assignment.id);
      return `<tr><td>${esc(assignment.title)}</td><td>${esc(classes.find(cls => cls.id === assignment.classId)?.name || "—")}</td><td>${esc(assignment.due || "Không giới hạn")}</td><td>${submission ? (submission.status === "submitted" ? "Chờ chấm" : "Đã nộp") : "Chưa nộp"}</td><td>${submission ? `${esc(submission.score)}/${esc(submission.total)}` : "—"}</td></tr>`;
    }).join("");

    const overlay = document.createElement("div");
    overlay.className = "account-detail-overlay teacher-student-detail-overlay";
    overlay.innerHTML = `<section class="account-detail-dialog teacher-student-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-student-detail-title" tabindex="-1">
      <header class="account-detail-heading"><div><p class="eyebrow">HỒ SƠ HỌC SINH</p><h2 id="teacher-student-detail-title">${esc(student.name)}</h2><p class="muted">Chi tiết trong phạm vi lớp bạn được phân công.</p></div><button type="button" class="ghost small" data-action="close-teacher-student-details" aria-label="Đóng">Đóng</button></header>
      <section class="account-detail-section"><h3>Thông tin học sinh</h3><dl class="account-detail-grid"><div><dt>Mã hồ sơ</dt><dd>${esc(student.publicCode || "Chưa cấp")}</dd></div><div><dt>Email</dt><dd>${esc(student.email || "Chưa cung cấp")}</dd></div><div><dt>Số điện thoại</dt><dd>${esc(student.phone || "Chưa cung cấp")}</dd></div><div><dt>Lớp được phân công</dt><dd>${esc(classes.map(cls => cls.name).join(", "))}</dd></div></dl></section>
      <section class="account-detail-section"><h3>Phụ huynh liên kết (${links.length})</h3>${links.length ? `<ul class="account-detail-list">${links.map(link => {
        const parent = state.users.find(user => user.id === link.parentId && user.role === "parent");
        return `<li class="account-guardian-item"><div><b>${esc(parent?.name || "Tài khoản phụ huynh không tồn tại")}</b><dl class="account-guardian-info"><div><dt>Quan hệ</dt><dd>${esc(relationshipNames[link.relationship] || "Khác")}</dd></div><div><dt>Email</dt><dd>${esc(parent?.email || "Chưa cung cấp")}</dd></div><div><dt>Số điện thoại</dt><dd>${esc(parent?.phone || "Chưa cung cấp")}</dd></div><div><dt>Trạng thái</dt><dd>${esc(relationshipStatus(link))}</dd></div></dl></div><span class="pill ${link.status === "verified" && !link.revokedAt ? "" : "off"}">${esc(relationshipStatus(link))}</span></li>`;
      }).join("")}</ul>` : '<p class="muted">Chưa có liên kết phụ huynh.</p>'}</section>
      <section class="account-detail-section"><h3>Tiến độ học tập</h3><div class="account-detail-stats"><div><b>${assignments.length}</b><span>Bài tập được giao</span></div><div><b>${submissions.length}</b><span>Bài đã nộp</span></div><div><b>${submissions.filter(submission => submission.status === "submitted").length}</b><span>Chờ chấm</span></div></div>${rows ? `<div class="table-wrap account-detail-table"><table><thead><tr><th>Bài tập</th><th>Lớp</th><th>Hạn nộp</th><th>Trạng thái</th><th>Kết quả</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Chưa có bài tập trong lớp được giao.</p>'}</section>
      <section class="account-detail-footer"><span class="muted">Cập nhật hồ sơ: ${esc(dateText(student.updatedAt))}</span><button type="button" data-action="close-teacher-student-details">Đóng</button></section>
    </section>`;
    const close = () => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };
    const onKeyDown = event => {
      if (event.key === "Escape") close();
    };
    overlay.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest('[data-action="close-teacher-student-details"]')) close();
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector(".teacher-student-detail-dialog").focus();
  }
  
  document.addEventListener("click", e => {
    const adminSidebarToggle = e.target.closest("[data-admin-sidebar-toggle]");
    if (adminSidebarToggle) {
      const dashboard = adminSidebarToggle.closest(".admin-dashboard");
      if (!dashboard) return;
      if (window.matchMedia("(max-width: 760px)").matches) {
        dashboard.classList.toggle("is-sidebar-open");
        adminSidebarToggle.setAttribute("aria-expanded", String(dashboard.classList.contains("is-sidebar-open")));
      } else {
        dashboard.classList.toggle("is-sidebar-collapsed");
        adminSidebarToggle.setAttribute("aria-expanded", String(!dashboard.classList.contains("is-sidebar-collapsed")));
      }
      return;
    }

    const adminSidebarClose = e.target.closest("[data-admin-sidebar-close]");
    if (adminSidebarClose) {
      const dashboard = adminSidebarClose.closest(".admin-dashboard");
      dashboard?.classList.remove("is-sidebar-open");
      dashboard?.querySelector("[data-admin-sidebar-toggle]")?.setAttribute("aria-expanded", "false");
      return;
    }

    // Question templates open the matching structured editor.
    const tplBtn = e.target.closest("[data-insert-template]");
    if (tplBtn) {
      const builder = document.getElementById("assignment-question-type");
      if (!builder) return;
      builder.value = tplBtn.dataset.insertTemplate;
      showQuestionType(builder.value, document.getElementById("assignment-form"));
      document.getElementById("assignment-question-prompt")?.focus();
      return;
    }

    // 2. Navigation jump in quiz
    const jumpBtn = e.target.closest("[data-jump-question]");
    if (jumpBtn) {
      const idx = jumpBtn.dataset.jumpQuestion;
      document.getElementById("q-card-" + idx)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // 3. Multi-choice toggle
    const multiBtn = e.target.closest("[data-multi-answer]");
    if (multiBtn) {
      const qIdx = Number(multiBtn.dataset.multiAnswer);
      const choiceIdx = Number(multiBtn.dataset.multiChoice);
      if (!Array.isArray(answers[qIdx])) answers[qIdx] = [];
      const pos = answers[qIdx].indexOf(choiceIdx);
      if (pos >= 0) answers[qIdx].splice(pos, 1);
      else answers[qIdx].push(choiceIdx);
      saveDraft();
      render();
      return;
    }

    // 4. Matching pairs logic
    const matchLeft = e.target.closest("[data-match-left]");
    if (matchLeft) {
      const qIdx = Number(matchLeft.dataset.matchLeft);
      const leftIdx = Number(matchLeft.dataset.leftIdx);
      window.__activeMatchLeft = window.__activeMatchLeft || {};
      window.__activeMatchLeft[qIdx] = leftIdx;
      render();
      return;
    }

    const matchRight = e.target.closest("[data-match-right]");
    if (matchRight) {
      const qIdx = Number(matchRight.dataset.matchRight);
      const rightIdx = Number(matchRight.dataset.rightIdx);
      const activeL = window.__activeMatchLeft?.[qIdx];
      if (activeL !== undefined) {
        answers[qIdx] = (typeof answers[qIdx] === "object" && answers[qIdx] !== null) ? answers[qIdx] : {};
        Object.keys(answers[qIdx]).forEach(k => {
          if (Number(answers[qIdx][k]) === rightIdx) delete answers[qIdx][k];
        });
        answers[qIdx][activeL] = rightIdx;
        delete window.__activeMatchLeft[qIdx];
        saveDraft();
        render();
      } else {
        toast("Hãy nhấp chọn 1 mục ở Cột A trước, rồi chọn mục ở Cột B để nối.");
      }
      return;
    }

    const resetMatch = e.target.closest("[data-reset-match]");
    if (resetMatch) {
      const qIdx = Number(resetMatch.dataset.resetMatch);
      answers[qIdx] = {};
      if (window.__activeMatchLeft) delete window.__activeMatchLeft[qIdx];
      saveDraft();
      render();
      return;
    }

    // 5. General actions & tabs
    const b = e.target.closest("[data-action],[data-tab]");
    if (!b) return;

    if (b.dataset.tab) {
      const tab = b.dataset.tab;
      if (tab.startsWith("class:") && session?.role === "teacher") {
        const c = state.classes.find(c => c.id === tab.slice(6));
        if (!c || !allowedClass(c)) { toast("Bạn không có quyền truy cập lớp này."); return; }
      }
      window.__studentReviewSubId = "";
      if (activeTab === "parents" && tab !== "parents") parentProvisionResult = null;
      activeTab = tab === "student-home" ? "overview" : tab;
      currentQuiz = null;
      render();
      return;
    }

    const action = b.dataset.action;
    if (action === "admin-data-tab") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) { toast("Chỉ Admin mới được truy cập khu vực này."); return; }
      if (!["logs","local-backup","system-backup"].includes(b.dataset.view)) return;
      adminDataTab=b.dataset.view;
      render();
      return;
    }
    if (action === "new-quiz") {
      uiState.teacherQuizEditId = "";
      uiState.teacherQuizDraftId = null;
      uiState.teacherQuizQuestions = [];
      uiState.teacherQuizQuestionEditIndex = null;
      activeTab = "quiz-bank";
      render();
      return;
    }
    if (action === "edit-quiz") {
      const quiz = state.quizzes.find(item => item.id === b.dataset.id);
      if (!quiz || (quiz.ownerId !== session?.id && !isAdmin())) { toast("Bạn không có quyền sửa Quiz này."); return; }
      uiState.teacherQuizEditId = quiz.id;
      uiState.teacherQuizDraftId = null;
      uiState.teacherQuizQuestionEditIndex = null;
      activeTab = "quiz-bank";
      render();
      return;
    }
    const builderKind = action.startsWith("assignment-") ? "assignment" : action.startsWith("quiz-") ? "quiz" : "";
    if (builderKind) {
      const prefix = builderKind;
      const verb = action.slice(prefix.length + 1);
      const form = document.getElementById(builderKind === "assignment" ? "assignment-form" : "teacher-quiz-form");
      const questions = questionDraftQuestions(builderKind);
      const editKey = builderKind === "assignment" ? "teacherAssignmentQuestionEditIndex" : "teacherQuizQuestionEditIndex";
      if (verb === "save-question") {
        if (!form) return;
        try {
          const question = buildQuestion(form, builderKind);
          const editIndex = uiState[editKey];
          if (Number.isInteger(editIndex) && editIndex >= 0 && editIndex < questions.length) {
            question.id = questions[editIndex].id || question.id;
            questions[editIndex] = question;
          } else questions.push(question);
          renderQuestionDraftList(builderKind);
          clearQuestionBuilder(builderKind);
        } catch (error) { toast(error.message); }
        return;
      }
      if (verb === "edit-question") {
        loadQuestionIntoBuilder(Number(b.dataset.index), builderKind);
        return;
      }
      if (verb === "cancel-question-edit") {
        clearQuestionBuilder(builderKind);
        return;
      }
      if (verb === "delete-question") {
        const index = Number(b.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= questions.length) return;
        questions.splice(index, 1);
        if (uiState[editKey] === index) clearQuestionBuilder(builderKind);
        else if (Number.isInteger(uiState[editKey]) && uiState[editKey] > index) uiState[editKey]--;
        renderQuestionDraftList(builderKind);
        return;
      }
      if (verb === "add-pair") {
        const container = form?.querySelector(`#${prefix}-match-pairs`);
        if (!container) return;
        const indices = Array.from(container.querySelectorAll("[data-pair-row]"), row => Number(row.dataset.pairRow));
        const index = indices.length ? Math.max(...indices) + 1 : 0;
        const order = indices.length + 1;
        container.insertAdjacentHTML("beforeend", `<div class="quiz-match-editor-row" data-pair-row="${index}">
          <label for="${prefix}-pair-left-${index}">Vế trái ${order}</label><input id="${prefix}-pair-left-${index}" data-pair-left="${index}" maxlength="300">
          <label for="${prefix}-pair-right-${index}">Vế phải ${order}</label><input id="${prefix}-pair-right-${index}" data-pair-right="${index}" maxlength="300">
          <button type="button" class="small ghost" data-action="${prefix}-remove-pair" data-index="${index}">Xóa cặp</button>
        </div>`);
        return;
      }
      if (verb === "remove-pair") {
        const container = form?.querySelector(`#${prefix}-match-pairs`);
        const row = container?.querySelector(`[data-pair-row="${Number(b.dataset.index)}"]`);
        if (container?.querySelectorAll("[data-pair-row]").length > 2) row?.remove();
        return;
      }
      if (verb === "preview-question") {
        const question = questions[Number(b.dataset.index)];
        const preview = form?.querySelector(`#${prefix}-question-preview`);
        if (!question || !preview) return;
        const type = ({ mc: "single", tf: "boolean" })[question.type] || question.type || "single";
        const shuffle = values => {
          const result = [...values];
          for (let index = result.length - 1; index > 0; index--) {
            const swap = Math.floor(Math.random() * (index + 1));
            [result[index], result[swap]] = [result[swap], result[index]];
          }
          return result;
        };
        let answersMarkup = "";
        if (type === "single" || type === "multi") answersMarkup = `<ul>${shuffle(question.opts || []).map((option, index) => `<li>${String.fromCharCode(65 + index)}. ${esc(option)}</li>`).join("")}</ul>`;
        else if (type === "boolean") answersMarkup = "<div>○ Đúng　○ Sai</div>";
        else if (type === "fill") answersMarkup = '<input disabled placeholder="Nhập câu trả lời">';
        else if (type === "match") {
          const pairs = question.pairs || [];
          answersMarkup = `<div><b>Cột A</b><ol>${pairs.map(pair => `<li>${esc(pair.left)}</li>`).join("")}</ol><b>Cột B</b><ol>${shuffle(pairs.map(pair => pair.right)).map(value => `<li>${esc(value)}</li>`).join("")}</ol></div>`;
        } else answersMarkup = '<textarea disabled placeholder="Nhập câu trả lời"></textarea>';
        preview.innerHTML = `<button type="button" class="ghost small" data-action="${prefix}-close-question-preview">Đóng xem trước</button><h3>Xem trước như học sinh</h3><p>${esc(question.q || question.text || "")}</p>${answersMarkup}`;
        preview.hidden = false;
        preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      if (verb === "close-question-preview") {
        const preview = form?.querySelector(`#${prefix}-question-preview`);
        if (preview) preview.hidden = true;
        return;
      }
    }
    if (action === "layout-add-element") {
      const classId = uiState.teacherLayoutClassId || (session?.role === "admin" ? state.classes[0]?.id : state.classes.find(allowedClass)?.id);
      const layout = state.classroomLayouts.find(item => item.id === (uiState.teacherLayoutId || state.classroomLayouts.find(layoutItem => layoutItem.classId === classId && layoutItem.status === "active")?.id));
      if (!layout) { toast("Hãy tạo hoặc chọn sơ đồ trước."); return; }
      try {
        const element = Core.addLayoutElement(state,session,layout.id,b.dataset.type,b.dataset.deskType);
        persist();log("ADD_CLASSROOM_ELEMENT",{layoutId:layout.id,elementId:element.id,type:element.type});
        render();
      } catch(error) { toast(error.message); }
      return;
    }
    if (action === "toggle-parent-classroom") {
      const classId = b.dataset.classId;
      const cls = state.classes.find(item => item.id === classId);
      if (!cls) { toast("Không tìm thấy lớp cần cập nhật."); return; }
      try {
        const visible = !Core.isParentClassroomVisible(state, classId);
        Core.setParentClassroomVisibility(state, session, classId, visible);
        persist();
        log("TOGGLE_PARENT_CLASSROOM_VISIBILITY", { classId, visible });
        render();
        toast(visible ? "Đã bật chia sẻ sơ đồ lớp với phụ huynh." : "Đã tắt chia sẻ sơ đồ lớp với phụ huynh.", true);
      } catch (error) { toast(error.message); }
      return;
    }
    if (action === "layout-remove-element") {
      const layoutId=b.dataset.layoutId;
      const layout=state.classroomLayouts.find(item=>item.id===layoutId);
      const element=layout?.elements.find(item=>item.id===b.dataset.id);
      const occupied=(element?.seats||[]).some(seat=>seat.studentId);
      if(occupied&&!confirm("Xóa bàn và gỡ các học sinh khỏi ghế? Học sinh vẫn thuộc danh sách lớp."))return;
      try {
        Core.removeLayoutElement(state,session,layoutId,b.dataset.id,occupied);
        persist();log("REMOVE_CLASSROOM_ELEMENT",{layoutId,elementId:b.dataset.id,unassignedStudents:occupied});
        render();
      } catch(error) { toast(error.message); }
      return;
    }
    if(action==="layout-rotate-element"){
      try{
        Core.rotateLayoutElement(state,session,b.dataset.layoutId,b.dataset.id);
        persist();log("ROTATE_CLASSROOM_ELEMENT",{layoutId:b.dataset.layoutId,elementId:b.dataset.id});
        render();
      }catch(error){toast(error.message);}
      return;
    }
    if(action==="revoke-class-teacher"){
      const record=state.classTeacherAssignments.find(item=>item.id===b.dataset.id);
      if(!record||!confirm("Thu hồi phân công giáo viên? Bài đã giao và kết quả cũ vẫn được giữ."))return;
      try{
        Core.revokeTeacherAssignment(state,session,record.id);
        const cls=state.classes.find(item=>item.id===record.classId);
        if(!Core.activeTeacherAssignment(state,record.classId,record.teacherId).length){
          cls.teacherIds=(cls.teacherIds||[]).filter(id=>id!==record.teacherId);
          state.classTeachers.forEach(item=>{if(item.classId===record.classId&&item.userId===record.teacherId&&!item.leftAt)item.leftAt=record.revokedAt;});
        }
        persist();log("REVOKE_CLASS_TEACHER",{classId:record.classId,teacherId:record.teacherId,subjectId:record.subjectId,role:record.role});
        render();toast("Đã thu hồi phân công; bài giao và kết quả cũ vẫn được giữ.",true);
      }catch(error){toast(error.message);}
      return;
    }
    if (action === "view-user-details") {
      showUserDetails(b.dataset.id,b);
      return;
    }
    if (action === "view-student-review") {
      window.__studentReviewSubId = b.dataset.id;
      activeTab = "results";
      render();
      return;
    }
    if (action === "close-student-review") {
      window.__studentReviewSubId = "";
      activeTab = "results";
      render();
      return;
    }
    if (action === "home") {
      if (pageRole !== "landing") location.href = "index.html";
      else if (session) { activeTab = "overview"; render(); }
      else renderHome();
    }
    else if (action === "admin-login") window.top.location.href = "/admin";
    else if (action === "code-login") renderLogin(b.dataset.role);
    else if (action === "logout") logout();
    else if (action === "template") downloadTemplate(b.dataset.role);
    else if (action === "confirm-import") commitImport();
    else if (action === "cancel-import") { pendingImport = null; render(); }
    else if (action === "download-backup") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) { toast("Chỉ Admin mới được sao lưu dữ liệu."); return; }
      try {
        log("BACKUP_EXPORTED",{schemaVersion:state.schemaVersion});
        const backup=Core.createBackup(state,session.id);
        downloadBlob(`project-quizz-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`,JSON.stringify(backup,null,2),"application/json;charset=utf-8");
        toast("Đã tạo tệp sao lưu. Hãy lưu tệp ở nơi an toàn.",true);
      } catch(error) { toast(`Không thể tạo bản sao lưu: ${error.message}`); }
    }
    else if (action === "restore-backup") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) { toast("Chỉ Admin mới được khôi phục dữ liệu."); return; }
      if (!pendingBackupRestore) { toast("Hãy chọn và kiểm tra tệp sao lưu trước."); return; }
      const {state:restored,exportedAt,fileName}=pendingBackupRestore;
      const summary=`Tệp: ${fileName}\nBản sao lưu: ${exportedAt||"không rõ thời điểm"}\nTài khoản: ${restored.users.length} · Lớp: ${restored.classes.length} · Bài giao: ${restored.assignments.length} · Bài nộp: ${restored.submissions.length}\n\nThao tác này thay thế toàn bộ dữ liệu hiện tại. Bạn đã tải bản sao lưu hiện tại và muốn tiếp tục?`;
      if(!confirm(summary))return;
      const nextState=restored;
      nextState.audit.unshift({id:uid("log"),at:new Date().toISOString(),actor:session.id,action:"BACKUP_RESTORED",detail:{fileName,exportedAt}});
      nextState.audit=nextState.audit.slice(0,500);
      try {
        Core.persist(nextState);
        state=nextState;
        pendingBackupRestore=null;
        render();
        toast("Đã khôi phục dữ liệu. Hãy đăng xuất và kiểm tra các phân hệ liên quan.",true);
      } catch(error) { toast(`Khôi phục thất bại; dữ liệu hiện tại được giữ nguyên: ${error.message}`); }
    }
    else if (action === "cancel-backup-restore") { pendingBackupRestore=null;render(); }
    else if (action === "export-codes") exportCodes();
    else if (action === "reset-code") resetCode(b.dataset.id);
    else if (action === "approve-all-parent-links") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) {
        toast("Chỉ Admin mới được xác minh liên kết phụ huynh.");
        return;
      }
      const pendingLinks=(state.studentGuardians||[]).filter(link=>link.status==="pending"&&!link.revokedAt);
      const eligibleLinks=pendingLinks.filter(link=>
        state.users.some(user=>user.id===link.parentId&&user.role==="parent"&&user.active!==false)&&
        state.users.some(user=>user.id===link.studentId&&user.role==="student"&&user.active!==false)
      );
      if(!eligibleLinks.length){toast("Không có yêu cầu chờ xác minh nào có tài khoản hợp lệ.");return;}
      const skippedCount=pendingLinks.length-eligibleLinks.length;
      const confirmation=`Chỉ xác minh sau khi nhà trường đã kiểm tra quan hệ thực tế.\n\nXác minh ${eligibleLinks.length} yêu cầu phụ huynh–học sinh${skippedCount?`? ${skippedCount} yêu cầu có tài khoản không hợp lệ sẽ được bỏ qua.`:"?"}`;
      if(!confirm(confirmation))return;
      const verifiedAt=new Date().toISOString();
      eligibleLinks.forEach(link=>{
        link.status="verified";
        link.verifiedAt=verifiedAt;
        link.verifiedBy=session.id;
        log("PARENT_LINK_VERIFIED",{linkId:link.id,parentId:link.parentId,studentId:link.studentId,bulk:true});
      });
      activeTab="parents";
      render();
      toast(`Đã xác minh ${eligibleLinks.length} liên kết${skippedCount?`; bỏ qua ${skippedCount} yêu cầu không hợp lệ`:""}.`,true);
    }
    else if (action === "approve-parent-link") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) {
        toast("Chỉ Admin mới được xác minh liên kết phụ huynh.");
        return;
      }
      const link = (state.studentGuardians || []).find(item => item.id === b.dataset.id && item.status === "pending" && !item.revokedAt);
      if (!link) { toast("Không tìm thấy yêu cầu đang chờ xác minh."); return; }
      const parent = state.users.find(user => user.id === link.parentId && user.role === "parent" && user.active !== false);
      const student = state.users.find(user => user.id === link.studentId && user.role === "student" && user.active !== false);
      if (!parent || !student) { toast("Tài khoản phụ huynh hoặc học sinh không còn hợp lệ."); return; }
      if (!confirm(`Chỉ xác minh khi nhà trường đã kiểm tra quan hệ thực tế.\n\nXác nhận liên kết ${parent.name} với học sinh ${student.name}?`)) return;
      link.status = "verified";
      link.verifiedAt = new Date().toISOString();
      link.verifiedBy = session.id;
      persist();
      log("PARENT_LINK_VERIFIED", { linkId: link.id, parentId: link.parentId, studentId: link.studentId });
      activeTab = "parents";
      render();
      toast("Đã xác minh liên kết. Phụ huynh có thể xem dữ liệu của học sinh này.", true);
    } else if (action === "revoke-parent-link") {
      const link = (state.studentGuardians || []).find(l => l.id === b.dataset.id && !l.revokedAt);
      if (!link) { toast("Không tìm thấy liên kết còn hiệu lực."); return; }
      link.revokedAt = new Date().toISOString(); link.revokedBy = session.id; link.status = "revoked";
      persist(); log("PARENT_LINK_REVOKED", { linkId: link.id, parentId: link.parentId, studentId: link.studentId });
      parentProvisionResult = null; render(); toast("Đã thu hồi liên kết phụ huynh–học sinh.", true);
    } else if (action === "download-parent-code") {
      if (!parentProvisionResult) { toast("Mã đã hết thời gian hiển thị. Hãy cấp mã mới từ danh sách tài khoản."); return; }
      downloadBlob(`ma_phu_huynh_${parentProvisionResult.publicCode}.csv`, "\ufeff" + `Họ tên,Vai trò,Mã hồ sơ,Email,Mã đăng nhập\r\n"${parentProvisionResult.name}","Phụ huynh","${parentProvisionResult.publicCode}","${parentProvisionResult.email||""}","${parentProvisionResult.code}"`);
    }
    else if (action === "toggle-user") toggleUser(b.dataset.id);
    else if (action === "view-class-details") showClassDetails(b.dataset.id);
    else if (action === "export-class") {
      const c = state.classes.find(c => c.id === b.dataset.id);
      if (c) {
        const rows = [["Họ tên", "Mã hồ sơ", "Mã lớp"], ...state.users.filter(u => u.role === "student" && (u.classIds || []).includes(c.id)).map(u => [u.name, u.publicCode, c.code])];
        downloadBlob(`danh_sach_${c.code}.csv`, "\ufeff" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n"));
      }
    }
    else if (action === "export-audit") {
      const rows = [["Thời gian", "Người thực hiện", "Thao tác", "Chi tiết"], ...state.audit.map(l => [l.at, state.users.find(u => u.id === l.actor)?.name || "Hệ thống", l.action, JSON.stringify(l.detail)])];
      downloadBlob("nhat_ky_he_thong.csv", "\ufeff" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n"));
    }
    else if (action === "remove-student") removeStudent(b.dataset.id, b.dataset.class);
    else if (action === "toggle-grade") {
      window.__teacherSubmissionFocus = window.__teacherSubmissionFocus === b.dataset.id ? "" : b.dataset.id;
      activeTab = "submissions";
      render();
    }
    else if (action === "close-grade") { window.__teacherSubmissionFocus = ""; render(); }
    else if (action === "save-grade") saveSubmissionGrade(b.dataset.id);
    else if (action === "focus-submission") { window.__teacherSubmissionFocus = b.dataset.id; activeTab = "submissions"; render(); }
    else if (action === "edit-assignment") editAssignment(b.dataset.id);
    else if (action === "clone-assignment") {
      if(!requireActiveSession()) return;
      const orig = state.assignments.find(a => a.id === b.dataset.id);
      if(!orig){ toast("Không tìm thấy bài tập."); return; }
      const c = state.classes.find(x => x.id === orig.classId);
      if(!isAdmin() && !allowedClass(c)){ toast("Không có quyền thao tác."); return; }
      const sourceQuiz=state.quizzes.find(item=>item.id===orig.quizId);
      if(sourceQuiz&&sourceQuiz.ownerId!==session.id&&!isAdmin()){toast("Chỉ chủ sở hữu mới có thể nhân bản Quiz này.");return;}
      try{
        const subjectId=orig.subjectId||sourceQuiz?.subjectId;
        const {quiz}=Core.createQuiz(state,session,{title:orig.title+" (Bản sao)",description:"",subjectId,questions:orig.questions||[]});
        const [cloned]=Core.assignQuizToClasses(state,session,quiz.id,[{
          classId:orig.classId,title:quiz.title,due:orig.due||"",
          durationMinutes:orig.durationMinutes||null,allowLate:orig.allowLate!==false
        }]);
        cloned.minigameEnabled=orig.minigameEnabled===true;
        cloned.minigames={...(orig.minigames||{})};
        const clonedQuizAssignment=state.quizAssignments.find(item=>item.id===cloned.id);
        if(clonedQuizAssignment) {
          clonedQuizAssignment.minigameEnabled=cloned.minigameEnabled;
          clonedQuizAssignment.minigames={...cloned.minigames};
        }
        persist(); log("CLONE_ASSIGNMENT", { originalId: orig.id, newId: cloned.id, quizId:quiz.id });
        assignmentEditId = cloned.id; window.__teacherAssignmentEditId = cloned.id; uiState.teacherAssignmentDraftId=null;
        activeTab = "assignments"; render();
        toast("Đã nhân bản thành Quiz riêng và tạo bài giao mới.", true);
      }catch(error){toast(error.message);}
    }
    else if (action === "cancel-edit-assignment") cancelEditAssignment();
    else if (action === "view-assignment-submissions") {
      const sub = state.submissions.find(s => s.assignmentId === b.dataset.id && state.assignments.some(a => a.id === s.assignmentId && allowedClass(state.classes.find(c => c.id === a.classId))));
      if (sub) { window.__teacherSubmissionFocus = sub.id || `${sub.studentId}|${sub.assignmentId}|${sub.at}`; }
      else { window.__teacherSubmissionFocus = ""; toast("Bài tập này chưa có bài nộp."); }
      activeTab = "submissions";
      render();
    }
    else if (action === "view-student") {
      const student = state.users.find(u => u.id === b.dataset.id && u.role === "student" && (u.classIds || []).some(id => classIdsSafeForCurrentTeacher().includes(id)));
      if (student) { activeTab = "submissions"; window.__teacherStudentFocus = student.id; window.__teacherSubmissionFocus = ""; render(); }
      else toast("Không có quyền xem hồ sơ này.");
    }
    else if (action === "view-student-details") showTeacherStudentDetails(b.dataset.id);
    else if (action === "clear-student-filter") { window.__teacherStudentFocus = ""; render(); }
    else if (action === "export-teacher-students") {
      const ownClasses = state.classes.filter(allowedClass), ownIds = new Set(ownClasses.map(c => c.id));
      const rows = [["Họ tên", "Mã hồ sơ", "Email", "Lớp"], ...state.users.filter(u => u.role === "student" && (u.classIds || []).some(id => ownIds.has(id))).map(u => [u.name, u.publicCode, u.email || "", (u.classIds || []).filter(id => ownIds.has(id)).map(clsName).join(", ")])];
      downloadBlob("danh_sach_hoc_sinh_giao_vien.csv", "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n"));
    }
    else if (action === "export-teacher-submissions") {
      const ownIds = new Set(state.classes.filter(allowedClass).map(c => c.id));
      const rows = [["Học sinh", "Mã hồ sơ", "Bài tập", "Lớp", "Điểm tự động", "Tổng tự động", "Câu tự luận", "Điểm cuối", "Trạng thái", "Nhận xét", "Thời gian nộp"], ...state.submissions.filter(s => state.assignments.some(a => a.id === s.assignmentId && ownIds.has(a.classId))).map(s => {
        const u = state.users.find(u => u.id === s.studentId), a = state.assignments.find(a => a.id === s.assignmentId);
        const statusLabel = s.status === "returned" ? "Đã trả bài" : s.status === "submitted" ? "Chờ chấm tự luận" : "Chờ xác nhận";
        return [u?.name || "", u?.publicCode || "", a?.title || "", clsName(a?.classId), s.score, s.total, s.essayCount || 0, s.status === "returned" ? s.score : "", statusLabel, s.feedback || "", s.at || ""];
      })];
      downloadBlob("bai_nop_lop_hoc_cua_co.csv", "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n"));
    }
    else if (action === "delete-assignment") {
      if(!requireActiveSession()) return;
      const assignment = state.assignments.find(a => a.id === b.dataset.id);
      if (assignment) {
        if (!isAdmin() && !allowedClass(state.classes.find(c => c.id === assignment.classId))) { toast("Không có quyền."); return; }
        if (assignment.archived) {
          if (confirm("Khôi phục bài tập này?")) {
            assignment.archived = false;
            const quizAssignment=state.quizAssignments.find(item=>item.id===assignment.id);
            if(quizAssignment)quizAssignment.status="published";
            persist(); log("RESTORE_ASSIGNMENT", { assignmentId: assignment.id }); render(); toast("Đã khôi phục bài tập.", true);
          }
        } else if (confirm("Lưu trữ bài tập? Bài tập sẽ không nhận lượt làm mới; bài nộp và điểm hiện có vẫn được giữ.")) {
          assignment.archived = true;
          const quizAssignment=state.quizAssignments.find(item=>item.id===assignment.id);
          if(quizAssignment)quizAssignment.status="archived";
          persist(); log("ARCHIVE_ASSIGNMENT", { assignmentId: assignment.id }); render(); toast("Đã lưu trữ bài tập và giữ nguyên lịch sử.", true);
        }
      }
    }
    else if (action === "start-quiz") {
      startQuiz(b.dataset.id);
    }
    else if (action === "answer") {
      answers[Number(b.dataset.answer)] = Number(b.dataset.choice);
      saveDraft();
      render();
    }
    else if (action === "submit-quiz") submitQuiz();
    else if (action === "back-assignments") { currentQuiz = null; activeTab = "overview"; render(); }
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const dashboard = document.querySelector(".admin-dashboard.is-sidebar-open");
    if (!dashboard) return;
    dashboard.classList.remove("is-sidebar-open");
    const toggle = dashboard.querySelector("[data-admin-sidebar-toggle]");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  });

  document.addEventListener("input", e => {
    if (e.target.dataset.fillAnswer !== undefined) {
      answers[Number(e.target.dataset.fillAnswer)] = e.target.value;
      saveDraft();
    }
    if (e.target.dataset.essayAnswer !== undefined) {
      answers[Number(e.target.dataset.essayAnswer)] = e.target.value;
      saveDraft();
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "quiz-question-type" || e.target.id === "assignment-question-type") {
      showQuestionType(e.target.value, e.target.form);
      return;
    }
    if (e.target.id === "assignment-minigame-enabled") {
      const options = document.getElementById("assignment-minigame-options");
      if (options) options.hidden = !e.target.checked;
      return;
    }
    if (e.target.matches("[data-parent-child]")) { activeTab = `child:${e.target.value}`; render(); return; }
    if (e.target.id === "import-file") {
      const file = e.target.files?.[0]; if (!file) return;
      const role = document.getElementById("import-role").value;
      readImportFile(file).then(rows => previewImport(rows, role)).catch(err => toast(err.message || "Không đọc được file."));
      e.target.value="";
    }
    if (e.target.id === "backup-file") {
      const file=e.target.files?.[0]; if(!file)return;
      const preview=document.getElementById("backup-preview");
      pendingBackupRestore=null;
      if(file.size>20*1024*1024){if(preview)preview.innerHTML='<p class="notice error">Tệp vượt quá giới hạn 20 MB.</p>';e.target.value="";return;}
      const reader=new FileReader();
      reader.onload=()=>{
        try {
          const parsed=JSON.parse(String(reader.result));
          const prepared=Core.prepareBackupRestore(parsed);
          pendingBackupRestore={...prepared,fileName:file.name};
          const restored=prepared.state;
          if(preview)preview.innerHTML=`<hr><h3>Xem trước bản sao lưu</h3><div class="notice">Thời điểm xuất: ${esc(prepared.exportedAt||"Không rõ")} · Phiên bản dữ liệu: ${restored.schemaVersion}</div><ul><li>Tài khoản: ${restored.users.length}</li><li>Lớp học: ${restored.classes.length}</li><li>Bài giao: ${restored.assignments.length}</li><li>Bài nộp: ${restored.submissions.length}</li><li>Quiz gốc: ${restored.quizzes.length}</li><li>Sơ đồ lớp: ${restored.classroomLayouts.length}</li></ul><div class="actions"><button data-action="restore-backup">Khôi phục và thay thế dữ liệu hiện tại</button><button class="ghost" data-action="cancel-backup-restore">Hủy</button></div>`;
        } catch(error) {
          pendingBackupRestore=null;
          if(preview)preview.innerHTML=`<p class="notice error">${esc(error.message||"Tệp sao lưu không hợp lệ.")}</p>`;
        }
      };
      reader.onerror=()=>{pendingBackupRestore=null;if(preview)preview.innerHTML='<p class="notice error">Không đọc được tệp sao lưu.</p>';};
      reader.readAsText(file,"utf-8");
      e.target.value="";
    }
    if (e.target.id === "assignment-import-file") {
      const file = e.target.files?.[0]; if (file) importAssignmentFile(file).catch(err => toast(err.message || "Không đọc được tệp."));
      e.target.value = "";
    }
    if (e.target.id === "quiz-import-file") {
      const file = e.target.files?.[0];
      if (file) importQuizBankFile(file).catch(error => toast(error.message || "Không đọc được tệp."));
      e.target.value = "";
      return;
    }
    if (e.target.id === "teacher-student-search") {
      const pos = e.target.selectionStart; render();
      const el = document.getElementById("teacher-student-search");
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      return;
    }
    if (e.target.id === "teacher-student-class") { render(); return; }
    if (e.target.id === "gradebook-class") { render(); return; }
    if (e.target.id === "assignment-class-picker") {
      const target = document.getElementById("assignment-class");
      const subjectSelect = document.getElementById("assignment-subject");
      const subjectHelp = document.getElementById("assignment-subject-help");
      const selectedOption = e.target.selectedOptions[0];
      const permittedSubjects = new Set((selectedOption?.dataset.subjectIds || "").split(",").filter(Boolean));
      if (target) target.value = e.target.value;
      if (subjectSelect) {
        for (const option of subjectSelect.options) {
          if (!option.value) continue;
          const permitted = permittedSubjects.has(option.value);
          option.disabled = !permitted;
          option.hidden = !permitted;
          const subject = state.subjects.find(item => item.id === option.value);
          option.textContent = `${subject?.name || "Môn học"}${permitted ? "" : " · Chưa được phân công"}`;
        }
        if (subjectSelect.value && !permittedSubjects.has(subjectSelect.value)) subjectSelect.value = "";
      }
      if (subjectHelp) {
        const classSubjects = state.subjects.filter(subject => subject.active !== false && permittedSubjects.has(subject.id));
        subjectHelp.textContent = classSubjects.length
          ? `Chỉ chọn được môn đã phân công: ${classSubjects.map(subject => subject.name).join(", ")}.`
          : "Chưa có môn học được phân công trong lớp này. Hãy nhờ GVCN hoặc Admin cập nhật phân công.";
      }
      return;
    }
    if (e.target.id === "filter-role" || e.target.id === "user-search") {
      const pos = e.target.id === "user-search" ? e.target.selectionStart : null; render();
      const el = document.getElementById(e.target.id);
      if (el) { el.value = e.target.id === "filter-role" ? e.target.value : e.target.value; if (pos !== null) { el.focus(); el.setSelectionRange(pos, pos); } }
    }
  });

  document.addEventListener("change", e => {
    if (e.target.matches("[data-classroom-class]")) {
      uiState.teacherLayoutClassId = e.target.value;
      uiState.teacherLayoutId = "";
      render();
      return;
    }
    if (e.target.matches("[data-layout-select]")) {
      uiState.teacherLayoutId = e.target.value;
      render();
      return;
    }
    if (e.target.matches("[data-seat-assignment]")) {
      try {
        Core.assignStudentToSeat(state,session,e.target.dataset.layoutId,e.target.dataset.seatId,e.target.value);
        persist();log("ASSIGN_CLASSROOM_SEAT",{layoutId:e.target.dataset.layoutId,seatId:e.target.dataset.seatId,studentId:e.target.value||null});
        render();
      } catch(error) { toast(error.message);render(); }
    }
  });

  document.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.id === "login-form") {
      if (document.getElementById("login-user")) {
        const username = document.getElementById("login-user").value.trim(), password = document.getElementById("login-password").value;
        if (username === "admin" && password === "Admin@123") { saveSession({ id: "admin-demo", role: "admin" }); activeTab = "overview"; log("ADMIN_LOGIN_DEMO"); }
        else toast("Tài khoản hoặc mật khẩu không đúng.");
      } else {
        const code = normalizeLoginCode(document.getElementById("login-code").value);
        const loginKind = pageRole === "teacher" ? "teacher" : pageRole === "parent" ? "parent" : pageRole === "learner" ? document.getElementById("login-role")?.value : "student";
        if (!code) { toast("Vui lòng nhập mã đăng nhập."); return; }
        const roleUsers = state.users.filter(u => u.role === loginKind);
        const matched = roleUsers.find(u => u.codeHash && (u.codeHash === hashCode(code) || u.codeHash === legacyHashCode(code)));
        if (!matched) {
          if (!roleUsers.length) toast(loginKind === "parent" ? "Chưa có tài khoản phụ huynh trên trình duyệt này. Admin cần tạo tài khoản và xác minh liên kết học sinh." : `Chưa có tài khoản ${loginKind === "teacher" ? "giáo viên" : "học sinh"} trên trình duyệt này. Hãy nhập danh sách tại Admin.`);
          else toast(`Không tìm thấy mã đăng nhập ${loginKind === "parent" ? "phụ huynh" : loginKind === "teacher" ? "giáo viên" : "học sinh"}. Hãy kiểm tra mã được cấp.`);
          return;
        }
        if (matched.active === false) { toast(`Tài khoản ${loginKind === "parent" ? "phụ huynh" : loginKind === "teacher" ? "giáo viên" : "học sinh"} đang bị khóa. Hãy nhờ Admin mở khóa.`); return; }
        saveSession({ id: matched.id, role: matched.role }); activeTab = "overview"; log("CODE_LOGIN", { role: matched.role });
      }
      try {
        render();
      } catch (error) {
        showRenderError(error);
      }
    } else if (e.target.id === "admin-school-competition-form") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) {
        toast("Chỉ Admin mới được quản lý cuộc thi cấp trường.");
        return;
      }
      const form = e.target;
      const name = form.elements.name.value.trim();
      const assignmentIds = Array.from(form.querySelectorAll('input[name="assignmentIds"]:checked')).map(input => input.value);
      const assignments = assignmentIds.map(id => state.assignments.find(assignment => assignment.id === id && !assignment.archived));
      if (!name) { toast("Hãy nhập tên cuộc thi."); return; }
      if (!assignmentIds.length || assignments.some(assignment => !assignment)) {
        toast("Hãy chọn ít nhất một bài thi đang hoạt động.");
        return;
      }
      state.schoolCompetition = {
        name,
        assignmentIds: [...new Set(assignmentIds)],
        active: form.elements.active.checked,
        updatedAt: new Date().toISOString(),
        updatedBy: session.id
      };
      persist();
      log("UPDATE_SCHOOL_COMPETITION", {
        name,
        active: state.schoolCompetition.active,
        assignmentIds: state.schoolCompetition.assignmentIds
      });
      activeTab = "competition";
      render();
      toast(state.schoolCompetition.active ? "Đã lưu và bật cuộc thi cấp trường." : "Đã lưu cuộc thi; bảng toàn trường đang tắt.", true);
    } else if (e.target.id === "admin-subject-form") {
      if (!requireActiveSession() || pageRole !== "admin" || !isAdmin()) {
        toast("Chỉ Admin mới được quản lý danh mục môn học.");
        return;
      }
      const name = e.target.elements.name.value.trim().normalize("NFKC");
      if (!name) { toast("Hãy nhập tên môn học."); return; }
      if (state.subjects.some(subject => String(subject.name || "").trim().normalize("NFKC").toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
        toast("Môn học này đã tồn tại.");
        return;
      }
      const subject = { id: uid("subject"), name, active: true, createdAt: new Date().toISOString(), createdBy: session.id };
      state.subjects.push(subject);
      try {
        persist();
      } catch (error) {
        state.subjects.pop();
        console.error("Không thể lưu môn học.", error);
        toast("Không thể lưu môn học. Hãy giải phóng dung lượng trình duyệt rồi thử lại.");
        return;
      }
      log("CREATE_SUBJECT", { subjectId: subject.id, name: subject.name });
      activeTab = "subjects";
      render();
      toast(`Đã tạo môn ${subject.name}.`, true);
    } else if (e.target.id === "parent-link-form") {
      const form = e.target;
      const name = form.elements.parentName.value.trim();
      const email = form.elements.parentEmail.value.trim();
      const phone = form.elements.parentPhone.value.trim();
      const studentId = form.elements.studentId.value;
      const relationship = form.elements.relationship.value;
      const student = state.users.find(u => u.id === studentId && u.role === "student" && u.active !== false);
      if (!name || !student || !form.elements.verified.checked) { toast("Hãy kiểm tra thông tin, chọn học sinh hợp lệ và xác nhận đã xác minh."); return; }
      if (email && state.users.some(u => u.role === "parent" && String(u.email||"").toLowerCase() === email.toLowerCase())) { toast("Email này đã thuộc một tài khoản phụ huynh."); return; }
      state.studentGuardians = state.studentGuardians || [];
      const existingParent = email ? state.users.find(u => u.role === "parent" && String(u.email||"").toLowerCase() === email.toLowerCase()) : null;
      const existingLink = existingParent && (state.studentGuardians || []).find(l => l.parentId === existingParent.id && l.studentId === student.id && !l.revokedAt);
      if (existingLink) { toast("Tài khoản này đã có liên kết còn hiệu lực với học sinh đã chọn."); return; }
      const parent = existingParent || { id: uid("parent"), role: "parent", name, email, phone, publicCode: "PH-" + String(state.users.filter(u=>u.role==="parent").length+1).padStart(4,"0"), active: true, createdAt: new Date().toISOString() };
      const code = makeLoginCode("parent");
      parent.name = name; parent.email = email; parent.phone = phone; parent.codeHash = hashCode(code); parent.codeOnce = false; parent.active = true; parent.codeUpdatedAt = new Date().toISOString();
      if (!existingParent) state.users.push(parent);
      const link = { id: uid("guardian_link"), parentId: parent.id, studentId: student.id, relationship, status: "verified", verifiedAt: new Date().toISOString(), verifiedBy: session.id, createdAt: new Date().toISOString(), revokedAt: null };
      state.studentGuardians.push(link);
      parentProvisionResult = { name, publicCode: parent.publicCode, code, email };
      persist(); log("PARENT_ACCOUNT_LINK_VERIFIED", { parentId: parent.id, studentId: student.id, linkId: link.id });
      activeTab = "parents"; render(); toast("Đã tạo tài khoản phụ huynh và xác minh liên kết.", true);
    } else if (e.target.id === "teacher-create-student-form") {
      createTeacherStudent(e.target);
    } else if (e.target.id === "teacher-parent-request-form") {
      requestTeacherParentLink(e.target);
    } else if (e.target.id === "teacher-profile-form") {
      const form = e.target;
      if (!requireActiveSession() || pageRole !== "teacher" || session?.role !== "teacher") {
        toast("Chỉ giáo viên đang đăng nhập mới được cập nhật hồ sơ này.");
        return;
      }
      const teacher = state.users.find(user => user.id === session.id && user.role === "teacher");
      if (!teacher) { toast("Không tìm thấy hồ sơ giáo viên."); return; }
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const phone = form.elements.phone.value.trim();
      if (!name) { toast("Vui lòng nhập họ tên."); return; }
      if (email && state.users.some(user =>
        user.id !== teacher.id && user.role === "teacher" && String(user.email || "").trim().toLowerCase() === email.toLowerCase()
      )) {
        toast("Email này đã được một tài khoản giáo viên khác sử dụng.");
        return;
      }
      const changes = [];
      for (const [field, value] of [["name", name], ["email", email], ["phone", phone]]) {
        if (String(teacher[field] || "") !== value) {
          teacher[field] = value;
          changes.push(field);
        }
      }
      if (!changes.length) { toast("Thông tin chưa có thay đổi."); return; }
      log("UPDATE_TEACHER_PROFILE", { userId: teacher.id, changedFields: changes });
      activeTab = "profile";
      render();
      toast("Đã cập nhật hồ sơ giáo viên.", true);
    } else if (e.target.id === "class-form") createClass(e.target);
    else if (e.target.id === "admin-class-edit-form") {
      if(!requireActiveSession()||pageRole!=="admin"||!isAdmin()){toast("Chỉ Admin mới được chỉnh sửa lớp.");return;}
      const form=e.target;
      const cls=state.classes.find(item=>item.id===form.dataset.id);
      if(!cls){toast("Không tìm thấy lớp cần chỉnh sửa.");return;}
      const name=form.elements.name.value.trim();
      const code=form.elements.code.value.trim();
      if(!name||!code){toast("Hãy nhập đầy đủ tên và mã lớp.");return;}
      if(state.classes.some(item=>item.id!==cls.id&&String(item.code||"").trim().toLowerCase()===code.toLowerCase())){toast("Mã lớp đã được sử dụng. Hãy nhập mã khác.");return;}
      const previous={name:cls.name,code:cls.code};
      cls.name=name;
      cls.code=code;
      persist();
      log("UPDATE_CLASS",{classId:cls.id,previous,name,code});
      activeTab="classes";
      form.closest(".class-detail-overlay")?.remove();
      render();
      showClassDetails(cls.id);
      toast("Đã cập nhật thông tin lớp.",true);
    }
    else if (e.target.id === "add-student-form") addStudentToClass(e.target);
    else if (e.target.id === "assignment-form") createAssignment(e.target);
    else if (e.target.id === "teacher-quiz-form") {
      const form=e.target;
      const payload={
        title:form.elements.title.value.trim(),
        description:form.elements.description.value.trim(),
        subjectId:form.elements.subjectId.value,
        questions:questionDraftQuestions("quiz")
      };
      if(!payload.questions.length){toast("Hãy thêm ít nhất một câu hỏi bằng trình tạo câu hỏi.");return;}
      try {
        const quizId=form.elements.quizId.value;
        const result=quizId?Core.updateQuiz(state,session,quizId,payload):Core.createQuiz(state,session,payload);
        uiState.teacherQuizEditId=result.quiz.id;
        uiState.teacherQuizDraftId=result.quiz.id;
        uiState.teacherQuizQuestions=JSON.parse(JSON.stringify(result.version.questions));
        persist();log(quizId?"UPDATE_QUIZ_VERSION":"CREATE_QUIZ",{quizId:result.quiz.id,version:result.version.version,questionCount:result.version.questions.length});
        activeTab="quiz-bank";render();toast(quizId?"Đã tạo phiên bản Quiz mới; các bài giao cũ không đổi.":"Đã tạo Quiz gốc và phiên bản đầu tiên.",true);
      } catch(error) { toast(error.message); }
    }
    else if(e.target.id==="teacher-quiz-assign-form"){
      const form=e.target;
      const classIds=Array.from(form.querySelectorAll('input[name="classIds"]:checked')).map(input=>input.value);
      const configs=classIds.map(classId=>({
        classId,
        title:form.elements[`title-${classId}`]?.value.trim(),
        due:form.elements[`due-${classId}`]?.value||"",
        durationMinutes:form.elements[`duration-${classId}`]?.value||null,
        allowLate:form.elements[`late-${classId}`]?.value !== "deny"
      }));
      try {
        const created=Core.assignQuizToClasses(state,session,form.elements.quizId.value,configs);
        persist();log("ASSIGN_QUIZ_TO_CLASSES",{quizId:form.elements.quizId.value,assignmentIds:created.map(item=>item.id),classIds});
        activeTab="quiz-bank";render();toast(`Đã giao Quiz cho ${created.length} lớp.`,true);
      } catch(error) { toast(error.message); }
    }
    else if(e.target.id==="teacher-assignment-form"){
      try {
        const form=e.target;
        const record=Core.assignTeacher(state,session,{
          classId:form.elements.classId.value,teacherId:form.elements.teacherId.value,
          subjectId:form.elements.subjectId.value,role:"subject_teacher"
        });
        const cls=state.classes.find(item=>item.id===record.classId);
        cls.teacherIds=Array.from(new Set([...(cls.teacherIds||[]),record.teacherId]));
        state.classTeachers=state.classTeachers||[];
        const relation=state.classTeachers.find(item=>item.classId===record.classId&&item.userId===record.teacherId);
        if(relation)relation.leftAt=null;
        else state.classTeachers.push({classId:record.classId,userId:record.teacherId,joinedAt:record.assignedAt,leftAt:null});
        persist();log("ASSIGN_CLASS_TEACHER",{classId:record.classId,teacherId:record.teacherId,subjectId:record.subjectId,role:record.role});
        render();toast("Đã thêm giáo viên bộ môn.",true);
      } catch(error) { toast(error.message); }
    }
    else if(e.target.id==="classroom-create-form"){
      try {
        const form=e.target;
        const layout=Core.createClassroomLayout(state,session,{
          classId:form.elements.classId.value,name:form.elements.name.value,
          width:form.elements.width.value,height:form.elements.height.value
        });
        uiState.teacherLayoutClassId=layout.classId;uiState.teacherLayoutId=layout.id;
        persist();log("CREATE_CLASSROOM_LAYOUT",{layoutId:layout.id,classId:layout.classId,name:layout.name});
        render();toast("Đã tạo sơ đồ lớp mới; sơ đồ cũ được lưu trữ.",true);
      } catch(error) { toast(error.message); }
    }
  });

  // Delegated selector for single-choice / boolean
  document.addEventListener("click", e => {
    const choice = e.target.closest("[data-answer]");
    if (choice) {
      answers[Number(choice.dataset.answer)] = Number(choice.dataset.choice);
      saveDraft();
      render();
    }
  });

  try {
    render();
  } catch (error) {
    showRenderError(error);
  }
})();