"use strict";

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const TABLES = [
  "users",
  "classes",
  "assignments",
  "subjects",
  "classStudents",
  "classTeacherAssignments",
  "studentGuardians",
  "quizzes",
  "quizVersions",
  "quizAssignments",
  "submissions",
  "classroomLayouts",
  "audit"
];

function fail(message) {
  throw new Error(message);
}

function asDate(value, label, fallback = null) {
  if (value == null || value === "") {
    if (fallback) return fallback;
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail(`Ngày giờ không hợp lệ ở ${label}.`);
  return date;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`Thiếu ${label} trong tệp sao lưu.`);
  return value;
}

function legacyJson(record) {
  return record && typeof record === "object" ? record : {};
}

function userLegacyJson(record) {
  const legacy = { ...legacyJson(record) };
  delete legacy.codeHash;
  return legacy;
}

function stableId(record, collection, index, fields) {
  if (typeof record.id === "string" && record.id) return record.id;
  const source = fields.map(field => String(record[field] ?? "")).join("\u001f");
  return `${collection}_${createHash("sha256").update(`${index}\u001f${source}`).digest("hex").slice(0, 24)}`;
}

function readBackup(filename) {
  const absolutePath = path.resolve(filename);
  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`Không đọc được JSON tại ${absolutePath}: ${error.message}`);
  }
  if (!backup || backup.format !== "lop-hoc-cua-co-backup" || backup.backupVersion !== 1) {
    fail("Tệp không phải bản sao lưu Project Quizz phiên bản được hỗ trợ.");
  }
  if (!backup.state || Number(backup.state.schemaVersion) !== 4) {
    fail("Dữ liệu phải ở schemaVersion 4. Hãy mở bản cũ, để ứng dụng nâng cấp dữ liệu rồi xuất backup mới.");
  }
  for (const key of TABLES) {
    if (backup.state[key] !== undefined && !Array.isArray(backup.state[key])) {
      fail(`Danh sách ${key} trong bản sao lưu không hợp lệ.`);
    }
  }
  for (const key of ["users", "classes", "assignments", "subjects", "classStudents", "classTeacherAssignments", "studentGuardians", "quizzes", "quizVersions", "quizAssignments", "submissions", "classroomLayouts", "audit"]) {
    if (!Array.isArray(backup.state[key])) backup.state[key] = [];
  }
  for (const key of ["users", "classes"]) {
    for (const record of backup.state[key]) requiredString(record?.id, `${key}.id`);
  }
  return backup;
}

function uniqueRows(rows, keyOf) {
  const unique = new Map();
  for (const row of rows) unique.set(keyOf(row), row);
  return [...unique.values()];
}

function createRows(state) {
  const now = new Date();
  const userIds = new Set(state.users.map(row => row.id));
  const users = state.users.map(row => {
    if (!["admin", "teacher", "student", "parent"].includes(row.role)) fail(`Vai trò tài khoản không hợp lệ: ${row.id}.`);
    return {
      id: row.id,
      role: row.role,
      name: requiredString(row.name, `users.name (${row.id})`),
      email: row.email || null,
      phone: row.phone || null,
      externalCode: row.externalCode || null,
      publicCode: row.publicCode || null,
      loginCodeHash: null,
      active: row.active !== false,
      lockedUntil: asDate(row.lockedUntil, `users.lockedUntil (${row.id})`),
      lockReason: row.lockReason || null,
      createdAt: asDate(row.createdAt, `users.createdAt (${row.id})`, now),
      updatedAt: asDate(row.updatedAt, `users.updatedAt (${row.id})`, asDate(row.createdAt, `users.createdAt (${row.id})`, now)),
      legacyData: userLegacyJson(row)
    };
  });
  const classes = state.classes.map(row => ({
    id: row.id,
    name: requiredString(row.name, `classes.name (${row.id})`),
    code: row.code || null,
    grade: row.grade == null ? null : String(row.grade),
    academicYear: row.academicYear || row.schoolYear || null,
    active: row.active !== false && row.archived !== true,
    createdAt: asDate(row.createdAt, `classes.createdAt (${row.id})`, now),
    updatedAt: asDate(row.updatedAt, `classes.updatedAt (${row.id})`, asDate(row.createdAt, `classes.createdAt (${row.id})`, now)),
    legacyData: legacyJson(row)
  }));
  const subjects = state.subjects.map(row => ({
    id: row.id,
    code: requiredString(row.code, `subjects.code (${row.id})`),
    name: requiredString(row.name, `subjects.name (${row.id})`),
    active: row.active !== false,
    createdAt: asDate(row.createdAt, `subjects.createdAt (${row.id})`, now),
    updatedAt: asDate(row.updatedAt, `subjects.updatedAt (${row.id})`, asDate(row.createdAt, `subjects.createdAt (${row.id})`, now))
  }));
  const classStudents = uniqueRows(state.classStudents.map((row, index) => ({
    id: stableId(row, "class_student", index, ["classId", "userId", "joinedAt"]),
    classId: requiredString(row.classId, "classStudents.classId"),
    studentId: requiredString(row.userId || row.studentId, "classStudents.userId"),
    joinedAt: asDate(row.joinedAt, "classStudents.joinedAt", now),
    leftAt: asDate(row.leftAt, "classStudents.leftAt"),
    legacyData: legacyJson(row)
  })), row => row.id);
  const classTeacherAssignments = state.classTeacherAssignments.map((row, index) => ({
    id: stableId(row, "class_teacher", index, ["classId", "teacherId", "assignedAt"]),
    classId: requiredString(row.classId, "classTeacherAssignments.classId"),
    teacherId: requiredString(row.teacherId || row.userId, "classTeacherAssignments.teacherId"),
    subjectId: row.subjectId || null,
    role: row.role || "subject_teacher",
    status: row.status || (row.revokedAt ? "revoked" : "active"),
    assignedBy: row.assignedBy || null,
    assignedAt: asDate(row.assignedAt || row.joinedAt, "classTeacherAssignments.assignedAt", now),
    revokedAt: asDate(row.revokedAt || row.leftAt, "classTeacherAssignments.revokedAt"),
    legacyData: legacyJson(row)
  }));
  const studentGuardians = state.studentGuardians.map((row, index) => ({
    id: stableId(row, "guardian", index, ["parentId", "studentId", "createdAt"]),
    parentId: requiredString(row.parentId, "studentGuardians.parentId"),
    studentId: requiredString(row.studentId, "studentGuardians.studentId"),
    relationship: row.relationship || "guardian",
    status: ["pending", "verified", "revoked"].includes(row.status) ? row.status : "pending",
    createdAt: asDate(row.createdAt, "studentGuardians.createdAt", now),
    verifiedAt: asDate(row.verifiedAt, "studentGuardians.verifiedAt"),
    revokedAt: asDate(row.revokedAt, "studentGuardians.revokedAt"),
    legacyData: legacyJson(row)
  }));
  const quizzes = state.quizzes.map(row => ({
    id: row.id,
    title: requiredString(row.title, `quizzes.title (${row.id})`),
    description: row.description || "",
    subjectId: row.subjectId || null,
    ownerId: userIds.has(row.ownerId) ? row.ownerId : null,
    originalCreatorId: row.originalCreatorId || null,
    status: row.status || "active",
    currentVersion: Number(row.currentVersion) || 1,
    createdAt: asDate(row.createdAt, `quizzes.createdAt (${row.id})`, now),
    updatedAt: asDate(row.updatedAt, `quizzes.updatedAt (${row.id})`, asDate(row.createdAt, `quizzes.createdAt (${row.id})`, now)),
    legacyData: legacyJson(row)
  }));
  const quizVersions = state.quizVersions.map(row => ({
    id: row.id,
    quizId: requiredString(row.quizId, "quizVersions.quizId"),
    version: Number(row.version),
    title: requiredString(row.title, `quizVersions.title (${row.id})`),
    subjectId: row.subjectId || null,
    questions: row.questions ?? [],
    createdAt: asDate(row.createdAt, `quizVersions.createdAt (${row.id})`, now),
    createdBy: userIds.has(row.createdBy) ? row.createdBy : null,
    legacyData: legacyJson(row)
  }));
  const assignmentsById = new Map(state.assignments.map(row => [row.id, row]));
  const quizAssignments = state.quizAssignments.map(row => {
    const legacyAssignment = assignmentsById.get(row.id) || null;
    const durationMinutes = Number(legacyAssignment?.durationMinutes);
    return {
      id: requiredString(row.id, "quizAssignments.id"),
      quizId: requiredString(row.quizId, "quizAssignments.quizId"),
      quizVersionId: requiredString(row.quizVersionId, "quizAssignments.quizVersionId"),
      classId: requiredString(row.classId, "quizAssignments.classId"),
      subjectId: row.subjectId || null,
      assignedBy: userIds.has(row.assignedBy) ? row.assignedBy : null,
      title: requiredString(row.title, `quizAssignments.title (${row.id})`),
      dueAt: asDate(row.dueAt || row.due, `quizAssignments.dueAt (${row.id})`),
      durationMinutes: Number.isInteger(durationMinutes) && durationMinutes > 0 ? durationMinutes : null,
      allowLate: legacyAssignment?.allowLate !== false,
      status: ["draft", "published", "archived", "revoked"].includes(row.status) ? row.status : "published",
      createdAt: asDate(row.createdAt, `quizAssignments.createdAt (${row.id})`, now),
      legacyData: { ...legacyJson(row), legacyAssignment }
    };
  });
  const submissions = state.submissions.map((row, index) => ({
    id: stableId(row, "submission", index, ["assignmentId", "studentId", "at"]),
    assignmentId: requiredString(row.assignmentId, "submissions.assignmentId"),
    quizVersionId: requiredString(row.quizVersionId, `submissions.quizVersionId (${row.id || index})`),
    studentId: requiredString(row.studentId, `submissions.studentId (${row.id || index})`),
    answers: row.answers ?? {},
    score: row.score != null && Number.isFinite(Number(row.score)) ? Number(row.score) : null,
    total: row.total != null && Number.isFinite(Number(row.total)) ? Number(row.total) : null,
    status: row.status || "submitted",
    startedAt: asDate(row.startedAt, `submissions.startedAt (${row.id || index})`),
    submittedAt: asDate(row.submittedAt || row.at, `submissions.submittedAt (${row.id || index})`),
    legacyData: legacyJson(row)
  }));
  const classroomLayouts = state.classroomLayouts.map(row => ({
    id: row.id,
    classId: requiredString(row.classId, "classroomLayouts.classId"),
    name: requiredString(row.name, `classroomLayouts.name (${row.id})`),
    term: row.term || null,
    layout: {
      width: row.width ?? 1200,
      height: row.height ?? 800,
      elements: row.elements ?? [],
      status: row.status || "active",
      version: row.version ?? 1,
      createdBy: row.createdBy || null,
      updatedBy: row.updatedBy || null
    },
    isShared: row.isShared !== false && row.parentVisible !== false,
    createdAt: asDate(row.createdAt, `classroomLayouts.createdAt (${row.id})`, now),
    updatedAt: asDate(row.updatedAt, `classroomLayouts.updatedAt (${row.id})`, asDate(row.createdAt, `classroomLayouts.createdAt (${row.id})`, now)),
    legacyData: legacyJson(row)
  }));
  const audit = state.audit.map((row, index) => ({
    id: stableId(row, "audit", index, ["actor", "action", "at"]),
    actorId: userIds.has(row.actor) ? row.actor : null,
    action: requiredString(row.action, "audit.action"),
    detail: row.detail ?? {},
    createdAt: asDate(row.at, "audit.at", now)
  }));
  return {
    users, classes, subjects, classStudents, classTeacherAssignments,
    studentGuardians, quizzes, quizVersions, quizAssignments,
    submissions, classroomLayouts, audit
  };
}

async function main() {
  const dryRun = process.argv[2] === "--dry-run";
  const filename = process.argv[dryRun ? 3 : 2];
  if (!filename) {
    console.error("Cách dùng: npm run db:import-legacy -- <đường-dẫn-backup.json>");
    console.error("Kiểm tra trước khi kết nối database: node scripts/import-legacy-backup.mjs --dry-run <backup.json>");
    process.exitCode = 2;
    return;
  }
  const backup = readBackup(filename);
  const rows = createRows(backup.state);
  if (dryRun) {
    console.log("Backup hợp lệ; đã chuyển đổi cấu trúc dữ liệu (chưa ghi vào database).");
    for (const [key, values] of Object.entries(rows)) console.log(`${key}: ${values.length}`);
    return;
  }
  const prisma = new PrismaClient();
  try {
    const tableModels = [
      "user", "schoolClass", "subject", "classStudent", "classTeacherAssignment",
      "studentGuardianLink", "quiz", "quizVersion", "quizAssignment",
      "submission", "classroomLayout", "auditLog"
    ];
    await prisma.$transaction(async tx => {
      const counts = await Promise.all(tableModels.map(model => tx[model].count()));
      if (counts.some(count => count > 0)) {
        fail("Database đích không trống. Để tránh ghi đè hoặc nhập trùng, hãy dùng database mới.");
      }
      for (const model of tableModels) {
        const key = ({
          user: "users", schoolClass: "classes", subject: "subjects",
          classStudent: "classStudents", classTeacherAssignment: "classTeacherAssignments",
          studentGuardianLink: "studentGuardians", quiz: "quizzes",
          quizVersion: "quizVersions", quizAssignment: "quizAssignments",
          submission: "submissions", classroomLayout: "classroomLayouts", auditLog: "audit"
        })[model];
        if (rows[key].length) await tx[model].createMany({ data: rows[key], skipDuplicates: true });
      }
    }, { isolationLevel: "Serializable" });
    console.log("Nhập dữ liệu cũ hoàn tất.");
    for (const [key, values] of Object.entries(rows)) console.log(`${key}: ${values.length}`);
    console.log("Mã đăng nhập cũ không được nhập làm thông tin xác thực; cần cấp lại mã sau khi hoàn thiện đăng nhập server-side.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(`Không thể nhập dữ liệu: ${error.message}`);
  process.exitCode = 1;
});
