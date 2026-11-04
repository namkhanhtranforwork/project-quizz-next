(() => {
  window.AdminViews = window.AdminViews || {};
  window.AdminViews.backup = ({ state }) => {
    const counts = [
      ["Tài khoản", state.users.length],
      ["Lớp học", state.classes.length],
      ["Bài giao", state.assignments.length],
      ["Bài nộp", state.submissions.length],
      ["Quiz gốc", state.quizzes.length],
      ["Sơ đồ lớp", state.classroomLayouts.length]
    ];
    return `<section class="card"><h2>Sao lưu cục bộ</h2>
      <p>Bản sao lưu chứa hồ sơ, mã băm đăng nhập, lớp, bài giao, bài nộp, Quiz, liên kết phụ huynh và nhật ký của trình duyệt hiện tại.</p>
      <div class="notice">Tệp JSON có thể chứa dữ liệu cá nhân và kết quả học tập. Chỉ lưu ở nơi an toàn, giới hạn người nhận và không gửi qua kênh công khai. Bản sao lưu này không được mã hóa.</div>
      <div class="stats">${counts.map(([label, count]) => `<div class="stat"><span>${label}</span><strong>${count}</strong></div>`).join("")}</div>
      <div class="actions"><button data-action="download-backup">Tạo và tải bản sao lưu JSON</button></div>
      <p class="muted">Dữ liệu hiện chỉ nằm trong localStorage của origin/trình duyệt này. Tệp tải về là bản sao lưu cục bộ, không phải backup tự động trên máy chủ.</p>
    </section>
    <section class="card"><h2>Khôi phục từ bản sao lưu</h2>
      <p>Chọn tệp JSON đã xuất từ Project Quizz. Tệp sẽ được kiểm tra và xem trước trước khi thay thế dữ liệu hiện tại.</p>
      <div class="notice error"><b>Lưu ý:</b> Khôi phục thay thế toàn bộ dữ liệu đang có trong trình duyệt này. Hãy tải bản sao lưu hiện tại trước khi tiếp tục.</div>
      <label for="backup-file">Tệp sao lưu JSON</label><input id="backup-file" type="file" accept=".json,application/json">
      <div id="backup-preview" aria-live="polite"></div>
    </section>`;
  };
  window.AdminViews.systemBackupMockup = () => `<section class="card">
    <div class="row"><div><h2>Sao lưu hệ thống</h2><p class="muted">Mockup định hướng — chưa kết nối backend hoặc kho lưu trữ dùng chung.</p></div><span class="pill off">Chưa khả dụng</span></div>
    <div class="notice"><b>Đây chỉ là bản phác thảo giao diện.</b> Các thông tin và điều khiển bên dưới không đại diện cho lịch chạy thật; không có dữ liệu nào được tạo, tải lên hoặc khôi phục từ máy chủ.</div>
    <div class="stats" aria-label="Thông tin dự kiến cho backup hệ thống">
      <div class="stat"><span>Trạng thái dịch vụ</span><strong>Chưa kết nối</strong></div>
      <div class="stat"><span>Lịch sao lưu</span><strong>Chưa cấu hình</strong></div>
      <div class="stat"><span>Bản gần nhất</span><strong>Chưa có</strong></div>
      <div class="stat"><span>Lưu giữ</span><strong>Chưa quyết định</strong></div>
    </div>
    <div class="actions"><button type="button" disabled title="Cần backend và chính sách lưu trữ">Tạo backup hệ thống</button><button type="button" class="secondary" disabled title="Chưa có kho backup máy chủ">Khôi phục từ máy chủ</button></div>
    <h3>Phạm vi cần hoàn thiện trước khi triển khai</h3>
    <ul><li>Backend/database và kho lưu trữ có phân quyền, mã hóa.</li><li>Lịch chạy, chính sách lưu giữ và cảnh báo khi job thất bại.</li><li>Danh sách restore point, xác nhận khôi phục và audit bất biến.</li><li>Kiểm thử khôi phục định kỳ và quy trình rollback.</li></ul>
  </section>`;
})();
