(() => {
  window.AdminViews=window.AdminViews||{};
  window.AdminViews.overview=({state,esc})=>{
    const recent=state.audit.slice(0,5);
    const pendingLinks=(state.studentGuardians||[]).filter(link=>link.status==="pending"&&!link.revokedAt);
    const unassignedClasses=state.classes.filter(cls=>!(cls.teacherIds||[]).some(id=>state.users.some(user=>user.id===id&&user.role==="teacher"&&user.active!==false)));
    const unassignedStudents=state.users.filter(user=>user.role==="student"&&user.active!==false&&!(user.classIds||[]).some(id=>state.classes.some(cls=>cls.id===id)));
    const actionNames={
      ADMIN_LOGIN_DEMO:"Admin đăng nhập",
      INIT_DEMO_SAMPLE_DATA:"Nạp dữ liệu mẫu",
      CODE_LOGIN:"Đăng nhập bằng mã",
      IMPORT_TEACHER:"Nhập danh sách giáo viên",
      IMPORT_STUDENT:"Nhập danh sách học sinh",
      CREATE_CLASS:"Tạo lớp học",
      ASSIGN_TEACHER:"Phân công giáo viên",
      REMOVE_TEACHER:"Gỡ phân công giáo viên",
      ADD_STUDENT_TO_CLASS:"Xếp học sinh vào lớp",
      REMOVE_STUDENT_FROM_CLASS:"Gỡ học sinh khỏi lớp",
      RESET_LOGIN_CODE:"Cấp lại mã đăng nhập",
      LOCK_USER:"Khóa tài khoản",
      UNLOCK_USER:"Mở khóa tài khoản",
      TEACHER_CREATE_STUDENT:"Tạo hồ sơ học sinh",
      TEACHER_REQUEST_PARENT_LINK:"Gửi yêu cầu liên kết phụ huynh",
      PARENT_LINK_VERIFIED:"Xác minh liên kết phụ huynh",
      PARENT_LINK_REVOKED:"Thu hồi liên kết phụ huynh",
      CREATE_ASSIGNMENT:"Tạo bài tập",
      UPDATE_ASSIGNMENT:"Cập nhật bài tập",
      CLONE_ASSIGNMENT:"Nhân bản bài tập",
      ARCHIVE_ASSIGNMENT:"Lưu trữ bài tập",
      RESTORE_ASSIGNMENT:"Khôi phục bài tập",
      SUBMIT_ASSIGNMENT:"Nộp bài",
      LOGOUT:"Đăng xuất"
    };
    const tasks=[];
    if(pendingLinks.length) tasks.push(`<article class="admin-task-card admin-task-priority"><div><span class="pill off">${pendingLinks.length} chờ xử lý</span><h3>Yêu cầu liên kết phụ huynh</h3><p class="muted">Kiểm tra thông tin trước khi xác minh để phụ huynh xem được hồ sơ.</p></div><button data-tab="parents">Xem yêu cầu</button></article>`);
    if(unassignedClasses.length) tasks.push(`<article class="admin-task-card"><div><span class="pill">${unassignedClasses.length} lớp</span><h3>Phân công giáo viên</h3><p class="muted">Có lớp chưa có giáo viên đang hoạt động được phân công.</p></div><button class="secondary" data-tab="classes">Phân công lớp</button></article>`);
    if(unassignedStudents.length) tasks.push(`<article class="admin-task-card"><div><span class="pill">${unassignedStudents.length} học sinh</span><h3>Xếp học sinh vào lớp</h3><p class="muted">Các hồ sơ này chưa được gán vào lớp học.</p></div><button class="secondary" data-tab="classes">Quản lý lớp</button></article>`);
    if(!tasks.length) tasks.push(`<article class="admin-task-card admin-task-clear"><div><span class="pill">Đã sẵn sàng</span><h3>Không có việc cần xử lý</h3><p class="muted">Các lớp đã được phân công và không có yêu cầu phụ huynh đang chờ.</p></div><button class="secondary" data-tab="import">Thêm dữ liệu</button></article>`);
    return `<section class="admin-workflow card"><div class="row"><div><p class="eyebrow">QUY TRÌNH QUẢN TRỊ</p><h2>Bắt đầu theo thứ tự</h2><p class="muted">Đi theo các bước để dữ liệu lớp, tài khoản và quyền truy cập được thiết lập đầy đủ.</p></div></div><ol class="admin-workflow-steps"><li><span>1</span><div><b>Tạo lớp và phân công</b><small>Thiết lập lớp, chọn giáo viên phụ trách.</small><button class="small ghost" data-tab="classes">Mở lớp học</button></div></li><li><span>2</span><div><b>Nhập tài khoản</b><small>Thêm giáo viên, học sinh và cấp mã đăng nhập.</small><button class="small ghost" data-tab="import">Nhập dữ liệu</button></div></li><li><span>3</span><div><b>Kiểm tra tài khoản</b><small>Rà soát trạng thái hồ sơ và cấp lại mã khi cần.</small><button class="small ghost" data-tab="users">Quản lý tài khoản</button></div></li><li><span>4</span><div><b>Xác minh phụ huynh</b><small>Duyệt yêu cầu sau khi nhà trường đã kiểm tra thông tin.</small><button class="small ghost" data-tab="parents">Mở mục phụ huynh</button></div></li></ol></section><section class="admin-action-center"><div class="row admin-section-heading"><div><h2>Việc cần xử lý</h2><p class="muted">Các mục cần Admin chú ý được đưa lên trước.</p></div><span class="pill">${pendingLinks.length+unassignedClasses.length+unassignedStudents.length} mục</span></div><div class="admin-task-list">${tasks.join("")}</div></section><section class="card admin-recent-activity"><div class="row"><div><h2>Hoạt động gần đây</h2><p class="muted">Nhật ký thao tác trong trình duyệt này.</p></div><button class="small ghost" data-tab="audit">Mở toàn bộ nhật ký</button></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hoạt động</th></tr></thead><tbody>${recent.map(item=>`<tr><td>${esc(item.at?new Date(item.at).toLocaleString("vi-VN"):"—")}</td><td>${esc(state.users.find(user=>user.id===item.actor)?.name||"Hệ thống")}</td><td>${esc(actionNames[item.action]||item.action)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">Chưa có hoạt động nào được ghi nhận.</div>'}</section>`;
  };
})();
