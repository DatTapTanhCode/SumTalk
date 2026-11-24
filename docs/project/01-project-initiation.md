# Project Initiation Document – Hồ sơ khởi động dự án

| | |
|---|---|
| Dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Mã tài liệu | SUMTALK-PID |
| Phiên bản | 2.0 – 13/11/2026 |
| Người lập | [CẦN ĐIỀN: Project Manager] |
| Người duyệt | Sponsor, Product Owner, Project Manager |
| Trạng thái | Chờ duyệt |

**Mục đích:** Giải thích vì sao làm dự án SumTalk, dự án nhắm tới mục tiêu gì, làm trong phạm vi nào, đáng đầu tư ra sao và quản lý theo phương pháp nào. Đây là căn cứ để Sponsor phê duyệt khởi động và cấp ngân sách.

> Ô `[CẦN ĐIỀN]` là số liệu đã có ở Azure Boards, dashboard chi phí hoặc biên bản họp nhưng chưa chép vào đây.
> **Giả định** là con số đặt ra để tính toán; bảng ghi rõ công thức để tính lại khi có số thật.

## Mục lục

1. [Project Charter](#charter)
2. [Business Case](#business-case)
3. [Lựa chọn phương pháp quản lý dự án](#methodology)

## Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 12/11/2026 | Bản đầu, gồm các tài liệu riêng: 01-project-charter, 02-business-case, 03-methodology | [CẦN ĐIỀN] |
| 2.0 | 13/11/2026 | Gộp thành một tài liệu, đánh lại số mục (CR-08) | [CẦN ĐIỀN] |

<a id="charter"></a>

## 1. Project Charter

| | |
|---|---|
| Tên dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Nhà tài trợ (Sponsor) | [CẦN ĐIỀN: đại diện đơn vị tài trợ] |
| Product Owner | [CẦN ĐIỀN] |
| Project Manager / Scrum Master | [CẦN ĐIỀN] |
| Ngày phê duyệt | [CẦN ĐIỀN] |
| Phiên bản tài liệu | 1.0 – 12/11/2026 |

### 1.1 Bối cảnh và vấn đề

Ghi biên bản họp đang làm tay: thư ký vừa nghe vừa gõ, mất 30–60 phút sau mỗi buổi để chỉnh và gửi. Họp
online (Meet, Teams, Zoom) và họp trộn tiếng Anh – tiếng Việt khiến việc ghi chép càng dễ sót. Các dịch vụ
ghi chú bằng AI có sẵn thường đưa audio lên cloud nước ngoài, hỗ trợ tiếng Việt và họp đa ngôn ngữ còn yếu,
và tính phí theo người dùng.

### 1.2 Mục tiêu dự án (SMART)

| # | Mục tiêu | Thước đo | Hạn |
|---|---|---|---|
| M1 | Ghi âm hoặc tải file cuộc họp và nhận transcript đúng ngôn ngữ người nói (Anh, Việt, trộn) | Chạy được trên Chrome/Edge, điện thoại, app Windows; test E2E đạt | Sprint 1–2 |
| M2 | Transcript hiện trực tiếp khi đang nói | Chữ hiện trễ ≤ 3–5 s (đo được: khoảng 1 s cho từ mới, 1.9 s cho câu đã chốt) | Sprint 4 |
| M3 | Tự động tóm tắt (tổng quan, ý chính, quyết định, việc cần làm) và dịch Việt ↔ Anh | Story #67, #60 đạt toàn bộ acceptance criteria | Sprint 3 |
| M4 | Xử lý được cuộc họp ≥ 60 phút | Đã đo: file 11.6 phút xong trong 18–57 s, dòng đầu hiện sau 3–5 s | Sprint 4 |
| M5 | Có bản web deploy trên AWS để test/demo, và bộ cài Windows không bắt tải model nặng | Có URL HTTPS, bộ cài `SumTalk-Setup-x.y.z.exe` | Sprint 4 |
| M6 | Nằm trong ngân sách | Chi phí thực tế ≤ ngân sách duyệt (mục 1.6), CPI ≥ 0.9 | Cuối dự án |

### 1.3 Phạm vi

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

### 1.4 Sản phẩm bàn giao chính

| Sản phẩm | Mô tả |
|---|---|
| Mã nguồn | Repo `DatTapTanhCode/SumTalk`, các nhánh feature theo sprint |
| Bản web | Docker image + hướng dẫn deploy AWS EC2/S3 |
| App desktop | Bộ cài Windows (NSIS), bản GPU dạng thư mục |
| Tài liệu | README, ARCHITECTURE, bộ 6 tài liệu quản lý dự án, test case |
| Kết quả kiểm thử | pytest (backend), Playwright (trình duyệt, desktop), báo cáo test |

### 1.5 Các bên liên quan

| Bên liên quan | Vai trò / quan tâm | Mức ảnh hưởng | Cách làm việc |
|---|---|---|---|
| Sponsor (đơn vị tài trợ) | Cấp ngân sách, duyệt phạm vi và mốc, nghiệm thu | Cao | Sprint Review, báo cáo trạng thái mỗi sprint |
| Product Owner | Ưu tiên backlog, chấp nhận story | Cao | Sprint planning/review, Azure Boards |
| Nhóm phát triển (Dev) | Xây dựng, test đơn vị | Cao | Daily, code review |
| BA | Yêu cầu, acceptance criteria, mẫu tham chiếu đánh giá | Trung bình | Refinement |
| QC | Test case, test E2E, báo lỗi | Trung bình | Test plan, Azure Boards Bug |
| Người dùng thử (thư ký, trưởng nhóm họp) | Dễ dùng, đúng nội dung, bảo mật | Trung bình | UAT trên bản web |
| Nhà cung cấp (AWS, Groq/OpenAI, Ollama) | Hạ tầng, API | Thấp | Theo dõi chi phí, rate limit |

### 1.6 Ngân sách tóm tắt

| Khoản | Giá trị | Nguồn |
|---|---|---|
| Đơn giá nhân công | 100.000 VND/giờ | dashboard chi phí của nhóm |
| Tổng giờ kế hoạch | [CẦN ĐIỀN: tổng giờ theo sprint] | Azure Boards |
| Chi phí nhân công kế hoạch | = tổng giờ × 100.000 VND | |
| Chi phí ngoài nhân công (AWS, API) | khoảng 3 triệu VND/tháng khi chạy bản test 24/7, xem [Kế hoạch chi phí và ngân sách](03-project-management-plan.md#cost) | ước tính |
| Dự phòng | 10% tổng ngân sách | |

### 1.7 Mốc chính

| Mốc | Nội dung | Ngày |
|---|---|---|
| M0 | Charter, backlog, tài liệu yêu cầu & UI/UX được duyệt | [CẦN ĐIỀN] |
| M1 (hết Sprint 1) | Ghi âm, upload, transcript gốc chạy được (POC E1) | [CẦN ĐIỀN] |
| M2 (hết Sprint 2) | Benchmark và chọn model LLM | [CẦN ĐIỀN] |
| M3 (hết Sprint 3) | Tóm tắt (#67) + dịch (#60), test E2E (#99, #100) | [CẦN ĐIỀN] |
| M4 (hết Sprint 4) | App desktop, transcript live dạng streaming, STT qua server, bản web trên AWS | [CẦN ĐIỀN] |
| M5 | Nghiệm thu, báo cáo tổng kết | [CẦN ĐIỀN] |

Chi tiết lịch xem [Lịch trình: sơ đồ mạng, CPM, Gantt, release plan](03-project-management-plan.md#schedule).

### 1.8 Giả định và ràng buộc

- Nhóm làm bán thời gian (song song công việc khác). Sprint dài [CẦN ĐIỀN: 1–2] tuần.
- Không có ngân sách thuê GPU cố định. Dev dùng laptop RTX 4050; bản test trên AWS dùng EC2 CPU + Whisper API,
  hoặc bật GPU theo giờ.
- Dữ liệu họp có thể nhạy cảm: mặc định chạy local; khi deploy phải có HTTPS, đăng nhập, bucket S3 private.
- Công cụ: Azure Boards (backlog), GitHub (mã nguồn), Python/FastAPI, React, Electron.

### 1.9 Rủi ro cấp cao

Độ chính xác STT với tiếng Việt và họp trộn ngôn ngữ; phụ thuộc GPU/API bên ngoài (chi phí, rate limit); trễ
tiến độ do làm bán thời gian; bảo mật dữ liệu họp. Chi tiết xem [Risk Register và quản lý rủi ro](03-project-management-plan.md#risk).

### 1.10 Phân quyền

| Quyết định | PM | PO | Nhóm Dev | Sponsor |
|---|---|---|---|---|
| Thêm/bớt story trong sprint đang chạy | đề xuất | **quyết định** | tư vấn | – |
| Thay đổi phạm vi dự án, mốc, ngân sách > 10% | đề xuất | đồng ý | – | **phê duyệt** |
| Giải pháp kỹ thuật | tư vấn | – | **quyết định** | – |
| Phân công, lịch họp | **quyết định** | – | tư vấn | – |
| Chấp nhận story (Definition of Done) | – | **quyết định** | – | – |

### Phê duyệt

| Vai trò | Họ tên | Chữ ký | Ngày |
|---|---|---|---|
| Sponsor | | | |
| Product Owner | | | |
| Project Manager | | | |

<a id="business-case"></a>

## 2. Business Case

**Kết luận:** nên tự xây SumTalk. Với các giả định ở mục 2.4, sau 3 năm NPV đạt khoảng **+109 triệu VND**, ROI
**89%**, hoàn vốn sau khoảng **1,3 năm (16 tháng)**. Phương án mua SaaS chỉ đạt NPV khoảng +25 triệu VND, ROI
13%, và audio họp phải đưa ra cloud nước ngoài.

> Mọi số tiền dưới đây là **ước tính dựa trên giả định** ghi trong bảng. Thay giả định bằng số thật của nhóm
> (tổng giờ công trên dashboard, số cuộc họp của đơn vị dùng thử) rồi tính lại bằng
> [`tools/pm_calc.py`](tools/pm_calc.py). Tỷ giá giả định: 26.000 VND/USD.

### 2.1 Bài toán nghiệp vụ

| | Hiện trạng | Mong muốn |
|---|---|---|
| Ghi biên bản | Thư ký gõ tay trong và sau họp, mất 30–60 phút mỗi buổi | Transcript có sẵn khi họp xong; biên bản (tóm tắt, quyết định, việc cần làm) tự tạo |
| Họp online | Phải ghi âm riêng, nghe lại | Thu cả micro và âm thanh cuộc gọi, chữ hiện ngay khi nói |
| Họp trộn Anh – Việt | Dễ sót, dịch tay | Giữ đúng ngôn ngữ từng câu, dịch Việt ↔ Anh một chạm |
| Bảo mật | Dịch vụ AI ngoài đưa dữ liệu ra nước ngoài | Chạy trên máy hoặc server của đơn vị; bucket S3 private |

### 2.2 Giá trị mang lại

- **Tiết kiệm thời gian:** giả định tiết kiệm 45 phút cho mỗi cuộc họp cần biên bản.
- **Chất lượng:** không sót quyết định hay việc cần làm; tìm kiếm và phát lại đúng đoạn.
- **Tiếp cận:** người vắng mặt đọc tóm tắt hoặc bản dịch thay vì nghe lại 1 giờ.
- **Chủ quyền dữ liệu:** tự host được (desktop local hoặc server riêng).

### 2.3 Các phương án

| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| P0. Giữ nguyên | Ghi tay như hiện tại | Không tốn đầu tư | Tốn giờ công, sót nội dung |
| **P1. Tự xây SumTalk** | Dự án này: web + desktop, Whisper + LLM | Làm theo nhu cầu tiếng Việt và họp trộn ngôn ngữ, tự host, chi phí vận hành thấp | Tốn công phát triển, cần bảo trì |
| P2. Mua SaaS ghi chú họp | Dịch vụ AI note-taker trả phí theo người | Dùng ngay | Phí theo người cao, dữ liệu ra nước ngoài, tiếng Việt và họp trộn còn yếu |

### 2.4 Giả định tài chính

| Giả định | Giá trị | Ghi chú |
|---|---|---|
| Tổng công phát triển | **600 giờ** × 100.000 VND = **60.000.000 VND** | [CẦN ĐIỀN: thay bằng tổng giờ thực tế] |
| Đơn vị dùng thử | 40 cuộc họp/tuần × 48 tuần = 1.920 cuộc/năm | ví dụ một công ty khoảng 50 người |
| Thời gian tiết kiệm | 0,75 giờ/cuộc họp, quy đổi 100.000 VND/giờ | lợi ích tối đa 144.000.000 VND/năm |
| Tỷ lệ áp dụng | Năm 1: 50%, năm 2: 80%, năm 3: 90% | |
| Vận hành P1 (mỗi năm) | 35.744.000 VND | chi tiết bên dưới |
| Phí SaaS P2 | 20 người × 15 USD/tháng = 93.600.000 VND/năm | giá tham khảo, cần kiểm tra |
| Suất chiết khấu, thời gian | 10%/năm, 3 năm | |

Chi phí vận hành P1 mỗi năm:

| Khoản | VND/năm |
|---|---|
| EC2 t3.large + EBS + IP (khoảng 85 USD/tháng) | 26.520.000 |
| Whisper API (1.600 giờ audio × 0,04 USD) | 1.664.000 |
| LLM API tóm tắt/dịch (khoảng 5 USD/tháng) | 1.560.000 |
| Bảo trì (10% chi phí phát triển) | 6.000.000 |
| **Tổng** | **35.744.000** |

### 2.5 Dòng tiền, NPV, ROI, thời gian hoàn vốn

Đơn vị: triệu VND. Dòng tiền ròng = lợi ích − chi phí.

| Năm | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Lợi ích (P1 và P2 như nhau) | 0 | 72,0 | 115,2 | 129,6 |
| **P1** chi phí | 60,0 | 35,7 | 35,7 | 35,7 |
| **P1** dòng tiền ròng | −60,0 | 36,3 | 79,5 | 93,9 |
| **P1** luỹ kế | −60,0 | −23,7 | 55,7 | 149,6 |
| **P2** chi phí | 0 | 93,6 | 93,6 | 93,6 |
| **P2** dòng tiền ròng | 0 | −21,6 | 21,6 | 36,0 |

```latex
NPV = \sum_{t=0}^{3} \frac{CF_t}{(1+0{,}1)^t}
\qquad ROI = \frac{\sum \text{lợi ích} - \sum \text{chi phí}}{\sum \text{chi phí}}
```

| Chỉ số | P0 Giữ nguyên | **P1 Tự xây** | P2 SaaS |
|---|---|---|---|
| NPV (3 năm, 10%) | 0 | **+109,1 triệu** | +25,3 triệu |
| ROI (3 năm) | – | **89,4%** | 12,8% |
| Hoàn vốn | – | **1,3 năm (khoảng 16 tháng)** | khoảng 2 năm |
| Dữ liệu họp | trong đơn vị | trong đơn vị | ra nước ngoài |

Cách tính hoàn vốn P1: luỹ kế hết năm 1 là −23,7 triệu, năm 2 thu thêm 79,5 triệu, nên
1 + 23,7 / 79,5 ≈ 1,30 năm.

### 2.6 Phân tích độ nhạy

| Kịch bản | NPV P1 |
|---|---|
| Cơ sở | +109,1 triệu |
| Công phát triển gấp đôi (1.200 giờ) | +49,1 triệu (vẫn có lời) |
| Lợi ích chỉ bằng một nửa (ít họp hoặc áp dụng chậm) | −19,9 triệu (lỗ) |
| Điểm hoà vốn | khoảng **23 cuộc họp/tuần** thì NPV = 0 |

Nhận xét: kết quả nhạy với số cuộc họp thực tế hơn là với chi phí phát triển. Trước khi mở rộng nên đo số
cuộc họp và thời gian tiết kiệm thật trong đợt UAT.

### 2.7 Rủi ro tài chính chính

Chi phí API vượt dự kiến khi dùng nhiều (R6 – đã có cấu hình `LIVE_INTERVAL_SEC`, token/cost log); GPU đắt nếu
chạy 24/7 (bật/tắt theo giờ, hoặc dùng cấu hình CPU + API); tỷ lệ áp dụng thấp. Xem [Risk Register và quản lý rủi ro](03-project-management-plan.md#risk).

### 2.8 Khuyến nghị

Chọn **P1**. Bắt đầu bằng bản web trên EC2 CPU + Whisper API để chi phí thấp. Khi số cuộc họp vượt khoảng
25/tuần, hoặc khi nhiều người dùng app desktop, mới chuyển sang server GPU (`STT_SERVER_API_KEYS`).

<a id="methodology"></a>

## 3. Lựa chọn phương pháp quản lý dự án

**Quyết định:** dùng **Scrum** (sprint [CẦN ĐIỀN: 1–2] tuần, backlog trên Azure Boards). Lý do chính: yêu cầu về
AI (độ chính xác STT, chất lượng tóm tắt) chỉ biết được sau khi thử, và phạm vi đã thay đổi nhiều lần (dời #60 vào
Sprint 3, thêm app desktop, streaming, deploy cloud). Waterfall sẽ khoá yêu cầu quá sớm.

### 3.1 Đặc điểm dự án ảnh hưởng tới lựa chọn

| Đặc điểm | SumTalk | Phương pháp phù hợp |
|---|---|---|
| Độ rõ của yêu cầu | Rõ ở mức tính năng, mơ hồ ở mức chất lượng AI (độ chính xác, độ trễ) | Lặp, đo, điều chỉnh |
| Rủi ro công nghệ | Cao: Whisper, LLM, GPU, trình duyệt, Electron | Làm POC sớm, demo mỗi sprint |
| Thay đổi phạm vi | Thường xuyên (xem [Change Log (nhật ký thay đổi phạm vi)](05-monitoring-and-control-report.md#change-log)) | Backlog ưu tiên lại mỗi sprint |
| Nhóm | Nhỏ, bán thời gian, đa vai | Tự tổ chức, họp ngắn |
| Khách hàng/Sponsor | Muốn thấy tiến độ đều và sản phẩm chạy được | Sprint Review có demo |
| Ràng buộc báo cáo | Sponsor cần báo cáo ngân sách, tiến độ, rủi ro | Scrum + tài liệu quản lý tối thiểu, cập nhật theo sprint |

### 3.2 So sánh

| Tiêu chí | Waterfall | **Scrum** | Kanban | Mô hình lai (Water-Scrum-Fall) |
|---|---|---|---|---|
| Yêu cầu thay đổi | Đắt, phải làm lại tài liệu | Rẻ, đưa vào sprint sau | Rẻ | Trung bình |
| Thấy sản phẩm chạy được | Cuối dự án | Mỗi sprint | Liên tục | Giữa dự án |
| Kiểm soát rủi ro kỹ thuật | Muộn | Sớm (POC Sprint 1, benchmark Sprint 2) | Sớm | Trung bình |
| Kế hoạch, ngân sách cố định | Tốt | Theo velocity, cần EVA bổ sung | Yếu | Tốt |
| Phù hợp nhóm nhỏ làm bán thời gian | Trung bình | Tốt (nhịp đều, mục tiêu ngắn) | Tốt nhưng khó đo tiến độ theo mốc | Trung bình |
| Đáp ứng yêu cầu báo cáo của Sponsor | Tốt | Tốt khi bổ sung tài liệu quản lý | Yếu | Tốt |

### 3.3 Cách áp dụng Scrum trong dự án

- **Vai trò:** PO, Scrum Master/PM, Developers (gồm BA, QC). Xem [Tổ chức nhóm, RACI và kế hoạch truyền thông](03-project-management-plan.md#communication).
- **Sự kiện:** Planning (Planning Poker), Daily, Refinement, Review (demo), Retrospective.
- **Artefact:** Product Backlog ([Product Backlog / PRD và mô tả tính năng](02-software-requirements-specification.md#product-backlog)), Sprint Backlog và burndown trên Azure Boards,
  Increment là nhánh feature chạy được, kèm test.
- **Bổ sung để đáp ứng yêu cầu báo cáo của Sponsor:** Charter, Business Case, WBS, CPM/Gantt, EVA, Risk Register là phần quản lý
  "bên ngoài" Scrum. Chúng được cập nhật mỗi sprint, không làm một lần rồi khoá.
- **Definition of Done** chung cho mọi story: xem [Quality Plan và Test Plan](04-quality-and-test.md#quality-plan).
- **Quản lý mã nguồn:** mỗi nhóm việc một nhánh `feature/...`, commit nhỏ theo task, PR trước khi merge vào
  `main` (xem [Change Log (nhật ký thay đổi phạm vi)](05-monitoring-and-control-report.md#change-log), [Release Notes](06-project-closure-report.md#release-notes)).

### 3.4 Hạn chế và cách bù

| Hạn chế của Scrum | Cách bù trong dự án |
|---|---|
| Khó cam kết ngày kết thúc và ngân sách | Velocity + CPM ([Lịch trình: sơ đồ mạng, CPM, Gantt, release plan](03-project-management-plan.md#schedule)) + EVA ([Earned Value Analysis (EVA)](05-monitoring-and-control-report.md#eva)) |
| Dễ phình phạm vi | Change Log có PO duyệt, phân quyền trong Charter |
| Ít tài liệu | Bộ 6 tài liệu quản lý dự án, README/ARCHITECTURE trong repo |
| Phụ thuộc kỷ luật họp | Daily ngắn, có thể họp không đồng bộ qua chat khi thành viên trùng lịch |
