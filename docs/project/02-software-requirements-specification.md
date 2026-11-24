# Software Requirements Specification – Đặc tả yêu cầu phần mềm

| | |
|---|---|
| Dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Mã tài liệu | SUMTALK-SRS |
| Phiên bản | 2.0 – 13/11/2026 |
| Người lập | [CẦN ĐIỀN: Project Manager] |
| Người duyệt | Product Owner, đại diện nhóm phát triển, QC |
| Trạng thái | Chờ duyệt |

**Mục đích:** Mô tả sản phẩm SumTalk: người dùng, tính năng, user story và tiêu chí chấp nhận, yêu cầu phi chức năng đo được, và đặc tả giao diện. Tài liệu chỉ nói về sản phẩm; kế hoạch và cách quản lý nằm trong Kế hoạch quản lý dự án.

> Ô `[CẦN ĐIỀN]` là số liệu đã có ở Azure Boards, dashboard chi phí hoặc biên bản họp nhưng chưa chép vào đây.
> **Giả định** là con số đặt ra để tính toán; bảng ghi rõ công thức để tính lại khi có số thật.

## Mục lục

1. [Product Backlog / PRD và mô tả tính năng](#product-backlog)
2. [Yêu cầu phi chức năng](#nfr)
3. [Đặc tả UI/UX (giao diện v0.4)](#ui-ux)

## Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 12/11/2026 | Bản đầu, gồm các tài liệu riêng: 04-product-backlog-prd, 05-non-functional-requirements, 22-ui-ux-spec | [CẦN ĐIỀN] |
| 2.0 | 13/11/2026 | Gộp thành một tài liệu, đánh lại số mục (CR-08) | [CẦN ĐIỀN] |

<a id="product-backlog"></a>

## 1. Product Backlog / PRD và mô tả tính năng

**Sản phẩm:** SumTalk biến một cuộc họp (ghi âm trực tiếp hoặc file có sẵn) thành transcript đúng ngôn ngữ người
nói, kèm tóm tắt và bản dịch. Người dùng có thể dùng trên trình duyệt, điện thoại, app Windows, hoặc bản web
trên AWS. Backlog gồm 7 epic, 17 user story; trạng thái tính đến 12/11/2026.

> Story point (SP) là số đề xuất: [CẦN ĐIỀN: thay bằng điểm đã vote trên Azure Boards]. Mã #60, #67, #61–#72,
> #99, #100 là ID trên Azure Boards; T1.x là task của epic E1.
> Ưu tiên theo MoSCoW: M = Must, S = Should, C = Could, W = Won't (lần này).

### 1.1 Người dùng mục tiêu

| Persona | Nhu cầu | Thiết bị |
|---|---|---|
| Thư ký / người ghi biên bản | Có transcript và biên bản ngay sau họp, sửa ít | Laptop (Chrome/Edge, app Windows) |
| Trưởng nhóm / quản lý | Đọc nhanh quyết định, việc cần làm; chia sẻ cho người vắng | Laptop, điện thoại |
| Thành viên họp đa ngôn ngữ | Đọc nội dung bằng tiếng mình (Việt ↔ Anh) | Bất kỳ |
| Người dùng không có GPU | Phiên âm nhanh, không phải cài model nặng | Laptop văn phòng |

### 1.2 Mô tả tính năng theo module

| Module | Tính năng | Trạng thái |
|---|---|---|
| Ghi âm | Bắt đầu/tạm dừng/tiếp tục/dừng, đồng hồ, đo mức âm; nguồn: micro hoặc micro + âm thanh cuộc họp (trình duyệt: chia sẻ tab; app Windows: thu thẳng âm thanh hệ thống); audio lưu trên máy trước rồi gửi mỗi 1 s | Xong |
| Offline/điện thoại | Ghi khi mất mạng, chunk chờ trong IndexedDB và tự gửi khi có mạng; giữ màn hình sáng; cài như app (PWA); khôi phục sau crash | Xong |
| Upload | Kéo thả MP3, WAV, M4A, AAC, OGG/Opus, WEBM, FLAC, WMA, AMR, MP4/MOV/MKV; tối đa 1 GB; gửi theo phần 8 MB, 3 phần song song, tiếp tục khi rớt mạng; chuẩn hoá WAV 16 kHz mono | Xong |
| Phiên âm (STT) | Whisper; nhận ngôn ngữ từng câu để họp trộn Anh–Việt giữ nguyên ngôn ngữ; lọc chữ "ảo"; engine local (GPU/CPU) hoặc remote (server GPU, Groq, OpenAI) | Xong |
| Transcript live | Từ mới hiện khoảng 1 s sau khi nói, câu chốt sau khoảng 2 s; phần chắc chắn chữ đậm, phần đang sửa chữ nghiêng mờ | Xong (Sprint 4) |
| File dài | Chia đoạn 5 phút tại chỗ im lặng; hiện các dòng đầu sau vài giây; 1 giờ audio xử lý trong 1,5–5 phút trên GPU | Xong (Sprint 4) |
| Trang cuộc họp | Trạng thái, tiến độ; phát audio đồng bộ transcript (bấm dòng để tua); tìm kiếm; sao chép; xuất TXT/SRT/VTT/JSON/WAV; đổi tên; phiên âm lại với ngôn ngữ cố định; xoá | Xong |
| Tóm tắt (#67) | Tự tạo sau khi có transcript: tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở; tạo lại bằng tiếng Việt/Anh; transcript dài dùng map-reduce; lỗi thì có Thử lại | Xong (Sprint 3) |
| Dịch (#60) | Chọn ngôn ngữ đích; thanh tiến độ; song ngữ theo từng dòng; dòng đã đúng ngôn ngữ thì giữ nguyên; lưu lại; xuất TXT/SRT (chỉ bản dịch hoặc song ngữ) | Xong (Sprint 3) |
| App desktop | App Windows (Electron) tự chạy backend; bộ cài NSIS; menu cài đặt/log/dữ liệu; có thể ghi sẵn cấu hình engine remote lúc build | Xong (Sprint 4) |
| Bản web trên AWS | Docker + Caddy (HTTPS, đăng nhập); audio và backup database lên S3; hướng dẫn deploy | Xong (Sprint 4) |

### 1.3 Product Backlog

#### E1 – Ghi lại cuộc họp

| ID | User story | Acceptance criteria (tóm tắt) | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US1.1 (T1.1.1–T1.1.5) | Là thư ký, tôi muốn ghi âm cuộc họp ngay trên trình duyệt để không cần phần mềm khác | 1) Start/Pause/Resume/Stop và đồng hồ; 2) ghi được micro, hoặc micro + âm thanh tab họp; 3) audio gửi theo chunk; 4) Stop thì tạo meeting mới; 5) chạy trên Chrome và Edge | M | 13 | Done |
| US1.2 (T1.2.1–T1.2.5) | Là người dùng điện thoại, tôi muốn ghi âm cả khi mất mạng để không mất nội dung | 1) Giao diện ghi âm trên điện thoại; 2) màn hình giữ sáng; 3) lưu audio khi offline; 4) tự gửi khi có mạng lại; 5) test trên Android/iOS | M | 13 | Done (iOS khoá màn hình: hạn chế) |
| US1.3 (T1.3.1–T1.3.5) | Là người dùng, tôi muốn tải file ghi âm có sẵn để lấy transcript | 1) Màn hình upload kéo thả; 2) kiểm tra định dạng và dung lượng trước khi gửi; 3) gửi file lớn theo phần, tiếp tục khi rớt mạng; 4) chuẩn hoá audio; 5) tạo meeting từ file | M | 8 | Done |

#### E2 – Transcript

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US2.1 | Là thành viên họp trộn ngôn ngữ, tôi muốn transcript giữ đúng ngôn ngữ từng người nói | 1) Câu tiếng Anh giữ tiếng Anh, câu tiếng Việt giữ tiếng Việt, không tự dịch; 2) có nhãn ngôn ngữ từng dòng; 3) có thể chọn cố định ngôn ngữ và phiên âm lại | M | 8 | Done |
| US2.2 | Là thư ký, tôi muốn thấy chữ hiện ngay khi người khác đang nói | 1) Chữ hiện trễ ≤ 3–5 s (đo được: khoảng 1 s cho từ mới); 2) hiện dần theo lời nói, không đợi hết câu; 3) không cắt đôi từ; 4) sau khi Stop có bản cuối chính xác thay thế | M | 13 | Done |
| US2.3 | Là người dùng, tôi muốn xem lại, tìm, nghe lại và xuất transcript | 1) Phát audio đồng bộ, bấm dòng để tua; 2) tìm kiếm; 3) xuất TXT/SRT/VTT/JSON/WAV; 4) đổi tên, xoá | M | 8 | Done |
| US2.4 | Là người dùng, tôi muốn xử lý cuộc họp dài 1 giờ trở lên | 1) Không lỗi, không hết bộ nhớ; 2) thấy dòng đầu sau vài giây; 3) tiến độ đúng; 4) trên GPU, 1 giờ xử lý ≤ 10 phút | M | 5 | Done |

#### E3 – Tóm tắt (#67)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| #67 | Là quản lý, tôi muốn có biên bản tóm tắt tự động sau mỗi cuộc họp | 1) Tự tạo sau khi có transcript cuối; 2) có đủ các mục tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở; 3) đúng ngôn ngữ chọn (vi/en), kể cả họp trộn, giữ thuật ngữ tiếng Anh; 4) không bịa người, số liệu, quyết định; 5) cuộc họp ≥ 60 phút vẫn tóm tắt được (map-reduce); 6) Regenerate có hỏi xác nhận và bị khoá khi đang chạy; 7) lỗi model thì báo lỗi và có Thử lại, không chạy lại STT | M | 18 (#68 5, #69 5, #70 5, #71 3); #72 tính chung với #66 | Done |

#### E4 – Dịch (#60)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| #60 | Là thành viên không giỏi tiếng Anh/Việt, tôi muốn đọc transcript bằng ngôn ngữ của mình | 1) Chọn ngôn ngữ đích (ít nhất Việt, Anh); 2) có thanh tiến độ, xong thì mọi dòng có bản dịch; 3) dòng đã đúng ngôn ngữ thì giữ nguyên và có nhãn; 4) hiển thị song ngữ theo dòng (điện thoại xếp dọc); 5) đã dịch thì lưu lại, mở lại không dịch lại; 6) xuất TXT/SRT, chỉ bản dịch hoặc song ngữ | M | 19 (#61 3, #62 3, #63 3, #64 3, #65 2, #66 + #72 5) | Done |

#### E5 – App desktop

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US5.1 | Là người dùng Windows, tôi muốn cài SumTalk như một phần mềm, không cần mở trình duyệt | 1) Bộ cài Windows, có shortcut; 2) mở app thì backend tự chạy, đóng thì tự tắt (kể cả crash); 3) micro và âm thanh hệ thống dùng được; 4) đóng khi đang ghi thì có hỏi; 5) có menu cài đặt, log, thư mục dữ liệu | S | 8 | Done |

#### E6 – Engine STT dùng chung (máy khách không cần model)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US6.1 | Là người dùng không có GPU, tôi muốn phiên âm nhanh và chính xác mà không phải tải model | 1) App/server cấu hình `STT_PROVIDER=remote`, không tải model; 2) độ chính xác bằng `large-v3-turbo`; 3) độ trễ live tương đương local GPU; 4) lỗi key/mạng hiện rõ trên header | M | 8 | Done |
| US6.2 | Là quản trị, tôi muốn server GPU của nhóm làm engine cho mọi app desktop | 1) API chuẩn OpenAI `/v1/audio/transcriptions` có API key; 2) trả ngôn ngữ từng đoạn; 3) bộ cài có thể ghi sẵn địa chỉ server | S | 5 | Done |

#### E7 – Triển khai web

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US7.1 | Là QC/khách hàng, tôi muốn dùng thử SumTalk qua một đường link mà không cài gì | 1) HTTPS, có trang đăng nhập; 2) audio lưu trên S3 private, phát qua link có hạn; 3) database tự sao lưu; 4) có hướng dẫn deploy từng bước và gỡ bỏ | S | 8 | Done (chờ deploy thật lên AWS) |

#### Backlog tương lai (chưa làm)

| ID | User story | MoSCoW |
|---|---|---|
| #79 | Trang việc cần làm (action items) liên kết tới đoạn transcript | S |
| #84 | Dịch trực tiếp khi đang họp | C |
| US8.1 | Nhận diện người nói (diarization), thêm "Người nói:" vào biên bản và file xuất | S |
| US8.2 | Tài khoản, phân quyền, chia sẻ cuộc họp | S (bắt buộc trước khi thương mại) |
| US8.3 | App iOS/Android native (ghi khi khoá màn hình) | C |
| US8.4 | Tự cập nhật app desktop, ký số bộ cài | C |

### 1.4 Definition of Ready

Story được đưa vào sprint khi đã có: mô tả theo mẫu "Là… tôi muốn… để…", acceptance criteria kiểm tra được, SP đã
ước lượng, phụ thuộc đã rõ, có thiết kế UI nếu story có giao diện.

Definition of Done: xem [Quality Plan và Test Plan](04-quality-and-test.md#quality-plan).

<a id="nfr"></a>

## 2. Yêu cầu phi chức năng

**Tóm tắt:** các yêu cầu đo được về hiệu năng, độ chính xác, bảo mật, độ tin cậy và khả năng dùng. Cột "Hiện
trạng" ghi kết quả đo thật ngày 12/11/2026 (laptop RTX 4050). Ô `[CẦN ĐIỀN]` là số cần đo trong UAT.

> Một phần các yêu cầu này đã có trong tài liệu Requirements & UI/UX của Sprint 1.
> [CẦN ĐIỀN: đối chiếu và giữ mã yêu cầu cũ nếu có.]
> Đặc tả giao diện theo bản hiện tại (v0.4): [22 – Đặc tả UI/UX](#ui-ux).

### 2.1 Hiệu năng

| Mã | Yêu cầu | Mục tiêu | Hiện trạng | Cách đo |
|---|---|---|---|---|
| NFR-P1 | Độ trễ transcript live (từ lúc nói tới lúc chữ hiện) | ≤ 3–5 s | Từ mới khoảng 1 s; câu chốt TB 1,9 s, tối đa 2,3 s (GPU local và remote như nhau) | Script mô phỏng ghi âm thời gian thực, file speech_en 17 s |
| NFR-P2 | Thời gian xử lý file sau upload | 1 giờ audio ≤ 10 phút trên GPU | 11,6 phút: 57 s (local GPU, 12× realtime), 18 s (remote, 39×) | Upload file dài, đo đến trạng thái Done |
| NFR-P3 | Thời gian thấy kết quả đầu tiên của file dài | ≤ 10 s | 3–5 s | như trên |
| NFR-P4 | Tạo tóm tắt | ≤ 2 phút cho cuộc họp 60 phút (LLM cloud) | [CẦN ĐIỀN] | Log token/thời gian từng lần chạy |
| NFR-P5 | Khởi động app desktop đến lúc dùng được | ≤ 10 s (chưa tính tải model lần đầu) | 1,5–1,9 s | Smoke test desktop |
| NFR-P6 | Chi phí mỗi lượt live không tăng theo độ dài buổi họp | O(1) mỗi lượt | Quét thư mục một lần, cửa sổ ≤ 15 s | Review code, test 1 giờ |

### 2.2 Độ chính xác

| Mã | Yêu cầu | Mục tiêu | Hiện trạng |
|---|---|---|---|
| NFR-A1 | Lỗi từ (WER) tiếng Anh, audio rõ | ≤ 10% | File mẫu speech_en: transcript đúng từng câu |
| NFR-A2 | WER tiếng Việt | ≤ 15% | [CẦN ĐIỀN: đo trên mẫu UAT] |
| NFR-A3 | Họp trộn Anh–Việt: câu nào giữ ngôn ngữ câu đó, không tự dịch | ≥ 95% số câu | [CẦN ĐIỀN] (xem ảnh `docs/screenshots/meeting-mixed-language.png`) |
| NFR-A4 | Tóm tắt không bịa sự kiện | 0 lỗi nghiêm trọng / mẫu | [CẦN ĐIỀN] – `backend/scripts/eval_summary.py` (ROUGE-L, độ phủ quyết định) |
| NFR-A5 | Chất lượng dịch | chrF++ ≥ [CẦN ĐIỀN] | `backend/scripts/eval_translation.py` |

### 2.3 Dung lượng và giới hạn

| Mã | Yêu cầu | Giá trị |
|---|---|---|
| NFR-C1 | Kích thước file upload tối đa | 1 GB (`MAX_UPLOAD_MB`) |
| NFR-C2 | Định dạng nhận | MP3, WAV, M4A, AAC, OGG/Opus, WEBM, FLAC, WMA, AMR, 3GP, MP4/MOV/MKV |
| NFR-C3 | Độ dài cuộc họp | ≥ 60 phút cho cả ghi âm, upload, tóm tắt (đoạn 5 phút, map-reduce) |
| NFR-C4 | Bộ nhớ khi xử lý file dài | Không phụ thuộc độ dài (đọc từng đoạn) |
| NFR-C5 | Bộ cài desktop | khoảng 200 MB, cài vào khoảng 630 MB; không tải model khi dùng engine remote |

### 2.4 Bảo mật và quyền riêng tư

| Mã | Yêu cầu |
|---|---|
| NFR-S1 | Mặc định xử lý local, không gửi audio ra ngoài; chỉ gửi khi quản trị cấu hình engine remote hoặc LLM cloud |
| NFR-S2 | Bản deploy: bắt buộc HTTPS; trang đăng nhập cho bản test; `/v1` cần API key |
| NFR-S3 | S3 private (Block Public Access), phát qua presigned URL có hạn (mặc định 3 giờ); EC2 dùng IAM role quyền tối thiểu, không lưu access key |
| NFR-S4 | Không commit bí mật (`.env`, `deploy/.env` trong `.gitignore`); API key có thể thu hồi |
| NFR-S5 | App desktop: trang web không có quyền Node.js (context isolation, sandbox); quyền micro chỉ cấp cho trang của app |
| NFR-S6 | Trước khi thương mại: tài khoản, phân quyền, chính sách lưu giữ audio (ngoài phạm vi bản này) |

### 2.5 Độ tin cậy

| Mã | Yêu cầu |
|---|---|
| NFR-R1 | Không mất audio khi rớt mạng, đóng tab, crash (chunk lưu trên máy trước, tự đồng bộ, khôi phục) |
| NFR-R2 | Job tóm tắt/dịch không bao giờ treo: retry, giới hạn thời gian, trạng thái cuối là done hoặc failed |
| NFR-R3 | Server khởi động lại thì tiếp tục job dở dang |
| NFR-R4 | App desktop tắt thì backend tắt theo (kể cả khi app crash) |
| NFR-R5 | Database được sao lưu lên S3 mỗi 6 giờ (bản deploy) |
| NFR-R6 | API bên ngoài lỗi 429/5xx: retry có back-off; lỗi key hiện rõ trên giao diện |

### 2.6 Khả năng dùng và tương thích

| Mã | Yêu cầu |
|---|---|
| NFR-U1 | Chrome và Edge desktop (test tự động); Firefox/Safari kiểm tra tay; Android Chrome; iOS Safari (hạn chế khi khoá màn hình) |
| NFR-U2 | Giao diện responsive tới 360 px, không cuộn ngang |
| NFR-U3 | Windows 10/11 cho app desktop |
| NFR-U4 | Thông báo lỗi bằng lời dễ hiểu, kèm hướng xử lý (ví dụ quyền micro trên Windows) |
| NFR-U5 | Giao diện tiếng Anh; tóm tắt và dịch hỗ trợ tiếng Việt và tiếng Anh |

### 2.7 Bảo trì và triển khai

| Mã | Yêu cầu |
|---|---|
| NFR-M1 | Test tự động: pytest backend (88 test), Playwright trình duyệt và desktop; ruff sạch |
| NFR-M2 | Cấu hình bằng biến môi trường/file `.env`, không sửa code khi đổi model, engine, nơi lưu |
| NFR-M3 | Deploy lặp lại được bằng Docker Compose; cập nhật bằng một lệnh (`deploy/scripts/update.sh`) |
| NFR-M4 | Đổi nhà cung cấp LLM/STT chỉ bằng cấu hình (API chuẩn OpenAI) |

<a id="ui-ux"></a>

## 3. Đặc tả UI/UX (giao diện v0.4)

**Tóm tắt:** mô tả giao diện SumTalk v0.4 đúng như đang chạy: hệ thống thiết kế, bố cục, từng màn hình, các
trạng thái, hộp thoại, khác biệt giữa máy tính, điện thoại và app desktop. Dùng để review UI, viết test case và
làm cơ sở khi thay đổi giao diện.

**Nguồn:**
- Mã nguồn `frontend/src` trên nhánh `docs/project-management`, ngày 12/11/2026.
- Ảnh chụp từ app chạy thật bằng Playwright: máy tính 1440×900, điện thoại 390×844.
- Dữ liệu trong ảnh là dữ liệu mẫu. Server chạy với `AI_MOCK=true`, nên nội dung tab Summary và Translation là
  chữ mẫu (ví dụ "Bản tóm tắt thử nghiệm (mock)", "[vi] …"); bố cục giống hệt khi dùng LLM thật.

Chữ trên giao diện hiện là **tiếng Anh**. Tài liệu giữ nguyên nhãn tiếng Anh (in đậm) để đối chiếu với app.

### 3.1 Nguyên tắc thiết kế

| # | Nguyên tắc | Thể hiện trên giao diện |
|---|---|---|
| P1 | **Không mất dữ liệu, và cho người dùng thấy điều đó** | Màn ghi âm luôn hiện số chunk đã lưu trên máy và đã gửi; chip kết nối báo Offline và số chunk đang chờ |
| P2 | **Phản hồi tức thì** | Transcript hiện trong lúc nói; phần chữ đã chốt in thường, phần còn có thể sửa in nghiêng xám |
| P3 | **Giữ đúng ngôn ngữ gốc** | Mỗi dòng giữ ngôn ngữ người nói dùng; dòng khác ngôn ngữ chính có nhãn mã ngôn ngữ |
| P4 | **Phong cách "thiết bị đo"** | Đen trắng, font mono cho nhãn, font số kiểu LED cho thời gian; đỏ chỉ dùng cho đang ghi và lỗi |
| P5 | **Một việc chính mỗi màn hình** | Ghi âm, upload, xem cuộc họp tách thành màn riêng; nút chính màu đen, nút phụ màu trắng có viền |
| P6 | **Chạy tốt trên điện thoại** | Thanh menu dưới với nút Record nổi lên; màn hình giữ sáng khi ghi; vùng chạm ≥ 44 px cho nút chính |

### 3.2 Hệ thống thiết kế

#### 3.2.1 Màu (light theme, `frontend/src/index.css`)

| Token | Mã màu | Dùng cho |
|---|---|---|
| `--background` | `#f2f2f0` | Nền trang, có lưới mờ (`--grid-line`) |
| `--card` | `#ffffff` | Thẻ, bảng, ô nhập |
| `--foreground` / `--primary` | `#0a0a0a` | Chữ chính, nút chính, viền đang chọn |
| `--muted-foreground` | `#6e6e6b` | Chữ phụ, nhãn, mô tả |
| `--secondary` / `--muted` | `#e9e9e6` | Nền hover, tab không chọn, skeleton |
| `--border` / `--input` | `#deddd8` / `#d2d1cc` | Viền thẻ, viền ô nhập |
| `--live` / `--destructive` | `#d71921` | Đang ghi, lỗi, nút xoá, số lỗi > 0 |
| `--live-soft` | `#fbeaea` | Nền badge "Recording" |
| `--online` | `#12b76a` | Chấm "Online" (chỗ duy nhất có màu xanh) |
| `--sidebar` | `#f7f7f5` | Nền thanh phát audio |

Chỉ có giao diện sáng; chưa có dark mode (xem mục 3.11).

#### 3.2.2 Chữ

| Vai trò | Font | Cỡ, kiểu |
|---|---|---|
| Nội dung, tiêu đề | Geist Variable | Tiêu đề trang 28 px đậm, chữ thường 16 px |
| Eyebrow trên tiêu đề trang | Geist Mono Variable | 16 px, IN HOA, giãn chữ 0,16 em, màu xám |
| Nhãn ô nhập, badge, chip, tiêu đề cột | Geist Mono Variable | 10–11 px, IN HOA, giãn chữ 0,08–0,14 em |
| Thời gian, thời lượng, số đếm, % | Handjet Variable (`.digital`) | Đồng hồ ghi âm 72 px (điện thoại) / 88 px (máy tính) |

#### 3.2.3 Hình khối và thành phần chung

- **Bo góc:** 6 px cho nút và thẻ; 3 px cho badge và chip.
- **Thẻ (`Card`):** nền trắng, viền 1 px. Thẻ quan trọng có dấu góc kiểu bản vẽ kỹ thuật (`.panel-ticks`).
- **Eyebrow:** nhãn nhỏ phía trên tiêu đề trang, ví dụ `LIBRARY`, `RECORDER / 01`, `INGEST / 02`.
- **Nút:** chính (nền đen, chữ trắng), phụ (nền trắng, viền), ghost (chỉ icon), destructive (nền đỏ).
- **Notice:** khung thông báo có vạch trái; đen là thông tin, xám là cảnh báo, đỏ là lỗi. Có thể kèm tiêu đề và
  nút hành động bên phải.
- **ProgressBar:** vạch đen cao 4 px. Khi chưa biết tiến độ, một đoạn chạy qua lại liên tục.
- **StatusBadge:** khung 1 px, chấm vuông, chữ mono. Trạng thái đang xử lý thì chấm nhấp nháy.

| Trạng thái cuộc họp | Nhãn | Màu |
|---|---|---|
| `recording` | **Recording** | Đỏ, nền đỏ nhạt, nhấp nháy |
| `uploading` | **Uploading** | Đen, nhấp nháy |
| `queued` | **Queued** | Xám |
| `processing` | **Preparing audio** | Đen, nhấp nháy |
| `transcribing` | **Transcribing 42%** | Nền xám, nhấp nháy, kèm % |
| `done` | **Ready** | Đen |
| `failed` | **Failed** | Đỏ |
| (chỉ có trên máy) | **On this device** | Xám |

### 3.3 Bố cục và responsive

| Độ rộng | Bố cục |
|---|---|
| < 768 px (điện thoại) | Thanh trên (logo, pill đang ghi, chip mất mạng); thanh menu dưới 3 mục, nút **Record** nổi lên giữa; nội dung một cột |
| ≥ 768 px (tablet, máy tính) | Sidebar trái cố định 240 px; bảng cuộc họp hiện đủ cột |
| ≥ 1024 px | Màn ghi âm và màn cuộc họp chia hai cột; khung chi tiết cuộc họp hiện bên phải |

Nội dung rộng tối đa 1152 px, căn giữa.

**Sidebar (máy tính)**, từ trên xuống:
1. Logo SumTalk (ô vuông chấm kiểu LED) và nhãn `POC`. Khi đang ghi âm, logo có chấm đỏ.
2. Nút **+ New recording**.
3. Menu **Meetings / Record / Upload**. Mục đang mở có nền trắng và vạch đen bên trái.
4. **Pill đang ghi** (đỏ, `REC 00:12`): chỉ hiện khi đang ghi mà người dùng đang ở màn khác; bấm để quay lại màn ghi.
5. Khu **System** ở đáy: chip kết nối và chip engine nhận dạng giọng nói (mục 3.8).

```mermaid
flowchart LR
  M["Meetings /"] -->|New recording| R["Record /record"]
  M -->|Upload audio| U["Upload /upload"]
  M -->|Bấm một dòng| D["Meeting /meetings/:id"]
  R -->|Stop| D
  U -->|Upload & transcribe xong| D
  D -->|Breadcrumb Meetings| M
  D --- T1[Transcript] & T2[Summary] & T3[Translation]
  X["URL sai"] --> NF["404 Page not found"] --> M
```

### 3.4 S1 – Danh sách cuộc họp (`/`)

**Mục đích:** xem, tìm và mở các cuộc họp; bắt đầu ghi hoặc upload. **Story:** US2.3.

![Danh sách cuộc họp](../screenshots/ui-spec/meetings-list.png)

| Khu vực | Thành phần và hành vi |
|---|---|
| Tiêu đề | Eyebrow `LIBRARY`, tiêu đề **Meetings**, dòng tổng "4 meetings · 12m 23s of audio". Nút **Upload audio**; trên điện thoại có thêm nút **Record** |
| Tab lọc | **All / Transcribed / In progress / Failed**, kèm số lượng. Số **Failed** chuyển đỏ khi > 0. Tab **In progress** hiện thêm dòng "~Xm of transcription left" |
| Tìm kiếm | Ô **Search titles** lọc theo tên khi đang gõ; có nút × để xoá |
| Sắp xếp | **Newest first / Oldest first / Longest first / Title A–Z**. Hai kiểu theo ngày thì nhóm thành **Today / Yesterday / Last 7 days / Earlier** theo ngày lịch |
| Bảng (≥ 768 px) | Cột **Name, Date, Duration, Language, Status** và nút ⋯. Icon micro là bản ghi âm, icon file là bản upload. Bấm vào bất kỳ chỗ nào của dòng để mở cuộc họp |
| Dòng (điện thoại) | Tên, rồi một dòng phụ gồm ngày · thời lượng · ngôn ngữ; badge trạng thái bên phải |
| Menu ⋯ | **Rename**: sửa tên ngay trên dòng (Enter lưu, Esc huỷ, bấm ra ngoài cũng lưu). **Delete**: mở hộp thoại xác nhận (mục 3.9). Trên máy tính, nút ⋯ chỉ hiện khi rê chuột vào dòng |
| Đang xử lý | Badge **Transcribing 42%** kèm "~3m left" (ước lượng trên, giả định tốc độ bằng thời gian thực) |
| Chờ upload | Khu **Waiting to upload from this device** ở trên cùng, liệt kê bản ghi còn chunk trên máy, kèm số chunk và lỗi nếu có |

Danh sách tự cập nhật mỗi 4 giây.

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | 3 dòng skeleton |
| Chưa có cuộc họp | Icon hộp thư, "No meetings yet", hai nút **New recording** và **Upload audio** |
| Lọc không ra kết quả | "No meetings match", nút **Clear filters** |
| Không gọi được server | Notice cảnh báo "Can't load meetings from the server", kèm lời nhắc bản ghi mới vẫn được giữ trên máy |
| Đổi tên/xoá lỗi | Notice đỏ "That didn't work" |

![Chưa có cuộc họp](../screenshots/ui-spec/meetings-empty.png)

### 3.5 S2 – Ghi âm (`/record`)

**Mục đích:** ghi cuộc họp và xem transcript ngay khi nói. **Story:** US1.1, US1.2, US2.2.

#### 3.5.1 Trước khi ghi

![Màn ghi âm trước khi bắt đầu](../screenshots/ui-spec/record-idle.png)

| Thành phần | Hành vi |
|---|---|
| **Title** | Để trống thì dùng tên mặc định "Meeting <ngày giờ>" (hiện sẵn ở placeholder) |
| **Date** | Chọn ngày diễn ra cuộc họp; mặc định hôm nay |
| **Spoken language** | **Auto-detect language** (mặc định, xử lý được họp trộn ngôn ngữ) hoặc 1 trong 15 ngôn ngữ. Lựa chọn được nhớ cho lần sau |
| **Audio source** | Hai thẻ chọn. **Microphone**: họp trực tiếp. **Microphone + meeting audio**: thu cả tiếng người khác trong Meet/Teams/Zoom; bị làm mờ nếu trình duyệt không hỗ trợ ("Needs desktop Chrome or Edge.") |
| Notice theo nguồn | Chọn micro + âm thanh họp trên trình duyệt: hướng dẫn chọn tab họp và bật **Share tab audio**. Trên app desktop: nhắc đeo tai nghe để tiếng không bị thu hai lần |
| **Start recording** | Nút chính cao 56 px; khi đang khởi động thì đổi thành "Starting…" |
| Khung bên phải | "The live transcript will appear here", trạng thái `AWAITING INPUT` có con trỏ nhấp nháy, và một khung chữ mẫu tự gõ để minh hoạ (tắt hiệu ứng khi hệ thống bật giảm chuyển động) |

Lỗi (trình duyệt không hỗ trợ, bị từ chối quyền micro) hiện thành Notice đỏ phía trên form, có nút × để đóng.

#### 3.5.2 Đang ghi

![Đang ghi, transcript live](../screenshots/ui-spec/record-live.png)

| Thành phần | Hành vi |
|---|---|
| Badge trạng thái | **Recording** (đỏ, nhấp nháy) / **Paused** / **Saving…**; bên phải ghi nguồn đang thu (**Mic** hoặc **Mic + meeting audio**) |
| Đồng hồ | Font số LED cỡ lớn, bên dưới là tên cuộc họp |
| Level meter | Các vạch theo âm lượng thật; vạch mới nhất màu đỏ |
| Nút | **Pause/Resume** (48–56 px) và **Stop** (64–68 px, nền đen). Bấm Stop thì lưu và mở trang cuộc họp |
| 4 ô thông số | **Saved on device** (số chunk), **Uploaded** (đã gửi / tổng; mất mạng thì hiện "Offline - later" màu đỏ), **Screen** (**Kept awake** / **Keep it on** / **May sleep**), **Language** |
| Khung **Live transcript** | Chấm đỏ nhấp nháy, chip ngôn ngữ ("English · auto"). Mỗi dòng có mốc thời gian. Dòng cuối đang nói: phần đã chốt in đen, phần còn có thể đổi in nghiêng xám, con trỏ nhấp nháy |
| Tự cuộn | Luôn cuộn theo chữ mới, trừ khi người dùng đã cuộn lên để đọc (cách đáy hơn 80 px) |
| Mất mạng | Khung transcript báo "You are offline. Audio keeps being saved on this device…"; audio vẫn được ghi |

Chunk 1 giây được gửi lên server ngay; trang hỏi transcript mỗi 0,7 giây. Chữ thường hiện khoảng 1 giây sau
khi nói ([Test Summary Report](04-quality-and-test.md#test-summary)).

Ảnh chụp bằng trình duyệt tự động nên ô **Screen** hiện **May sleep**. Trên điện thoại hỗ trợ Wake Lock, ô này
hiện **Kept awake**.

### 3.6 S3 – Upload (`/upload`)

**Mục đích:** biến file ghi âm có sẵn thành một cuộc họp. **Story:** US1.3, US2.4.

| Chưa chọn file | Đã chọn file |
|---|---|
| ![Vùng thả file](../screenshots/ui-spec/upload-empty.png) | ![Đã chọn file](../screenshots/ui-spec/upload-selected.png) |

| Thành phần | Hành vi |
|---|---|
| Vùng thả file | Viền đứt, bấm để chọn hoặc kéo thả; khi kéo file vào thì viền đậm lên. Dòng dưới liệt kê định dạng hỗ trợ (MP3, WAV, M4A, AAC, OGG, OPUS, WEBM, FLAC, WMA, AMR, 3GP, MP4, MOV, MKV…) và giới hạn "up to 1024 MB" |
| Thẻ file | Tên file, dung lượng, loại, thời lượng (nếu trình duyệt đọc được); nút × để bỏ file |
| Kiểm tra trước khi gửi | Báo lỗi ngay, không gửi: sai đuôi file, không phải audio/video, file rỗng, vượt dung lượng ("This file can't be used") |
| **Meeting title** | Mặc định là tên file bỏ đuôi |
| **Spoken language** | Như màn ghi âm |
| **Upload & transcribe** | Gửi theo từng phần, tự tiếp tục khi rớt mạng |
| Khung tiến độ | Các bước **Starting upload… → Uploading… → Creating the meeting…**; khi mất mạng hiện **Waiting for the network…** với icon đỏ. Có %, số byte, tốc độ, "Part x / y" và nút **Cancel** |
| Xong | Tự mở trang cuộc họp mới (S4) |

### 3.7 S4 – Trang cuộc họp (`/meetings/:id`)

**Mục đích:** đọc, tìm, nghe lại, xuất transcript; xem tóm tắt và bản dịch. **Story:** US2.1, US2.3, #67, #60.

#### 3.7.1 Khung chung

![Tab Transcript, đang phát audio](../screenshots/ui-spec/meeting-transcript.png)

| Khu vực | Thành phần và hành vi |
|---|---|
| Breadcrumb | Máy tính: `MEETINGS > TÊN CUỘC HỌP`. Điện thoại: `← MEETINGS` |
| Tiêu đề | Bấm vào tên (có icon bút chì) để sửa; Enter hoặc bấm ra ngoài thì lưu, Esc thì huỷ |
| Dòng thông tin | Badge trạng thái, nguồn (tên file / **Microphone** / **Mic + meeting audio**), ngày họp, thời lượng, ngôn ngữ ("English (auto-detected 100%)"; họp trộn thì "English + Vietnamese") |
| Menu ⋯ (**More actions**) | **Transcribe again…** (làm mờ khi đang xử lý), **Download audio (.wav)**, **Delete meeting** (đỏ) |
| Khung trạng thái | Hiện giữa tiêu đề và nội dung, thay đổi theo trạng thái (bảng 7.2) |
| Tab | **Transcript** (có chữ đỏ `LIVE` khi đang là bản nháp live), **Summary**, **Translation** |
| Thanh phát audio | Play/Pause, lùi/tới 10 giây, tốc độ 1× / 1,25× / 1,5× / 2×, thanh tua, thời gian hiện tại / tổng |
| Khung **Details** (≥ 1024 px) | Source, Duration, Meeting, Created, Finished, Size, Chunks, Language (kèm độ tin cậy %) |

![Menu More actions](../screenshots/ui-spec/meeting-menu.png)

#### 3.7.2 Khung trạng thái theo tình huống

| Tình huống | Hiển thị |
|---|---|
| Đang ghi trên chính thiết bị này | "Recording in progress", link **Open recorder** |
| Đang upload chunk từ thiết bị này | "Uploading the recording", số chunk còn lại |
| Đang ghi ở thiết bị/tab khác | "Receiving audio" |
| Bị kẹt ở trạng thái ghi > 20 giây | Cảnh báo "Still marked as recording", nút **Finish now** để phiên âm phần đã nhận |
| Upload file bị bỏ dở | "Upload not finished" |
| Đang chờ / đang chuẩn hoá audio | "Waiting in the queue…" / "Converting audio to the standard format…", thanh chạy liên tục |
| Đang phiên âm | "Transcribing…" và % (hoặc "Loading the speech model…"). Nếu đang hiện bản nháp live: "Improving the transcript…" kèm ghi chú "Showing the live draft until the accurate full-file transcript is ready." |
| Lỗi | Notice đỏ "Processing failed", lý do, nút **Retry** (nếu còn audio) |

![Đang phiên âm file dài, các dòng hiện dần](../screenshots/ui-spec/meeting-transcribing.png)

File dài được phiên âm theo từng đoạn khoảng 5 phút, nên các dòng hiện dần khi % tăng; người dùng đọc được ngay
mà không phải chờ hết file.

#### 3.7.3 Tab Transcript

| Thành phần | Hành vi |
|---|---|
| Dòng transcript | Mốc thời gian (font LED) và nội dung. Bấm một dòng thì audio nhảy tới đó và phát |
| Dòng đang phát | Nền xám và vạch đen bên trái; trang tự cuộn để dòng này luôn trong tầm nhìn |
| Nhãn ngôn ngữ | Dòng nói khác ngôn ngữ chính có nhãn nhỏ bên phải (ví dụ `VI` trong cuộc họp tiếng Anh) |
| **Search transcript** | Chỉ giữ các dòng chứa từ khoá, tô nền từ khoá, hiện "N lines match …" |
| Nút copy | Chép toàn bộ transcript kèm mốc thời gian; icon đổi thành dấu ✓ trong 1,5 giây |
| **Export** | **Text (.txt), Subtitles (.srt), WebVTT (.vtt), JSON (.json)** |
| Trống | Đang xử lý: "The transcript will appear here as soon as the first words are recognized." Xong mà không có lời nói: "No speech was recognized in this audio." |

![Tìm trong transcript](../screenshots/ui-spec/meeting-search.png)

#### 3.7.4 Tab Summary

![Tab Summary (nội dung mẫu từ AI_MOCK)](../screenshots/ui-spec/meeting-summary.png)

| Thành phần | Hành vi |
|---|---|
| Dòng thông tin | Ngôn ngữ · thời điểm tạo · model (ví dụ "Vietnamese · Nov 12, 2026, 11:35 PM · mock") |
| Nút copy | Chép biên bản dạng chữ |
| **Regenerate ▾** (hoặc **Generate**) | Chọn ngôn ngữ tóm tắt (Vietnamese / English); ngôn ngữ hiện tại có dấu ✓. Thay bản đã có thì phải xác nhận (mục 3.9) |
| **Overview** | Một đoạn tổng quan, có icon ✦ |
| **Key points** và **Decisions** | Hai cột trên màn ≥ 768 px, một cột trên điện thoại |
| **Action items** | Ô vuông, nội dung việc, người phụ trách · hạn (nếu có), mốc thời gian bấm được để nghe lại đoạn liên quan |
| **Open questions** | Danh sách câu hỏi còn mở |

| Trạng thái | Hiển thị |
|---|---|
| Transcript chưa xong | "The summary is generated automatically as soon as the transcript is ready." |
| Transcript lỗi | "The transcript failed, so there is no summary." |
| Chưa có tóm tắt | "No summary yet. Use Generate to create one." |
| Đang tạo | Vòng xoay, "Summarizing…", "Waiting for the summary model" hoặc "Writing the minutes in <ngôn ngữ>", kèm ghi chú họp dài mất vài phút |
| Lỗi | Notice đỏ "The summary could not be generated", nút **Try again** |

Trong lúc đang tạo, trang hỏi lại kết quả mỗi 3 giây.

#### 3.7.5 Tab Translation

![Tab Translation, hai cột (nội dung mẫu từ AI_MOCK)](../screenshots/ui-spec/meeting-translation.png)

| Thành phần | Hành vi |
|---|---|
| **Translate to** | Chọn Vietnamese / English; ngôn ngữ đã dịch xong có dấu ✓. Ngôn ngữ chọn lần trước được nhớ; mở lại trang thì hiện ngay bản đã lưu, không dịch lại |
| Bảng hai cột | **Original** \| **Translation · Vietnamese**; mỗi dòng có mốc thời gian bấm được để nghe. Trên điện thoại, bản dịch nằm ngay dưới câu gốc |
| Dòng chưa dịch | Thanh xám nhấp nháy (skeleton) |
| Dòng vốn đã đúng ngôn ngữ đích | Giữ nguyên, có nhãn nhỏ "already Vietnamese" |
| Tiến độ | "Translating into Vietnamese… 45%" và thanh tiến độ; hỏi lại mỗi 2 giây |
| **Export** (khi dịch xong) | **Text (.txt)**, **Subtitles (.srt)**, **Text, original + translation**, **Subtitles, original + translation** |
| Lỗi | Notice đỏ "The translation stopped", nút **Try again**; các dòng đã dịch được giữ lại và có ghi số dòng |
| Chưa chọn ngôn ngữ | "Choose a language to translate the transcript. Lines already in that language are kept as they are." |

#### 3.7.6 Cuộc họp chỉ có trên máy (chưa lên server)

Hiện khi mở một bản ghi chưa upload xong (mất mạng hoặc server tắt). Không có ảnh chụp.

| Tình huống | Hiển thị |
|---|---|
| Đang ghi trong tab/cửa sổ này | "Recording in progress" |
| Có mạng, đang upload | "Uploading from this device…", số chunk còn lại, phiên âm tự chạy sau đó |
| Mất mạng | "Saved on this device", nhắc giữ trình duyệt và không xoá dữ liệu trình duyệt (app desktop: chunk được xử lý khi engine chạy lại) |
| Server từ chối | Notice đỏ "The server refused this recording", nút **Retry** và **Discard** (cần xác nhận) |
| Không tìm thấy | "Meeting not found", link **Back to meetings** |

### 3.8 Trạng thái hệ thống (khu System và thanh trên điện thoại)

| Chip | Trạng thái | Hiển thị |
|---|---|---|
| Kết nối | Bình thường | Chấm xanh, `ONLINE` (trên điện thoại ẩn đi cho gọn) |
| | Đang gửi chunk | Icon mây, `3 QUEUED` |
| | Mất mạng / không gọi được server | Icon wifi gạch, chấm đỏ, `OFFLINE` hoặc `NO SERVER` kèm số chunk chờ; rê chuột thấy giải thích |
| Engine | Đang nạp model | Vòng xoay, `LOADING MODEL` |
| | Sẵn sàng (chạy trên máy) | `WHISPER LARGE-V3-TURBO · GPU` (hoặc `· CPU`) |
| | Sẵn sàng (engine remote) | Icon mây, `<model> · SERVER` |
| | Lỗi model | Chữ đỏ, `SPEECH MODEL ERROR`; rê chuột thấy lý do |

### 3.9 Hộp thoại

| Hộp thoại | Khi nào | Nội dung | Nút |
|---|---|---|---|
| **Delete this meeting?** | Delete từ danh sách hoặc từ trang cuộc họp | "“<tên>” and its audio will be deleted. This cannot be undone." | **Cancel**, **Delete** (đỏ) |
| **Discard this recording?** | Discard bản ghi bị server từ chối | Xoá khỏi máy, không khôi phục được | **Cancel**, **Discard** (đỏ) |
| **Regenerate the summary?** | Chọn ngôn ngữ khi đã có tóm tắt | "The current summary will be replaced by a new one in <ngôn ngữ>." | **Cancel**, **Regenerate** |
| **Transcribe again** | Menu ⋯ → Transcribe again… | Chọn lại ngôn ngữ nói khi nhận sai; transcript cũ bị thay | **Cancel**, **Start** |

| Xoá cuộc họp | Phiên âm lại |
|---|---|
| ![Hộp thoại xoá](../screenshots/ui-spec/dialog-delete.png) | ![Hộp thoại phiên âm lại](../screenshots/ui-spec/dialog-retranscribe.png) |

Hành động xoá luôn cần xác nhận và dùng màu đỏ. Esc hoặc **Cancel** thì đóng hộp thoại mà không làm gì. Ba hộp
thoại xác nhận (Delete, Discard, Regenerate) không đóng khi bấm ra ngoài, để tránh bấm nhầm; hộp thoại Transcribe
again thì có.

### 3.10 Điện thoại và app desktop

#### 3.10.1 Điện thoại (390×844)

| Danh sách | Trang cuộc họp | Trước khi ghi | Đang ghi |
|---|---|---|---|
| <img src="../screenshots/ui-spec/mobile-meetings.png" width="190" alt="Danh sách trên điện thoại"> | <img src="../screenshots/ui-spec/mobile-meeting.png" width="190" alt="Trang cuộc họp trên điện thoại"> | <img src="../screenshots/ui-spec/mobile-record-idle.png" width="190" alt="Màn ghi âm trên điện thoại"> | <img src="../screenshots/ui-spec/mobile-record-live.png" width="190" alt="Đang ghi trên điện thoại"> |

Ảnh "Đang ghi" chụp trên màn hình cao 1400 px để thấy cả đồng hồ lẫn transcript; trên điện thoại thật, người
dùng cuộn xuống để xem transcript.

- Thanh menu dưới có 3 mục; nút **Record** nổi lên, có viền đỏ nhạt khi đang ghi.
- Bảng cuộc họp gộp thành một dòng phụ; nút ⋯ luôn hiện (không có hover).
- Nút **Export** chỉ còn icon; khung Details ẩn (thông tin chính đã có ở dòng dưới tiêu đề).
- Khi ghi, màn hình được giữ sáng (Wake Lock). iOS vẫn dừng micro khi khoá màn hình, đây là giới hạn của trình
  duyệt (rủi ro R13).

#### 3.10.2 App desktop (Windows, Electron)

Dùng cùng giao diện web, khác ở các điểm sau:

- Khi mở app: màn chờ "SumTalk – Starting…" trong lúc engine khởi động (khoảng 1,4–1,9 giây).
- **Microphone + meeting audio** thu toàn bộ âm thanh máy đang phát (Zoom/Teams/Meet bản desktop), không cần
  chọn tab. Mô tả và Notice nhắc đeo tai nghe để tiếng không bị thu hai lần.
- Các câu nói "this browser" đổi thành "this window" / "this computer"; bản ghi chưa xử lý được nói là sẽ chạy khi
  "SumTalk engine" hoạt động lại.
- Khi dùng engine remote (`STT_PROVIDER=remote`), chip engine hiện `· SERVER` thay vì `GPU`/`CPU`.

### 3.11 Khả năng truy cập, tương tác nhỏ và cập nhật dữ liệu

**Khả năng truy cập**
- Nút chỉ có icon đều có `aria-label` (ví dụ "Stop and save", "Copy transcript", "Actions for <tên>").
- Có viền focus rõ khi dùng bàn phím (`focus-visible`).
- Sửa tên dùng Enter/Esc; hộp thoại đóng bằng Esc.
- Tôn trọng cài đặt giảm chuyển động của hệ thống (`prefers-reduced-motion`).
- Thông báo đang chạy (tóm tắt, dịch) dùng `role="status"`.

**Chu kỳ cập nhật dữ liệu (polling)**

| Nơi | Chu kỳ |
|---|---|
| Transcript khi đang ghi | 0,7 giây |
| Trang cuộc họp khi đang xử lý | 1,5 giây |
| Danh sách cuộc họp | 4 giây |
| Tab Summary khi đang tạo | 3 giây |
| Tab Translation khi đang dịch | 2 giây |

### 3.12 Hạn chế và đề xuất cải tiến UI/UX

| # | Hạn chế hiện tại | Đề xuất | Liên quan |
|---|---|---|---|
| UX-01 | Chữ giao diện chỉ có tiếng Anh, trong khi người dùng chính nói tiếng Việt | Thêm bản tiếng Việt cho giao diện (i18n), chọn theo ngôn ngữ trình duyệt | Đề xuất mới |
| UX-02 | Chưa có dark mode | Thêm bộ token tối theo `prefers-color-scheme` | Đề xuất mới |
| UX-03 | Không có tên người nói trên transcript | Nhận diện người nói, hiện "Người nói:" ở đầu dòng | US8.1 |
| UX-04 | Việc cần làm chỉ nằm trong tab Summary | Trang action items riêng, liên kết tới đoạn transcript | #79 |
| UX-05 | Bản dịch chỉ có sau khi họp xong | Dịch trực tiếp trong khung live transcript | #84 |
| UX-06 | iOS dừng ghi khi khoá màn hình | App native, hoặc cảnh báo rõ hơn trên iOS | US8.3, R13 |
| UX-07 | Chưa có tài khoản, mọi người dùng chung một thư viện | Đăng nhập, phân quyền, chia sẻ cuộc họp | US8.2 |
| UX-08 | Danh sách cuộc họp tải toàn bộ, chưa phân trang | Phân trang hoặc cuộn vô hạn khi có nhiều cuộc họp | Đề xuất mới |

Liên quan: tính năng theo module ở [Product Backlog / PRD và mô tả tính năng](#product-backlog), yêu cầu phi chức năng ở
[Yêu cầu phi chức năng](#nfr), kết quả test ở [Test Summary Report](04-quality-and-test.md#test-summary).
