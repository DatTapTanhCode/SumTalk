# Tài liệu quản lý dự án SumTalk

Bộ tài liệu quản lý dự án SumTalk (môn Quản lý dự án phần mềm), mỗi tài liệu là một file. Số thứ tự là thứ
tự nên làm. Các file có ★ là 6 file ưu tiên làm mới.

**Cách đọc ký hiệu**

- `[CẦN ĐIỀN: …]`: số liệu nhóm đã có ở chỗ khác (Azure Boards, dashboard chi phí, biên bản họp) nhưng
  không có trong repo. Cần chép vào, không được để trống khi nộp.
- **Giả định**: con số do người viết đặt ra để tính toán (ví dụ NPV). Có thể đổi; các bảng ghi rõ công thức
  để tính lại.
- Số liệu kỹ thuật (số dòng code, số API, kết quả đo độ trễ, số test) lấy từ repo ngày 12/11/2026.

| # | Tài liệu | Nhóm | Ưu tiên |
|---|---|---|---|
| 01 | [Project Charter](01-project-charter.md) | A. Khởi động | ★ |
| 02 | [Business Case (NPV, ROI, payback)](02-business-case.md) | A. Khởi động | ★ |
| 03 | [Lựa chọn phương pháp (Scrum)](03-methodology.md) | A. Khởi động | |
| 04 | [Product Backlog / PRD, mô tả tính năng](04-product-backlog-prd.md) | B. Yêu cầu | |
| 05 | [Yêu cầu phi chức năng](05-non-functional-requirements.md) | B. Yêu cầu | |
| 06 | [WBS](06-wbs.md) | B. Yêu cầu | |
| 07 | [Ước lượng effort](07-effort-estimation.md) | C. Kế hoạch | ★ |
| 08 | [Lịch trình: sơ đồ mạng, CPM, Gantt](08-schedule-cpm-gantt.md) | C. Kế hoạch | ★ |
| 09 | [Risk Register](09-risk-register.md) | C. Kế hoạch | ★ |
| 10 | [Phân bổ nguồn lực](10-resource-plan.md) | C. Kế hoạch | |
| 11 | [Kế hoạch chi phí / ngân sách](11-cost-budget-plan.md) | C. Kế hoạch | |
| 12 | [Quality Plan và Test Plan](12-quality-test-plan.md) | C. Kế hoạch | |
| 13 | [Truyền thông, tổ chức nhóm, RACI](13-communication-raci.md) | C. Kế hoạch | ★ |
| 14 | [Sprint / Status Report](14-sprint-status-reports.md) | D. Theo dõi | |
| 15 | [Earned Value (EVA)](15-earned-value.md) | D. Theo dõi | |
| 16 | [Biên bản họp và Retrospective](16-meeting-minutes-retro.md) | D. Theo dõi | |
| 17 | [Change Log](17-change-log.md) | D. Theo dõi | |
| 18 | [SOW và biên bản nghiệm thu](18-sow-acceptance.md) | E. Kết thúc | |
| 19 | [Test Summary Report](19-test-summary-report.md) | E. Kết thúc | |
| 20 | [Release Notes](20-release-notes.md) | E. Kết thúc | |
| 21 | [Báo cáo tổng kết / Lessons Learned](21-lessons-learned.md) | E. Kết thúc | |
| 22 | [Đặc tả UI/UX (theo giao diện v0.4)](22-ui-ux-spec.md) | B. Yêu cầu (bổ sung) | |

Tài liệu kỹ thuật liên quan (chỉ tham khảo, không nằm trong bộ này): [README](../../README.md),
[ARCHITECTURE](../ARCHITECTURE.md), [hướng dẫn deploy AWS](../deploy/AWS-EC2-S3.md),
[test case Sprint 3](../testing/sprint3-test-cases.md).
