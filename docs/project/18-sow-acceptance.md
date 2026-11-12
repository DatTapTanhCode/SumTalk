# 18 – Statement of Work (SOW) và biên bản nghiệm thu

**Tóm tắt:** thoả thuận giữa nhóm thực hiện và PO/giảng viên về phạm vi giao, tiêu chí nghiệm thu và cách xử lý
thay đổi. Biên bản nghiệm thu ở mục 7 dùng cho từng mốc và lần nghiệm thu cuối.

## 1. Các bên

| Bên | Đại diện | Vai trò |
|---|---|---|
| Bên giao việc (khách hàng) | [CẦN ĐIỀN: giảng viên / PO] | Phê duyệt phạm vi, nghiệm thu |
| Bên thực hiện | Nhóm SumTalk – [CẦN ĐIỀN: PM] | Xây dựng, bàn giao |

## 2. Mục đích

Xây dựng hệ thống SumTalk ghi âm, phiên âm, tóm tắt và dịch cuộc họp, theo mục tiêu trong
[Project Charter](01-project-charter.md).

## 3. Phạm vi công việc

| # | Hạng mục | Mô tả | Tiêu chí nghiệm thu |
|---|---|---|---|
| 1 | Ghi âm và upload | Trình duyệt, điện thoại (offline), upload ≤ 1 GB | AC của US1.1–US1.3 ([04](04-product-backlog-prd.md)) đạt; test E2E trình duyệt đạt |
| 2 | Transcript | Ngôn ngữ gốc theo câu, live ≤ 3–5 s, file ≥ 60 phút, xem/tìm/xuất | AC của US2.1–US2.4; NFR-P1, P2 ([05](05-non-functional-requirements.md)) |
| 3 | Tóm tắt | Story #67 | 7 AC của #67; test case S-01…S-11 |
| 4 | Dịch | Story #60 | 6 AC của #60; test case T-01…T-12 |
| 5 | App desktop | Bộ cài Windows | AC của US5.1; smoke test bản đóng gói 8/8 |
| 6 | Engine STT dùng chung | Remote, API `/v1` | AC của US6.1–US6.2 |
| 7 | Bản web trên AWS | Docker, HTTPS, đăng nhập, S3, hướng dẫn | AC của US7.1; checklist trong hướng dẫn deploy đạt trên AWS thật |
| 8 | Tài liệu | README, ARCHITECTURE, 21 tài liệu quản lý, test case | Đủ file, không còn ô `[CẦN ĐIỀN]` ở phần bắt buộc |

**Ngoài phạm vi:** xem mục 3 của Charter (tài khoản, diarization, app iOS/Android native, SLA thương mại).

## 4. Sản phẩm bàn giao và thời hạn

| Sản phẩm | Hình thức | Mốc |
|---|---|---|
| Mã nguồn | Repo GitHub, nhánh đã merge vào `main` | M5 |
| Bộ cài Windows | `SumTalk-Setup-<version>.exe` | M4 |
| Bản web | URL HTTPS + tài khoản test | M4 |
| Tài liệu | Thư mục `docs/` | M5 |
| Báo cáo test | [19](19-test-summary-report.md) | M5 |

Mốc M0–M5: [Charter mục 7](01-project-charter.md#7-mốc-chính).

## 5. Giả định và trách nhiệm của bên giao việc

- Cung cấp phản hồi trong Sprint Review; nghiệm thu trong vòng [CẦN ĐIỀN: 3] ngày làm việc sau khi nhận bàn giao.
- Cung cấp hoặc chấp nhận chi phí tài khoản AWS và API trong thời gian test (khoảng 2,5–3 triệu VND/tháng, cấu
  hình CPU).
- Cung cấp mẫu audio thật (tiếng Việt, họp trộn ngôn ngữ) cho đánh giá chất lượng, nếu có.

## 6. Quản lý thay đổi

Mọi yêu cầu thay đổi theo quy trình [Change Log](17-change-log.md). Thay đổi làm tăng > 10% công sức hoặc dời mốc
phải được bên giao việc ký duyệt; công sức phát sinh tính theo đơn giá 100.000 VND/giờ hoặc đổi lấy việc cắt hạng
mục Should/Could tương đương.

## 7. Mẫu biên bản nghiệm thu

```markdown
BIÊN BẢN NGHIỆM THU – Mốc: <M1…M5 / nghiệm thu cuối>      Ngày: …
Thành phần: Bên giao việc: …   Bên thực hiện: …
Phiên bản nghiệm thu: <tag/commit, bộ cài, URL>

| Hạng mục | Tiêu chí | Kết quả (Đạt/Không đạt) | Ghi chú |
|---|---|---|---|
| … | … | … | … |

Lỗi còn tồn (mức, ID Azure Boards, hạn khắc phục): …
Kết luận: ☐ Nghiệm thu toàn bộ  ☐ Nghiệm thu có điều kiện (khắc phục trước ngày …)  ☐ Không nghiệm thu
Chữ ký:  Bên giao việc ……………        Bên thực hiện ……………
```
