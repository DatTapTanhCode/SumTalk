# Hướng dẫn style cho bộ báo cáo PDF (tài liệu 01–06)

Bộ tài liệu quản lý dự án được xuất thành báo cáo PDF bằng LaTeX, theo kiểu dáng của template báo cáo
Khoa KH&KT Máy tính – ĐH Bách Khoa (`main (49).pdf`). Tài liệu 01 (`01-project-initiation.tex`) là bản mẫu
đã hoàn chỉnh: khi làm 02–06, mở nó ra đối chiếu.

## 1. Biên dịch

- Cần MiKTeX hoặc TeX Live, dùng **pdfLaTeX** (không dùng XeLaTeX: tiếng Việt đi qua `vntex`, mã hoá T5).
- Chạy trong thư mục này: `latexmk 02-software-requirements-specification.tex`. File `latexmkrc` tự chọn
  pdfLaTeX và đưa mọi file phụ cùng PDF vào `build/` (đã có trong `.gitignore`).
- Gói cần có (MiKTeX tự cài nếu thiếu): vntex, lm, babel-vietnamese, booktabs, tabularx, longtable,
  fancyhdr, lastpage, caption, enumitem, needspace, pgfplots, pgfgantt (nếu vẽ Gantt), hyperref, bookmark.
- Biên dịch xong phải **không còn** dòng `Overfull \hbox` trong `build/*.log`, và phải mở PDF xem từng trang.

## 2. Các file

| File | Vai trò |
|---|---|
| `sumtalk-report.sty` | Toàn bộ style chung: font, lề, header/footer, bìa, bảng, màu, macro. Không sửa riêng cho một tài liệu. |
| `sumtalk-info.tex` | Tên môn, năm học, giảng viên, danh sách thành viên + MSSV. Sửa một lần, mọi tài liệu cùng đổi. |
| `hcmut.png` | Logo BK, dùng ở bìa và header. |
| `NN-ten-tai-lieu.tex` | Mỗi tài liệu một file, cùng tên với file `.md` tương ứng. |
| `figures/` | Ảnh chụp màn hình, sơ đồ xuất từ công cụ khác (PNG ≥ 200 dpi hoặc PDF). |

Khung một tài liệu mới (chép từ 01 rồi đổi các macro):

```latex
\documentclass[12pt,a4paper]{report}
\usepackage{sumtalk-report}
\input{sumtalk-info}

\newcommand{\DocTitle}{ĐẶC TẢ YÊU CẦU PHẦN MỀM}          % bìa, viết HOA sẵn (không dùng \MakeUppercase)
\newcommand{\DocTitleNormal}{Đặc tả yêu cầu phần mềm}
\newcommand{\DocTitleEn}{Software Requirements Specification}
\newcommand{\DocRunningTitle}{Đặc tả yêu cầu phần mềm}  % header trang mở chương
\newcommand{\DocCode}{SUMTALK-SRS}
\newcommand{\DocVersion}{2.1 -- dd/mm/2026}
\newcommand{\DocStatus}{Chờ duyệt}
\newcommand{\DocAuthor}{\canDien[BA]}
\newcommand{\DocReviewers}{Product Owner, Project Manager}
\newcommand{\DocReaders}{PO, nhóm phát triển, QC}
\newcommand{\CoverDate}{TP. HỒ CHÍ MINH, THÁNG 11/2026}
\hypersetup{pdftitle={SumTalk -- Đặc tả yêu cầu phần mềm},pdfauthor={Nhóm SumTalk}}

\begin{document}
\makereportcover
... (front matter như 01) ...
\end{document}
```

## 3. Thiết kế trang (rút ra từ template)

| Thành phần | Quy định |
|---|---|
| Khổ giấy, font | A4, 12pt, Latin Modern (giống Computer Modern của template) |
| Lề | Trái 3 cm, phải 2 cm, trên 3 cm (template 2,5 cm; tăng vì header có logo), dưới 2,5 cm |
| Dòng, đoạn | Giãn dòng 1,5; căn đều hai bên; thụt đầu dòng, không cách đoạn |
| Bìa | 3 dòng ĐHQG / Trường / Khoa (in hoa, căn giữa) → logo 4 cm → gạch ngang → tên môn (đậm, in hoa) → **SUMTALK** và tên tài liệu (đậm, xanh `titleblue`) → tên tiếng Anh (nghiêng) → gạch ngang → Giảng viên, Nhóm thực hiện (đánh số, "Họ tên -- MSSV") → "TP. HỒ CHÍ MINH, THÁNG …" ở chân trang. Bìa không đánh số trang. |
| Trang thường | Header: logo BK + 2 dòng "Trường Đại học Bách Khoa -- ĐHQG-HCM / Khoa Khoa học và Kỹ thuật Máy tính" (chữ máy đánh, đậm), có gạch dưới. Footer: "Quản lý Dự án Phần mềm -- Năm học …" bên trái, "Trang n/N" bên phải, chữ máy đánh cỡ nhỏ, gạch trên. |
| Trang mở chương, front matter | Header gọn: "SumTalk -- tên tài liệu" bên trái, "n/N" bên phải, có gạch; footer chỉ có gạch. |
| Số trang | Trang sau bìa là 1; N là tổng số trang không tính bìa. |
| Link | Bấm được nhưng in màu đen (giống template); chỉ URL màu xanh. |

### Thứ tự các phần

1. Bìa (`\makereportcover`)
2. **Thông tin tài liệu**: `\docinfotable`, bảng *Lịch sử phiên bản* (`[H]`), mục *Quy ước trong tài liệu*
3. **Mục lục** (`\tableofcontents`, không tự đưa vào mục lục)
4. **Tóm tắt**: 2–3 đoạn trả lời "tài liệu này kết luận gì", kèm con số chính; dòng **Từ khoá:** ở cuối
5. **Danh mục từ viết tắt**: bảng 2 cột, xếp A–Z, chỉ gồm từ có xuất hiện trong tài liệu
6. **Danh sách hình vẽ**, rồi **Danh sách bảng** (thứ tự như template)
7. Các chương, đánh số
8. **Tài liệu tham khảo** (`thebibliography`)
9. Phụ lục (nếu có): `\appendix` rồi `\chapter{...}`

Mỗi mục 2, 4, 5, 6 dùng `\chapter*{...}` + `\addcontentsline{toc}{chapter}{...}`; với danh sách hình/bảng
dùng `\cleardoublepage\phantomsection\addcontentsline{toc}{chapter}{\listfigurename}\listoffigures`.

## 4. Đề mục và văn bản

- Cấp đề mục: `\chapter` ("Chương N" + tên, chữ rất lớn), `\section` (1.1), `\subsection` (1.1.1). Không
  dùng `\subsubsection`; cần đầu mục nhỏ không đánh số thì dùng `\heading{...}` (chữ đậm, như "Industry
  Context" trong template).
- **Mở đầu mỗi chương bằng 1–2 câu kết luận hoặc quyết định** ("Kết luận: nên tự xây SumTalk.", "Quyết
  định: dùng Scrum"), rồi mới đến chi tiết.
- In đậm thuật ngữ quan trọng và con số kết luận ở lần xuất hiện đầu; in nghiêng cho khái niệm hoặc nhấn nhẹ.
- Danh sách: `itemize` với cụm đầu in đậm + dấu hai chấm (`\item \textbf{Ghi âm:} ...`); cấp 2 tự dùng gạch
  ngang "–". `enumerate` chỉ cho các bước có thứ tự hoặc danh sách cần đánh số để tham chiếu.
- Viết tắt: viết đầy đủ ở lần đầu nếu người đọc có thể chưa biết, và thêm vào *Danh mục từ viết tắt*.
- Thuật ngữ quản lý dự án giữ tiếng Anh như bản md (Sprint, Backlog, Story, Sponsor, Product Owner…).
- Mã, tên biến, tên file: `\texttt{...}`; đường dẫn dài: `\path{...}` (tự xuống dòng được).

## 5. Bảng

- Kiểu **booktabs**: `\toprule`, `\midrule`, `\bottomrule`; **không có đường kẻ dọc**. Dùng thêm `\midrule`
  để tách nhóm hàng (ví dụ P1 / P2) hoặc trước dòng **Tổng**.
- **Chú thích nằm trên bảng**: "Bảng X.Y: …" (tự động), đánh số theo chương. Đơn vị chung đưa vào chú thích,
  ví dụ "Dòng tiền theo năm (triệu VND)".
- Hàng tiêu đề in đậm bằng `\thead{...}`.
- Ô chữ **căn trái, không căn đều** (template căn đều nên bị giãn chữ xấu; ở đây đã sửa). Dùng các kiểu cột có
  sẵn trong style: `L` (giãn, căn trái), `C` (giãn, căn giữa), `P{3cm}` (cố định, căn trái), `Q{2cm}` (cố định,
  căn giữa). Cột số dùng `r`.
- Bảng từ 4 cột trở lên hoặc chữ dày: thêm `\small` ngay sau `\label`.
- Bảng thông tin dạng khoá–giá trị (như thông tin dự án): 2 cột, không có hàng tiêu đề.
- **Luôn có câu dẫn trước bảng** ("… được tóm tắt trong Bảng~\ref{tab:x}."), và với bảng quan trọng thì có
  1–2 câu rút ra ý nghĩa sau bảng. **Không bao giờ đặt bảng ngay dưới tiêu đề mục**: bảng sẽ bị đẩy lên trên
  tiêu đề.

```latex
Các bên liên quan được liệt kê trong Bảng~\ref{tab:stakeholders}.

\begin{table}[htbp]
  \centering
  \caption{Các bên liên quan và cách làm việc}
  \label{tab:stakeholders}
  \small
  \begin{tabularx}{\linewidth}{@{}P{3.4cm}LQ{1.9cm}L@{}}
    \toprule
    \thead{Bên liên quan} & \thead{Vai trò} & \thead{Ảnh hưởng} & \thead{Cách làm việc} \\
    \midrule
    Sponsor & Cấp ngân sách, nghiệm thu & Cao & Sprint Review \\
    \bottomrule
  \end{tabularx}
\end{table}
```

**Bảng dài nhiều trang** (backlog, risk register, change log, test case) dùng `longtable`; hàng tiêu đề lặp
lại ở mỗi trang kèm dòng "(tiếp theo)":

```latex
\begingroup\small
\begin{longtable}{@{}P{1.4cm}P{8.6cm}Q{2cm}Q{2cm}@{}}
  \caption{Risk Register}\label{tab:risks}\\
  \toprule
  \thead{Mã} & \thead{Rủi ro} & \thead{Xác suất} & \thead{Tác động} \\
  \midrule
  \endfirsthead
  \multicolumn{4}{@{}l}{\footnotesize\itshape Bảng~\thetable{} (tiếp theo)}\\
  \toprule
  \thead{Mã} & \thead{Rủi ro} & \thead{Xác suất} & \thead{Tác động} \\
  \midrule
  \endhead
  \bottomrule
  \endlastfoot
  R1 & Độ chính xác STT với tiếng Việt & Cao & Cao \\
\end{longtable}
\endgroup
```

## 6. Vị trí bảng và hình

- Mặc định `[htbp]`: LaTeX tự đặt bảng/hình để không để trống nửa trang. Gói `flafter` bảo đảm bảng không bao
  giờ xuất hiện trước đoạn văn gọi nó.
- Chỉ dùng `[H]` (đứng yên đúng chỗ) cho: bảng *Lịch sử phiên bản*, bảng chữ ký *Phê duyệt*, và bảng cuối
  chương nếu không thì nó bị đẩy ra một trang riêng.
- Tiêu đề cần đi liền nội dung phía sau (ví dụ mục *Phê duyệt* với bảng chữ ký): đặt `\needspace{14\baselineskip}`
  ngay trước `\section`.

## 7. Hình vẽ và biểu đồ

- **Chú thích nằm dưới hình**: "Hình X.Y: …", đánh số theo chương. Hình phải được nhắc trong văn bản.
- Ưu tiên vẽ bằng **TikZ / pgfplots** ngay trong LaTeX (nét, sửa số liệu dễ). Hình không rộng quá `\linewidth`
  (16 cm); sau khi biên dịch kiểm tra log không có `Overfull`.
- Màu: `primaryblue` RGB(20,60,110) cho đối tượng chính (đường, mốc, cột), `chartgray` cho đối tượng so sánh
  (nét đứt), `todored` để đánh dấu một điểm đặc biệt, `accentblue` làm nền ô sơ đồ. Không dùng quá 3 màu.
- Nhãn trong hình cỡ `\footnotesize` hoặc `\small`, giãn dòng gần 1 (`execute at begin node=\setstretch{1.05}`).
- Số liệu trên biểu đồ dùng dấu phẩy thập phân: thêm `/pgf/number format/.cd, use comma, 1000 sep={.}` vào
  cuối danh sách tuỳ chọn của `axis`.
- Hình có sẵn trong tài liệu 01: dòng mốc thời gian (TikZ, nhãn xen kẽ trên/dưới trục) và biểu đồ đường
  luỹ kế (pgfplots). Gợi ý cho 02–06: cây WBS và sơ đồ mạng CPM (TikZ), Gantt (`\usepackage{pgfgantt}`,
  `ganttchart`), ma trận rủi ro xác suất × tác động (TikZ), đường S của EVA (PV/EV/AC, pgfplots), biểu đồ
  cột kết quả test (pgfplots), ảnh chụp màn hình UI trong `figures/`.

## 8. Công thức và con số

- Công thức có đánh số (`equation`), tham chiếu bằng `\eqref{eq:npv}`; công thức chỉ để minh hoạ phép tính thì
  dùng `equation*`.
- Định dạng số kiểu Việt Nam: dấu phẩy thập phân (`109,1`; trong công thức viết `0{,}75`), dấu chấm phân cách
  hàng nghìn (`100.000`), khoảng dùng gạch `--` (`30--60 phút`), đơn vị cách bằng `\,` (`1\,s`, `16\,kHz`,
  `1\,GB`), phần trăm `\%`, số âm trong bảng viết `$-60{,}0$`.
- **Không tự đặt số liệu.** Số chưa có thì dùng `\canDien` (hiện `[CẦN ĐIỀN]` màu đỏ) hoặc
  `\canDien[tổng giờ theo sprint]`. Số là giả định thì ghi rõ "giả định" và cách tính lại.

## 9. Tham chiếu

- Trong tài liệu: `Bảng~\ref{...}`, `Hình~\ref{...}`, `Mục~\ref{...}`, `Chương~\ref{...}`, luôn có dấu `~`.
  Nhãn đặt theo tiền tố `chap:`, `sec:`, `tab:`, `fig:`, `eq:`.
- Sang tài liệu khác của bộ: trích dẫn số `\cite{pmp}`, có thể kèm tên bằng
  `\docref{03}{Kế hoạch quản lý dự án}~\cite{pmp}`. Khoá dùng chung: `srs` (02), `pmp` (03), `qtd` (04),
  `mcr` (05), `pcr` (06), `pmcalc` (công cụ tính). Chép khối `thebibliography` của 01 sang, bỏ mục tự
  trích dẫn chính mình, thêm tài liệu ngoài nếu có (sách, chuẩn PMBOK…).
- Link trong file md (`[...](03-project-management-plan.md#risk)`) đổi thành `\cite{...}` hoặc `\ref{...}`;
  không để lại đường dẫn `.md`.

## 10. Chuyển một file `.md` thành báo cáo (không chép y nguyên)

1. Bảng thông tin ở đầu file md → các macro `\Doc...` + `\docinfotable`. Mục lục md bỏ đi (LaTeX tự tạo).
   Lịch sử phiên bản → front matter; thêm một dòng cho phiên bản chuyển sang PDF.
2. **Chương 1 – Giới thiệu**: bối cảnh, mục đích và người đọc của tài liệu, cấu trúc các chương. Nội dung lấy
   từ phần "Mục đích" của md, viết thành đoạn văn.
3. Mỗi nhóm H2 của md thành một chương; H3 thành mục. Có thể gộp hoặc tách để chương có độ dài tương đương.
4. Danh sách gạch đầu dòng chứa *lập luận* → viết lại thành đoạn văn; dữ liệu có cấu trúc → giữ thành bảng có
   chú thích. Thêm câu dẫn trước và câu nhận xét sau mỗi bảng quan trọng.
5. Thêm hình khi dữ liệu kể được bằng hình (mốc, dòng tiền, WBS, Gantt, EVA, kết quả test).
6. **Chương cuối – Kết luận**: tóm tắt kết quả chính, việc cần làm tiếp (gồm các ô `[CẦN ĐIỀN]`), và bảng
   *Phê duyệt* nếu tài liệu cần ký duyệt.
7. Viết *Tóm tắt* và *Danh mục từ viết tắt* sau cùng, khi nội dung đã xong.
8. Giữ nguyên mọi con số và sự kiện của md. Viết lại câu chữ thì được, thêm số liệu mới thì không.

### Gợi ý dàn ý 02–06

Dựa trên mô tả trong `docs/project/README.md`; điều chỉnh sau khi đọc kỹ từng file md.

| Tài liệu | Dàn ý gợi ý |
|---|---|
| 02 – Đặc tả yêu cầu phần mềm | Giới thiệu · Tổng quan sản phẩm và người dùng · Product Backlog / PRD (bảng epic, story, ưu tiên; `longtable`) · Yêu cầu phi chức năng · Đặc tả UI/UX v0.4 (ảnh màn hình) · Kết luận |
| 03 – Kế hoạch quản lý dự án | Giới thiệu · WBS (cây TikZ) và ước lượng effort · Lịch trình: sơ đồ mạng, CPM, Gantt · Quản lý rủi ro (Risk Register + ma trận) · Nguồn lực và chi phí · RACI và kế hoạch truyền thông · Kết luận |
| 04 – Chất lượng và kiểm thử | Giới thiệu · Quality Plan (DoD, tiêu chuẩn) · Test Plan · Test Summary Report (biểu đồ kết quả) · Kết luận · Phụ lục: test case E2E Sprint 3 |
| 05 – Báo cáo theo dõi và kiểm soát | Giới thiệu · Báo cáo trạng thái từng sprint · Earned Value (bảng + đường S) · Biên bản họp và Retrospective · Change Log · Kết luận |
| 06 – Báo cáo kết thúc dự án | Giới thiệu · SOW và nghiệm thu · Release Notes · Báo cáo tổng kết (mục tiêu M1–M6 đạt/không đạt) · Lessons Learned · Kết luận và phê duyệt |

## 11. Kiểm tra trước khi nộp

- [ ] `latexmk` chạy không lỗi; log không có `Overfull \hbox`, không có tham chiếu `??`
- [ ] Xem PDF từng trang: không có trang trống nửa trang vô lý, không bảng nào đứng trên tiêu đề mục của nó
- [ ] Tìm `CẦN ĐIỀN` trong PDF: đã điền hết, hoặc biết rõ còn ô nào
- [ ] Danh mục từ viết tắt khớp với các từ có trong bài
- [ ] Số liệu khớp với file md và các tài liệu khác của bộ
