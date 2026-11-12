# 12 – Quality Plan và Test Plan (mức quản lý)

**Tóm tắt:** chất lượng được giữ bằng Definition of Done cho mọi story, test tự động ở 3 tầng (pytest,
Playwright trình duyệt, Playwright desktop), test thủ công theo test case của QC, và tiêu chí phát hành rõ ràng.
Tính đến 12/11/2026: 88 test backend đạt, ruff sạch, smoke test desktop 8/8.

> Nhóm đã có DoD và các task QC: [CẦN ĐIỀN: đối chiếu DoD dưới đây với DoD đã thống nhất, giữ bản của nhóm nếu
> khác].

## 1. Mục tiêu chất lượng

| Thuộc tính | Mục tiêu | Đo bằng |
|---|---|---|
| Đúng chức năng | 100% acceptance criteria của story trong sprint đạt | Test case QC, test E2E |
| Độ chính xác AI | Theo NFR-A1…A5 ([05](05-non-functional-requirements.md)) | `eval_summary.py`, `eval_translation.py`, WER trên mẫu UAT |
| Hiệu năng | Live ≤ 3–5 s; 1 giờ audio ≤ 10 phút trên GPU | Script đo độ trễ, upload file dài |
| Ổn định | 0 lỗi Critical/High mở khi phát hành | Azure Boards (Bug) |
| Bảo trì | Lint sạch, test tự động chạy < 1 phút | ruff, pytest |

## 2. Definition of Done

Một story chỉ được tính Done khi:
- [ ] Code merge vào nhánh feature của sprint, có review của ít nhất 1 người khác.
- [ ] Đạt toàn bộ acceptance criteria, PO đã xem demo.
- [ ] Có test tự động cho logic mới (pytest hoặc Playwright); toàn bộ test cũ vẫn đạt.
- [ ] `ruff check` sạch; frontend `npm run build` (type check) đạt.
- [ ] Không còn Bug mức Critical/High liên quan story.
- [ ] Cập nhật README/ARCHITECTURE nếu thay đổi cách chạy, cấu hình hoặc kiến trúc.
- [ ] Không có bí mật (key, mật khẩu) trong commit.
- [ ] Task trên Azure Boards cập nhật giờ thực tế và chuyển trạng thái Done.

## 3. Chiến lược kiểm thử

| Cấp | Phạm vi | Công cụ | Ai | Khi nào |
|---|---|---|---|---|
| Unit / component | Logic live (LocalAgreement), chia đoạn file dài, parse API STT, prompt/JSON LLM, xuất file | pytest (STT giả + LLM mock + S3 giả lập moto) | Dev | Mỗi commit |
| API / tích hợp | Endpoint meetings, uploads, summary, translation, `/v1`, S3 | pytest + FastAPI TestClient | Dev | Mỗi commit |
| E2E trình duyệt | Ghi âm (micro, micro + âm thanh họp), offline rồi đồng bộ, upload, file sai định dạng; tóm tắt/dịch (Sprint 3) | Playwright trên Chrome và Edge thật, file WAV giả làm micro | QC | Mỗi sprint |
| E2E desktop | Cửa sổ, micro, âm thanh hệ thống, thoát sạch, bản đóng gói | Playwright Electron (`desktop/scripts/smoke-test.js`) | Dev desktop | Trước khi build bộ cài |
| Hiệu năng | Độ trễ live, thời gian file dài | Script mô phỏng ghi âm thời gian thực / upload file dài | Dev STT | Khi đổi engine, model |
| Chất lượng AI | ROUGE-L, độ phủ quyết định, chrF++, BLEU, giữ thuật ngữ | `backend/scripts/eval_*.py` | Dev AI + BA (mẫu tham chiếu) | Khi đổi model/prompt |
| Thủ công / UAT | Test case [`docs/testing/`](../testing/sprint3-test-cases.md), điện thoại, Firefox/Safari, bản web AWS | Tay | QC + người dùng thử | Cuối sprint, trước phát hành |
| Deploy | Image build, HTTPS, đăng nhập, `/v1`, S3 | Docker local + checklist hướng dẫn deploy | Dev ops | Trước khi deploy |

## 4. Quản lý lỗi

| Mức | Định nghĩa | Thời hạn xử lý |
|---|---|---|
| Critical | Mất dữ liệu ghi âm, app không chạy, lộ dữ liệu | Ngay, chặn phát hành |
| High | Tính năng chính hỏng, không có cách né | Trong sprint, chặn phát hành |
| Medium | Lỗi có cách né, sai hiển thị quan trọng | Sprint sau |
| Low | Thẩm mỹ, câu chữ | Khi có thời gian |

Quy trình: QC tạo Bug trên Azure Boards, link tới story, kèm bước tái hiện, kết quả mong đợi, log/ảnh. Dev sửa,
QC kiểm tra lại, rồi đóng Bug.

## 5. Tiêu chí bắt đầu, kết thúc, phát hành

| Tiêu chí | Nội dung |
|---|---|
| Bắt đầu test sprint | Story đạt DoD phía Dev, bản build chạy được, test case đã viết |
| Kết thúc test sprint | 100% test case ưu tiên cao đã chạy; tỷ lệ đạt ≥ 95%; không còn Critical/High |
| Phát hành (release) | Đạt tiêu chí kết thúc; release notes ([20](20-release-notes.md)); smoke test bản đóng gói và bản web đạt; PO và Sponsor đồng ý |

## 6. Rà soát chất lượng

- Code review qua Pull Request trên nhánh feature.
- Sprint Review: demo trên bản build thật (bản web hoặc bộ cài), không demo trên máy dev đã sửa tay.
- Retrospective: xem lại lỗi lọt qua test, bổ sung test tự động cho đúng lỗi đó.
