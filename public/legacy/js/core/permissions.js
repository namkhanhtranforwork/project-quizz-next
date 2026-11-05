/* Module dùng chung: Phân quyền và kiểm tra phiên làm việc */
(function () {
  "use strict";
  window.Core = window.Core || {};
  const SESSION_KEY = "lhcc_v2_session";
  const ADMIN_MODULES = [
    "overview",
    "classes",
    "subjects",
    "classroom",
    "quiz-bank",
    "competition",
    "import",
    "users",
    "parents",
    "audit"
  ];

  function isAdmin(session) {
    return session?.role === "admin";
  }

  function isFullAdmin(session, state) {
    if (!isAdmin(session)) return false;
    if (session.id === "admin-demo") return true;
    const user = state?.users?.find(item => item.id === session.id && item.role === "admin");
    return Boolean(user && !Object.prototype.hasOwnProperty.call(user, "adminPermissions"));
  }

  function canAdminAccess(module, session, state) {
    if (module === "users") {
      if (isFullAdmin(session, state)) return true;
      const user = state?.users?.find(item => item.id === session?.id && item.role === "admin");
      return Array.isArray(user?.adminPermissions) && (
        user.adminPermissions.includes("users") ||
        user.adminPermissions.includes("parents") ||
        user.adminPermissions.includes("import")
      );
    }
    if (!ADMIN_MODULES.includes(module)) return false;
    if (isFullAdmin(session, state)) return true;
    const user = state?.users?.find(item => item.id === session?.id && item.role === "admin");
    return Array.isArray(user?.adminPermissions) && user.adminPermissions.includes(module);
  }

  function canManageAdminAccess(session, state) {
    return isFullAdmin(session, state);
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
    const user = (state?.users || []).find(u => u.id === session.id);
    if (session.role === "admin" && session.id === "admin-demo") return true;
    if (session.role === "admin" && (!user || user.role !== "admin")) {
      if (typeof onInvalid === "function") onInvalid();
      return false;
    }
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
    ADMIN_MODULES,
    isAdmin,
    isFullAdmin,
    canAdminAccess,
    canManageAdminAccess,
    allowedClass,
    requireActiveSession
  });
})();
