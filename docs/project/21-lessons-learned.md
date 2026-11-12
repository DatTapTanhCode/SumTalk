# 21 – Báo cáo tổng kết và Lessons Learned

**Tóm tắt:** khung báo cáo cuối dự án: so sánh kế hoạch với thực tế (phạm vi, thời gian, chi phí, chất lượng) và
bài học. Phần kỹ thuật dưới đây ghi từ kinh nghiệm đến Sprint 4. Phần số liệu và bài học quản lý điền khi kết
thúc dự án [CẦN ĐIỀN].

## 1. Kế hoạch so với thực tế

| Khía cạnh | Kế hoạch | Thực tế | Chênh lệch | Nguyên nhân |
|---|---|---|---|---|
| Phạm vi | E1–E4 (ghi âm, transcript, tóm tắt, dịch) | E1–E7 (thêm desktop, engine dùng chung, bản web AWS) | +3 epic | Thay đổi CR-03…CR-06 ([17](17-change-log.md)) |
| Thời gian | [CẦN ĐIỀN] sprint | [CẦN ĐIỀN] | | |
| Chi phí nhân công (BAC) | [CẦN ĐIỀN] | [CẦN ĐIỀN] (AC) | VAC = | |
| CPI / SPI cuối | 1,0 / 1,0 | [CẦN ĐIỀN] | | |
| Chất lượng | 0 lỗi Critical/High khi phát hành | [CẦN ĐIỀN] | | |
| Hiệu năng live | ≤ 3–5 s | khoảng 1–2 s | tốt hơn mục tiêu | Chunk 1 s, LocalAgreement, engine GPU/remote |

## 2. Điều làm tốt

- **Đo thay vì đoán:** độ trễ live và thời gian xử lý file dài được đo bằng script mô phỏng (số liệu ở
  [19](19-test-summary-report.md)), nên tranh luận dựa trên số liệu.
- **Kiến trúc mở:** STT và LLM đều qua API chuẩn OpenAI. Đổi Ollama/Groq/OpenAI/server riêng chỉ bằng cấu hình;
  thêm engine remote mà không sửa pipeline.
- **Không mất dữ liệu:** lưu chunk trên máy trước khi gửi; khôi phục sau crash; backend desktop tự tắt khi app chết.
- **Test tự động nhanh** (STT giả, LLM mock, S3 giả lập): 88 test chạy khoảng 6 s, nên chạy được sau mỗi thay đổi.
- **Chia commit theo task trên nhánh feature:** dễ review, dễ map với Azure Boards.

## 3. Điều cần cải thiện

| Vấn đề | Tác động | Bài học / hành động |
|---|---|---|
| Nhiều thay đổi Sprint 3 nằm chưa commit trong máy khi bắt đầu Sprint 4 | Khó tách commit, dễ mất code | Commit và push sau mỗi task; không để thay đổi qua đêm |
| Push bị 403 do sai tài khoản/quyền repo (R11) | Code chỉ có ở một máy, không review được | Kiểm tra quyền repo cho mọi thành viên từ Sprint 1; mỗi người dùng tài khoản của mình |
| Phạm vi tăng 3 epic giữa dự án | Áp lực lịch và chi phí | Đánh giá tác động trước, cắt Should/Could tương ứng, ghi Change Log ngay |
| Live trên CPU chậm (cửa sổ tới 25 s phiên âm lại mỗi lần) | Chữ hiện muộn trên máy không có GPU | Thiết kế live phải tính chi phí mỗi lượt; có engine remote ngay từ đầu cho máy yếu |
| Bộ cài GPU quá lớn cho NSIS (> 2 GB) | Không có bộ cài GPU | Ưu tiên server GPU dùng chung thay vì GPU trên từng máy |
| [CẦN ĐIỀN: bài học quản lý từ retro: họp, ước lượng, phân công] | | |

## 4. Bài học kỹ thuật đáng giữ

1. Phiên âm live tốt cần ba thứ cùng lúc: chunk ngắn, cửa sổ ngắn (commit các từ mà hai lượt phiên âm đều cho
   kết quả giống nhau), và đường truyền kết quả nhanh (polling ngắn hoặc push).
2. Với họp trộn ngôn ngữ, nhận ngôn ngữ theo từng câu quan trọng hơn chọn model lớn hơn.
3. Mọi API bên ngoài phải có retry, back-off và thông báo lỗi rõ trên giao diện; lỗi key phải hiện ngay ở header.
4. Bản deploy POC chưa có tài khoản vẫn phải có HTTPS, đăng nhập, bucket private và IAM role tối thiểu.
5. Môi trường dev có thể gây lỗi khó thấy (ví dụ VS Code đặt `ELECTRON_RUN_AS_NODE=1`): script khởi động phải tự
   làm sạch môi trường.

## 5. Khuyến nghị cho giai đoạn sau

- Tài khoản và phân quyền trước khi cho người ngoài dùng thật.
- Nhận diện người nói; trang action items (#79); dịch trực tiếp (#84).
- Ký số bộ cài, tự cập nhật app; CI chạy test tự động trên mỗi Pull Request.
- Theo dõi chi phí API thật trong UAT để cập nhật Business Case ([02](02-business-case.md)).

## 6. Xác nhận đóng dự án

| Hạng mục | Trạng thái |
|---|---|
| Nghiệm thu cuối ([18](18-sow-acceptance.md)) | [CẦN ĐIỀN] |
| Bàn giao mã nguồn, bộ cài, URL, tài liệu | [CẦN ĐIỀN] |
| Gỡ tài nguyên AWS không dùng (EC2, Elastic IP, bucket) | [CẦN ĐIỀN] |
| Lưu trữ tài liệu, biên bản | [CẦN ĐIỀN] |
