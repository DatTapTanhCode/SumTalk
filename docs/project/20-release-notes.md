# 20 – Release Notes

Mỗi phiên bản liệt kê tính năng mới, thay đổi, lỗi đã sửa và hạn chế. Bản mới nhất ở trên cùng.

## v0.4 – Desktop, transcript live dạng streaming, cloud (Sprint 4, 12/11/2026)

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

## v0.3 – Tóm tắt và dịch (Sprint 3)

**Nhánh:** `feature/sprint3-summary-translation`
- Tóm tắt tự động sau khi có transcript (#67, #68–#71): tổng quan, ý chính, quyết định, việc cần làm, câu hỏi mở;
  tạo lại bằng tiếng Việt/Anh; map-reduce cho transcript dài.
- Dịch transcript (#60, #61–#65): chọn ngôn ngữ, tiến độ, song ngữ, xuất TXT/SRT.
- Script đánh giá chất lượng (#66, #72); test E2E (#99, #100).
- Giao diện mới: sidebar, danh sách cuộc họp, recorder, player.

## v0.2 – Transcript live, chọn LLM (Sprint 2)

[CẦN ĐIỀN: theo báo cáo Sprint 2: transcript live khoảng 3 s, kết quả benchmark và model LLM được chọn.]

## v0.1 – Ghi lại cuộc họp (Sprint 1)

**Commit:** `c483e36 Initial commit`, `163e2fa Update the UI`
- Ghi âm trên trình duyệt (micro, micro + âm thanh tab), offline trên điện thoại, upload file lớn, transcript
  ngôn ngữ gốc, xuất TXT/SRT/VTT/JSON/WAV.

## Mẫu cho phiên bản sau

```markdown
## vX.Y – <tên> (<sprint>, dd/mm/yyyy)
**Nhánh/tag:** …
**Mới:** …
**Thay đổi:** …
**Sửa lỗi:** … (ID Azure Boards)
**Hạn chế đã biết:** …
**Nâng cấp:** (bước cần làm khi cập nhật, ví dụ biến cấu hình mới)
```
