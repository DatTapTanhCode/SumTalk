# Project Closure Report – Báo cáo kết thúc dự án

| | |
|---|---|
| Dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Mã tài liệu | SUMTALK-PCR |
| Phiên bản | 2.0 – 13/11/2026 |
| Người lập | [CẦN ĐIỀN: Project Manager] |
| Người duyệt | Sponsor, Product Owner, Project Manager |
| Trạng thái | Chờ duyệt |

**Mục đích:** Khép lại dự án: phạm vi đã thoả thuận và tiêu chí nghiệm thu, các phiên bản đã phát hành, so sánh kế hoạch với thực tế, bài học kinh nghiệm và xác nhận đóng dự án.

> Ô `[CẦN ĐIỀN]` là số liệu đã có ở Azure Boards, dashboard chi phí hoặc biên bản họp nhưng chưa chép vào đây.
> **Giả định** là con số đặt ra để tính toán; bảng ghi rõ công thức để tính lại khi có số thật.

## Mục lục

1. [Statement of Work (SOW) và nghiệm thu](#sow)
2. [Release Notes](#release-notes)
3. [Báo cáo tổng kết và Lessons Learned](#lessons-learned)

## Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 12/11/2026 | Bản đầu, gồm các tài liệu riêng: 18-sow-acceptance, 20-release-notes, 21-lessons-learned | [CẦN ĐIỀN] |
| 2.0 | 13/11/2026 | Gộp thành một tài liệu, đánh lại số mục (CR-08) | [CẦN ĐIỀN] |

<a id="sow"></a>

## 1. Statement of Work (SOW) và nghiệm thu

**Tóm tắt:** thoả thuận giữa nhóm thực hiện và bên giao việc (Sponsor) về phạm vi giao, tiêu chí nghiệm thu và cách xử lý
thay đổi. Biên bản nghiệm thu ở mục 1.7 dùng cho từng mốc và lần nghiệm thu cuối.

### 1.1 Các bên

| Bên | Đại diện | Vai trò |
|---|---|---|
| Bên giao việc (khách hàng) | [CẦN ĐIỀN: đại diện Sponsor] | Phê duyệt phạm vi, nghiệm thu |
| Bên thực hiện | Nhóm SumTalk – [CẦN ĐIỀN: PM] | Xây dựng, bàn giao |

### 1.2 Mục đích

Xây dựng hệ thống SumTalk ghi âm, phiên âm, tóm tắt và dịch cuộc họp, theo mục tiêu trong
[Project Charter](01-project-initiation.md#charter).

### 1.3 Phạm vi công việc

| # | Hạng mục | Mô tả | Tiêu chí nghiệm thu |
|---|---|---|---|
| 1 | Ghi âm và upload | Trình duyệt, điện thoại (offline), upload ≤ 1 GB | AC của US1.1–US1.3 ([Product Backlog / PRD và mô tả tính năng](02-software-requirements-specification.md#product-backlog)) đạt; test E2E trình duyệt đạt |
| 2 | Transcript | Ngôn ngữ gốc theo câu, live ≤ 3–5 s, file ≥ 60 phút, xem/tìm/xuất | AC của US2.1–US2.4; NFR-P1, P2 ([Yêu cầu phi chức năng](02-software-requirements-specification.md#nfr)) |
| 3 | Tóm tắt | Story #67 | 7 AC của #67; test case S-01…S-11 |
| 4 | Dịch | Story #60 | 6 AC của #60; test case T-01…T-12 |
| 5 | App desktop | Bộ cài Windows | AC của US5.1; smoke test bản đóng gói 8/8 |
| 6 | Engine STT dùng chung | Remote, API `/v1` | AC của US6.1–US6.2 |
| 7 | Bản web trên AWS | Docker, HTTPS, đăng nhập, S3, hướng dẫn | AC của US7.1; checklist trong hướng dẫn deploy đạt trên AWS thật |
| 8 | Tài liệu | README, ARCHITECTURE, 6 tài liệu quản lý dự án, test case | Đủ file, không còn ô `[CẦN ĐIỀN]` ở phần bắt buộc |

**Ngoài phạm vi:** xem mục 1.3 của [Project Charter](01-project-initiation.md#charter) (tài khoản, diarization, app iOS/Android native, SLA thương mại).

### 1.4 Sản phẩm bàn giao và thời hạn

| Sản phẩm | Hình thức | Mốc |
|---|---|---|
| Mã nguồn | Repo GitHub, nhánh đã merge vào `main` | M5 |
| Bộ cài Windows | `SumTalk-Setup-<version>.exe` | M4 |
| Bản web | URL HTTPS + tài khoản test | M4 |
| Tài liệu | Thư mục `docs/` | M5 |
| Báo cáo test | [Test Summary Report](04-quality-and-test.md#test-summary) | M5 |

Mốc M0–M5: [Project Charter, mục 1.7](01-project-initiation.md#charter).

### 1.5 Giả định và trách nhiệm của bên giao việc

- Cung cấp phản hồi trong Sprint Review; nghiệm thu trong vòng [CẦN ĐIỀN: 3] ngày làm việc sau khi nhận bàn giao.
- Cung cấp hoặc chấp nhận chi phí tài khoản AWS và API trong thời gian test (khoảng 2,5–3 triệu VND/tháng, cấu
  hình CPU).
- Cung cấp mẫu audio thật (tiếng Việt, họp trộn ngôn ngữ) cho đánh giá chất lượng, nếu có.

### 1.6 Quản lý thay đổi

Mọi yêu cầu thay đổi theo quy trình [Change Log](05-monitoring-and-control-report.md#change-log). Thay đổi làm tăng > 10% công sức hoặc dời mốc
phải được bên giao việc ký duyệt; công sức phát sinh tính theo đơn giá 100.000 VND/giờ hoặc đổi lấy việc cắt hạng
mục Should/Could tương đương.

### 1.7 Mẫu biên bản nghiệm thu

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

<a id="release-notes"></a>

## 2. Release Notes

Mỗi phiên bản liệt kê tính năng mới, thay đổi, lỗi đã sửa và hạn chế. Bản mới nhất ở trên cùng.

### v0.4 – Desktop, transcript live dạng streaming, cloud (Sprint 4, 12/11/2026)

**Nhánh:** `feature/desktop-app` → `feature/streaming-stt` → `feature/aws-deploy` → `docs/project-management`

**Mới**
- App Windows (Electron): mở như phần mềm, backend tự chạy và tự tắt; thu âm thanh hệ thống (Zoom/Teams bản
  desktop) mà không cần chia sẻ tab; bộ cài `SumTalk-Setup-0.3.0.exe` (khoảng 200 MB).
- Transcript live "nói tới đâu hiện tới đó": từ mới hiện khoảng 1 s sau khi nói; chữ đã chắc chắn in đậm, phần
  đang sửa in nghiêng mờ.
- Engine STT remote (`STT_PROVIDER=remote`): dùng server GPU của nhóm, Groq hoặc OpenAI; máy khách không tải model.
- Server có API `/v1/audio/transcriptions` chuẩn OpenAI (bật bằng `STT_SERVER_API_KEYS`).
- File dài: chia đoạn 5 phút tại chỗ im lặng; dòng đầu hiện sau vài giây; 1 giờ audio mất 1,5–5 phút trên GPU.
- Bản web trên AWS: Dockerfile, Docker Compose + Caddy (HTTPS tự động, đăng nhập), lưu audio và sao lưu database
  trên S3, hướng dẫn deploy từng bước.
- Bộ cài có thể ghi sẵn cấu hình (`SUMTALK_DEFAULT_*`).

**Thay đổi**
- Chunk ghi âm 3 s → 1 s; polling khi ghi 1,5 s → 0,7 s; cửa sổ live tối đa 25 s → 15 s.
- Thêm thư viện `python-multipart` (server); `boto3` chỉ dùng cho bản server.

**Hạn chế:** bộ cài chưa ký số; bản GPU của desktop là thư mục khoảng 2,5 GB (không đóng được NSIS); chưa deploy
lên AWS thật.

### v0.3 – Tóm tắt và dịch (Sprint 3)

**Nhánh:** `feature/sprint3-summary-translation`
- Tóm tắt tự động sau khi có transcript (#67, #68–#71): tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở;
  tạo lại bằng tiếng Việt/Anh; map-reduce cho transcript dài.
- Dịch transcript (#60, #61–#65): chọn ngôn ngữ, tiến độ, song ngữ, xuất TXT/SRT.
- Script đánh giá chất lượng (#66, #72); test E2E (#99, #100).
- Giao diện mới: sidebar, danh sách cuộc họp, recorder, player.

### v0.2 – Transcript live, chọn LLM (Sprint 2)

[CẦN ĐIỀN: theo báo cáo Sprint 2: transcript live khoảng 3 s, kết quả benchmark và model LLM được chọn.]

### v0.1 – Ghi lại cuộc họp (Sprint 1)

**Commit:** `c483e36 Initial commit`, `163e2fa Update the UI`
- Ghi âm trên trình duyệt (micro, micro + âm thanh tab), offline trên điện thoại, upload file lớn, transcript
  ngôn ngữ gốc, xuất TXT/SRT/VTT/JSON/WAV.

### Mẫu cho phiên bản sau

```markdown
## vX.Y – <tên> (<sprint>, dd/mm/yyyy)
**Nhánh/tag:** …
**Mới:** …
**Thay đổi:** …
**Sửa lỗi:** … (ID Azure Boards)
**Hạn chế đã biết:** …
**Nâng cấp:** (bước cần làm khi cập nhật, ví dụ biến cấu hình mới)
```

<a id="lessons-learned"></a>

## 3. Báo cáo tổng kết và Lessons Learned

**Tóm tắt:** khung báo cáo cuối dự án: so sánh kế hoạch với thực tế (phạm vi, thời gian, chi phí, chất lượng) và
bài học. Phần kỹ thuật dưới đây ghi từ kinh nghiệm đến Sprint 4. Phần số liệu và bài học quản lý điền khi kết
thúc dự án [CẦN ĐIỀN].

### 3.1 Kế hoạch so với thực tế

| Khía cạnh | Kế hoạch | Thực tế | Chênh lệch | Nguyên nhân |
|---|---|---|---|---|
| Phạm vi | E1–E4 (ghi âm, transcript, tóm tắt, dịch) | E1–E7 (thêm desktop, engine dùng chung, bản web AWS) | +3 epic | Thay đổi CR-03…CR-06 ([Change Log (nhật ký thay đổi phạm vi)](05-monitoring-and-control-report.md#change-log)) |
| Thời gian | [CẦN ĐIỀN] sprint | [CẦN ĐIỀN] | | |
| Chi phí nhân công (BAC) | [CẦN ĐIỀN] | [CẦN ĐIỀN] (AC) | VAC = | |
| CPI / SPI cuối | 1,0 / 1,0 | [CẦN ĐIỀN] | | |
| Chất lượng | 0 lỗi Critical/High khi phát hành | [CẦN ĐIỀN] | | |
| Hiệu năng live | ≤ 3–5 s | khoảng 1–2 s | tốt hơn mục tiêu | Chunk 1 s, LocalAgreement, engine GPU/remote |

### 3.2 Điều làm tốt

- **Đo thay vì đoán:** độ trễ live và thời gian xử lý file dài được đo bằng script mô phỏng (số liệu ở
  [Test Summary Report](04-quality-and-test.md#test-summary)), nên tranh luận dựa trên số liệu.
- **Kiến trúc mở:** STT và LLM đều qua API chuẩn OpenAI. Đổi Ollama/Groq/OpenAI/server riêng chỉ bằng cấu hình;
  thêm engine remote mà không sửa pipeline.
- **Không mất dữ liệu:** lưu chunk trên máy trước khi gửi; khôi phục sau crash; backend desktop tự tắt khi app chết.
- **Test tự động nhanh** (STT giả, LLM mock, S3 giả lập): 88 test chạy khoảng 6 s, nên chạy được sau mỗi thay đổi.
- **Chia commit theo task trên nhánh feature:** dễ review, dễ map với Azure Boards.

### 3.3 Điều cần cải thiện

| Vấn đề | Tác động | Bài học / hành động |
|---|---|---|
| Nhiều thay đổi Sprint 3 nằm chưa commit trong máy khi bắt đầu Sprint 4 | Khó tách commit, dễ mất code | Commit và push sau mỗi task; không để thay đổi qua đêm |
| Push bị 403 do sai tài khoản/quyền repo (R11) | Code chỉ có ở một máy, không review được | Kiểm tra quyền repo cho mọi thành viên từ Sprint 1; mỗi người dùng tài khoản của mình |
| Phạm vi tăng 3 epic giữa dự án | Áp lực lịch và chi phí | Đánh giá tác động trước, cắt Should/Could tương ứng, ghi Change Log ngay |
| Live trên CPU chậm (cửa sổ tới 25 s phiên âm lại mỗi lần) | Chữ hiện muộn trên máy không có GPU | Thiết kế live phải tính chi phí mỗi lượt; có engine remote ngay từ đầu cho máy yếu |
| Bộ cài GPU quá lớn cho NSIS (> 2 GB) | Không có bộ cài GPU | Ưu tiên server GPU dùng chung thay vì GPU trên từng máy |
| [CẦN ĐIỀN: bài học quản lý từ retro: họp, ước lượng, phân công] | | |

### 3.4 Bài học kỹ thuật đáng giữ

1. Phiên âm live tốt cần ba thứ cùng lúc: chunk ngắn, cửa sổ ngắn (commit các từ mà hai lượt phiên âm đều cho
   kết quả giống nhau), và đường truyền kết quả nhanh (polling ngắn hoặc push).
2. Với họp trộn ngôn ngữ, nhận ngôn ngữ theo từng câu quan trọng hơn chọn model lớn hơn.
3. Mọi API bên ngoài phải có retry, back-off và thông báo lỗi rõ trên giao diện; lỗi key phải hiện ngay ở header.
4. Bản deploy POC chưa có tài khoản vẫn phải có HTTPS, đăng nhập, bucket private và IAM role tối thiểu.
5. Môi trường dev có thể gây lỗi khó thấy (ví dụ VS Code đặt `ELECTRON_RUN_AS_NODE=1`): script khởi động phải tự
   làm sạch môi trường.

### 3.5 Khuyến nghị cho giai đoạn sau

- Tài khoản và phân quyền trước khi cho người ngoài dùng thật.
- Nhận diện người nói; trang action items (#79); dịch trực tiếp (#84).
- Ký số bộ cài, tự cập nhật app; CI chạy test tự động trên mỗi Pull Request.
- Theo dõi chi phí API thật trong UAT để cập nhật Business Case ([Business Case](01-project-initiation.md#business-case)).

### 3.6 Xác nhận đóng dự án

| Hạng mục | Trạng thái |
|---|---|
| Nghiệm thu cuối ([Statement of Work (SOW) và nghiệm thu](#sow)) | [CẦN ĐIỀN] |
| Bàn giao mã nguồn, bộ cài, URL, tài liệu | [CẦN ĐIỀN] |
| Gỡ tài nguyên AWS không dùng (EC2, Elastic IP, bucket) | [CẦN ĐIỀN] |
| Lưu trữ tài liệu, biên bản | [CẦN ĐIỀN] |
