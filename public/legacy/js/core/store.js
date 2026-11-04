/* Module dùng chung: Quản lý lưu trữ localStorage, nhật ký và migration */
(function () {
  "use strict";
  window.Core = window.Core || {};
  const STORE_KEY = "lhcc_v2_state";

  function emptyState() {
    return {
      users: [],
      classes: [],
      assignments: [],
      submissions: [],
      audit: [],
      classTeachers: [],
      classStudents: [],
      studentGuardians: [],
      subjects: [],
      classTeacherAssignments: [],
      quizzes: [],
      quizVersions: [],
      quizAssignments: [],
      classroomLayouts: [],
      schoolCompetition: null,
      schemaVersion: 4
    };
  }

  function migrateV2toV3(state) {
    if (!state) return state;
    state.classTeachers = state.classTeachers || [];
    state.classStudents = state.classStudents || [];
    state.studentGuardians = state.studentGuardians || [];

    // Chuyển class.teacherIds sang classTeachers
    (state.classes || []).forEach(c => {
      (c.teacherIds || []).forEach(teacherId => {
        const exists = state.classTeachers.some(
          ct => ct.classId === c.id && ct.userId === teacherId && !ct.leftAt
        );
        if (!exists) {
          state.classTeachers.push({
            classId: c.id,
            userId: teacherId,
            joinedAt: c.createdAt || new Date().toISOString(),
            leftAt: null
          });
        }
      });
    });

    // Chuyển user.classIds sang classStudents
    (state.users || []).forEach(u => {
      if (u.role === "student") {
        (u.classIds || []).forEach(classId => {
          const exists = state.classStudents.some(
            cs => cs.classId === classId && cs.userId === u.id && !cs.leftAt
          );
          if (!exists) {
            state.classStudents.push({
              classId,
              userId: u.id,
              joinedAt: u.createdAt || new Date().toISOString(),
              leftAt: null
            });
          }
        });
      }
    });

    state.schemaVersion = 3;
    return state;
  }

  function migrateV3toV4(state) {
    if (!state) return state;
    for (const key of ["subjects", "classTeacherAssignments", "quizzes", "quizVersions", "quizAssignments", "classroomLayouts"]) {
      if (!Array.isArray(state[key])) state[key] = [];
    }

    const uid = window.Core.uid || (prefix => `${prefix}_${Math.random().toString(36).slice(2)}`);
    const now = new Date().toISOString();
    const defaultSubjects = [
      ["MATH", "Toán"], ["LITERATURE", "Ngữ văn"], ["ENGLISH", "Tiếng Anh"],
      ["PHYSICS", "Vật lý"], ["CHEMISTRY", "Hóa học"], ["BIOLOGY", "Sinh học"],
      ["HISTORY", "Lịch sử"], ["GEOGRAPHY", "Địa lý"], ["INFORMATICS", "Tin học"],
      ["CIVICS", "Giáo dục công dân"]
    ];
    defaultSubjects.forEach(([code, name]) => {
      if (!state.subjects.some(subject => subject.code === code)) {
        state.subjects.push({ id: uid("subject"), code, name, active: true, createdAt: now, updatedAt: now });
      }
    });

    (state.classTeachers || []).forEach(record => {
      const teacherId = record.teacherId || record.userId;
      if (!teacherId || !record.classId) return;
      const exists = state.classTeacherAssignments.some(item =>
        item.classId === record.classId && item.teacherId === teacherId
      );
      if (!exists) {
        state.classTeacherAssignments.push({
          id: uid("cta"),
          classId: record.classId,
          teacherId,
          subjectId: null,
          role: "subject_teacher",
          status: record.leftAt ? "revoked" : "active",
          assignedBy: "migration",
          assignedAt: record.joinedAt || now,
          revokedBy: record.leftAt ? "migration" : null,
          revokedAt: record.leftAt || null,
          migrated: true
        });
      }
    });
    (state.classes || []).forEach(cls => {
      (cls.teacherIds || []).forEach(teacherId => {
        const exists = state.classTeacherAssignments.some(item =>
          item.classId === cls.id && item.teacherId === teacherId
        );
        if (!exists) {
          state.classTeacherAssignments.push({
            id: uid("cta"), classId: cls.id, teacherId, subjectId: null, role: "subject_teacher",
            status: "active", assignedBy: "migration", assignedAt: cls.createdAt || now,
            revokedBy: null, revokedAt: null, migrated: true
          });
        }
      });
    });

    (state.assignments || []).forEach(assignment => {
      let quiz = state.quizzes.find(item => item.id === assignment.quizId);
      let version = state.quizVersions.find(item => item.id === assignment.quizVersionId);
      if (!quiz) {
        quiz = {
          id: uid("quiz"),
          title: assignment.title || "Quiz cũ",
          description: "",
          subjectId: assignment.subjectId || null,
          ownerId: assignment.createdBy || null,
          originalCreatorId: assignment.createdBy || null,
          status: "active",
          currentVersion: 1,
          createdAt: assignment.createdAt || now,
          updatedAt: assignment.updatedAt || assignment.createdAt || now
        };
        state.quizzes.push(quiz);
        assignment.quizId = quiz.id;
      }
      if (!version) {
        version = {
          id: uid("quiz_version"),
          quizId: quiz.id,
          version: quiz.currentVersion || 1,
          title: assignment.title || quiz.title,
          subjectId: assignment.subjectId || quiz.subjectId || null,
          questions: JSON.parse(JSON.stringify(assignment.questions || [])),
          createdAt: assignment.createdAt || now,
          createdBy: assignment.createdBy || "migration"
        };
        state.quizVersions.push(version);
        assignment.quizVersionId = version.id;
      }
      let quizAssignment = state.quizAssignments.find(item => item.id === assignment.id);
      if (!quizAssignment) {
        quizAssignment = {
          id: assignment.id,
          quizId: quiz.id,
          quizVersionId: version.id,
          classId: assignment.classId,
          subjectId: assignment.subjectId || quiz.subjectId || null,
          assignedBy: assignment.createdBy || "migration",
          title: assignment.title || version.title,
          dueAt: assignment.due || "",
          status: assignment.archived ? "archived" : "published",
          createdAt: assignment.createdAt || now
        };
        state.quizAssignments.push(quizAssignment);
      }
      (state.submissions || []).forEach(submission => {
        if (submission.assignmentId === assignment.id && !submission.quizVersionId) {
          submission.quizVersionId = version.id;
        }
      });
    });

    state.schemaVersion = 4;
    return state;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY) || "{}";
      const parsed = JSON.parse(raw);
      const data = parsed && typeof parsed === "object" ? parsed : {};
      const storedVersion = Number(data.schemaVersion) || 0;
      const state = Object.assign(emptyState(), data);
      for (const key of ["users", "classes", "assignments", "submissions", "audit", "classTeachers", "classStudents", "studentGuardians", "subjects", "classTeacherAssignments", "quizzes", "quizVersions", "quizAssignments", "classroomLayouts"]) {
        if (!Array.isArray(state[key])) state[key] = [];
      }
      if (storedVersion < 4 && raw !== "{}" && raw !== "null") {
        const backupKey = `${STORE_KEY}_pre_v4_backup`;
        if (!localStorage.getItem(backupKey)) {
          try {
            localStorage.setItem(backupKey, raw);
          } catch (error) {
            const backupError = new Error("Không thể tạo bản sao lưu dữ liệu trước khi nâng cấp. Dữ liệu cũ được giữ nguyên; hãy xuất hoặc giải phóng dung lượng trình duyệt rồi tải lại.");
            backupError.code = "MIGRATION_BACKUP_REQUIRED";
            backupError.cause = error;
            throw backupError;
          }
        }
      }
      if (storedVersion < 3 || (!state.classTeachers.length && !state.classStudents.length)) {
        migrateV2toV3(state);
      }
      if (storedVersion < 4) migrateV3toV4(state);
      if (storedVersion < 4 || !Array.isArray(data.classroomLayouts) || !Array.isArray(data.quizAssignments) || !Array.isArray(data.classTeacherAssignments)) {
        try {
          persist(state);
        } catch (error) {
          const persistError = new Error("Không thể lưu dữ liệu sau migration. Dữ liệu cũ vẫn được giữ nguyên và có bản sao lưu; hãy giải phóng dung lượng trình duyệt rồi tải lại.");
          persistError.code = "MIGRATION_PERSIST_FAILED";
          persistError.cause = error;
          throw persistError;
        }
      }
      return state;
    } catch (error) {
      if (error?.code?.startsWith("MIGRATION_")) throw error;
      return emptyState();
    }
  }

  function persist(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function log(state, session, action, detail = {}) {
    const uidFn = window.Core.uid || (p => (p || "id") + "_" + Math.random().toString(36).slice(2));
    state.audit = state.audit || [];
    state.audit.unshift({
      id: uidFn("log"),
      at: new Date().toISOString(),
      actor: session?.id || "system",
      action,
      detail
    });
    state.audit = state.audit.slice(0, 500);
    persist(state);
  }

  // Helper quan hệ lớp hai chiều thống nhất
  function getStudentClassIds(state, userId) {
    if (state.classStudents && Array.isArray(state.classStudents)) {
      const v3 = state.classStudents
        .filter(cs => cs.userId === userId && !cs.leftAt)
        .map(cs => cs.classId);
      if (v3.length) return v3;
    }
    const u = (state.users || []).find(x => x.id === userId);
    return u?.classIds || [];
  }

  function getClassStudentIds(state, classId) {
    const memberships = Array.isArray(state.classStudents)
      ? state.classStudents.filter(record => record.classId === classId)
      : [];
    const usersWithMembershipRecords = new Set(memberships.map(record => record.userId));
    const activeMemberships = memberships.filter(record => !record.leftAt).map(record => record.userId);
    const legacyMemberships = (state.users || [])
      .filter(user => user.role === "student" && !usersWithMembershipRecords.has(user.id) && (user.classIds || []).includes(classId))
      .map(user => user.id);
    return [...new Set([...activeMemberships, ...legacyMemberships])];
  }

  function getActiveClassStudentIds(state, classId) {
    const activeStudentIds = new Set(
      (state.users || [])
        .filter(user => user.role === "student" && user.active !== false)
        .map(user => user.id)
    );
    return [...new Set(getClassStudentIds(state, classId))]
      .filter(studentId => activeStudentIds.has(studentId));
  }

  function getClassTeacherIds(state, classId) {
    if (state.classTeachers && Array.isArray(state.classTeachers)) {
      const v3 = state.classTeachers
        .filter(ct => ct.classId === classId && !ct.leftAt)
        .map(ct => ct.userId);
      if (v3.length) return v3;
    }
    const c = (state.classes || []).find(x => x.id === classId);
    return c?.teacherIds || [];
  }

  Object.assign(window.Core, {
    STORE_KEY,
    emptyState,
    migrateV2toV3,
    migrateV3toV4,
    loadState,
    persist,
    log,
    getStudentClassIds,
    getClassStudentIds,
    getActiveClassStudentIds,
    getClassTeacherIds
  });
})();
