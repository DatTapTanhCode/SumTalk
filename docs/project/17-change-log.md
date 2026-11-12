# 17 – Change Log (nhật ký thay đổi phạm vi)

**Tóm tắt:** mọi thay đổi phạm vi, mốc hoặc ngân sách phải ghi vào đây trước khi làm, kèm lý do, tác động và người
duyệt. Theo phân quyền trong Charter: thay đổi trong sprint do PO duyệt; thay đổi mốc, ngân sách > 10% hoặc phạm
vi dự án do Sponsor duyệt.

## Quy trình

1. Người đề xuất ghi một dòng (trạng thái "Đề xuất").
2. PM đánh giá tác động: SP/giờ, chi phí, lịch (đường găng [08](08-schedule-cpm-gantt.md)), rủi ro.
3. PO (hoặc Sponsor) duyệt hoặc từ chối.
4. Nếu duyệt: cập nhật backlog, kế hoạch, ngân sách; thông báo theo kế hoạch truyền thông ([13](13-communication-raci.md)).

## Nhật ký

| Mã | Ngày | Thay đổi | Lý do | Tác động | Người đề xuất | Người duyệt | Trạng thái |
|---|---|---|---|---|---|---|---|
| CR-07 | 12/11/2026 | Tài liệu quản lý dự án làm thành 21 file `.md` trong repo thay vì một tài liệu | Dễ chia việc, quản lý phiên bản cùng code | Không đổi lịch | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm |
| CR-06 | 12/11/2026 | Thêm bản web deploy trên AWS EC2 + S3 (Docker, Caddy, hướng dẫn) | Test và demo cho khách mà không cần cài app | +8 SP; chi phí AWS khoảng 2,5–3 triệu VND/tháng nếu chạy 24/7 | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm (chưa deploy thật) |
| CR-05 | 12/11/2026 | Engine STT remote + API `/v1`: máy khách không cần model | Máy văn phòng không có GPU; giữ độ chính xác `large-v3-turbo` | +13 SP (gộp với CR-04); thêm phụ thuộc vào server/API | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm |
| CR-04 | 12/11/2026 | Live "nói tới đâu hiện tới đó" (trễ ≤ 3–5 s) và xử lý file dài ≥ 1 giờ | Yêu cầu của PO sau khi dùng thử | Chunk 1 s, LocalAgreement, chia đoạn file dài | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm |
| CR-03 | [CẦN ĐIỀN] | Chuyển từ web app sang có thêm app desktop Windows | Khách muốn cài như phần mềm; thu được âm thanh từ Zoom/Teams bản desktop | +8 SP; thêm bộ cài, rủi ro R12 (chưa ký số) | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm |
| CR-02 | [CẦN ĐIỀN] | Dời story dịch #60 vào Sprint 3 | [CẦN ĐIỀN: lý do theo biên bản] | Sprint 3 nhận thêm 19 SP (#61–#66) | [CẦN ĐIỀN] | [CẦN ĐIỀN] | Đã làm |
| CR-01 | [CẦN ĐIỀN] | [CẦN ĐIỀN: các thay đổi trước đó trong biên bản S1–S2, ví dụ chọn model sau benchmark] | | | | | |

## Thay đổi đã từ chối hoặc hoãn

| Mã | Đề xuất | Lý do hoãn | Xem lại khi |
|---|---|---|---|
| CR-H1 | Nhận diện người nói (diarization) | Tốn thời gian, cần model riêng; không ảnh hưởng mục tiêu chính | Sau v1.0 |
| CR-H2 | Tài khoản, phân quyền | Ngoài phạm vi POC; bản test dùng đăng nhập chung | Trước khi thương mại |
| CR-H3 | Dịch trực tiếp khi đang họp (#84), trang action items (#79) | Ưu tiên Should/Could | Sprint sau |
