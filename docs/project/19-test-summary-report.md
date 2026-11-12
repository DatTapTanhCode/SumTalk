# 19 – Test Summary Report

**Kết luận hiện tại (12/11/2026):** đủ điều kiện phát hành bản **v0.4 cho đợt test nội bộ và UAT**. Các test tự động
đều đạt và hiệu năng đạt mục tiêu. **Chưa đủ để nghiệm thu cuối**, vì còn thiếu 3 việc: chạy lại test E2E trình
duyệt sau thay đổi Sprint 4, deploy thật lên AWS, và đo độ chính xác tiếng Việt trên mẫu UAT.

## 1. Phạm vi và môi trường

| Mục | Nội dung |
|---|---|
| Phiên bản | Nhánh `docs/project-management` (gồm toàn bộ code tới `feature/aws-deploy`) |
| Máy test | Windows 11, i7-13620H, RTX 4050 6 GB, Python 3.13, Node 22, Chrome/Edge, Electron 45 |
| Model | Whisper `large-v3-turbo` (GPU), `small` (CPU); LLM mock trong test tự động |
| Kế hoạch tham chiếu | [12](12-quality-test-plan.md), [test case Sprint 3](../testing/sprint3-test-cases.md) |

## 2. Kết quả test tự động

| Bộ test | Số test | Đạt | Không đạt | Ghi chú |
|---|---|---|---|---|
| pytest backend (API, live, STT remote, `/v1`, S3, tóm tắt, dịch) | 88 | 88 | 0 | khoảng 6 s |
| ruff (lint) | – | sạch | – | |
| Type check + build frontend | – | đạt | – | |
| Playwright desktop – từ mã nguồn | 8 | 8 | 0 | cửa sổ, micro, âm thanh hệ thống, thoát sạch |
| Playwright desktop – bản đóng gói | 8 | 8 | 0 | chạy trên `win-unpacked` của v0.4 trước khi thêm streaming; [CẦN ĐIỀN: chạy lại sau khi build lại bộ cài] |
| Playwright trình duyệt (Chrome, Edge) – E1 | 5 × 2 | [CẦN ĐIỀN] | | cần chạy lại sau khi đổi chunk 1 s |
| Playwright Sprint 3 (`sprint3.spec.ts`) | [CẦN ĐIỀN] | | | server `AI_MOCK=true` |
| Docker: build image, HTTPS, đăng nhập, `/v1` | 8 kiểm tra | 8 | 0 | stack chạy local với `SITE_ADDRESS=localhost` |

## 3. Kết quả hiệu năng (đo thực tế)

| Kịch bản | Mục tiêu | Kết quả | Đạt |
|---|---|---|---|
| Live, GPU local, file 17 s phát theo thời gian thực | ≤ 3–5 s | Từ mới khoảng 1 s; câu chốt TB 1,93 s, tối đa 2,31 s | ✔ |
| Live qua engine remote (máy không có model) | như trên | TB 1,93 s, tối đa 2,31 s; máy khách không tải model | ✔ |
| File 11,6 phút – remote | 1 giờ ≤ 10 phút | 17,8 s (39× realtime), dòng đầu sau 3,1 s | ✔ |
| File 11,6 phút – GPU local | như trên | 56,7 s (12× realtime), dòng đầu sau 4,6 s | ✔ |
| Khởi động app desktop | ≤ 10 s | 1,4–1,9 s | ✔ |

## 4. Kết quả test thủ công (QC)

| Bộ test case | Tổng | Đạt | Không đạt | Chưa chạy |
|---|---|---|---|---|
| #99 Tóm tắt (S-01…S-11) | 11 | [CẦN ĐIỀN] | | |
| #100 Dịch (T-01…T-12) | 12 | [CẦN ĐIỀN] | | |
| Điện thoại Android/iOS (T1.2.5) | [CẦN ĐIỀN] | | | |
| UAT bản web trên AWS | [CẦN ĐIỀN] | | | |

## 5. Lỗi còn tồn và hạn chế đã biết

| ID | Mô tả | Mức | Trạng thái |
|---|---|---|---|
| L-01 | iOS dừng micro khi khoá màn hình (giới hạn của trình duyệt) | Medium | Chấp nhận (R13) |
| L-02 | Bộ cài chưa ký số, SmartScreen cảnh báo | Low | Chấp nhận (R12) |
| L-03 | Engine remote dùng API công cộng: ngôn ngữ nhận theo block khoảng 30 s, thô hơn engine local (theo câu) | Low | Dùng server SumTalk GPU để giữ nhận ngôn ngữ theo câu |
| L-04 | Live: dòng có thể bị ngắt giữa câu khi nói liền > 8 s không nghỉ (bản cuối sau khi Stop sẽ chia lại câu) | Low | Thiết kế có chủ ý |
| [CẦN ĐIỀN] | Lỗi QC tìm thấy trên Azure Boards | | |

## 6. Đánh giá theo tiêu chí phát hành

| Tiêu chí ([12](12-quality-test-plan.md)) | Trạng thái |
|---|---|
| Test tự động đạt 100% | ✔ (backend, desktop, Docker); E2E trình duyệt cần chạy lại |
| Không còn lỗi Critical/High | ✔ theo hiểu biết hiện tại; [CẦN ĐIỀN: xác nhận trên board] |
| Hiệu năng đạt mục tiêu | ✔ |
| Smoke test bản đóng gói và bản web | Bản đóng gói: cần build lại bộ cài v0.4; bản web: đạt local, chưa có trên AWS |
| PO và Sponsor đồng ý | [CẦN ĐIỀN] |

**Khuyến nghị:** build lại bộ cài, chạy lại E2E trình duyệt và Sprint 3, deploy lên AWS, chạy UAT 1 tuần, rồi
nghiệm thu v1.0.
