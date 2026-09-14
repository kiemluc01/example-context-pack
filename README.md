# Quản lý nhân viên

Web quản lý hồ sơ nhân viên công ty: NestJS API + React (Vite) + Prisma + PostgreSQL.

```
apps/api   NestJS 11, Prisma 6, JWT trong cookie httpOnly
apps/web   React 19, React Router 7, Vite
```

## Chức năng

- Đăng nhập bằng email và mật khẩu. Phiên đăng nhập là JWT trong cookie httpOnly, SameSite=Lax, hết hạn sau 8 giờ. Mỗi phút chỉ được thử đăng nhập tối đa 5 lần.
- Có 3 vai trò:

  | Thao tác | Admin | HR | Nhân viên |
  |---|:-:|:-:|:-:|
  | Xem danh sách, chi tiết nhân viên | ✓ | ✓ | – |
  | Thêm, sửa, xóa mềm, khôi phục nhân viên thường | ✓ | ✓ | – |
  | Sửa, xóa hồ sơ có tài khoản HR/Admin (kể cả hồ sơ của chính HR) | ✓ | – | – |
  | Cấp tài khoản vai trò Nhân viên, đặt lại mật khẩu cho nhân viên thường | ✓ | ✓ | – |
  | Cấp tài khoản HR/Admin, đổi vai trò | ✓ | – | – |
  | Xem hồ sơ của mình (có lương và CCCD), đổi mật khẩu | ✓ | ✓ | ✓ |

  Không ai được tự xóa hồ sơ, tự đổi vai trò hoặc tự đặt lại mật khẩu của chính mình.
- **Tài khoản:** tạo cùng lúc khi thêm nhân viên, hoặc tạo sau. Hệ thống sinh mật khẩu tạm và chỉ hiển thị một lần. Người dùng phải đổi mật khẩu tạm trước khi dùng các chức năng khác. Khi đổi hoặc đặt lại mật khẩu, mọi phiên đăng nhập khác bị đăng xuất.
- **Xóa mềm:** nhân viên bị xóa chuyển sang trạng thái *Đã nghỉ việc*, có `deleted_at`, bị ẩn khỏi danh sách và tài khoản bị khóa ngay. Có thể khôi phục. Muốn xem nhân viên đã xóa thì lọc theo *Đã nghỉ việc*.
- **Danh sách:** tìm kiếm phía server theo mã, họ tên, email và số điện thoại. Tìm kiếm không phân biệt hoa thường nhưng vẫn phân biệt dấu. Có lọc theo phòng ban, chức vụ và trạng thái; sắp xếp theo cột; phân trang 20 dòng.
- **Hồ sơ:** mã NV (duy nhất), họ tên, email (duy nhất), SĐT, ngày sinh, giới tính, phòng ban, chức vụ, ngày vào làm, trạng thái, lương, CCCD (duy nhất, 12 số), ảnh đại diện (JPG/PNG/WEBP, tối đa 2 MB, kiểm tra theo magic bytes). Lương và CCCD không trả về trong API danh sách.

## Chạy local

Yêu cầu: Node.js ≥ 22 và PostgreSQL ≥ 14 đang chạy trên máy.

```bash
# 1. Cài dependency và generate Prisma client
npm run setup

# 2. Tạo database. BẮT BUỘC dùng locale UTF-8, nếu không tìm kiếm tiếng Việt sẽ sai
createdb -T template0 -E UTF8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8 employee_mgmt

# 3. Cấu hình
cp apps/api/.env.example apps/api/.env
#    Sửa DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
#    Đặt JWT_SECRET bằng giá trị của: openssl rand -hex 32

# 4. Tạo bảng và tài khoản Admin đầu tiên (thêm 30 nhân viên mẫu nếu SEED_DEMO=true)
npm run db:migrate
npm run db:seed

# 5. Chạy API (http://localhost:3000) và web (http://localhost:5173)
npm run dev
```

Mở http://localhost:5173 và đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Lần đầu đăng nhập, hệ thống sẽ yêu cầu đổi mật khẩu.

Khi dev, Vite proxy `/api` sang API để cookie luôn cùng origin.

## Test

```bash
createdb -T template0 -E UTF8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8 employee_mgmt_test
npm test
```

Test API chạy trên database có tên kết thúc bằng `_test`. Mặc định là `DATABASE_URL` thêm hậu tố `_test`; có thể chỉ định khác qua `TEST_DATABASE_URL`. Test sẽ từ chối chạy trên database không có hậu tố này, vì dữ liệu bị xóa sạch giữa các test. Xem coverage: `npm run test:cov --prefix apps/api`.

## API

Mọi route đều có tiền tố `/api`, và cần đăng nhập, trừ `POST /auth/login` và `POST /auth/logout`.

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/login`, `/auth/logout` | công khai |
| GET | `/auth/me` | đã đăng nhập |
| POST | `/auth/change-password` | đã đăng nhập |
| GET | `/employees?q&department&position&status&sortBy&sortOrder&page&pageSize` | Admin, HR |
| GET | `/employees/filter-options` | Admin, HR |
| GET | `/employees/me` | đã đăng nhập |
| GET / PATCH / DELETE | `/employees/:id` | Admin, HR |
| POST | `/employees` | Admin, HR |
| POST | `/employees/:id/restore` | Admin, HR |
| POST | `/employees/:id/account` · `/employees/:id/account/reset-password` | Admin, HR |
| PATCH | `/employees/:id/account` (đổi vai trò) | Admin |
| PUT | `/employees/:id/avatar` (multipart, field `file`) | Admin, HR |
| GET | `/employees/:id/avatar` | Admin, HR, hoặc chính nhân viên đó |

## Giới hạn hiện tại

- Chưa có: phòng ban/chức vụ dạng danh mục (đang là chữ nhập tay), chấm công, lương, hợp đồng, import/export, dashboard, Docker/deploy.
- Tìm kiếm vẫn phân biệt dấu ("tran" không tìm ra "Trần"). Muốn bỏ dấu cần extension `unaccent`.
- Ảnh đại diện lưu trên đĩa tại `apps/api/uploads/`. Nếu deploy nhiều instance thì cần chuyển sang object storage.
- Giới hạn số lần đăng nhập đang lưu trong bộ nhớ của từng process.
