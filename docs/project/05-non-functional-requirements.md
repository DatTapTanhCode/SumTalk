# 05 – Yêu cầu phi chức năng

**Tóm tắt:** các yêu cầu đo được về hiệu năng, độ chính xác, bảo mật, độ tin cậy và khả năng dùng. Cột "Hiện
trạng" ghi kết quả đo thật ngày 12/11/2026 (laptop RTX 4050). Ô `[CẦN ĐIỀN]` là số cần đo trong UAT.

> Một phần các yêu cầu này đã có trong tài liệu Requirements & UI/UX của Sprint 1.
> [CẦN ĐIỀN: đối chiếu và giữ mã yêu cầu cũ nếu có.]
> Đặc tả giao diện theo bản hiện tại (v0.4): [22 – Đặc tả UI/UX](22-ui-ux-spec.md).

## 1. Hiệu năng

| Mã | Yêu cầu | Mục tiêu | Hiện trạng | Cách đo |
|---|---|---|---|---|
| NFR-P1 | Độ trễ transcript live (từ lúc nói tới lúc chữ hiện) | ≤ 3–5 s | Từ mới khoảng 1 s; câu chốt TB 1,9 s, tối đa 2,3 s (GPU local và remote như nhau) | Script mô phỏng ghi âm thời gian thực, file speech_en 17 s |
| NFR-P2 | Thời gian xử lý file sau upload | 1 giờ audio ≤ 10 phút trên GPU | 11,6 phút: 57 s (local GPU, 12× realtime), 18 s (remote, 39×) | Upload file dài, đo đến trạng thái Done |
| NFR-P3 | Thời gian thấy kết quả đầu tiên của file dài | ≤ 10 s | 3–5 s | như trên |
| NFR-P4 | Tạo tóm tắt | ≤ 2 phút cho cuộc họp 60 phút (LLM cloud) | [CẦN ĐIỀN] | Log token/thời gian từng lần chạy |
| NFR-P5 | Khởi động app desktop đến lúc dùng được | ≤ 10 s (chưa tính tải model lần đầu) | 1,5–1,9 s | Smoke test desktop |
| NFR-P6 | Chi phí mỗi lượt live không tăng theo độ dài buổi họp | O(1) mỗi lượt | Quét thư mục một lần, cửa sổ ≤ 15 s | Review code, test 1 giờ |

## 2. Độ chính xác

| Mã | Yêu cầu | Mục tiêu | Hiện trạng |
|---|---|---|---|
| NFR-A1 | Lỗi từ (WER) tiếng Anh, audio rõ | ≤ 10% | File mẫu speech_en: transcript đúng từng câu |
| NFR-A2 | WER tiếng Việt | ≤ 15% | [CẦN ĐIỀN: đo trên mẫu UAT] |
| NFR-A3 | Họp trộn Anh–Việt: câu nào giữ ngôn ngữ câu đó, không tự dịch | ≥ 95% số câu | [CẦN ĐIỀN] (xem ảnh `docs/screenshots/meeting-mixed-language.png`) |
| NFR-A4 | Tóm tắt không bịa sự kiện | 0 lỗi nghiêm trọng / mẫu | [CẦN ĐIỀN] – `backend/scripts/eval_summary.py` (ROUGE-L, độ phủ quyết định) |
| NFR-A5 | Chất lượng dịch | chrF++ ≥ [CẦN ĐIỀN] | `backend/scripts/eval_translation.py` |

## 3. Dung lượng và giới hạn

| Mã | Yêu cầu | Giá trị |
|---|---|---|
| NFR-C1 | Kích thước file upload tối đa | 1 GB (`MAX_UPLOAD_MB`) |
| NFR-C2 | Định dạng nhận | MP3, WAV, M4A, AAC, OGG/Opus, WEBM, FLAC, WMA, AMR, 3GP, MP4/MOV/MKV |
| NFR-C3 | Độ dài cuộc họp | ≥ 60 phút cho cả ghi âm, upload, tóm tắt (đoạn 5 phút, map-reduce) |
| NFR-C4 | Bộ nhớ khi xử lý file dài | Không phụ thuộc độ dài (đọc từng đoạn) |
| NFR-C5 | Bộ cài desktop | khoảng 200 MB, cài vào khoảng 630 MB; không tải model khi dùng engine remote |

## 4. Bảo mật và quyền riêng tư

| Mã | Yêu cầu |
|---|---|
| NFR-S1 | Mặc định xử lý local, không gửi audio ra ngoài; chỉ gửi khi quản trị cấu hình engine remote hoặc LLM cloud |
| NFR-S2 | Bản deploy: bắt buộc HTTPS; trang đăng nhập cho bản test; `/v1` cần API key |
| NFR-S3 | S3 private (Block Public Access), phát qua presigned URL có hạn (mặc định 3 giờ); EC2 dùng IAM role quyền tối thiểu, không lưu access key |
| NFR-S4 | Không commit bí mật (`.env`, `deploy/.env` trong `.gitignore`); API key có thể thu hồi |
| NFR-S5 | App desktop: trang web không có quyền Node.js (context isolation, sandbox); quyền micro chỉ cấp cho trang của app |
| NFR-S6 | Trước khi thương mại: tài khoản, phân quyền, chính sách lưu giữ audio (ngoài phạm vi bản này) |

## 5. Độ tin cậy

| Mã | Yêu cầu |
|---|---|
| NFR-R1 | Không mất audio khi rớt mạng, đóng tab, crash (chunk lưu trên máy trước, tự đồng bộ, khôi phục) |
| NFR-R2 | Job tóm tắt/dịch không bao giờ treo: retry, giới hạn thời gian, trạng thái cuối là done hoặc failed |
| NFR-R3 | Server khởi động lại thì tiếp tục job dở dang |
| NFR-R4 | App desktop tắt thì backend tắt theo (kể cả khi app crash) |
| NFR-R5 | Database được sao lưu lên S3 mỗi 6 giờ (bản deploy) |
| NFR-R6 | API bên ngoài lỗi 429/5xx: retry có back-off; lỗi key hiện rõ trên giao diện |

## 6. Khả năng dùng và tương thích

| Mã | Yêu cầu |
|---|---|
| NFR-U1 | Chrome và Edge desktop (test tự động); Firefox/Safari kiểm tra tay; Android Chrome; iOS Safari (hạn chế khi khoá màn hình) |
| NFR-U2 | Giao diện responsive tới 360 px, không cuộn ngang |
| NFR-U3 | Windows 10/11 cho app desktop |
| NFR-U4 | Thông báo lỗi bằng lời dễ hiểu, kèm hướng xử lý (ví dụ quyền micro trên Windows) |
| NFR-U5 | Giao diện tiếng Anh; tóm tắt và dịch hỗ trợ tiếng Việt và tiếng Anh |

## 7. Bảo trì và triển khai

| Mã | Yêu cầu |
|---|---|
| NFR-M1 | Test tự động: pytest backend (88 test), Playwright trình duyệt và desktop; ruff sạch |
| NFR-M2 | Cấu hình bằng biến môi trường/file `.env`, không sửa code khi đổi model, engine, nơi lưu |
| NFR-M3 | Deploy lặp lại được bằng Docker Compose; cập nhật bằng một lệnh (`deploy/scripts/update.sh`) |
| NFR-M4 | Đổi nhà cung cấp LLM/STT chỉ bằng cấu hình (API chuẩn OpenAI) |
