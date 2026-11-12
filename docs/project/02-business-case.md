# 02 – Business Case / BRD

**Kết luận:** nên tự xây SumTalk. Với các giả định ở mục 4, sau 3 năm NPV đạt khoảng **+109 triệu VND**, ROI
**89%**, hoàn vốn sau khoảng **1,3 năm (16 tháng)**. Phương án mua SaaS chỉ đạt NPV khoảng +25 triệu VND, ROI
13%, và audio họp phải đưa ra cloud nước ngoài.

> Mọi số tiền dưới đây là **ước tính dựa trên giả định** ghi trong bảng. Thay giả định bằng số thật của nhóm
> (tổng giờ công trên dashboard, số cuộc họp của đơn vị dùng thử) rồi tính lại bằng
> [`tools/pm_calc.py`](tools/pm_calc.py). Tỷ giá giả định: 26.000 VND/USD.

## 1. Bài toán nghiệp vụ

| | Hiện trạng | Mong muốn |
|---|---|---|
| Ghi biên bản | Thư ký gõ tay trong và sau họp, mất 30–60 phút mỗi buổi | Transcript có sẵn khi họp xong; biên bản (tóm tắt, quyết định, việc cần làm) tự tạo |
| Họp online | Phải ghi âm riêng, nghe lại | Thu cả micro và âm thanh cuộc gọi, chữ hiện ngay khi nói |
| Họp trộn Anh – Việt | Dễ sót, dịch tay | Giữ đúng ngôn ngữ từng câu, dịch Việt ↔ Anh một chạm |
| Bảo mật | Dịch vụ AI ngoài đưa dữ liệu ra nước ngoài | Chạy trên máy hoặc server của đơn vị; bucket S3 private |

## 2. Giá trị mang lại

- **Tiết kiệm thời gian:** giả định tiết kiệm 45 phút cho mỗi cuộc họp cần biên bản.
- **Chất lượng:** không sót quyết định hay việc cần làm; tìm kiếm và phát lại đúng đoạn.
- **Tiếp cận:** người vắng mặt đọc tóm tắt hoặc bản dịch thay vì nghe lại 1 giờ.
- **Chủ quyền dữ liệu:** tự host được (desktop local hoặc server riêng).

## 3. Các phương án

| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| P0. Giữ nguyên | Ghi tay như hiện tại | Không tốn đầu tư | Tốn giờ công, sót nội dung |
| **P1. Tự xây SumTalk** | Dự án này: web + desktop, Whisper + LLM | Làm theo nhu cầu tiếng Việt và họp trộn ngôn ngữ, tự host, chi phí vận hành thấp | Tốn công phát triển, cần bảo trì |
| P2. Mua SaaS ghi chú họp | Dịch vụ AI note-taker trả phí theo người | Dùng ngay | Phí theo người cao, dữ liệu ra nước ngoài, tiếng Việt và họp trộn còn yếu |

## 4. Giả định tài chính

| Giả định | Giá trị | Ghi chú |
|---|---|---|
| Tổng công phát triển | **600 giờ** × 100.000 VND = **60.000.000 VND** | [CẦN ĐIỀN: thay bằng tổng giờ thực tế] |
| Đơn vị dùng thử | 40 cuộc họp/tuần × 48 tuần = 1.920 cuộc/năm | ví dụ một công ty khoảng 50 người |
| Thời gian tiết kiệm | 0,75 giờ/cuộc họp, quy đổi 100.000 VND/giờ | lợi ích tối đa 144.000.000 VND/năm |
| Tỷ lệ áp dụng | Năm 1: 50%, năm 2: 80%, năm 3: 90% | |
| Vận hành P1 (mỗi năm) | 35.744.000 VND | chi tiết bên dưới |
| Phí SaaS P2 | 20 người × 15 USD/tháng = 93.600.000 VND/năm | giá tham khảo, cần kiểm tra |
| Suất chiết khấu, thời gian | 10%/năm, 3 năm | |

Chi phí vận hành P1 mỗi năm:

| Khoản | VND/năm |
|---|---|
| EC2 t3.large + EBS + IP (khoảng 85 USD/tháng) | 26.520.000 |
| Whisper API (1.600 giờ audio × 0,04 USD) | 1.664.000 |
| LLM API tóm tắt/dịch (khoảng 5 USD/tháng) | 1.560.000 |
| Bảo trì (10% chi phí phát triển) | 6.000.000 |
| **Tổng** | **35.744.000** |

## 5. Dòng tiền, NPV, ROI, thời gian hoàn vốn

Đơn vị: triệu VND. Dòng tiền ròng = lợi ích − chi phí.

| Năm | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Lợi ích (P1 và P2 như nhau) | 0 | 72,0 | 115,2 | 129,6 |
| **P1** chi phí | 60,0 | 35,7 | 35,7 | 35,7 |
| **P1** dòng tiền ròng | −60,0 | 36,3 | 79,5 | 93,9 |
| **P1** luỹ kế | −60,0 | −23,7 | 55,7 | 149,6 |
| **P2** chi phí | 0 | 93,6 | 93,6 | 93,6 |
| **P2** dòng tiền ròng | 0 | −21,6 | 21,6 | 36,0 |

```latex
NPV = \sum_{t=0}^{3} \frac{CF_t}{(1+0{,}1)^t}
\qquad ROI = \frac{\sum \text{lợi ích} - \sum \text{chi phí}}{\sum \text{chi phí}}
```

| Chỉ số | P0 Giữ nguyên | **P1 Tự xây** | P2 SaaS |
|---|---|---|---|
| NPV (3 năm, 10%) | 0 | **+109,1 triệu** | +25,3 triệu |
| ROI (3 năm) | – | **89,4%** | 12,8% |
| Hoàn vốn | – | **1,3 năm (khoảng 16 tháng)** | khoảng 2 năm |
| Dữ liệu họp | trong đơn vị | trong đơn vị | ra nước ngoài |

Cách tính hoàn vốn P1: luỹ kế hết năm 1 là −23,7 triệu, năm 2 thu thêm 79,5 triệu, nên
1 + 23,7 / 79,5 ≈ 1,30 năm.

## 6. Phân tích độ nhạy

| Kịch bản | NPV P1 |
|---|---|
| Cơ sở | +109,1 triệu |
| Công phát triển gấp đôi (1.200 giờ) | +49,1 triệu (vẫn có lời) |
| Lợi ích chỉ bằng một nửa (ít họp hoặc áp dụng chậm) | −19,9 triệu (lỗ) |
| Điểm hoà vốn | khoảng **23 cuộc họp/tuần** thì NPV = 0 |

Nhận xét: kết quả nhạy với số cuộc họp thực tế hơn là với chi phí phát triển. Trước khi mở rộng nên đo số
cuộc họp và thời gian tiết kiệm thật trong đợt UAT.

## 7. Rủi ro tài chính chính

Chi phí API vượt dự kiến khi dùng nhiều (R6 – đã có cấu hình `LIVE_INTERVAL_SEC`, token/cost log); GPU đắt nếu
chạy 24/7 (bật/tắt theo giờ, hoặc dùng cấu hình CPU + API); tỷ lệ áp dụng thấp. Xem [09](09-risk-register.md).

## 8. Khuyến nghị

Chọn **P1**. Bắt đầu bằng bản web trên EC2 CPU + Whisper API để chi phí thấp. Khi số cuộc họp vượt khoảng
25/tuần, hoặc khi nhiều người dùng app desktop, mới chuyển sang server GPU (`STT_SERVER_API_KEYS`).
