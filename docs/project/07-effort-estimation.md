# 07 – Ước lượng effort

**Phương pháp chính:** Story Point với Planning Poker, theo từng sprint, rồi quy ra giờ bằng velocity thực tế.
**Đối chiếu:** COCOMO 81 cơ bản (từ số dòng code thật của repo) và Function Point (từ số API và bảng dữ liệu
thật). Hai phương pháp đối chiếu cho kết quả 3.500–5.100 giờ cho cả sản phẩm, nếu làm theo kiểu công ty với một
nhóm toàn thời gian. Con số này dùng để kiểm tra độ hợp lý, không thay cho số giờ thực tế của nhóm.

## 1. Story Point và Planning Poker

Quy trình mỗi buổi Sprint Planning:
1. PO đọc user story và acceptance criteria (xem [04](04-product-backlog-prd.md)).
2. Mỗi thành viên chọn lá bài Fibonacci: 1, 2, 3, 5, 8, 13, 21, ?.
3. Lật bài cùng lúc. Người chọn cao nhất và thấp nhất giải thích; vote lại tối đa 2 vòng.
4. Story trên 13 điểm phải tách nhỏ. Story mốc tham chiếu: **#65 Xuất TXT/SRT = 2 điểm**.
5. Quy ra giờ khi lập kế hoạch: giờ ≈ điểm × (giờ thực tế / điểm hoàn thành của 2 sprint gần nhất).

## 2. Bảng ước lượng theo backlog

Cột "SP" là điểm đề xuất để nhóm đối chiếu với điểm đã vote trên Azure Boards. Cột "Giờ TT" lấy từ board.

| Task / Story | Nội dung | SP đề xuất | Giờ ước lượng | Giờ TT |
|---|---|---|---|---|
| T1.1.1–T1.1.5 | Ghi âm trên trình duyệt, gửi chunk, tạo meeting, test trình duyệt | 13 | | [CẦN ĐIỀN] |
| T1.2.1–T1.2.5 | Ghi trên điện thoại, offline, tự đồng bộ | 13 | | [CẦN ĐIỀN] |
| T1.3.1–T1.3.5 | Upload file lớn, kiểm tra định dạng, chuẩn hoá audio | 8 | | [CẦN ĐIỀN] |
| STT | Whisper, transcript ngôn ngữ gốc, live | 13 | | [CẦN ĐIỀN] |
| #68 | Model + prompt tóm tắt | 5 | | [CẦN ĐIỀN] |
| #69 | Transcript dài (map-reduce) | 5 | | [CẦN ĐIỀN] |
| #70 | Bước tóm tắt, lưu trữ, API | 5 | | [CẦN ĐIỀN] |
| #71 | Tab Summary + Regenerate | 3 | | [CẦN ĐIỀN] |
| #61 | Model dịch | 3 | | [CẦN ĐIỀN] |
| #62 | Lưu bản dịch + API | 3 | | [CẦN ĐIỀN] |
| #63 | Bước dịch có tiến độ | 3 | | [CẦN ĐIỀN] |
| #64 | Chọn ngôn ngữ + hiển thị song ngữ | 3 | | [CẦN ĐIỀN] |
| #65 | Xuất TXT/SRT (mốc tham chiếu) | 2 | | [CẦN ĐIỀN] |
| #66, #72 | Đánh giá chất lượng dịch, tóm tắt | 5 | | [CẦN ĐIỀN] |
| #99, #100 | Test E2E Sprint 3 | 5 | | [CẦN ĐIỀN] |
| D-1 | App desktop (Electron, đóng gói, bộ cài) | 8 | | [CẦN ĐIỀN] |
| S-1 | Live streaming + STT remote + file dài | 13 | | [CẦN ĐIỀN] |
| O-1 | Deploy AWS (Docker, S3, hướng dẫn) | 8 | | [CẦN ĐIỀN] |
| **Tổng** | | **125** | | |

## 3. Velocity

| Sprint | SP cam kết | SP hoàn thành | Giờ thực tế | Giờ/SP |
|---|---|---|---|---|
| Sprint 1 | [CẦN ĐIỀN] | [CẦN ĐIỀN] | [CẦN ĐIỀN] | |
| Sprint 2 | [CẦN ĐIỀN] | [CẦN ĐIỀN] | [CẦN ĐIỀN] | |
| Sprint 3 | [CẦN ĐIỀN] | [CẦN ĐIỀN] | [CẦN ĐIỀN] | |
| **Trung bình** | | | | |

Velocity dùng để lập kế hoạch = trung bình SP hoàn thành của 3 sprint gần nhất. Số sprint còn lại =
SP còn lại trong backlog / velocity.

## 4. Đối chiếu bằng COCOMO 81 (cơ bản)

Kích thước đo trong repo ngày 12/11/2026, chỉ tính code viết tay, không tính dòng trống/comment, test và
component UI sinh tự động:

| Thành phần | Dòng code |
|---|---|
| Backend Python (`backend/app`, `run.py`) | 3.386 |
| Frontend TypeScript/React (trừ `components/ui`) | 4.518 |
| Desktop (Electron, build) | 749 |
| **Tổng** | **8.650 dòng (8,65 KLOC)** |

```latex
E = a \cdot KLOC^{b} \;(\text{người-tháng}) \qquad T = c \cdot E^{d} \;(\text{tháng}) \qquad N = E / T
```

| Chế độ | a, b, c, d | Effort E | Thời gian T | Số người N | Giờ (152 h/tháng) | Chi phí (100.000 VND/h) |
|---|---|---|---|---|---|---|
| Organic | 2,4; 1,05; 2,5; 0,38 | 23,1 người-tháng | 8,2 tháng | 2,8 | 3.516 h | 351,6 triệu |
| Semi-detached (có AI/ML, nhiều công nghệ) | 3,0; 1,12; 2,5; 0,35 | 33,6 người-tháng | 8,6 tháng | 3,9 | 5.112 h | 511,2 triệu |

## 5. Đối chiếu bằng Function Point (IFPUG, trọng số trung bình)

Đếm từ hệ thống thật: 27 endpoint API, 6 bảng dữ liệu.

| Loại | Đếm từ hệ thống | Số lượng | Trọng số | Điểm |
|---|---|---|---|---|
| EI – nhập liệu | tạo meeting, gửi chunk, finalize, đổi tên, xoá, upload (tạo, part, complete, huỷ), retranscribe, regenerate/dịch | 11 | 4 | 44 |
| EO – xuất có xử lý | export transcript (5 định dạng), export bản dịch, transcript live, tóm tắt, phát audio, API /v1 transcription | 7 | 5 | 35 |
| EQ – truy vấn | danh sách meeting, chi tiết, transcript, health, config, trạng thái upload, danh sách bản dịch, bản dịch, models | 9 | 4 | 36 |
| ILF – dữ liệu nội bộ | Meeting, Segment, Upload, Summary, Translation, SegmentTranslation | 6 | 10 | 60 |
| EIF – dữ liệu ngoài | API LLM, API Whisper/S3 | 2 | 7 | 14 |
| **UFP** | | | | **189** |

Hệ số điều chỉnh VAF = 0,65 + 0,01 × 38 = 1,03 (tổng 14 đặc tính hệ thống, giả định 38 điểm). Từ đó
AFP ≈ **195 FP**. Với năng suất 8 giờ/FP, effort ≈ **1.560 giờ**.

## 6. So sánh và kết luận

| Phương pháp | Effort | Ghi chú |
|---|---|---|
| Story Point (125 SP × giờ/SP thực tế) | [CẦN ĐIỀN] | số dùng để lập kế hoạch |
| Function Point (195 FP × 8 h) | khoảng 1.560 giờ | chỉ phần chức năng, chưa gồm desktop/deploy |
| COCOMO organic | khoảng 3.500 giờ | mô hình công ty, gồm cả quản lý, tài liệu |
| COCOMO semi-detached | khoảng 5.100 giờ | |

Giờ thực tế của nhóm sinh viên thấp hơn nhiều so với COCOMO. Lý do: dùng framework và thư viện có sẵn
(FastAPI, React, faster-whisper, Electron), có công cụ AI hỗ trợ viết code, phạm vi POC chưa có tài khoản và
phân quyền, và COCOMO 81 được hiệu chỉnh trên dự án những năm 1970–80. Khi trình bày, dùng Story Point làm số kế
hoạch; FP và COCOMO chỉ để chứng minh quy mô sản phẩm.
