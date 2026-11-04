# Kết nối Supabase qua Prisma 6

Project: https://supabase.com/dashboard/project/cwbewsezobxefteozrky

Luồng dữ liệu: trình duyệt → API Next.js → Prisma → Supabase PostgreSQL.
GitHub lưu code; kết nối database được cấu hình tại máy chạy ứng dụng.
PR này chỉ chuẩn bị kết nối, chưa chuyển giao diện legacy/localStorage sang API.

## Cấu hình trên Windows PowerShell

Sau khi merge PR và pull code:

```powershell
Copy-Item .env.example .env
npm ci
```

Trong Dashboard → Connect, sao chép đúng host và chuỗi kết nối của project:
- DATABASE_URL: Transaction pooler, port 6543; giữ pgbouncer=true và sslmode=require.
- DIRECT_URL: Session pooler, port 5432; dùng cho Prisma CLI/migration và mạng IPv4.
- Thay mật khẩu trong .env, URL-encode ký tự đặc biệt. Không gửi mật khẩu vào chat hoặc commit Git.
- Không dùng anon/publishable/service_role key thay cho mật khẩu PostgreSQL.
- Không thêm tiền tố NEXT_PUBLIC_ vào hai biến database.

```powershell
npm run db:generate
npx prisma validate
node scripts/check-database.mjs
```

Chỉ khi hiện "Prisma database connection: OK" mới xác nhận ứng dụng đã kết nối.
Khi deploy, đặt hai biến trong cấu hình môi trường của hosting.

## Áp dụng schema

Database Supabase được kiểm tra ngày 2026-11-04: chưa có bảng trong public.
Không dùng migrate dev hoặc reset trên database dùng chung.
Repo đã có migration ban đầu. Trước khi chạy db:deploy, bổ sung migration bảo vệ:
bật RLS cho các bảng public và thu hồi quyền Data API của anon/authenticated
nếu chỉ truy cập qua Prisma. Không để dữ liệu học sinh hoặc đáp án công khai.

Sau khi review migration bảo vệ, chạy:

```powershell
npm run db:deploy
npx prisma migrate status
```

Prisma là nguồn migration duy nhất của schema ứng dụng. Không áp dụng cùng SQL
bằng Supabase SQL Editor rồi chạy migrate deploy vì sẽ lệch lịch sử Prisma.
Không có migration nào được áp dụng bởi thay đổi cấu hình này.

## GitHub integration trong Supabase

Nếu cần liên kết repository trong Dashboard để dùng Supabase Branching,
mở Integrations → GitHub và chọn namkhanhtranforwork/project-quizz-next.
Đây là cấu hình riêng với kết nối database; cần quyền GitHub App trong Dashboard.
Chưa cấu hình tự động deploy migration trong PR này.

## Phần việc tiếp theo

Triển khai auth/quyền server và API theo từng luồng để thay localStorage.
Mã đăng nhập demo hiện tại chưa trở thành Supabase Auth sau khi thêm chuỗi kết nối.
