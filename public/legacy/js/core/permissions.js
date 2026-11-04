/* Module dùng chung: Phân quyền và kiểm tra phiên làm việc */
(function () {
  "use strict";
  window.Core = window.Core || {};
  const SESSION_KEY = "lhcc_v2_session";

  function isAdmin(session) {
    return session?.role === "admin";
  }

  function allowedClass(c, session, state) {
    if (!c || !session) return false;
    if (isAdmin(session)) return true;
    if (session.role !== "teacher") return false;

    const assignments = state?.classTeacherAssignments;
    if (Array.isArray(assignments)) {
      const matching = assignments.filter(ct => ct.classId === c.id && ct.teacherId === session.id);
      if (matching.length) {
        return matching.some(ct => ct.status === "active" && !ct.revokedAt);
      }
    }

    if (state?.classTeachers && Array.isArray(state.classTeachers)) {
      const matching = state.classTeachers.filter(ct => ct.classId === c.id && ct.userId === session.id);
      if (matching.length) return matching.some(ct => !ct.leftAt);
    }
    return (c.teacherIds || []).includes(session.id);
  }

  function requireActiveSession(session, state, onInvalid) {
    if (!session) return false;
    if (session.role === "admin") return true;
    const user = (state?.users || []).find(u => u.id === session.id);
    if (!user || user.active === false) {
      if (typeof onInvalid === "function") {
        onInvalid();
      }
      return false;
    }
    return true;
  }

  Object.assign(window.Core, {
    SESSION_KEY,
    isAdmin,
    allowedClass,
    requireActiveSession
  });
})();
