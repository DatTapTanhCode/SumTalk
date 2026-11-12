# 13 – Tổ chức nhóm, RACI và kế hoạch truyền thông

**Tóm tắt:** nhóm làm Scrum với 1 PO, 1 Scrum Master/PM, BA, QC và Dev. Mỗi sản phẩm bàn giao có đúng một người
**A** (chịu trách nhiệm cuối). Kênh chính là Azure Boards (công việc), GitHub (code) và nhóm chat (trao đổi nhanh).

## 1. Thành viên và vai trò

| Thành viên | Vai trò Scrum | Vai trò chuyên môn | Mảng phụ trách chính |
|---|---|---|---|
| [CẦN ĐIỀN] | Product Owner | BA | Backlog, acceptance criteria, mẫu tham chiếu đánh giá |
| [CẦN ĐIỀN] | Scrum Master / PM | Dev | Kế hoạch, theo dõi chi phí (CPI/SPI), rủi ro, báo cáo |
| [CẦN ĐIỀN] | Developer | Backend / STT | FastAPI, Whisper, pipeline, deploy |
| [CẦN ĐIỀN] | Developer | Frontend / Desktop | React, recorder, offline, Electron |
| [CẦN ĐIỀN] | Developer | AI (LLM) | Tóm tắt, dịch, đánh giá chất lượng |
| [CẦN ĐIỀN] | Developer | QC | Test case, Playwright, báo lỗi |

[CẦN ĐIỀN: chỉnh theo phân vai thật của nhóm; một người có thể giữ nhiều vai.]

## 2. Ma trận RACI

R = thực hiện · A = chịu trách nhiệm cuối (mỗi dòng đúng một A) · C = được hỏi ý kiến · I = được thông báo

| Công việc / sản phẩm | PO | PM/SM | Dev Backend | Dev Frontend | Dev AI | QC | Sponsor |
|---|---|---|---|---|---|---|---|
| Project Charter, Business Case | C | **A/R** | I | I | I | I | C (duyệt) |
| Product Backlog, user story, AC | **A/R** | C | C | C | C | C | I |
| Ưu tiên backlog, chấp nhận story | **A** | C | I | I | I | C | I |
| Kế hoạch sprint, lịch, ước lượng | C | **A/R** | R | R | R | R | I |
| Kiến trúc, lựa chọn công nghệ | C | C | **A/R** | R | R | I | I |
| Ghi âm, offline, upload (E1) | C | I | R | **A/R** | I | C | I |
| STT, live streaming, engine remote | C | I | **A/R** | R | I | C | I |
| Tóm tắt, dịch (#67, #60) | C | I | R | R | **A/R** | C | I |
| App desktop | C | I | R | **A/R** | I | C | I |
| Deploy AWS, vận hành bản test | I | C | **A/R** | I | I | C | I |
| Test case, test E2E, báo cáo test | C | I | C | C | C | **A/R** | I |
| Definition of Done, nghiệm thu story | **A** | C | R | R | R | R | I |
| Quản lý rủi ro, Change Log | C | **A/R** | C | C | C | C | I |
| Theo dõi chi phí (EVA, CPI/SPI) | I | **A/R** | I | I | I | I | I |
| Báo cáo trạng thái, sprint report | C | **A/R** | C | C | C | C | I |
| Nghiệm thu cuối, SOW | R | R | I | I | I | C | **A** |

## 3. Lịch họp Scrum

| Sự kiện | Khi nào | Thời lượng | Thành phần | Đầu ra |
|---|---|---|---|---|
| Sprint Planning | Đầu sprint | 1–2 giờ | Cả nhóm | Sprint backlog, mục tiêu sprint, ước lượng (Planning Poker) |
| Daily Scrum | [CẦN ĐIỀN: hằng ngày / 3 buổi một tuần] | 15 phút | Dev, SM (PO tuỳ chọn) | Đã làm, sẽ làm, vướng mắc |
| Backlog Refinement | Giữa sprint | 1 giờ | PO, BA, đại diện Dev/QC | Story sẵn sàng cho sprint sau (có AC, đã ước lượng) |
| Sprint Review | Cuối sprint | 1 giờ | Cả nhóm + Sponsor/giảng viên | Demo, phản hồi, cập nhật backlog |
| Retrospective | Sau review | 45 phút | Cả nhóm | 1–3 hành động cải tiến ([16](16-meeting-minutes-retro.md)) |

## 4. Kế hoạch truyền thông

| Thông tin | Gửi cho | Hình thức | Tần suất | Người gửi |
|---|---|---|---|---|
| Tiến độ task, lỗi | Cả nhóm | Azure Boards (board, Bug) | Liên tục | Người làm task |
| Vướng mắc cần gỡ | SM, người liên quan | Nhóm chat, nêu trong Daily | Khi phát sinh | Bất kỳ |
| Code, review | Dev | GitHub Pull Request trên nhánh feature | Mỗi task | Dev |
| Báo cáo trạng thái (burndown, CPI/SPI, rủi ro) | Sponsor, cả nhóm | [14](14-sprint-status-reports.md), dashboard chi phí | Mỗi sprint | PM |
| Demo tính năng | Sponsor, người dùng thử | Sprint Review, bản web trên AWS | Mỗi sprint | PO |
| Thay đổi phạm vi | Sponsor, cả nhóm | [Change Log](17-change-log.md) + email/chat | Khi có thay đổi | PO/PM |
| Sự cố bản deploy | Dev ops, PM | Nhóm chat | Ngay | Người phát hiện |

**Quy tắc trao đổi:** câu hỏi kỹ thuật trả lời trong ngày làm việc; quyết định phạm vi phải ghi lại trên board
hoặc Change Log, không để lại chỉ trong chat; tài liệu dùng chung nằm trong repo (`docs/`).

## 5. Leo thang vấn đề

1. Người làm task tự xử lý (≤ 1 ngày).
2. Báo Scrum Master trong Daily; SM điều phối người hỗ trợ.
3. Ảnh hưởng mục tiêu sprint: PO quyết định cắt hoặc dời story.
4. Ảnh hưởng mốc, ngân sách > 10%, hoặc phạm vi dự án: PM báo Sponsor xin phê duyệt.
