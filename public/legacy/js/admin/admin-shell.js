/* Khung giao diện Admin. Các phần nội dung nằm trong module riêng. */
(() => {
  window.AdminViews = window.AdminViews || {};
  window.AdminViews.render = function(ctx) {
    const {app,state,esc,activeTab}=ctx;
    const teachers=state.users.filter(u=>u.role==='teacher');
    const students=state.users.filter(u=>u.role==='student');
    const suspended=state.users.filter(u=>u.active===false).length;
    const pendingParents=(state.studentGuardians||[]).filter(link=>link.status==="pending"&&!link.revokedAt).length;
    const views=window.AdminViews;
    const content=activeTab==='users'?views.users(ctx):activeTab==='classes'?views.classes(ctx):activeTab==='import'?views.import(ctx):activeTab==='audit'?views.audit(ctx):activeTab==='parents'?views.parents(ctx):activeTab==='competition'?views.competition(ctx):activeTab==='subjects'?views.subjects(ctx):activeTab==='classroom'?window.TeacherViews.classroom(ctx.classroomContext):activeTab==='quiz-bank'?window.TeacherViews.quizBank(ctx.quizBankContext):views.overview(ctx);
    const pageTitle={overview:"Tổng quan",import:"Nhập dữ liệu",users:"Người dùng",classes:"Lớp học",audit:"Nhật ký & dữ liệu",parents:"Phụ huynh",competition:"Cuộc thi cấp trường",subjects:"Môn học",classroom:"Sơ đồ lớp","quiz-bank":"Ngân hàng Quiz"}[activeTab]||"Tổng quan";
    const pageDescription={overview:"Tình hình chung và lối tắt đến các công việc quản trị thường dùng.",import:"Nhập hồ sơ giáo viên, học sinh và kiểm tra dữ liệu trước khi tạo.",users:"Quản lý hồ sơ, trạng thái và mã đăng nhập của tài khoản.",classes:"Quản lý lớp học, phân công giáo viên và học sinh.",audit:"Theo dõi thao tác, xuất backup cục bộ và xem trước kế hoạch backup hệ thống.",parents:"Xử lý yêu cầu liên kết, tài khoản phụ huynh và hồ sơ học sinh.",competition:"Chọn bài thi, đặt tên và bật/tắt bảng xếp hạng toàn trường.",subjects:"Tạo danh mục môn học dùng chung cho toàn trường.",classroom:"Tạo, sắp xếp và quản lý sơ đồ lớp học.","quiz-bank":"Quản lý Quiz gốc, phiên bản và lượt giao trên toàn hệ thống."}[activeTab]||"";
    const navigation=[
      {id:"overview",icon:"⌂",label:"Tổng quan"},
      {id:"classes",icon:"🏫",label:"Trường học & lớp học"},
      {id:"subjects",icon:"📚",label:"Môn học"},
      {id:"classroom",icon:"🪑",label:"Sơ đồ lớp"},
      {id:"quiz-bank",icon:"📝",label:"Ngân hàng Quiz"},
      {id:"competition",icon:"🏆",label:"Cuộc thi cấp trường"},
      {id:"import",icon:"📥",label:"Nhập dữ liệu"},
      {id:"users",icon:"👥",label:"Người dùng"},
      {id:"parents",icon:"👨‍👩‍👧",label:"Phụ huynh",badge:pendingParents},
      {id:"audit",icon:"📋",label:"Nhật ký & dữ liệu"}
    ];
    const stats=activeTab==="overview"?`<section class="stats admin-stats" aria-label="Thống kê hệ thống">
      <div class="stat"><span>Tổng tài khoản</span><strong>${state.users.length}</strong></div>
      <div class="stat"><span>Giáo viên</span><strong>${teachers.length}</strong></div>
      <div class="stat"><span>Học sinh</span><strong>${students.length}</strong></div>
      <div class="stat"><span>Lớp học</span><strong>${state.classes.length}</strong></div>
      <div class="stat"><span>Ngân hàng Quiz</span><strong>${state.quizzes.length}</strong></div>
      <div class="stat"><span>Lượt giao bài</span><strong>${state.assignments.length}</strong></div>
      <div class="stat"><span>Bài nộp</span><strong>${state.submissions.length}</strong></div>
      <div class="stat"><span>Tài khoản bị khóa</span><strong>${suspended}</strong></div>
    </section>`:"";
    app.innerHTML=`<div class="admin-dashboard">
      <button class="admin-sidebar-backdrop" type="button" data-admin-sidebar-close aria-label="Đóng điều hướng quản trị"></button>
      <aside class="admin-sidebar" aria-label="Điều hướng quản trị">
        <div class="admin-sidebar-heading"><span>QUẢN TRỊ</span></div>
        <nav class="admin-nav" aria-label="Các phân hệ quản trị">
          ${navigation.map(item=>`<button class="admin-pill-nav ${activeTab===item.id?"is-active":""}" data-tab="${item.id}" aria-label="${item.label}${item.badge?`, ${item.badge} chờ xử lý`:""}" ${activeTab===item.id?'aria-current="page"':""}><span class="admin-nav-icon" aria-hidden="true">${item.icon}</span><span class="admin-nav-label">${item.label}</span>${item.badge?`<span class="admin-nav-badge" aria-label="${item.badge} yêu cầu chờ xử lý">${item.badge}</span>`:""}</button>`).join("")}
        </nav>
      </aside>
      <section class="admin-main">
        <header class="workspace-heading admin-page-banner admin-dotted-backdrop">
          <button class="admin-sidebar-toggle" type="button" data-admin-sidebar-toggle aria-label="Thu gọn hoặc mở điều hướng quản trị" aria-expanded="true">☰</button>
          <div class="admin-page-heading"><p class="eyebrow">KHÔNG GIAN QUẢN TRỊ</p><h1>${pageTitle}</h1><p class="muted">${pageDescription}</p></div>
          <span class="workspace-role-chip">🛡️ Quản trị viên</span>
        </header>
        ${stats}<div class="workspace-content">${content}</div>
      </section>
    </div>`;
  };
})();
