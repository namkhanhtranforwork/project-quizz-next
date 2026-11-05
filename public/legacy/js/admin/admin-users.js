(() => {
  window.AdminViews = window.AdminViews || {};

  const ADMIN_MODULES = [
    ["overview", "Tổng quan"],
    ["classes", "Trường học & lớp học"],
    ["subjects", "Môn học"],
    ["classroom", "Sơ đồ lớp"],
    ["quiz-bank", "Ngân hàng Quiz"],
    ["competition", "Cuộc thi cấp trường"],
    ["users", "Người dùng & tài khoản"],
    ["parents", "Xác minh phụ huynh"],
    ["import", "Nhập dữ liệu Excel"],
    ["audit", "Nhật ký & dữ liệu"]
  ];

  function adminAccessLabel(user) {
    if (user.systemAccount) return "Tài khoản demo hệ thống";
    if (!Array.isArray(user.adminPermissions)) return "Toàn quyền (Admin hiện có)";
    const labels = ADMIN_MODULES
      .filter(([id]) => user.adminPermissions.includes(id))
      .map(([, label]) => label);
    return labels.length ? labels.join(", ") : "Chưa được cấp quyền";
  }

  window.AdminViews.users = (ctx) => {
    const {
      state, esc, roleName, clsName, userStatus, canManageAdminAccess, loginCodeReveal
    } = ctx;

    const selectedTab = ctx.adminUserTab || "accounts";
    const pendingCount = (state.studentGuardians || []).filter(link => link.status === "pending" && !link.revokedAt).length;

    const tabs = [
      ["accounts", "👥 Danh sách tài khoản"],
      ["parents", `👨‍👩‍👧 Phụ huynh & Liên kết${pendingCount ? ` (${pendingCount} chờ)` : ""}`],
      ["import", "📥 Nhập dữ liệu từ Excel"]
    ];

    const tabsNav = `<nav class="tabs workspace-tabs" aria-label="Quản lý người dùng & hồ sơ">
      ${tabs.map(([id, label]) => `<button type="button" class="${selectedTab === id ? "active" : ""}" data-action="admin-user-tab" data-view="${id}" aria-pressed="${selectedTab === id}">${label}</button>`).join("")}
    </nav>`;

    if (selectedTab === "parents") {
      return `${tabsNav}${window.AdminViews.parents(ctx)}`;
    }
    if (selectedTab === "import") {
      return `${tabsNav}${window.AdminViews.import(ctx)}`;
    }

    const role = document.getElementById("filter-role")?.value || "all";
    const search = (document.getElementById("user-search")?.value || "").trim().toLowerCase();
    const accounts = state.users.slice();
    if (!accounts.some(user => user.id === "admin-demo")) {
      accounts.push({
        id: "admin-demo",
        role: "admin",
        name: "Quản trị viên",
        publicCode: "—",
        active: true,
        systemAccount: true
      });
    }

    const users = accounts.filter(user =>
      (role === "all" || user.role === role) &&
      (!search || [user.name, user.publicCode, user.email]
        .some(value => String(value || "").toLowerCase().includes(search)))
    );
    const actualAdmins = state.users.filter(user => user.role === "admin");
    const revealedCode = loginCodeReveal
      ? `<section class="notice success"><b>Mã đăng nhập một lần của ${esc(loginCodeReveal.name)}:</b>
          <code>${esc(loginCodeReveal.code)}</code>
          <p>Sao chép và gửi mã an toàn. Mã sẽ không hiện lại sau khi rời mục này hoặc tải lại trang.</p>
        </section>`
      : "";
    const adminForm = canManageAdminAccess
      ? `<section class="card">
          <div class="row"><div><h2>Tạo tài khoản quản trị viên</h2>
          <p class="muted">Admin mới chỉ có các quyền được chọn. Mã đăng nhập chỉ hiển thị một lần sau khi tạo.</p></div></div>
          <form id="create-admin-form" class="form-grid">
            <div><label for="new-admin-name">Họ tên</label><input id="new-admin-name" name="name" required maxlength="120"></div>
            <div><label for="new-admin-email">Email (không bắt buộc)</label><input id="new-admin-email" name="email" type="email" maxlength="254"></div>
            <fieldset class="wide admin-permission-fieldset">
              <legend>Phân quyền theo khu vực</legend>
              <div class="form-grid admin-permission-grid">
                ${ADMIN_MODULES.map(([id, label]) => `<label class="checkbox-row"><input type="checkbox" name="adminPermissions" value="${esc(id)}"><span>${esc(label)}</span></label>`).join("")}
              </div>
            </fieldset>
            <div class="wide"><button type="submit">Tạo quản trị viên và cấp mã</button></div>
          </form>
        </section>`
      : "";

    return `${tabsNav}${revealedCode}${adminForm}
      <section class="card">
        <div class="row"><div><h2>Danh sách tài khoản</h2>
        <p class="muted">Có ${actualAdmins.length} tài khoản quản trị viên thật trong dữ liệu trình duyệt này. Tài khoản demo hiển thị riêng và không phải hồ sơ người dùng.</p></div>
        <div class="actions">
          <button type="button" class="secondary small" data-action="admin-user-tab" data-view="import">📥 Nhập file Excel</button>
          <button type="button" class="secondary small" data-action="admin-user-tab" data-view="parents">👨‍👩‍👧 Quản lý liên kết PH${pendingCount ? ` (${pendingCount})` : ""}</button>
          <button type="button" class="ghost small" data-action="export-users">📤 Xuất CSV</button>
        </div></div>
        <div class="form-grid">
          <div><label for="filter-role">Vai trò</label><select id="filter-role">
            <option value="all">Tất cả</option>
            <option value="admin" ${role === "admin" ? "selected" : ""}>Quản trị viên</option>
            <option value="teacher" ${role === "teacher" ? "selected" : ""}>Giáo viên</option>
            <option value="student" ${role === "student" ? "selected" : ""}>Học sinh</option>
            <option value="parent" ${role === "parent" ? "selected" : ""}>Phụ huynh</option>
          </select></div>
          <div><label for="user-search">Tìm kiếm</label><input id="user-search" value="${esc(search)}" placeholder="Tên, mã hồ sơ, email"></div>
        </div>
        ${users.length ? `<div class="table-wrap"><table><thead><tr>
          <th>Họ tên</th><th>Vai trò / Quyền</th><th>Mã hồ sơ</th><th>Lớp / Liên kết</th><th>Trạng thái</th><th>Thao tác</th>
        </tr></thead><tbody>${users.map(user => {
          const assignedClasses = state.classes.filter(cls => (cls.teacherIds || []).includes(user.id));
          const teachingSubjects = (state.classTeacherAssignments || [])
            .filter(item => item.teacherId === user.id && item.status === "active" && !item.revokedAt)
            .map(item => {
              const cls = state.classes.find(value => value.id === item.classId);
              const subject = state.subjects.find(value => value.id === item.subjectId);
              return item.role === "homeroom_teacher"
                ? `${cls?.name || "Lớp"} · GVCN`
                : cls ? `${cls.name} · ${subject?.name || "GV bộ môn"}` : "";
            }).filter(Boolean);
          const teacherInfo = teachingSubjects.length
            ? teachingSubjects.join(", ")
            : assignedClasses.map(cls => cls.name).join(", ") || "Chưa phân công";
          const actions = user.systemAccount
            ? '<span class="muted">Tài khoản demo, không phải người dùng thật</span>'
            : `<button class="small secondary" data-action="view-user-details" data-id="${esc(user.id)}">Xem chi tiết</button>`;
          const userRole = `${esc(roleName(user.role))}${user.role === "admin"
            ? `<div class="smalltext">${esc(adminAccessLabel(user))}</div>` : ""}`;
          return `<tr>
            <td>${esc(user.name)}<div class="smalltext">${esc(user.email || "")}</div></td>
            <td>${userRole}</td>
            <td class="code">${esc(user.publicCode || "—")}</td>
            <td>${user.role === "student"
              ? esc((user.classIds || []).map(clsName).join(", ") || "Chưa phân lớp")
              : user.role === "teacher" ? esc(teacherInfo)
              : user.role === "parent"
                ? esc((state.studentGuardians || [])
                  .filter(link => link.parentId === user.id && link.status === "verified" && !link.revokedAt)
                  .map(link => state.users.find(item => item.id === link.studentId)?.name || "")
                  .filter(Boolean).join(", ") || "Chưa liên kết")
                : "—"}</td>
            <td>${userStatus(user)}</td>
            <td><div class="actions account-actions">
              ${user.role === "teacher" ? '<button class="small ghost" data-tab="classes">Mở quản lý lớp</button>' : ""}
              ${actions}
            </div></td>
          </tr>`;
        }).join("")}</tbody></table></div>`
          : '<div class="empty">Chưa có tài khoản khớp bộ lọc.</div>'}
      </section>`;
  };
})();
