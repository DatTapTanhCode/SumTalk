# 09 – Risk Register và kế hoạch quản lý rủi ro

**Rủi ro lớn nhất hiện tại:** chi phí và giới hạn của API bên ngoài khi deploy (R6, R8), và độ chính xác STT với
tiếng Việt hoặc họp trộn ngôn ngữ (R1). Cả hai đã có biện pháp kỹ thuật, nhưng cần đo lại trong đợt UAT.

> R1–R6 là các rủi ro đã nêu trong buổi họp của nhóm. Repo chỉ ghi rõ R6 (ngân sách API/LLM); nội dung R1–R5 dưới
> đây là đề xuất. [CẦN ĐIỀN: đối chiếu với biên bản và sửa lại cho khớp tên, mô tả gốc.] R7 trở đi là rủi ro mới
> phát hiện khi làm desktop, streaming và deploy.

## 1. Thang đánh giá

| Điểm | Xác suất (P) | Tác động (I) |
|---|---|---|
| 1 | Hiếm (< 10%) | Không đáng kể, xử lý trong ngày |
| 2 | Thấp (10–30%) | Trễ < 2 ngày, không ảnh hưởng mốc |
| 3 | Trung bình (30–50%) | Trễ 1 sprint một phần việc, hoặc tốn thêm < 10% ngân sách |
| 4 | Cao (50–80%) | Lỡ mốc, phải cắt phạm vi, hoặc tốn thêm 10–20% ngân sách |
| 5 | Gần như chắc chắn (> 80%) | Mục tiêu dự án thất bại |

Mức độ = P × I: 1–5 Thấp (theo dõi), 6–11 Trung bình (có kế hoạch ứng phó), 12–25 Cao (xử lý ngay, báo Sponsor).

## 2. Sổ rủi ro

| ID | Rủi ro | Hạng mục | P | I | Mức | Chiến lược | Biện pháp ứng phó | Dấu hiệu cảnh báo | Phụ trách | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | STT sai với tiếng Việt, họp trộn Anh–Việt, hoặc tự sinh chữ khi im lặng | Kỹ thuật | 3 | 4 | **12** | Giảm | Nhận diện ngôn ngữ theo từng câu; lọc chữ "ảo"; cho chọn cố định ngôn ngữ và phiên âm lại; dùng `large-v3-turbo` qua server GPU | WER cao trong UAT, người dùng sửa nhiều | [Dev STT] | Đang theo dõi |
| R2 | Máy người dùng không có GPU, CPU quá chậm cho live | Kỹ thuật | 4 | 3 | **12** | Giảm | Engine remote (`STT_PROVIDER=remote`): server GPU hoặc Whisper API, client không tải model; bộ cài ghi sẵn cấu hình | Live trễ > 5 s | [Dev] | **Đã xử lý** (Sprint 4) |
| R3 | Trễ tiến độ do làm bán thời gian, trùng lịch thi | Lịch | 4 | 3 | **12** | Giảm | Sprint ngắn; ưu tiên việc găng ([08](08-schedule-cpm-gantt.md)); dùng dự trữ của nhánh tóm tắt/dịch | Burndown nằm trên đường lý tưởng 2 ngày liền | PM | Đang theo dõi |
| R4 | Mất dữ liệu ghi âm khi rớt mạng, đóng tab hoặc app | Kỹ thuật | 2 | 4 | 8 | Tránh | Lưu chunk vào IndexedDB trước khi gửi, tự đồng bộ; khôi phục sau crash; hỏi trước khi đóng khi đang ghi | Lỗi đồng bộ trong log | [Dev frontend] | Đã xử lý |
| R5 | Yêu cầu thay đổi, phình phạm vi (thêm desktop, streaming, cloud) | Phạm vi | 4 | 3 | **12** | Chấp nhận có kiểm soát | Mọi thay đổi qua PO + [Change Log](17-change-log.md); việc ngoài phạm vi để sau v1.0 | Story mới chen vào giữa sprint | PO | Đang theo dõi |
| R6 | Chi phí API LLM/STT vượt ngân sách | Chi phí | 3 | 3 | 9 | Giảm | Log token và chi phí từng lần chạy; `AI_MOCK` khi demo; `LIVE_INTERVAL_SEC`; VAD bỏ đoạn im lặng không gửi; AWS Budget cảnh báo | Chi phí tuần > 25% ngân sách tháng | PM | Đang theo dõi |
| R7 | Model LLM chạy local (Ollama) quá nặng cho máy nhóm | Kỹ thuật | 3 | 2 | 6 | Chuyển giao | Client chuẩn OpenAI: đổi sang LLM cloud bằng cấu hình | Tóm tắt > 2 phút hoặc hết RAM | [Dev AI] | Đã xử lý |
| R8 | Rate limit của Whisper API (429) khi ghi live | Bên ngoài | 3 | 3 | 9 | Giảm | Retry có back-off; `LIVE_INTERVAL_SEC`; giới hạn `STT_CONCURRENCY`; chuyển sang server GPU riêng | Lỗi 429 trong log | [Dev] | Đang theo dõi |
| R9 | Lộ dữ liệu họp khi deploy công khai (POC chưa có tài khoản) | Bảo mật | 2 | 5 | 10 | Giảm | HTTPS + đăng nhập (Caddy), bucket S3 private + presigned URL ngắn hạn, IAM role tối thiểu, `/v1` có API key, không commit `.env` | Truy cập lạ trong log Caddy | [Dev ops] | Đã xử lý (bản test) |
| R10 | Chi phí AWS phát sinh do quên tắt máy GPU hoặc Elastic IP | Chi phí | 3 | 3 | 9 | Giảm | AWS Budget + email; tắt máy khi không test; checklist gỡ bỏ trong hướng dẫn deploy | Hoá đơn tăng bất thường | PM | Mới |
| R11 | Mất quyền truy cập repo/CI (push bị 403), mất code chưa push | Cấu hình | 3 | 4 | **12** | Giảm | Thêm collaborator đúng tài khoản; push sau mỗi task; nhánh feature theo sprint | `git push` lỗi | PM | **Đang xảy ra** (12/11/2026) |
| R12 | Bộ cài Windows chưa ký số, bị SmartScreen chặn | Triển khai | 4 | 2 | 8 | Chấp nhận | Hướng dẫn "More info → Run anyway"; demo bằng bản web; ký số khi thương mại | Người dùng báo không cài được | [Dev desktop] | Chấp nhận |
| R13 | iOS dừng micro khi khoá màn hình | Kỹ thuật | 5 | 2 | 10 | Chấp nhận | Giữ màn hình sáng (Wake Lock); ghi chú hạn chế; app native ở phiên bản sau | – | PO | Chấp nhận |
| R14 | Thành viên chủ chốt vắng hoặc rời nhóm | Nhân sự | 2 | 4 | 8 | Giảm | Code review chéo; tài liệu README/ARCHITECTURE; HANDOFF khi bàn giao | Task bị kẹt > 2 ngày | PM | Đang theo dõi |

## 3. Ma trận rủi ro (trước ứng phó)

| P \ I | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | R13 | | | |
| **4** | | R12 | R2, R3, R5 | | |
| **3** | | R7 | R6, R8, R10 | R1, R11 | |
| **2** | | | | R4, R14 | R9 |
| **1** | | | | | |

Vùng Cao (≥ 12): R1, R2, R3, R5, R11. R2 đã giảm xuống mức 2 × 2 = 4 sau khi có engine remote.

## 4. Quy trình quản lý rủi ro

1. **Nhận diện:** mỗi Sprint Planning và Retrospective, hỏi: "Điều gì có thể làm sprint sau thất bại?"
2. **Đánh giá:** chấm P và I theo thang trên, cập nhật bảng.
3. **Ứng phó:** chọn Tránh / Giảm / Chuyển giao / Chấp nhận; ghi biện pháp và người phụ trách.
4. **Theo dõi:** người phụ trách báo tình trạng trong Daily khi dấu hiệu cảnh báo xuất hiện; PM rà toàn bảng mỗi
   sprint review.
5. **Đóng:** rủi ro đã qua hoặc đã xử lý xong được chuyển sang "Đã đóng", ghi bài học vào [21](21-lessons-learned.md).

## 5. Dự phòng ngân sách và thời gian

- Dự phòng ngân sách: 10% tổng ngân sách ([11](11-cost-budget-plan.md)) cho R6, R8, R10.
- Dự phòng thời gian: dự trữ của nhánh tóm tắt/dịch (3–12 ngày) và 3 ngày UAT cuối dự án.
