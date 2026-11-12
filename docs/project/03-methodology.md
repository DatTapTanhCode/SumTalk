# 03 – Lựa chọn phương pháp quản lý dự án

**Quyết định:** dùng **Scrum** (sprint [CẦN ĐIỀN: 1–2] tuần, backlog trên Azure Boards). Lý do chính: yêu cầu về
AI (độ chính xác STT, chất lượng tóm tắt) chỉ biết được sau khi thử, và phạm vi đã thay đổi nhiều lần (dời #60 vào
Sprint 3, thêm app desktop, streaming, deploy cloud). Waterfall sẽ khoá yêu cầu quá sớm.

## 1. Đặc điểm dự án ảnh hưởng tới lựa chọn

| Đặc điểm | SumTalk | Phương pháp phù hợp |
|---|---|---|
| Độ rõ của yêu cầu | Rõ ở mức tính năng, mơ hồ ở mức chất lượng AI (độ chính xác, độ trễ) | Lặp, đo, điều chỉnh |
| Rủi ro công nghệ | Cao: Whisper, LLM, GPU, trình duyệt, Electron | Làm POC sớm, demo mỗi sprint |
| Thay đổi phạm vi | Thường xuyên (xem [17](17-change-log.md)) | Backlog ưu tiên lại mỗi sprint |
| Nhóm | Nhỏ, bán thời gian, đa vai | Tự tổ chức, họp ngắn |
| Khách hàng/Sponsor | Giảng viên, muốn thấy tiến độ đều | Sprint Review có demo |
| Ràng buộc tài liệu | Môn học yêu cầu tài liệu quản lý | Scrum + tài liệu tối thiểu theo từng sprint |

## 2. So sánh

| Tiêu chí | Waterfall | **Scrum** | Kanban | Mô hình lai (Water-Scrum-Fall) |
|---|---|---|---|---|
| Yêu cầu thay đổi | Đắt, phải làm lại tài liệu | Rẻ, đưa vào sprint sau | Rẻ | Trung bình |
| Thấy sản phẩm chạy được | Cuối dự án | Mỗi sprint | Liên tục | Giữa dự án |
| Kiểm soát rủi ro kỹ thuật | Muộn | Sớm (POC Sprint 1, benchmark Sprint 2) | Sớm | Trung bình |
| Kế hoạch, ngân sách cố định | Tốt | Theo velocity, cần EVA bổ sung | Yếu | Tốt |
| Phù hợp nhóm sinh viên bán thời gian | Trung bình | Tốt (nhịp đều, mục tiêu ngắn) | Tốt nhưng khó chấm tiến độ | Trung bình |
| Đáp ứng yêu cầu tài liệu của môn | Tốt | Tốt khi bổ sung bộ tài liệu này | Yếu | Tốt |

## 3. Cách áp dụng Scrum trong dự án

- **Vai trò:** PO, Scrum Master/PM, Developers (gồm BA, QC). Xem [13](13-communication-raci.md).
- **Sự kiện:** Planning (Planning Poker), Daily, Refinement, Review (demo), Retrospective.
- **Artefact:** Product Backlog ([04](04-product-backlog-prd.md)), Sprint Backlog và burndown trên Azure Boards,
  Increment là nhánh feature chạy được, kèm test.
- **Bổ sung để đáp ứng môn học:** Charter, Business Case, WBS, CPM/Gantt, EVA, Risk Register là phần quản lý
  "bên ngoài" Scrum. Chúng được cập nhật mỗi sprint, không làm một lần rồi khoá.
- **Definition of Done** chung cho mọi story: xem [12](12-quality-test-plan.md).
- **Quản lý mã nguồn:** mỗi nhóm việc một nhánh `feature/...`, commit nhỏ theo task, PR trước khi merge vào
  `main` (xem [17](17-change-log.md), [20](20-release-notes.md)).

## 4. Hạn chế và cách bù

| Hạn chế của Scrum | Cách bù trong dự án |
|---|---|
| Khó cam kết ngày kết thúc và ngân sách | Velocity + CPM ([08](08-schedule-cpm-gantt.md)) + EVA ([15](15-earned-value.md)) |
| Dễ phình phạm vi | Change Log có PO duyệt, phân quyền trong Charter |
| Ít tài liệu | Bộ 21 tài liệu, README/ARCHITECTURE trong repo |
| Phụ thuộc kỷ luật họp | Daily ngắn, có thể họp không đồng bộ qua chat khi trùng lịch học |
