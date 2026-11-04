/* Business rules for subject assignments, reusable quizzes and classroom layouts. */
(function () {
  "use strict";
  window.Core = window.Core || {};
  const Core = window.Core;

  function fail(message) {
    throw new Error(message);
  }

  function uid(prefix) {
    return Core.uid ? Core.uid(prefix) : `${prefix}_${Math.random().toString(36).slice(2)}`;
  }

  function findMissingClassCodes(state, classCodes) {
    const normalize = value => String(value || "").normalize("NFKC").trim().toLowerCase();
    const available = new Set((state.classes || []).map(cls => normalize(cls.code)).filter(Boolean));
    return [...new Set((classCodes || []).map(code => String(code || "").normalize("NFKC").trim()).filter(Boolean))]
      .filter(code => !available.has(normalize(code)));
  }

  function activeTeacherAssignment(state, classId, teacherId) {
    return (state.classTeacherAssignments || []).filter(item =>
      item.classId === classId && item.teacherId === teacherId &&
      item.status === "active" && !item.revokedAt
    );
  }

  function canManageClassTeachers(state, session, classId) {
    if (Core.isAdmin(session)) return true;
    return session?.role === "teacher" && activeTeacherAssignment(state, classId, session.id)
      .some(item => item.role === "homeroom_teacher");
  }

  function canTeachSubject(state, session, classId, subjectId) {
    if (Core.isAdmin(session)) return true;
    if (session?.role !== "teacher" || !subjectId) return false;
    return activeTeacherAssignment(state, classId, session.id).some(item =>
      item.role === "homeroom_teacher" ||
      (item.role === "subject_teacher" && item.subjectId === subjectId) ||
      (item.migrated === true && item.role === "subject_teacher" && !item.subjectId)
    );
  }

  function assignTeacher(state, session, { classId, teacherId, subjectId = null, role = "subject_teacher" }) {
    if (!canManageClassTeachers(state, session, classId)) fail("Bạn không có quyền quản lý phân công giáo viên của lớp này.");
    const cls = (state.classes || []).find(item => item.id === classId);
    const teacher = (state.users || []).find(item => item.id === teacherId && item.role === "teacher" && item.active !== false);
    if (!cls || !teacher) fail("Lớp hoặc tài khoản giáo viên không còn hợp lệ.");
    if (!["homeroom_teacher", "subject_teacher"].includes(role)) fail("Vai trò phân công không hợp lệ.");
    if (role === "homeroom_teacher" && !Core.isAdmin(session)) fail("Chỉ Admin được phân công giáo viên chủ nhiệm.");
    if (role === "subject_teacher" && !(state.subjects || []).some(item => item.id === subjectId && item.active !== false)) {
      fail("Hãy chọn môn học đang hoạt động.");
    }
    const duplicate = activeTeacherAssignment(state, classId, teacherId).some(item =>
      item.role === role && (item.subjectId || null) === (subjectId || null)
    );
    if (duplicate) fail("Phân công này đã tồn tại.");
    const now = new Date().toISOString();
    const record = {
      id: uid("cta"), classId, teacherId, subjectId: role === "subject_teacher" ? subjectId : null,
      role, status: "active", assignedBy: session.id, assignedAt: now, revokedBy: null, revokedAt: null
    };
    state.classTeacherAssignments.push(record);
    if (role === "homeroom_teacher") {
      const current = state.classTeacherAssignments.filter(item =>
        item.classId === classId && item.role === "homeroom_teacher" && item.status === "active" && !item.revokedAt && item.id !== record.id
      );
      current.forEach(item => {
        item.status = "revoked";
        item.revokedBy = session.id;
        item.revokedAt = now;
      });
    }
    return record;
  }

  function revokeTeacherAssignment(state, session, assignmentId) {
    const record = (state.classTeacherAssignments || []).find(item => item.id === assignmentId);
    if (!record || record.status !== "active" || record.revokedAt) fail("Không tìm thấy phân công đang hoạt động.");
    if (!canManageClassTeachers(state, session, record.classId)) fail("Bạn không có quyền thu hồi phân công của lớp này.");
    if (record.role === "homeroom_teacher" && !Core.isAdmin(session)) fail("Chỉ Admin được thu hồi phân công giáo viên chủ nhiệm.");
    record.status = "revoked";
    record.revokedBy = session.id;
    record.revokedAt = new Date().toISOString();
    return record;
  }

  function createQuiz(state, session, { title, description = "", subjectId, questions }) {
    if (!session || !["admin", "teacher"].includes(session.role)) fail("Không có quyền tạo Quiz.");
    if (!String(title || "").trim() || !Array.isArray(questions) || !questions.length) fail("Quiz cần tiêu đề và ít nhất một câu hỏi.");
    if (!(state.subjects || []).some(item => item.id === subjectId && item.active !== false)) fail("Hãy chọn môn học hợp lệ.");
    const now = new Date().toISOString();
    const quiz = {
      id: uid("quiz"), title: String(title).trim(), description: String(description).trim(),
      subjectId, ownerId: session.id, originalCreatorId: session.id, status: "active",
      currentVersion: 1, createdAt: now, updatedAt: now
    };
    const version = {
      id: uid("quiz_version"), quizId: quiz.id, version: 1, title: quiz.title, subjectId,
      questions: JSON.parse(JSON.stringify(questions)), createdAt: now, createdBy: session.id
    };
    state.quizzes.push(quiz);
    state.quizVersions.push(version);
    return { quiz, version };
  }

  function updateQuiz(state, session, quizId, { title, description = "", subjectId, questions }) {
    const quiz = (state.quizzes || []).find(item => item.id === quizId);
    if (!quiz) fail("Không tìm thấy Quiz.");
    if (quiz.ownerId !== session?.id && !Core.isAdmin(session)) fail("Chỉ chủ sở hữu hoặc Admin được sửa Quiz gốc.");
    if (!String(title || "").trim() || !Array.isArray(questions) || !questions.length) fail("Quiz cần tiêu đề và ít nhất một câu hỏi.");
    if (!(state.subjects || []).some(item => item.id === subjectId && item.active !== false)) fail("Hãy chọn môn học hợp lệ.");
    const versionNumber = (Number(quiz.currentVersion) || 0) + 1;
    const now = new Date().toISOString();
    const version = {
      id: uid("quiz_version"), quizId: quiz.id, version: versionNumber, title: String(title).trim(),
      subjectId, questions: JSON.parse(JSON.stringify(questions)), createdAt: now, createdBy: session.id
    };
    quiz.title = version.title;
    quiz.description = String(description).trim();
    quiz.subjectId = subjectId;
    quiz.currentVersion = versionNumber;
    quiz.updatedAt = now;
    state.quizVersions.push(version);
    return { quiz, version };
  }

  function assignQuizToClasses(state, session, quizId, classConfigs) {
    const quiz = (state.quizzes || []).find(item => item.id === quizId);
    if (!quiz) fail("Không tìm thấy Quiz.");
    if (quiz.ownerId !== session?.id && !Core.isAdmin(session)) fail("Chỉ chủ sở hữu Quiz hoặc Admin được giao Quiz.");
    if (!Array.isArray(classConfigs) || !classConfigs.length) fail("Chọn ít nhất một lớp.");
    const version = (state.quizVersions || []).find(item => item.quizId === quiz.id && item.version === quiz.currentVersion);
    if (!version) fail("Không tìm thấy phiên bản Quiz hiện tại.");
    const configs = classConfigs.map(config => {
      const cls = (state.classes || []).find(item => item.id === config.classId);
      if (!cls || !canTeachSubject(state, session, cls.id, quiz.subjectId)) {
        fail(`Không có quyền giao Quiz cho lớp ${cls?.name || "đã chọn"}.`);
      }
      return { ...config, cls };
    });
    const now = new Date().toISOString();
    return configs.map(config => {
      const id = uid("assignment");
      const assignment = {
        id, classId: config.cls.id, title: String(config.title || version.title).trim(),
        due: config.due || "", dueAt: config.due || "", questions: JSON.parse(JSON.stringify(version.questions)),
        durationMinutes: Number(config.durationMinutes) > 0 ? Number(config.durationMinutes) : null,
        allowLate: config.allowLate !== false, createdBy: session.id, createdAt: now,
        quizId: quiz.id, quizVersionId: version.id, subjectId: quiz.subjectId
      };
      const quizAssignment = {
        id, quizId: quiz.id, quizVersionId: version.id, classId: config.cls.id,
        subjectId: quiz.subjectId, assignedBy: session.id, title: assignment.title,
        dueAt: assignment.dueAt, status: "published", createdAt: now
      };
      state.assignments.push(assignment);
      state.quizAssignments.push(quizAssignment);
      return assignment;
    });
  }

  function getQuizQuestions(state, assignment) {
    const version = (state.quizVersions || []).find(item => item.id === assignment?.quizVersionId);
    return version ? JSON.parse(JSON.stringify(version.questions)) : JSON.parse(JSON.stringify(assignment?.questions || []));
  }

  function canEditClassroom(state, session, classId) {
    if (Core.isAdmin(session)) return true;
    if (session?.role !== "teacher") return false;
    return activeTeacherAssignment(state, classId, session.id)
      .some(item => item.role === "homeroom_teacher");
  }

  function isParentClassroomVisible(state, classId) {
    const cls = (state.classes || []).find(item => item.id === classId);
    return Boolean(cls && cls.parentClassroomVisible !== false);
  }

  function setParentClassroomVisibility(state, session, classId, visible) {
    if (!canEditClassroom(state, session, classId)) fail("Bạn không có quyền thay đổi quyền xem sơ đồ lớp này.");
    if (typeof visible !== "boolean") fail("Trạng thái chia sẻ sơ đồ không hợp lệ.");
    const cls = (state.classes || []).find(item => item.id === classId);
    if (!cls) fail("Không tìm thấy lớp.");
    cls.parentClassroomVisible = visible;
    return visible;
  }

  function canEditLayout(state, session, layout) {
    return Boolean(layout && layout.status === "active" && canEditClassroom(state, session, layout.classId));
  }

  function createClassroomLayout(state, session, { classId, name, width = 1200, height = 800 }) {
    if (!canEditClassroom(state, session, classId)) fail("Bạn không có quyền chỉnh sửa sơ đồ lớp này.");
    if (!(state.classes || []).some(item => item.id === classId)) fail("Không tìm thấy lớp.");
    const title = String(name || "").trim();
    const w = Number(width), h = Number(height);
    if (!title || !Number.isFinite(w) || !Number.isFinite(h) || w < 400 || h < 300 || w > 3000 || h > 2000) {
      fail("Tên hoặc kích thước sơ đồ không hợp lệ.");
    }
    (state.classroomLayouts || []).filter(item => item.classId === classId && item.status === "active")
      .forEach(item => { item.status = "archived"; });
    const now = new Date().toISOString();
    const layout = {
      id: uid("layout"), classId, name: title, width: w, height: h,
      elements: [], status: "active", version: 1, createdBy: session.id,
      updatedBy: session.id, createdAt: now, updatedAt: now
    };
    state.classroomLayouts.push(layout);
    return layout;
  }

  function addLayoutElement(state, session, layoutId, type, deskType = "single") {
    const layout = (state.classroomLayouts || []).find(item => item.id === layoutId);
    if (!canEditLayout(state, session, layout)) fail("Bạn không có quyền sửa sơ đồ này.");
    const definitions = {
      desk: deskType === "double"
        ? { width: 120, height: 70, seats: 2, deskType: "double" }
        : { width: 65, height: 70, seats: 1, deskType: "single" },
      teacher_desk: { width: 180, height: 65 },
      board: { width: 400, height: 30 },
      door: { width: 90, height: 24 },
      window: { width: 120, height: 24 },
      label: { width: 160, height: 40, text: "Ghi chú" }
    };
    const definition = definitions[type];
    if (!definition) fail("Loại phần tử sơ đồ không hợp lệ.");
    const element = {
      id: uid(type), type, x: 40, y: 40, width: definition.width,
      height: definition.height, rotation: 0
    };
    if (type === "desk") {
      element.deskType = definition.deskType;
      element.seats = Array.from({ length: definition.seats }, (_, position) => ({
        id: uid("seat"), studentId: null, position
      }));
    }
    if (type === "label") element.text = definition.text;
    layout.elements.push(element);
    layout.version += 1;
    layout.updatedBy = session.id;
    layout.updatedAt = new Date().toISOString();
    return element;
  }

  function moveLayoutElement(state, session, layoutId, elementId, x, y) {
    const layout = (state.classroomLayouts || []).find(item => item.id === layoutId);
    const element = layout?.elements.find(item => item.id === elementId);
    if (!layout || !element || !canEditLayout(state, session, layout)) fail("Bạn không có quyền di chuyển phần tử này.");
    const nextX = Number(x), nextY = Number(y);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) fail("Tọa độ sơ đồ không hợp lệ.");
    element.x = Math.max(0, Math.min(nextX, layout.width - element.width));
    element.y = Math.max(0, Math.min(nextY, layout.height - element.height));
    layout.version += 1;
    layout.updatedBy = session.id;
    layout.updatedAt = new Date().toISOString();
    return layout;
  }

  function rotateLayoutElement(state, session, layoutId, elementId) {
    const layout = (state.classroomLayouts || []).find(item => item.id === layoutId);
    const element = layout?.elements.find(item => item.id === elementId);
    if (!layout || !element || !canEditLayout(state, session, layout)) fail("Bạn không có quyền xoay phần tử này.");
    element.rotation = ((Number(element.rotation) || 0) + 90) % 360;
    const rotated = element.rotation % 180 !== 0;
    const maxX = layout.width - (rotated ? element.height : element.width);
    const maxY = layout.height - (rotated ? element.width : element.height);
    element.x = Math.max(0, Math.min(Number(element.x) || 0, maxX));
    element.y = Math.max(0, Math.min(Number(element.y) || 0, maxY));
    layout.version += 1;
    layout.updatedBy = session.id;
    layout.updatedAt = new Date().toISOString();
    return layout;
  }

  function assignStudentToSeat(state, session, layoutId, seatId, studentId) {
    const layout = (state.classroomLayouts || []).find(item => item.id === layoutId);
    if (!layout || !canEditLayout(state, session, layout)) fail("Bạn không có quyền xếp chỗ cho lớp này.");
    const seat = layout.elements.flatMap(element => element.seats || []).find(item => item.id === seatId);
    if (!seat) fail("Không tìm thấy ghế.");
    if (studentId) {
      const validStudentIds = Core.getClassStudentIds(state, layout.classId);
      const student = (state.users || []).find(item => item.id === studentId && item.role === "student" && item.active !== false);
      if (!student || !validStudentIds.includes(studentId)) fail("Chỉ được xếp học sinh đang thuộc lớp này.");
      const duplicate = layout.elements.flatMap(element => element.seats || [])
        .some(item => item.id !== seatId && item.studentId === studentId);
      if (duplicate) fail("Học sinh này đã được xếp vào một ghế khác.");
    }
    seat.studentId = studentId || null;
    layout.version += 1;
    layout.updatedBy = session.id;
    layout.updatedAt = new Date().toISOString();
    return layout;
  }

  function removeLayoutElement(state, session, layoutId, elementId, removeAssignedStudents = false) {
    const layout = (state.classroomLayouts || []).find(item => item.id === layoutId);
    const index = layout?.elements.findIndex(item => item.id === elementId) ?? -1;
    if (!layout || index < 0 || !canEditLayout(state, session, layout)) fail("Bạn không có quyền xóa phần tử này.");
    const element = layout.elements[index];
    const occupied = (element.seats || []).some(seat => seat.studentId);
    if (occupied && !removeAssignedStudents) fail("Bàn đang có học sinh. Xác nhận xóa bàn và gỡ học sinh khỏi ghế.");
    layout.elements.splice(index, 1);
    layout.version += 1;
    layout.updatedBy = session.id;
    layout.updatedAt = new Date().toISOString();
    return layout;
  }

  Object.assign(Core, {
    findMissingClassCodes,
    activeTeacherAssignment, canManageClassTeachers, canTeachSubject, assignTeacher,
    revokeTeacherAssignment, createQuiz, updateQuiz, assignQuizToClasses, getQuizQuestions,
    canEditClassroom, isParentClassroomVisible, setParentClassroomVisibility,
    canEditLayout, createClassroomLayout, addLayoutElement, moveLayoutElement,
    rotateLayoutElement, assignStudentToSeat, removeLayoutElement
  });
})();
