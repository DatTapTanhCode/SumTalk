# 01 – Project Charter: SumTalk

| | |
|---|---|
| Tên dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Nhà tài trợ (Sponsor) | [CẦN ĐIỀN: giảng viên hướng dẫn / đơn vị] |
| Product Owner | [CẦN ĐIỀN] |
| Project Manager / Scrum Master | [CẦN ĐIỀN] |
| Ngày phê duyệt | [CẦN ĐIỀN] |
| Phiên bản tài liệu | 1.0 – 12/11/2026 |

## 1. Bối cảnh và vấn đề

Ghi biên bản họp đang làm tay: thư ký vừa nghe vừa gõ, mất 30–60 phút sau mỗi buổi để chỉnh và gửi. Họp
online (Meet, Teams, Zoom) và họp trộn tiếng Anh – tiếng Việt khiến việc ghi chép càng dễ sót. Các dịch vụ
ghi chú bằng AI có sẵn thường đưa audio lên cloud nước ngoài, hỗ trợ tiếng Việt và họp đa ngôn ngữ còn yếu,
và tính phí theo người dùng.

## 2. Mục tiêu dự án (SMART)

| # | Mục tiêu | Thước đo | Hạn |
|---|---|---|---|
| M1 | Ghi âm hoặc tải file cuộc họp và nhận transcript đúng ngôn ngữ người nói (Anh, Việt, trộn) | Chạy được trên Chrome/Edge, điện thoại, app Windows; test E2E đạt | Sprint 1–2 |
| M2 | Transcript hiện trực tiếp khi đang nói | Chữ hiện trễ ≤ 3–5 s (đo được: khoảng 1 s cho từ mới, 1.9 s cho câu đã chốt) | Sprint 4 |
| M3 | Tự động tóm tắt (tổng quan, ý chính, quyết định, việc cần làm) và dịch Việt ↔ Anh | Story #67, #60 đạt toàn bộ acceptance criteria | Sprint 3 |
| M4 | Xử lý được cuộc họp ≥ 60 phút | Đã đo: file 11.6 phút xong trong 18–57 s, dòng đầu hiện sau 3–5 s | Sprint 4 |
| M5 | Có bản web deploy trên AWS để test/demo, và bộ cài Windows không bắt tải model nặng | Có URL HTTPS, bộ cài `SumTalk-Setup-x.y.z.exe` | Sprint 4 |
| M6 | Nằm trong ngân sách | Chi phí thực tế ≤ ngân sách duyệt (mục 6), CPI ≥ 0.9 | Cuối dự án |

## 3. Phạm vi

**Trong phạm vi**

- Ghi âm: micro, hoặc micro + âm thanh cuộc họp online; tạm dừng/tiếp tục; ghi khi mất mạng rồi tự đồng bộ.
- Tải file audio/video lớn (≤ 1 GB, nhiều định dạng), tự chuẩn hoá về WAV 16 kHz.
- Speech-to-text Whisper: chạy local (GPU/CPU) hoặc qua API/server; giữ ngôn ngữ gốc theo từng câu.
- Transcript live, transcript cuối chính xác; tìm kiếm, phát lại đồng bộ, xuất TXT/SRT/VTT/JSON/WAV.
- Tóm tắt bằng LLM (vi/en) và dịch transcript (vi/en), xuất bản dịch.
- App desktop Windows (Electron), bản web deploy AWS (EC2 + S3), tài liệu dự án.

**Ngoài phạm vi (phiên bản này)**

- Tài khoản người dùng, phân quyền, đa tổ chức. Bản test dùng một mật khẩu chung.
- Nhận diện người nói (diarization), dịch trực tiếp khi đang họp (#84), trang việc cần làm (#79).
- App iOS/Android native, ghi âm khi khoá màn hình trên iOS.
- Cam kết SLA vận hành thương mại.

## 4. Sản phẩm bàn giao chính

| Sản phẩm | Mô tả |
|---|---|
| Mã nguồn | Repo `DatTapTanhCode/SumTalk`, các nhánh feature theo sprint |
| Bản web | Docker image + hướng dẫn deploy AWS EC2/S3 |
| App desktop | Bộ cài Windows (NSIS), bản GPU dạng thư mục |
| Tài liệu | README, ARCHITECTURE, bộ 21 tài liệu quản lý dự án này, test case |
| Kết quả kiểm thử | pytest (backend), Playwright (trình duyệt, desktop), báo cáo test |

## 5. Các bên liên quan

| Bên liên quan | Vai trò / quan tâm | Mức ảnh hưởng | Cách làm việc |
|---|---|---|---|
| Giảng viên / Sponsor | Duyệt phạm vi, nghiệm thu, chấm điểm | Cao | Sprint review, báo cáo trạng thái |
| Product Owner | Ưu tiên backlog, chấp nhận story | Cao | Sprint planning/review, Azure Boards |
| Nhóm phát triển (Dev) | Xây dựng, test đơn vị | Cao | Daily, code review |
| BA | Yêu cầu, acceptance criteria, mẫu tham chiếu đánh giá | Trung bình | Refinement |
| QC | Test case, test E2E, báo lỗi | Trung bình | Test plan, Azure Boards Bug |
| Người dùng thử (thư ký, trưởng nhóm họp) | Dễ dùng, đúng nội dung, bảo mật | Trung bình | UAT trên bản web |
| Nhà cung cấp (AWS, Groq/OpenAI, Ollama) | Hạ tầng, API | Thấp | Theo dõi chi phí, rate limit |

## 6. Ngân sách tóm tắt

| Khoản | Giá trị | Nguồn |
|---|---|---|
| Đơn giá nhân công | 100.000 VND/giờ | dashboard chi phí của nhóm |
| Tổng giờ kế hoạch | [CẦN ĐIỀN: tổng giờ theo sprint] | Azure Boards |
| Chi phí nhân công kế hoạch | = tổng giờ × 100.000 VND | |
| Chi phí ngoài nhân công (AWS, API) | khoảng 3 triệu VND/tháng khi chạy bản test 24/7, xem [11](11-cost-budget-plan.md) | ước tính |
| Dự phòng | 10% tổng ngân sách | |

## 7. Mốc chính

| Mốc | Nội dung | Ngày |
|---|---|---|
| M0 | Charter, backlog, tài liệu yêu cầu & UI/UX được duyệt | [CẦN ĐIỀN] |
| M1 (hết Sprint 1) | Ghi âm, upload, transcript gốc chạy được (POC E1) | [CẦN ĐIỀN] |
| M2 (hết Sprint 2) | Benchmark và chọn model LLM | [CẦN ĐIỀN] |
| M3 (hết Sprint 3) | Tóm tắt (#67) + dịch (#60), test E2E (#99, #100) | [CẦN ĐIỀN] |
| M4 (hết Sprint 4) | App desktop, transcript live dạng streaming, STT qua server, bản web trên AWS | [CẦN ĐIỀN] |
| M5 | Nghiệm thu, báo cáo tổng kết | [CẦN ĐIỀN] |

Chi tiết lịch xem [08](08-schedule-cpm-gantt.md).

## 8. Giả định và ràng buộc

- Nhóm làm bán thời gian (song song việc học). Sprint dài [CẦN ĐIỀN: 1–2] tuần.
- Không có ngân sách thuê GPU cố định. Dev dùng laptop RTX 4050; bản test trên AWS dùng EC2 CPU + Whisper API,
  hoặc bật GPU theo giờ.
- Dữ liệu họp có thể nhạy cảm: mặc định chạy local; khi deploy phải có HTTPS, đăng nhập, bucket S3 private.
- Công cụ: Azure Boards (backlog), GitHub (mã nguồn), Python/FastAPI, React, Electron.

## 9. Rủi ro cấp cao

Độ chính xác STT với tiếng Việt và họp trộn ngôn ngữ; phụ thuộc GPU/API bên ngoài (chi phí, rate limit); trễ
tiến độ do làm bán thời gian; bảo mật dữ liệu họp. Chi tiết xem [09](09-risk-register.md).

## 10. Phân quyền

| Quyết định | PM | PO | Nhóm Dev | Sponsor |
|---|---|---|---|---|
| Thêm/bớt story trong sprint đang chạy | đề xuất | **quyết định** | tư vấn | – |
| Thay đổi phạm vi dự án, mốc, ngân sách > 10% | đề xuất | đồng ý | – | **phê duyệt** |
| Giải pháp kỹ thuật | tư vấn | – | **quyết định** | – |
| Phân công, lịch họp | **quyết định** | – | tư vấn | – |
| Chấp nhận story (Definition of Done) | – | **quyết định** | – | – |

## Phê duyệt

| Vai trò | Họ tên | Chữ ký | Ngày |
|---|---|---|---|
| Sponsor | | | |
| Product Owner | | | |
| Project Manager | | | |
