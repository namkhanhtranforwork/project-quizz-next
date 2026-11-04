/* Backup JSON có phiên bản cho dữ liệu localStorage của ứng dụng. */
(() => {
  "use strict";
  window.Core = window.Core || {};

  const FORMAT = "lop-hoc-cua-co-backup";
  const BACKUP_VERSION = 1;
  const COLLECTIONS = [
    "users", "classes", "assignments", "submissions", "audit", "classTeachers",
    "classStudents", "studentGuardians", "subjects", "classTeacherAssignments",
    "quizzes", "quizVersions", "quizAssignments", "classroomLayouts"
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBackup(state, createdBy = "admin") {
    return {
      format: FORMAT,
      backupVersion: BACKUP_VERSION,
      application: "Lớp học của cô",
      exportedAt: new Date().toISOString(),
      exportedBy: String(createdBy || "admin"),
      state: clone(state)
    };
  }

  function prepareBackupRestore(backup) {
    if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
      throw new Error("Tệp sao lưu không đúng định dạng JSON.");
    }
    if (backup.format !== FORMAT || backup.backupVersion !== BACKUP_VERSION) {
      throw new Error("Tệp không phải bản sao lưu Project Quizz được hỗ trợ.");
    }
    if (!backup.state || typeof backup.state !== "object" || Array.isArray(backup.state)) {
      throw new Error("Bản sao lưu không có trạng thái dữ liệu hợp lệ.");
    }

    const state = clone(backup.state);
    const schemaVersion = Number(state.schemaVersion);
    if (!Number.isInteger(schemaVersion) || schemaVersion < 2 || schemaVersion > 4) {
      throw new Error("Phiên bản dữ liệu trong bản sao lưu không được hỗ trợ.");
    }
    for (const key of ["users", "classes", "assignments", "submissions"]) {
      if (!Array.isArray(state[key])) throw new Error(`Bản sao lưu thiếu danh sách ${key}.`);
    }
    for (const key of COLLECTIONS) {
      if (state[key] !== undefined && !Array.isArray(state[key])) {
        throw new Error(`Dữ liệu ${key} trong bản sao lưu không hợp lệ.`);
      }
    }

    for (const key of COLLECTIONS) {
      const records = state[key];
      if (!Array.isArray(records)) continue;
      const ids = new Set();
      for (const record of records) {
        if (!record || typeof record !== "object" || Array.isArray(record)) {
          throw new Error(`Bản sao lưu có bản ghi ${key} không hợp lệ.`);
        }
        if (typeof record.id === "string" && record.id) {
          if (ids.has(record.id)) throw new Error(`Bản sao lưu có mã ${key} bị trùng.`);
          ids.add(record.id);
        } else if (["users", "classes"].includes(key)) {
          throw new Error(`Bản sao lưu có bản ghi ${key} thiếu mã định danh.`);
        }
      }
    }

    const migrated = Object.assign(window.Core.emptyState(), state);
    for (const key of COLLECTIONS) {
      if (!Array.isArray(migrated[key])) migrated[key] = [];
    }
    if (schemaVersion < 3) window.Core.migrateV2toV3(migrated);
    if (schemaVersion < 4) window.Core.migrateV3toV4(migrated);

    return {
      state: migrated,
      exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
      exportedBy: typeof backup.exportedBy === "string" ? backup.exportedBy : ""
    };
  }

  Object.assign(window.Core, { createBackup, prepareBackupRestore });
})();
