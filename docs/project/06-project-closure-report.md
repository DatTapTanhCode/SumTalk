# Project Closure Report – Báo cáo kết thúc dự án

| | |
|---|---|
| Dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Mã tài liệu | SUMTALK-PCR |
| Phiên bản | 2.2 – 27/11/2026 |
| Người lập | Trần Phan Đăng Khôi |
| Người duyệt | Product Owner, Project Manager |
| Trạng thái | Chờ duyệt |

**Mục đích:** Khép lại dự án: phạm vi đã thoả thuận và tiêu chí nghiệm thu, các phiên bản đã phát hành, so sánh kế hoạch với thực tế, bài học kinh nghiệm và xác nhận đóng dự án.

> Ô `[CẦN ĐIỀN]` là số liệu đã có ở Azure Boards, dashboard chi phí hoặc biên bản họp nhưng chưa chép vào đây.
> **Giả định** là con số đặt ra để tính toán; bảng ghi rõ công thức để tính lại khi có số thật.
> Giờ công theo sprint, story point và số lỗi đọc từ Azure Boards ngày 27/11/2026; ngân sách và mốc lấy từ tài liệu 01.
> **Số dẫn xuất** (EV, EAC, CPI, SPI) được tính từ các số đó, không đọc trực tiếp từ board.

## Mục lục

1. [Statement of Work (SOW) và nghiệm thu](#sow)
2. [Release Notes](#release-notes)
3. [Báo cáo tổng kết và Lessons Learned](#lessons-learned)

## Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 12/11/2026 | Bản đầu, gồm các tài liệu riêng: 18-sow-acceptance, 20-release-notes, 21-lessons-learned | Đỗ Thành Đạt |
| 2.0 | 13/11/2026 | Gộp thành một tài liệu, đánh lại số mục (CR-08) | Đỗ Thành Đạt |
| 2.2 | 27/11/2026 | Bỏ vai trò Sponsor; điền giờ công, story point, số lỗi từ Azure Boards (27/11/2026) và tính CPI/SPI Sprint 2–4; cập nhật đánh giá M1–M6, bài học quản lý và xác nhận đóng dự án (nghiệm thu cuối 03/12/2026) | Đỗ Thành Đạt |

<a id="sow"></a>

## 1. Statement of Work (SOW) và nghiệm thu

**Tóm tắt:** thoả thuận giữa nhóm thực hiện và bên giao việc (Product Owner) về phạm vi giao, tiêu chí nghiệm thu và cách xử lý
thay đổi. Biên bản nghiệm thu ở mục 1.7 dùng cho từng mốc và lần nghiệm thu cuối.

### 1.1 Các bên

| Bên | Đại diện | Vai trò |
|---|---|---|
| Bên giao việc (khách hàng) | Product Owner – Nguyễn Phúc Điền | Duyệt phạm vi, nghiệm thu |
| Bên thực hiện | Nhóm SumTalk – Project Manager Trần Phan Đăng Khôi | Xây dựng, bàn giao |

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

- Cung cấp phản hồi trong Sprint Review; lần nghiệm thu cuối diễn ra ngày **03/12/2026**, sau khi bàn giao tại mốc M5 (27/11/2026).
- Cung cấp hoặc chấp nhận chi phí tài khoản AWS và API trong thời gian test (khoảng 2,5–3 triệu VND/tháng, cấu
  hình CPU).
- Cung cấp mẫu audio thật (tiếng Việt, họp trộn ngôn ngữ) cho đánh giá chất lượng, nếu có.

### 1.6 Quản lý thay đổi

Mọi yêu cầu thay đổi theo quy trình [Change Log](05-monitoring-and-control-report.md#change-log). Thay đổi làm tăng > 10% công sức hoặc dời mốc
phải được Product Owner đồng ý và Project Manager phê duyệt, theo phân quyền trong [Project Charter](01-project-initiation.md#charter); công sức phát sinh tính theo đơn giá 100.000 VND/giờ hoặc đổi lấy việc cắt hạng
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

Mỗi phiên bản liệt kê tính năng mới, thay đổi, lỗi đã sửa và hạn chế. Bản mới nhất ở trên cùng. Báo cáo dừng ở v0.4; Sprint 5 (chia sẻ cuộc họp, đặt tên và gắn tag) nằm ngoài báo cáo này.

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

**Hạn chế:** bộ cài chưa ký số; bản GPU của desktop là thư mục khoảng 2,5 GB (không đóng được NSIS); tại thời điểm
phát hành chưa deploy lên AWS thật. Hạn chế cuối đã được xử lý sau đó: bản web đã deploy lên AWS (mục 3.6).

### v0.3 – Tóm tắt và dịch (Sprint 3, mốc M3 30/10/2026)

**Nhánh:** `feature/sprint3-summary-translation`
- Tóm tắt tự động sau khi có transcript (#67, #68–#71): tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở;
  tạo lại bằng tiếng Việt/Anh; map-reduce cho transcript dài.
- Dịch transcript (#60, #61–#65): chọn ngôn ngữ, tiến độ, song ngữ, xuất TXT/SRT.
- Script đánh giá chất lượng (#66, #72); test E2E (#99, #100).
- Giao diện mới: sidebar, danh sách cuộc họp, recorder, player.

### v0.2 – Transcript live, chọn LLM (Sprint 2, mốc M2 09/10/2026)

Transcript live với độ trễ khoảng 3 s (chunk ghi âm 3 s) và benchmark các model LLM để chọn model cho tóm tắt và dịch.
Kết quả benchmark được lưu trên Wiki của dự án (theo xác nhận của nhóm). Báo cáo này chưa chép số liệu vì Wiki không truy cập được khi lập báo cáo; model được chọn là `gemma4:26b-a4b` (chạy qua Ollama), đặt làm mặc định cho tóm tắt và dịch trong `backend/.env.example` với ghi chú "chọn từ benchmark Sprint 2"; cấu hình mẫu cho bản AWS (`deploy/.env.example`) dùng `gpt-4o-mini` qua API.

### v0.1 – Ghi lại cuộc họp (Sprint 1, mốc M1 25/09/2026)

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

**Tóm tắt:** cả sáu mục tiêu M1–M6 đã đạt; chi phí Sprint 2–4 là 19,1 triệu VND so với ngân sách 17,7 triệu (CPI 0,93), theo dashboard chi phí của nhóm. Sprint 1 chỉ có giờ thực tế (28 giờ), không có giờ kế hoạch.
Sprint 5 (chia sẻ cuộc họp, đặt tên và gắn tag) chưa đóng trên Azure Boards (còn 2 story In Progress) nên nằm ngoài báo
cáo. Board không có Bug nào. Giờ công theo sprint đọc từ Azure Boards ngày 27/11/2026, giờ kế hoạch lấy từ dashboard chi phí của nhóm (ảnh chụp 13/11/2026); mốc lấy từ
[Project Charter](01-project-initiation.md#charter). Phần kỹ thuật ghi từ kinh nghiệm đến hết Sprint 4.

### 3.0 Đánh giá theo mục tiêu M1–M6 (27/11/2026)

Các bước kiểm chứng cuối (E2E trình duyệt, test case QC, deploy AWS) đã hoàn tất theo xác nhận của nhóm; kết quả
chính thức nằm ở biên bản nghiệm thu cuối ngày 03/12/2026.

| Mã | Mục tiêu | Bằng chứng | Đánh giá |
|---|---|---|---|
| M1 | Ghi âm hoặc tải file, transcript đúng ngôn ngữ người nói | Story E1, E2 Done; chạy trên Chrome/Edge, điện thoại, app Windows; E2E trình duyệt đã chạy lại sau Sprint 4 | ✔ Đạt |
| M2 | Transcript hiện trực tiếp khi đang nói | Từ mới khoảng 1 s, câu chốt trung bình 1,9 s (mục tiêu ≤ 3–5 s) | ✔ Đạt |
| M3 | Tóm tắt và dịch Việt ↔ Anh | Story #67, #60 Done, test tự động đạt; 23 test case thủ công đã chạy xong | ✔ Đạt |
| M4 | Xử lý cuộc họp từ 60 phút trở lên | File 11,6 phút xong trong 18–57 s, dòng đầu sau 3–5 s; tóm tắt map-reduce cho transcript dài | ✔ Đạt |
| M5 | Bản web trên AWS và bộ cài Windows | Bộ cài v0.4 đạt smoke test 8/8; bản web đã deploy lên AWS thật | ✔ Đạt |
| M6 | Nằm trong ngân sách (CPI ≥ 0,9) | CPI 0,93 cho Sprint 2–4: 19,1 triệu VND so với ngân sách 17,7 triệu (mục 3.1) | ✔ Đạt (Sprint 2–4) |

M2 và M4 đạt với khoảng cách lớn so với ngưỡng. M6 đạt với CPI 0,93 cho Sprint 2–4, sát ngưỡng 0,9 hơn các mục tiêu khác; CPI của cả dự án sẽ tính khi Sprint 5 đóng.

### 3.1 Kế hoạch so với thực tế

Giờ công theo sprint (Azure Boards, 27/11/2026). Giờ thực tế đọc từ Azure Boards (27/11/2026); giờ kế hoạch và CPI từng sprint lấy từ dashboard "6. Chi phí" của nhóm (ảnh chụp 13/11/2026). Sprint 1 không có giờ ước tính trên board và dashboard để trống; capacity của cả năm sprint chưa nhập. Vì vậy CPI, SPI chỉ tính cho Sprint 2–4. Giờ kế hoạch Sprint 2 trên board hiện là 73, đã chỉnh sau khi dashboard ghi 67; báo cáo dùng 67 như nhóm đã công bố. Story point mới nhập cho Sprint 1–2.

| Sprint | Thời gian | Giờ kế hoạch | Giờ thực tế | CPI | Story point |
|---|---|---|---|---|---|
| 1 | 11/09–25/09 | – | 28 | – | 25 |
| 2 | 25/09–09/10 | 67 | 76 | 0,88 | 28 |
| 3 | 19/10–30/10 | 61 | 64,5 | 0,95 | chưa nhập |
| 4 | 02/11–12/11 | 49 | 50,5 | 0,97 | chưa nhập |
| **Sprint 2–4** | | **177** | **191** | **0,93** | |
| Sprint 1–4 (giờ thực tế) | | | 219 | | |
| 5 (chưa đóng) | 13/11–27/11 | 38 | 43 | – | chưa nhập |

| Khía cạnh | Kế hoạch | Thực tế | Chênh lệch | Nguyên nhân |
|---|---|---|---|---|
| Phạm vi | E1–E4 (ghi âm, transcript, tóm tắt, dịch) | E1–E7 (thêm desktop, engine dùng chung, bản web AWS) | +3 epic | Thay đổi CR-03…CR-06 ([Change Log (nhật ký thay đổi phạm vi)](05-monitoring-and-control-report.md#change-log)) |
| Thời gian | Sprint 1–4 xong tại mốc M4 ngày 12/11/2026 | Sprint 1–4 xong đúng M4; Sprint 5 còn mở đến 27/11; nghiệm thu cuối 03/12/2026 | Sprint 1–4 đúng hạn | Sprint 3 và 4 rút còn 10–11 ngày |
| Chi phí nhân công (Sprint 2–4) | BAC 17.700.000 VND (177 giờ) | AC 19.100.000 VND (191 giờ) | VAC = −1.400.000 VND (−7,9%) | Dùng khoảng 45% dự phòng 10% (3.130.000 VND) |
| CPI / SPI (Sprint 2–4) | 1,0 / 1,0 | 0,93 / 1,00 | CPI −0,07 | EV = BAC vì Sprint 2–4 hoàn tất |
| Chi phí đến nay, gồm Sprint 5 | BAC 24.300.000 VND (243 giờ, dashboard; Sprint 1 tính bằng giờ thực tế 28) | 262 giờ (26.200.000 VND), board 27/11/2026 | +19 giờ (+7,8%), Sprint 5 chưa đóng | Dashboard dự báo 261,5 giờ khi hoàn thành. Tài liệu 01 ghi 253 giờ kế hoạch và 264,5 giờ thực tế, không khớp dashboard |
| Chất lượng | 0 lỗi Critical/High khi phát hành | 88/88 pytest đạt, smoke test desktop 8/8, ruff sạch; Azure Boards không có Bug nào | Đạt | |
| Hiệu năng live | ≤ 3–5 s | khoảng 1–2 s | tốt hơn mục tiêu | Chunk 1 s, LocalAgreement, engine GPU/remote |

**Cách tính (số dẫn xuất, Sprint 2–4).** Vì mọi story của các sprint này đã Done, EV = BAC = 17,70 triệu VND; PV tại mốc M4 cũng bằng BAC.

```latex
CPI = \frac{EV}{AC} = \frac{17{,}70}{19{,}10} \approx 0{,}93 \qquad SPI = \frac{EV}{PV} = \frac{17{,}70}{17{,}70} = 1{,}00
EAC = \frac{BAC}{CPI} \approx 19{,}10 \qquad VAC = BAC - EAC \approx -1{,}40 \text{ triệu VND}
```

CPI 0,93 vẫn trên ngưỡng hành động 0,9, nhưng khoản vượt 1,4 triệu VND đã dùng khoảng 45% dự phòng, và CPI riêng Sprint 2 chỉ 0,88 (dưới ngưỡng). Sprint 5 đã tiêu 43 giờ nhưng còn hai
story In Progress nên chưa tính giá trị đạt được; nghiệm thu cuối 03/12/2026 được ghi riêng.

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
| Giờ thực tế Sprint 2–4 là 191 so với 177 giờ kế hoạch (+7,9%) trong khi phạm vi tăng 3 epic; Sprint 2 vượt nhiều nhất (CPI 0,88) | CPI 0,93; Sprint 5 đã tiêu thêm 43 giờ mà chưa đóng | Ước lượng lại giờ và đối chiếu với dự phòng mỗi khi duyệt thay đổi phạm vi; theo dõi CPI mỗi sprint |
| Board cập nhật chậm: Sprint 1 không có giờ ước tính và capacity chưa nhập, story point chỉ có ở Sprint 1–2, Sprint 5 còn mở dù code đã merge | Số liệu EVA phải dẫn xuất; tài liệu 01 (253 và 264,5 giờ) không khớp dashboard (243) và board (262) | Nhập ước tính và story point khi lập sprint; chuyển item sang Done ngay khi merge |
| Sprint 3 và 4 chỉ dài 10–11 ngày thay vì 2 tuần | Khó so sánh velocity giữa các sprint | Giữ độ dài sprint cố định; nếu phải rút, ghi rõ và hiệu chỉnh năng lực khi lập kế hoạch |
| Không có Sponsor: Project Manager vừa lập kế hoạch vừa phê duyệt thay đổi ngân sách > 10% | Thiếu người duyệt độc lập với người lập kế hoạch | Chọn người duyệt độc lập (Product Owner hoặc người ngoài nhóm) ngay từ khởi động |

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

Cả bốn hạng mục đã hoàn thành theo xác nhận của nhóm; các ngày còn trống cần bổ sung.

| Hạng mục | Trạng thái |
|---|---|
| Nghiệm thu cuối ([Statement of Work (SOW) và nghiệm thu](#sow)) | Đã hoàn thành, ngày 03/12/2026 |
| Bàn giao mã nguồn, bộ cài, URL, tài liệu | Đã hoàn thành, ngày 03/12/2026 |
| Gỡ tài nguyên AWS không dùng (EC2, Elastic IP, bucket) | Đã hoàn thành, ngày 03/12/2026 (cùng ngày nghiệm thu) |
| Lưu trữ tài liệu, biên bản | Đã hoàn thành, lưu trên Wiki của dự án (Azure DevOps) |

### 3.7 Việc còn lại để hoàn tất hồ sơ

1. Đóng Sprint 5 trên Azure Boards (2 story In Progress, 7 task Testing hoặc Ready for Release); khi đó tính CPI cả dự án; cập nhật tài liệu 01 (253 giờ kế hoạch, 264,5 giờ thực tế) theo dashboard và board (243 và 262 giờ), tính lại business case (NPV, ROI, thời gian hoàn vốn).
2. Chép số liệu benchmark từ Wiki vào v0.2, nếu cần đưa vào báo cáo.
3. Ký biên bản nghiệm thu cuối ngày 03/12/2026 (mẫu ở mục 1.7) và bảng phê duyệt dưới đây.

### 3.8 Phê duyệt

| Vai trò | Họ tên | Chữ ký | Ngày |
|---|---|---|---|
| Product Owner | Nguyễn Phúc Điền | | 03/12/2026 |
| Project Manager | Trần Phan Đăng Khôi | | 03/12/2026 |
