# Lớp học của cô — nền tảng mới

Dự án mới tách biệt khỏi phiên bản HTML/JavaScript hiện tại. Nền tảng đã chốt:

- Next.js App Router và TypeScript
- PostgreSQL
- Prisma ORM và Prisma Migrate

## Yêu cầu

- Node.js 20.9 trở lên
- PostgreSQL 14 trở lên

## Chạy trên máy phát triển

1. Tạo database PostgreSQL tên `project_quizz`.
2. Sao chép `.env.example` thành `.env` và cập nhật `DATABASE_URL`.
3. Cài dependencies và sinh Prisma Client:

   ```bash
   npm install
   npm run db:generate
   ```

4. Khi đã có model đầu tiên trong `prisma/schema.prisma`, tạo và áp dụng migration:

   ```bash
   npm run db:migrate -- --name init
   ```

5. Khởi chạy ứng dụng:

   ```bash
   npm run dev
   ```

Mở [http://localhost:3000](http://localhost:3000).

## Các phân hệ được chuyển sang

Các trang hiện có được phục vụ qua Next.js:

- `/admin`
- `/teacher`
- `/student`
- `/parent`
- `/legacy/index.html` giữ đường dẫn tương thích với bản giao diện cũ.

Cổng học sinh hiện có danh sách bài tập, kết quả cá nhân, xem lại bài đã làm và bảng xếp hạng top 10 theo lớp. Admin có thể cấu hình một cuộc thi cấp trường bằng cách chọn các bài thi được tính điểm và bật/tắt cuộc thi; bảng xếp hạng toàn trường chỉ hiển thị khi cuộc thi đang bật và chỉ cộng điểm từ các bài được chọn đã chấm. Hạng của học sinh đang đăng nhập vẫn hiện nếu em ngoài top 10. Đây là tính năng MVP phía trình duyệt, chưa phải bảng xếp hạng đồng bộ hoặc được bảo vệ server-side.

Admin có thể tạo môn học trong mục **Môn học**; danh mục này dùng chung để phân công giáo viên bộ môn và chọn môn khi tạo bài tập.

Sĩ số lớp được hiển thị trong danh sách lớp và trang chi tiết dành cho Admin/Giáo viên; số đếm lấy từ học sinh đang hoạt động có quan hệ thành viên lớp và loại trùng hồ sơ.

Trang chủ `/` hiển thị landing page tại `public/legacy/index.html`. Mỗi vai trò có route và layout Next.js riêng; các route nhóm `(admin)`, `(teacher)`, `(student)` và `(parent)` chỉ phục vụ tổ chức mã nguồn, không xuất hiện trong URL. Các route nhúng giao diện hiện tại từ `public/legacy` để đảm bảo đủ luồng trong giai đoạn chuyển đổi. Đây là lớp tương thích trình duyệt, chưa phải bản viết lại bằng React và hiện vẫn lưu trạng thái ở localStorage. URL `/legacy/*.html` tiếp tục dùng cho tương thích. Chưa dùng cho dữ liệu thật hoặc nhiều người dùng đồng thời.

## Cấu trúc thư mục

- `src/app`: App Router; các vai trò nằm trong route groups và vẫn giữ nguyên URL hiện tại.
- `src/components`: component dùng chung; `layouts/` chứa khung nhúng giao diện legacy.
- `src/features`: vùng đặt mã theo nghiệp vụ khi từng tính năng được triển khai.
- `src/lib/database/prisma.ts`: Prisma Client dùng chung; schema và migration tiếp tục nằm trong `prisma/`.
- `src/config`: cấu hình ứng dụng, điều hướng, vai trò và trạng thái phân quyền.
- `src/styles`, `src/types`, `src/hooks`: CSS dùng chung, kiểu dữ liệu và hooks.
- `public/images`, `public/icons`, `public/fonts`: tài nguyên tĩnh mới; `public/legacy` được giữ nguyên để tương thích.
- `tests` và `docs`: khung thư mục cho kiểm thử và tài liệu.

Các thư mục chưa có mã nghiệp vụ được giữ bằng `.gitkeep`. Phân quyền server-side hiện chưa được triển khai (`permissions.config.ts` đang tắt); cấu trúc này chưa dùng Supabase và không thay thế Prisma.

## Database và SQL migration

- Mô hình dữ liệu có phiên bản được khai báo trong `prisma/schema.prisma`.
- SQL của từng thay đổi nằm riêng trong `prisma/migrations/<timestamp>_<name>/migration.sql`.
- Không chỉnh tay database production; cập nhật Prisma schema, tạo migration ở môi trường phát triển, review file SQL rồi mới áp dụng.
- Migration đầu tiên hiện chỉ tạo schema, chưa được áp dụng vì chưa có PostgreSQL được cấu hình.

```bash
npm run db:migrate -- --name <ten-thay-doi>
npm run db:deploy
```

### Chuyển backup từ ứng dụng cũ

1. Mở ứng dụng cũ trên đúng trình duyệt/hồ sơ đang chứa dữ liệu.
2. Dùng **Admin → Sao lưu cục bộ** để tải backup JSON phiên bản 4.
3. Tạo database đích rỗng, cấu hình `.env`, sau đó áp dụng migration.
4. Kiểm tra backup trước, không cần kết nối database:

   ```bash
   node scripts/import-legacy-backup.mjs --dry-run "C:\duong-dan\backup.json"
   ```

5. Chạy công cụ nhập một lần:

   ```bash
   npm run db:import-legacy -- "C:\duong-dan\backup.json"
   ```

Công cụ chỉ nhập vào database rỗng và chạy trong transaction. Các mã đăng nhập cũ không được dùng lại làm xác thực server-side; cần cấp lại mã khi backend đăng nhập được triển khai. Hãy sao lưu tệp JSON an toàn vì có chứa dữ liệu cá nhân và kết quả học tập.

## Lệnh thường dùng

- `npm run db:generate`: sinh Prisma Client từ schema.
- `npm run db:migrate -- --name <ten-migration>`: tạo và áp dụng migration ở môi trường phát triển.
- `npm run db:deploy`: áp dụng các migration đã được tạo ở môi trường triển khai.
- `npm run db:studio`: mở Prisma Studio.
- `npm run db:import-legacy -- <backup.json>`: nhập backup localStorage cũ vào database rỗng.
- `node scripts/import-legacy-backup.mjs --dry-run <backup.json>`: kiểm tra và đếm dữ liệu mà không ghi database.
- `npm run lint`: chạy ESLint.
- `npm run build`: kiểm tra bản production.

Không commit `.env` hoặc thông tin kết nối thật. `.env.example` chỉ chứa giá trị minh họa.

## Trạng thái và giới hạn

- Chưa có API nghiệp vụ hoặc xác thực/phân quyền phía server; giao diện cũ còn dùng localStorage.
- PostgreSQL schema/migration và tiện ích nhập backup đã được chuẩn bị, nhưng migration chưa được áp dụng và tiện ích nhập chưa được chạy nếu chưa cấu hình database.
- Bản cũ được giữ nguyên tại thư mục dự án ban đầu làm bản tham chiếu.
