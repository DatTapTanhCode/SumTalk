# 16 – Biên bản họp và Retrospective

**Tóm tắt:** mẫu biên bản cho 4 loại họp Scrum và bảng kiểm tra độ đầy đủ. Nhóm đã có biên bản các buổi họp
[CẦN ĐIỀN: dán liên kết hoặc chép vào mục 4]. Mỗi sprint cần đủ Planning, Review và Retro; Daily chỉ cần ghi
vướng mắc.

## 1. Bảng kiểm tra độ đầy đủ

| Sprint | Planning | Review | Retrospective | Ghi chú |
|---|---|---|---|---|
| 1 | [ ] | [ ] | [ ] | |
| 2 | [ ] | [ ] | [ ] | Benchmark LLM; ghi rủi ro R1–R6 |
| 3 | [ ] | [ ] | [ ] | Quyết định dời #60 vào Sprint 3 |
| 4 | [ ] | [ ] | [ ] | Quyết định thêm desktop, streaming, cloud |

## 2. Mẫu biên bản

### Sprint Planning

```markdown
**Sprint N Planning** – ngày … – thành phần: … – chủ trì: SM
Mục tiêu sprint: …
Năng lực (giờ) từng người: …          Velocity tham chiếu: … SP
Story nhận vào (ID, SP, người nhận): …
Ước lượng: Planning Poker, các story phải vote lại: …
Rủi ro, phụ thuộc: …
Quyết định: …
```

### Sprint Review

```markdown
**Sprint N Review** – ngày … – thành phần: nhóm + Sponsor/giảng viên
Demo: (story – người demo – kết quả: chấp nhận / chưa)
Phản hồi của Sponsor/PO: …
Thay đổi backlog sau review: … (ghi vào Change Log nếu là thay đổi phạm vi)
Số liệu: SP Done …/…, giờ thực tế …, CPI …, SPI …
```

### Retrospective (Start – Stop – Continue)

```markdown
**Sprint N Retrospective** – ngày …
Điều tốt (Continue): …
Điều chưa tốt (Stop): …
Thử mới (Start): …
Hành động cải tiến (tối đa 3, có người phụ trách và hạn): …
Kiểm tra hành động của retro trước: đã làm / chưa
```

### Daily Scrum (chỉ ghi khi có vướng mắc)

```markdown
Ngày … – Vướng mắc: … – Người hỗ trợ: … – Hạn gỡ: …
```

## 3. Gợi ý nội dung Retrospective Sprint 4 (để nhóm thảo luận)

| Loại | Nội dung |
|---|---|
| Continue | Chia commit theo task, mỗi nhóm việc một nhánh; đo hiệu năng bằng script thay vì ước đoán |
| Continue | Có test tự động cho phần mới (live, STT remote, S3), chạy dưới 10 giây |
| Stop | Để nhiều thay đổi chưa commit trong máy quá lâu (Sprint 3 chưa commit khi bắt đầu Sprint 4) |
| Start | Kiểm tra quyền push repo ngay đầu sprint (sự cố 403 – R11) |
| Start | Deploy bản web sớm để QC test trên môi trường giống thật |

## 4. Lưu trữ biên bản

[CẦN ĐIỀN: liên kết tới biên bản các sprint (Azure Boards Wiki, Google Drive…), hoặc chép nội dung vào đây.]
