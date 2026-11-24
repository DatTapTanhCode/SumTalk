# Quality & Test Document – Chất lượng và kiểm thử

| | |
|---|---|
| Dự án | SumTalk – ghi âm, phiên âm, tóm tắt và dịch biên bản cuộc họp |
| Mã tài liệu | SUMTALK-QTD |
| Phiên bản | 2.0 – 13/11/2026 |
| Người lập | [CẦN ĐIỀN: Project Manager] |
| Người duyệt | QC, Product Owner, Project Manager |
| Trạng thái | Chờ duyệt |

**Mục đích:** Đặt kế hoạch chất lượng và kiểm thử cạnh kết quả kiểm thử để đối chiếu trực tiếp: mục tiêu chất lượng, Definition of Done, chiến lược kiểm thử, quản lý lỗi, tiêu chí phát hành, rồi kết quả đo được trên bản v0.4 và bộ test case E2E.

> Ô `[CẦN ĐIỀN]` là số liệu đã có ở Azure Boards, dashboard chi phí hoặc biên bản họp nhưng chưa chép vào đây.
> **Giả định** là con số đặt ra để tính toán; bảng ghi rõ công thức để tính lại khi có số thật.

## Mục lục

1. [Quality Plan và Test Plan](#quality-plan)
2. [Test Summary Report](#test-summary)
- [Phụ lục A. Test case E2E Sprint 3 (#99, #100)](#appendix-a)

## Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung | Người thực hiện |
|---|---|---|---|
| 1.0 | 12/11/2026 | Bản đầu, gồm các tài liệu riêng: 12-quality-test-plan, 19-test-summary-report | [CẦN ĐIỀN] |
| 2.0 | 13/11/2026 | Gộp thành một tài liệu, đánh lại số mục (CR-08) | [CẦN ĐIỀN] |

<a id="quality-plan"></a>

## 1. Quality Plan và Test Plan

**Tóm tắt:** chất lượng được giữ bằng Definition of Done cho mọi story, test tự động ở 3 tầng (pytest,
Playwright trình duyệt, Playwright desktop), test thủ công theo test case của QC, và tiêu chí phát hành rõ ràng.
Tính đến 12/11/2026: 88 test backend đạt, ruff sạch, smoke test desktop 8/8.

> Nhóm đã có DoD và các task QC: [CẦN ĐIỀN: đối chiếu DoD dưới đây với DoD đã thống nhất, giữ bản của nhóm nếu
> khác].

### 1.1 Mục tiêu chất lượng

| Thuộc tính | Mục tiêu | Đo bằng |
|---|---|---|
| Đúng chức năng | 100% acceptance criteria của story trong sprint đạt | Test case QC, test E2E |
| Độ chính xác AI | Theo NFR-A1…A5 ([Yêu cầu phi chức năng](02-software-requirements-specification.md#nfr)) | `eval_summary.py`, `eval_translation.py`, WER trên mẫu UAT |
| Hiệu năng | Live ≤ 3–5 s; 1 giờ audio ≤ 10 phút trên GPU | Script đo độ trễ, upload file dài |
| Ổn định | 0 lỗi Critical/High mở khi phát hành | Azure Boards (Bug) |
| Bảo trì | Lint sạch, test tự động chạy < 1 phút | ruff, pytest |

### 1.2 Definition of Done

Một story chỉ được tính Done khi:
- [ ] Code merge vào nhánh feature của sprint, có review của ít nhất 1 người khác.
- [ ] Đạt toàn bộ acceptance criteria, PO đã xem demo.
- [ ] Có test tự động cho logic mới (pytest hoặc Playwright); toàn bộ test cũ vẫn đạt.
- [ ] `ruff check` sạch; frontend `npm run build` (type check) đạt.
- [ ] Không còn Bug mức Critical/High liên quan story.
- [ ] Cập nhật README/ARCHITECTURE nếu thay đổi cách chạy, cấu hình hoặc kiến trúc.
- [ ] Không có bí mật (key, mật khẩu) trong commit.
- [ ] Task trên Azure Boards cập nhật giờ thực tế và chuyển trạng thái Done.

### 1.3 Chiến lược kiểm thử

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

### 1.4 Quản lý lỗi

| Mức | Định nghĩa | Thời hạn xử lý |
|---|---|---|
| Critical | Mất dữ liệu ghi âm, app không chạy, lộ dữ liệu | Ngay, chặn phát hành |
| High | Tính năng chính hỏng, không có cách né | Trong sprint, chặn phát hành |
| Medium | Lỗi có cách né, sai hiển thị quan trọng | Sprint sau |
| Low | Thẩm mỹ, câu chữ | Khi có thời gian |

Quy trình: QC tạo Bug trên Azure Boards, link tới story, kèm bước tái hiện, kết quả mong đợi, log/ảnh. Dev sửa,
QC kiểm tra lại, rồi đóng Bug.

### 1.5 Tiêu chí bắt đầu, kết thúc, phát hành

| Tiêu chí | Nội dung |
|---|---|
| Bắt đầu test sprint | Story đạt DoD phía Dev, bản build chạy được, test case đã viết |
| Kết thúc test sprint | 100% test case ưu tiên cao đã chạy; tỷ lệ đạt ≥ 95%; không còn Critical/High |
| Phát hành (release) | Đạt tiêu chí kết thúc; release notes ([Release Notes](06-project-closure-report.md#release-notes)); smoke test bản đóng gói và bản web đạt; PO và Sponsor đồng ý |

### 1.6 Rà soát chất lượng

- Code review qua Pull Request trên nhánh feature.
- Sprint Review: demo trên bản build thật (bản web hoặc bộ cài), không demo trên máy dev đã sửa tay.
- Retrospective: xem lại lỗi lọt qua test, bổ sung test tự động cho đúng lỗi đó.

<a id="test-summary"></a>

## 2. Test Summary Report

**Kết luận hiện tại (12/11/2026):** đủ điều kiện phát hành bản **v0.4 cho đợt test nội bộ và UAT**. Các test tự động
đều đạt và hiệu năng đạt mục tiêu. **Chưa đủ để nghiệm thu cuối**, vì còn thiếu 3 việc: chạy lại test E2E trình
duyệt sau thay đổi Sprint 4, deploy thật lên AWS, và đo độ chính xác tiếng Việt trên mẫu UAT. Bộ cài desktop
đã được build lại và đạt smoke test.

### 2.1 Phạm vi và môi trường

| Mục | Nội dung |
|---|---|
| Phiên bản | Nhánh `docs/project-management` (gồm toàn bộ code tới `feature/aws-deploy`) |
| Máy test | Windows 11, i7-13620H, RTX 4050 6 GB, Python 3.13, Node 22, Chrome/Edge, Electron 45 |
| Model | Whisper `large-v3-turbo` (GPU), `small` (CPU); LLM mock trong test tự động |
| Kế hoạch tham chiếu | [Quality Plan và Test Plan](#quality-plan), [test case Sprint 3](../testing/sprint3-test-cases.md) |

### 2.2 Kết quả test tự động

| Bộ test | Số test | Đạt | Không đạt | Ghi chú |
|---|---|---|---|---|
| pytest backend (API, live, STT remote, `/v1`, S3, tóm tắt, dịch) | 88 | 88 | 0 | khoảng 6 s |
| ruff (lint) | – | sạch | – | |
| Type check + build frontend | – | đạt | – | |
| Playwright desktop – từ mã nguồn | 8 | 8 | 0 | cửa sổ, micro, âm thanh hệ thống, thoát sạch |
| Playwright desktop – bản đóng gói | 8 | 8 | 0 | bộ cài v0.4 build lại ngày 12/11/2026 (205 MB), có streaming và STT remote |
| Playwright trình duyệt (Chrome, Edge) – E1 | 5 × 2 | [CẦN ĐIỀN] | | cần chạy lại sau khi đổi chunk 1 s |
| Playwright Sprint 3 (`sprint3.spec.ts`) | [CẦN ĐIỀN] | | | server `AI_MOCK=true` |
| Docker: build image, HTTPS, đăng nhập, `/v1` | 8 kiểm tra | 8 | 0 | stack chạy local với `SITE_ADDRESS=localhost` |

### 2.3 Kết quả hiệu năng (đo thực tế)

| Kịch bản | Mục tiêu | Kết quả | Đạt |
|---|---|---|---|
| Live, GPU local, file 17 s phát theo thời gian thực | ≤ 3–5 s | Từ mới khoảng 1 s; câu chốt TB 1,93 s, tối đa 2,31 s | ✔ |
| Live qua engine remote (máy không có model) | như trên | TB 1,93 s, tối đa 2,31 s; máy khách không tải model | ✔ |
| File 11,6 phút – remote | 1 giờ ≤ 10 phút | 17,8 s (39× realtime), dòng đầu sau 3,1 s | ✔ |
| File 11,6 phút – GPU local | như trên | 56,7 s (12× realtime), dòng đầu sau 4,6 s | ✔ |
| Khởi động app desktop | ≤ 10 s | 1,4–1,9 s | ✔ |

### 2.4 Kết quả test thủ công (QC)

| Bộ test case | Tổng | Đạt | Không đạt | Chưa chạy |
|---|---|---|---|---|
| #99 Tóm tắt (S-01…S-11) | 11 | [CẦN ĐIỀN] | | |
| #100 Dịch (T-01…T-12) | 12 | [CẦN ĐIỀN] | | |
| Điện thoại Android/iOS (T1.2.5) | [CẦN ĐIỀN] | | | |
| UAT bản web trên AWS | [CẦN ĐIỀN] | | | |

### 2.5 Lỗi còn tồn và hạn chế đã biết

| ID | Mô tả | Mức | Trạng thái |
|---|---|---|---|
| L-01 | iOS dừng micro khi khoá màn hình (giới hạn của trình duyệt) | Medium | Chấp nhận (R13) |
| L-02 | Bộ cài chưa ký số, SmartScreen cảnh báo | Low | Chấp nhận (R12) |
| L-03 | Engine remote dùng API công cộng: ngôn ngữ nhận theo block khoảng 30 s, thô hơn engine local (theo câu) | Low | Dùng server SumTalk GPU để giữ nhận ngôn ngữ theo câu |
| L-04 | Live: dòng có thể bị ngắt giữa câu khi nói liền > 8 s không nghỉ (bản cuối sau khi Stop sẽ chia lại câu) | Low | Thiết kế có chủ ý |
| [CẦN ĐIỀN] | Lỗi QC tìm thấy trên Azure Boards | | |

### 2.6 Đánh giá theo tiêu chí phát hành

| Tiêu chí ([Quality Plan và Test Plan](#quality-plan)) | Trạng thái |
|---|---|
| Test tự động đạt 100% | ✔ (backend, desktop, Docker); E2E trình duyệt cần chạy lại |
| Không còn lỗi Critical/High | ✔ theo hiểu biết hiện tại; [CẦN ĐIỀN: xác nhận trên board] |
| Hiệu năng đạt mục tiêu | ✔ |
| Smoke test bản đóng gói và bản web | Bản đóng gói: ✔ (8/8); bản web: đạt khi chạy local, chưa có trên AWS |
| PO và Sponsor đồng ý | [CẦN ĐIỀN] |

**Khuyến nghị:** chạy lại E2E trình duyệt và Sprint 3, deploy lên AWS, chạy UAT 1 tuần, rồi nghiệm thu v1.0.

<a id="appendix-a"></a>

## Phụ lục A. Test case E2E Sprint 3 (#99, #100)

Bản gốc dùng hằng ngày cho QC: [`docs/testing/sprint3-test-cases.md`](../testing/sprint3-test-cases.md). Nội dung giữ nguyên tiếng Anh như bản QC đang dùng.

For QC (#99, #100). Each case maps to an acceptance criterion of story #67 or #60.
Bugs found: log a **Bug** on Azure Boards, link it to the story, retest after the fix.

### Setup

| Run | How |
|---|---|
| **Mock model** (predictable, no GPU) | `AI_MOCK=true` in `backend/.env`, then `start.bat`. Summary text starts with "Bản tóm tắt thử nghiệm (mock)" (vi) or "Mock summary" (en); a translated line is the original prefixed with `[vi]` / `[en]`. |
| **Real model** (quality) | `AI_MOCK=false`, `LLM_BASE_URL` + `SUMMARY_MODEL` / `TRANSLATION_MODEL` set, Ollama running (or cloud key). |
| **Simulate a model failure** | `AI_MOCK=false` and `LLM_BASE_URL=http://localhost:9/v1` (nothing listens there). |

Sample audio: `frontend/e2e/fixtures/speech_en.mp3` (English, 17 s), a Vietnamese recording, a mixed
EN/VI recording, and a recording of 60 minutes or more (any meeting recording; the content does not matter).

Automated coverage: `backend/tests/test_summary_translation_api.py`, `test_ai_summary.py`,
`test_ai_translation.py` (pytest, mock model) and `frontend/e2e/sprint3.spec.ts` (Playwright, server with
`AI_MOCK=true`): `npx playwright test e2e/sprint3.spec.ts`.

### #99 – Summary (story #67)

| ID | AC | Steps | Expected | Auto |
|---|---|---|---|---|
| S-01 | 1 | Upload `speech_en.mp3`. Wait for **Ready**. Open the **Summary** tab without clicking anything else. | "Summarizing…" with a spinner, then the summary appears by itself (page polls every 3 s). | e2e, pytest |
| S-02 | 2 | Look at a finished summary. | Sections **Overview, Key points, Decisions, Action items, Open questions**. Empty sections say so ("No decisions were recorded."). | e2e, pytest |
| S-03 | 3 | Regenerate ▾ → **English**, confirm. Then Regenerate ▾ → **Vietnamese**. Repeat on the mixed EN/VI meeting. | Text is in the chosen language each time, also for the mixed meeting. English technical terms (API, deploy, sprint…) stay in English in the Vietnamese summary. | e2e (lang), manual (terms) |
| S-04 | 3 | Real model: compare the summary with the transcript. | No people, numbers, dates or decisions that are not in the transcript. | manual / `eval_summary.py` |
| S-05 | 4 | Upload a recording of **≥ 60 min**. | Summary ends as **done** (no error). In `GET /api/meetings/{id}/summary`: `mode = "map_reduce"`, `calls` = number of parts + 1. | pytest (80k-char transcript) |
| S-06 | 5 | On a finished summary: Regenerate ▾ → a language. | A confirmation "The current summary will be replaced…" appears. After confirming, the old text disappears and the new one replaces it. Cancel keeps the old one. | e2e |
| S-07 | 5 | While a summary is being generated. | The Regenerate button is disabled. `POST …/summary/regenerate` returns **409**. | pytest |
| S-08 | 6 | Simulate a model failure, upload a file. | After the retries (about 30 s) the tab shows "The summary could not be generated" with the error and **Try again**. Nothing spins forever. | pytest |
| S-09 | 6 | Fix the model URL, click **Try again**. | The summary is generated. The transcript is **not** re-transcribed (meeting stays Ready). | pytest |
| S-10 | – | Re-transcribe a meeting that has a summary. | The summary is rebuilt after the new transcript. | pytest |
| S-11 | – | Phone width (≤ 400 px). | Sections stack in one column, buttons reachable, no horizontal scroll. | manual |

### #100 – Translation (story #60)

| ID | AC | Steps | Expected | Auto |
|---|---|---|---|---|
| T-01 | 1 | Open the **Translation** tab of a Ready meeting. Open "Translate to". | The list offers at least **Vietnamese** and **English**; choosing one starts the translation. | e2e |
| T-02 | 2 | Translate `speech_en.mp3` into Vietnamese; wait for the end. | A progress bar with % while running, lines filling in. When done, **every** line has a translation (`GET …/translations/vi`: no `translation: null`). | e2e, pytest |
| T-03 | 3 | Translate the English meeting into **English**, and the Vietnamese meeting into **Vietnamese**. | Lines are kept unchanged with the label "already English/Vietnamese" (`skipped: true`), and no model call is made for them. | pytest |
| T-04 | 3 | Real model: translate the mixed EN/VI meeting into Vietnamese and into English. | Natural translation; English technical terms and names kept. Vietnamese lines are kept when the target is Vietnamese. | manual / `eval_translation.py` |
| T-05 | 4 | Look at a finished translation on a desktop screen. | Two columns **Original | Translation**, one row per segment, time on the left, rows aligned. Clicking a time plays the audio from there. | e2e |
| T-06 | 4 | Same at phone width. | Each original line is directly above its translation. | manual |
| T-07 | 5 | Reload the page (F5), open the Translation tab. | The saved translation shows at once. No new job: `GET …/translations` still has one entry with the same `updated_at`; choosing the same language again returns **200** immediately. | e2e, pytest |
| T-08 | 6 | Export ▾ → **Text (.txt)**; open in Windows Notepad. | File `<title>_vi.txt`; Vietnamese accents display correctly; lines `[hh:mm:ss] translation`. | e2e (file), manual (Notepad) |
| T-09 | 6 | Export ▾ → **Subtitles (.srt)**; open in VLC with the audio, or in a subtitle editor. | File `<title>_vi.srt`; numbered cues `HH:MM:SS,mmm --> HH:MM:SS,mmm`; subtitles in sync. | e2e, pytest |
| T-10 | 6 | Export the bilingual variants. | Original line above each translation, in TXT and SRT. | pytest |
| T-11 | – | Simulate a model failure, pick a language. | "The translation stopped" with the error and **Try again**; Export disabled. After fixing the model, Try again translates only the missing lines. | pytest |
| T-12 | – | Before the transcript is Ready. | The tab says translation is available once the transcript is ready; the API returns 409. | pytest |

### Results

| Date | Build / commit | Tester | Model | Passed | Failed (bug IDs) |
|---|---|---|---|---|---|
| | | | | | |
