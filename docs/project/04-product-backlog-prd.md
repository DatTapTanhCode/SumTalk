# 04 – Product Backlog / PRD và mô tả tính năng hệ thống

**Sản phẩm:** SumTalk biến một cuộc họp (ghi âm trực tiếp hoặc file có sẵn) thành transcript đúng ngôn ngữ người
nói, kèm tóm tắt và bản dịch. Người dùng có thể dùng trên trình duyệt, điện thoại, app Windows, hoặc bản web
trên AWS. Backlog gồm 7 epic, 17 user story; trạng thái tính đến 12/11/2026.

> Story point (SP) là số đề xuất: [CẦN ĐIỀN: thay bằng điểm đã vote trên Azure Boards]. Mã #60, #67, #61–#72,
> #99, #100 là ID trên Azure Boards; T1.x là task của epic E1.
> Ưu tiên theo MoSCoW: M = Must, S = Should, C = Could, W = Won't (lần này).

## 1. Người dùng mục tiêu

| Persona | Nhu cầu | Thiết bị |
|---|---|---|
| Thư ký / người ghi biên bản | Có transcript và biên bản ngay sau họp, sửa ít | Laptop (Chrome/Edge, app Windows) |
| Trưởng nhóm / quản lý | Đọc nhanh quyết định, việc cần làm; chia sẻ cho người vắng | Laptop, điện thoại |
| Thành viên họp đa ngôn ngữ | Đọc nội dung bằng tiếng mình (Việt ↔ Anh) | Bất kỳ |
| Người dùng không có GPU | Phiên âm nhanh, không phải cài model nặng | Laptop văn phòng |

## 2. Mô tả tính năng theo module

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

## 3. Product Backlog

### E1 – Ghi lại cuộc họp

| ID | User story | Acceptance criteria (tóm tắt) | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US1.1 (T1.1.1–T1.1.5) | Là thư ký, tôi muốn ghi âm cuộc họp ngay trên trình duyệt để không cần phần mềm khác | 1) Start/Pause/Resume/Stop và đồng hồ; 2) ghi được micro, hoặc micro + âm thanh tab họp; 3) audio gửi theo chunk; 4) Stop thì tạo meeting mới; 5) chạy trên Chrome và Edge | M | 13 | Done |
| US1.2 (T1.2.1–T1.2.5) | Là người dùng điện thoại, tôi muốn ghi âm cả khi mất mạng để không mất nội dung | 1) Giao diện ghi âm trên điện thoại; 2) màn hình giữ sáng; 3) lưu audio khi offline; 4) tự gửi khi có mạng lại; 5) test trên Android/iOS | M | 13 | Done (iOS khoá màn hình: hạn chế) |
| US1.3 (T1.3.1–T1.3.5) | Là người dùng, tôi muốn tải file ghi âm có sẵn để lấy transcript | 1) Màn hình upload kéo thả; 2) kiểm tra định dạng và dung lượng trước khi gửi; 3) gửi file lớn theo phần, tiếp tục khi rớt mạng; 4) chuẩn hoá audio; 5) tạo meeting từ file | M | 8 | Done |

### E2 – Transcript

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US2.1 | Là thành viên họp trộn ngôn ngữ, tôi muốn transcript giữ đúng ngôn ngữ từng người nói | 1) Câu tiếng Anh giữ tiếng Anh, câu tiếng Việt giữ tiếng Việt, không tự dịch; 2) có nhãn ngôn ngữ từng dòng; 3) có thể chọn cố định ngôn ngữ và phiên âm lại | M | 8 | Done |
| US2.2 | Là thư ký, tôi muốn thấy chữ hiện ngay khi người khác đang nói | 1) Chữ hiện trễ ≤ 3–5 s (đo được: khoảng 1 s cho từ mới); 2) hiện dần theo lời nói, không đợi hết câu; 3) không cắt đôi từ; 4) sau khi Stop có bản cuối chính xác thay thế | M | 13 | Done |
| US2.3 | Là người dùng, tôi muốn xem lại, tìm, nghe lại và xuất transcript | 1) Phát audio đồng bộ, bấm dòng để tua; 2) tìm kiếm; 3) xuất TXT/SRT/VTT/JSON/WAV; 4) đổi tên, xoá | M | 8 | Done |
| US2.4 | Là người dùng, tôi muốn xử lý cuộc họp dài 1 giờ trở lên | 1) Không lỗi, không hết bộ nhớ; 2) thấy dòng đầu sau vài giây; 3) tiến độ đúng; 4) trên GPU, 1 giờ xử lý ≤ 10 phút | M | 5 | Done |

### E3 – Tóm tắt (#67)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| #67 | Là quản lý, tôi muốn có biên bản tóm tắt tự động sau mỗi cuộc họp | 1) Tự tạo sau khi có transcript cuối; 2) có đủ các mục tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở; 3) đúng ngôn ngữ chọn (vi/en), kể cả họp trộn, giữ thuật ngữ tiếng Anh; 4) không bịa người, số liệu, quyết định; 5) cuộc họp ≥ 60 phút vẫn tóm tắt được (map-reduce); 6) Regenerate có hỏi xác nhận và bị khoá khi đang chạy; 7) lỗi model thì báo lỗi và có Thử lại, không chạy lại STT | M | 18 (#68 5, #69 5, #70 5, #71 3); #72 tính chung với #66 | Done |

### E4 – Dịch (#60)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| #60 | Là thành viên không giỏi tiếng Anh/Việt, tôi muốn đọc transcript bằng ngôn ngữ của mình | 1) Chọn ngôn ngữ đích (ít nhất Việt, Anh); 2) có thanh tiến độ, xong thì mọi dòng có bản dịch; 3) dòng đã đúng ngôn ngữ thì giữ nguyên và có nhãn; 4) hiển thị song ngữ theo dòng (điện thoại xếp dọc); 5) đã dịch thì lưu lại, mở lại không dịch lại; 6) xuất TXT/SRT, chỉ bản dịch hoặc song ngữ | M | 19 (#61 3, #62 3, #63 3, #64 3, #65 2, #66 + #72 5) | Done |

### E5 – App desktop

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US5.1 | Là người dùng Windows, tôi muốn cài SumTalk như một phần mềm, không cần mở trình duyệt | 1) Bộ cài Windows, có shortcut; 2) mở app thì backend tự chạy, đóng thì tự tắt (kể cả crash); 3) micro và âm thanh hệ thống dùng được; 4) đóng khi đang ghi thì có hỏi; 5) có menu cài đặt, log, thư mục dữ liệu | S | 8 | Done |

### E6 – Engine STT dùng chung (máy khách không cần model)

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US6.1 | Là người dùng không có GPU, tôi muốn phiên âm nhanh và chính xác mà không phải tải model | 1) App/server cấu hình `STT_PROVIDER=remote`, không tải model; 2) độ chính xác bằng `large-v3-turbo`; 3) độ trễ live tương đương local GPU; 4) lỗi key/mạng hiện rõ trên header | M | 8 | Done |
| US6.2 | Là quản trị, tôi muốn server GPU của nhóm làm engine cho mọi app desktop | 1) API chuẩn OpenAI `/v1/audio/transcriptions` có API key; 2) trả ngôn ngữ từng đoạn; 3) bộ cài có thể ghi sẵn địa chỉ server | S | 5 | Done |

### E7 – Triển khai web

| ID | User story | Acceptance criteria | MoSCoW | SP | Trạng thái |
|---|---|---|---|---|---|
| US7.1 | Là QC/khách hàng, tôi muốn dùng thử SumTalk qua một đường link mà không cài gì | 1) HTTPS, có trang đăng nhập; 2) audio lưu trên S3 private, phát qua link có hạn; 3) database tự sao lưu; 4) có hướng dẫn deploy từng bước và gỡ bỏ | S | 8 | Done (chờ deploy thật lên AWS) |

### Backlog tương lai (chưa làm)

| ID | User story | MoSCoW |
|---|---|---|
| #79 | Trang việc cần làm (action items) liên kết tới đoạn transcript | S |
| #84 | Dịch trực tiếp khi đang họp | C |
| US8.1 | Nhận diện người nói (diarization), thêm "Người nói:" vào biên bản và file xuất | S |
| US8.2 | Tài khoản, phân quyền, chia sẻ cuộc họp | S (bắt buộc trước khi thương mại) |
| US8.3 | App iOS/Android native (ghi khi khoá màn hình) | C |
| US8.4 | Tự cập nhật app desktop, ký số bộ cài | C |

## 4. Definition of Ready

Story được đưa vào sprint khi đã có: mô tả theo mẫu "Là… tôi muốn… để…", acceptance criteria kiểm tra được, SP đã
ước lượng, phụ thuộc đã rõ, có thiết kế UI nếu story có giao diện.

Definition of Done: xem [12](12-quality-test-plan.md).
