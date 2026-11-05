/* Module dùng chung: Hàm mã hóa, chuẩn hóa mã đăng nhập và sinh ID ngẫu nhiên */
(function () {
  "use strict";
  window.Core = window.Core || {};

  function normalizeLoginCode(code) {
    return String(code || "")
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[\s\uFEFF]/g, "")
      .replace(/[^A-Z0-9-]/g, "");
  }

  function hashCode(code) {
    const normalized = normalizeLoginCode(code);
    let h = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      h ^= normalized.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function legacyHashCode(code) {
    const raw = String(code || "").trim().toUpperCase().replace(/\s+/g, "");
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function uid(prefix = "id") {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return prefix + "_" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }

  function makeLoginCode(role) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(15);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const raw = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
    const groups = raw.match(/.{1,5}/g).join("-");
    return (role === "teacher" ? "GV" : role === "parent" ? "PH" : role === "admin" ? "ADM" : "HS") + "-" + groups;
  }

  Object.assign(window.Core, {
    normalizeLoginCode,
    hashCode,
    legacyHashCode,
    uid,
    makeLoginCode
  });
})();
