# JavaScript được tách theo khu vực

## Giáo viên
- `teacher-dashboard.js`: tổng quan.
- `teacher-classes.js`: danh sách lớp được phân công.
- `teacher-students.js`: danh sách/tìm kiếm học sinh.
- `teacher-assignments.js`: tạo và quản lý bài tập.
- `teacher-quiz-bank.js`: ngân hàng Quiz cá nhân, phiên bản và giao nhiều lớp.
- `teacher-classroom.js`: sơ đồ lớp SVG, kéo thả, xoay và xếp học sinh.
- `teacher-submissions.js`: danh sách bài nộp.
- `teacher-class-detail.js`: chi tiết lớp.
- `teacher-grading.js`: lưu điểm, nhận xét và trả bài.

## Admin (`js/admin/`)
- `admin-shell.js`: khung trang, điều hướng pill, trạng thái active và thống kê từ dữ liệu hiện có.
- `admin-overview.js`: tổng quan và nhật ký gần đây.
- `admin-import.js`: giao diện nhập Excel/CSV, tải mẫu và tạo lớp nhanh.
- `admin-backup.js`: xuất/khôi phục backup JSON cục bộ có phiên bản; trình bày mockup backup hệ thống chưa kết nối backend.
- `admin-users.js`: danh sách/lọc tài khoản và tạo Admin mới với quyền theo module.
- `admin-classes.js`: tạo lớp, phân công giáo viên, xuất danh sách.
- `admin-audit.js`: phân hệ Nhật ký & dữ liệu với tab nhật ký, backup cục bộ và mockup backup hệ thống.

## Học sinh (`js/student/`)
- `student-shell.js`: khung trang, danh sách bài tập và điều hướng.
- `student-results.js`: kết quả, trạng thái xác nhận và nhận xét.
- `student-quiz.js`: giao diện làm bài trắc nghiệm.
- `student-result-message.js`: màn hình xác nhận đã nộp bài.

## Thứ tự tải
Các file module phải được tải bằng `defer` trước `app.js`:
1. `js/core/`: `crypto.js` -> `store.js` -> `permissions.js` -> `academic.js` (cung cấp `window.Core`).
2. Các module view theo vai trò (`js/admin/`, `js/teacher/`, `js/student/`).
3. `app.js` (hoặc `js/landing.js` ở trang chủ) điều phối luồng ứng dụng.

Trang Admin nạp thêm `css/admin-dashboard.css` sau `css/styles.css` để giới hạn design system, backdrop chấm và responsive sidebar trong phạm vi Admin.

`store.js` giữ schema v4 và migration lặp an toàn; trước khi nâng dữ liệu cũ, tạo bản JSON sao lưu localStorage. `backup.js` kiểm tra định dạng/schema và chuyển đổi bản backup cũ lên schema hiện tại trước khi khôi phục. Admin cũ không có `adminPermissions` được giữ toàn quyền; Admin mới được giới hạn theo module, và chỉ Admin toàn quyền mới được tạo Admin. Mã Admin mới chỉ hiển thị ngay sau khi tạo. Dữ liệu quyền vẫn ở localStorage và chỉ phục vụ MVP: người dùng có thể sửa dữ liệu/JavaScript trên trình duyệt, nên không dùng làm ranh giới bảo mật production. Backup do trình duyệt tạo chứa dữ liệu cá nhân và mã băm, chưa mã hóa và không phải lưu trữ server. `academic.js` chứa kiểm tra phân công giáo viên, chủ sở hữu/phiên bản Quiz và tính toàn vẹn sơ đồ lớp. Đây là logic phía trình duyệt, không thay thế kiểm tra quyền ở backend.

`app.js` sử dụng các hàm dùng chung từ `window.Core`. Dữ liệu vẫn chỉ nằm trên trình duyệt hiện tại; đây là MVP, chưa phải backend bảo mật production.
