# Tài liệu quản lý dự án SumTalk

Bộ tài liệu quản lý dự án SumTalk gồm 6 tài liệu, chia theo nhóm quy trình: khởi động, yêu cầu, lập kế hoạch,
chất lượng, theo dõi và kết thúc. Mỗi tài liệu có bảng thông tin, mục lục và lịch sử phiên bản ở đầu file.

| # | Tài liệu | Nội dung | Người đọc chính |
|---|---|---|---|
| 01 | [Project Initiation Document](01-project-initiation.md) | Project Charter, Business Case (NPV, ROI, hoàn vốn), lựa chọn phương pháp (Scrum) | Sponsor, PO, PM |
| 02 | [Software Requirements Specification](02-software-requirements-specification.md) | Product Backlog / PRD, yêu cầu phi chức năng, đặc tả UI/UX (v0.4) | PO, nhóm phát triển, QC |
| 03 | [Project Management Plan](03-project-management-plan.md) | WBS, ước lượng effort, lịch trình (CPM, Gantt), Risk Register, nguồn lực, chi phí, RACI và truyền thông | Sponsor, PM, cả nhóm |
| 04 | [Quality & Test Document](04-quality-and-test.md) | Quality Plan và Test Plan, Test Summary Report, phụ lục test case E2E Sprint 3 | QC, PO, PM |
| 05 | [Monitoring & Control Report](05-monitoring-and-control-report.md) | Sprint / Status Report, Earned Value (EVA), biên bản họp và Retrospective, Change Log | PM, PO, Sponsor |
| 06 | [Project Closure Report](06-project-closure-report.md) | SOW và nghiệm thu, Release Notes, báo cáo tổng kết và Lessons Learned | Sponsor, PO, PM |

**Cách đọc ký hiệu**

- `[CẦN ĐIỀN: …]`: số liệu đã có ở chỗ khác (Azure Boards, dashboard chi phí, biên bản họp) nhưng chưa chép vào
  repo. Cần bổ sung trước khi trình duyệt.
- **Giả định**: con số đặt ra để tính toán (ví dụ NPV). Có thể đổi; các bảng ghi rõ công thức để tính lại, hoặc
  tính lại bằng [`tools/pm_calc.py`](tools/pm_calc.py).
- Số liệu kỹ thuật (số dòng code, số API, kết quả đo độ trễ, số test) lấy từ repo ngày 12/11/2026.

Tài liệu kỹ thuật liên quan (không nằm trong bộ này): [README](../../README.md),
[ARCHITECTURE](../ARCHITECTURE.md), [hướng dẫn deploy AWS](../deploy/AWS-EC2-S3.md),
[test case Sprint 3](../testing/sprint3-test-cases.md).
