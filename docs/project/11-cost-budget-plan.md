# 11 – Kế hoạch chi phí và ngân sách

**Tóm tắt:** chi phí chính là nhân công, tính theo đơn giá 100.000 VND/giờ trên dashboard chi phí của nhóm. Chi
phí ngoài nhân công nhỏ: bản test trên AWS khoảng 2,5–3 triệu VND/tháng nếu chạy 24/7 cấu hình CPU, gần như 0 nếu
chỉ bật khi demo. Ngân sách gồm thêm 10% dự phòng.

## 1. Đơn giá

| Hạng mục | Đơn giá | Nguồn |
|---|---|---|
| Nhân công (mọi vai trò) | 100.000 VND/giờ | dashboard chi phí của nhóm |
| Tỷ giá quy đổi | 26.000 VND/USD | giả định |

## 2. Chi phí nhân công theo sprint

| Sprint | Giờ kế hoạch | Chi phí kế hoạch (PV) | Giờ thực tế | Chi phí thực tế (AC) |
|---|---|---|---|---|
| Sprint 1 | [CẦN ĐIỀN] | = giờ × 100.000 | [CẦN ĐIỀN] | |
| Sprint 2 | [CẦN ĐIỀN] | | [CẦN ĐIỀN] | |
| Sprint 3 | [CẦN ĐIỀN] | | [CẦN ĐIỀN] | |
| Sprint 4 | [CẦN ĐIỀN] | | [CẦN ĐIỀN] | |
| **Tổng (BAC)** | | | | |

Giá trị theo từng sprint dùng cho EVA ở [15](15-earned-value.md).

## 3. Chi phí ngoài nhân công

Giá dưới đây là ước tính từ bảng giá công khai, cần kiểm tra lại trên AWS Pricing Calculator và trang giá của nhà
cung cấp trước khi dùng.

| Khoản | Cách tính | Ước tính/tháng | Ghi chú |
|---|---|---|---|
| EC2 `t3.large` (Singapore), 24/7 | khoảng 0,1 USD/giờ × 730 giờ | khoảng 2,0 triệu VND | bật/tắt theo giờ test: rẻ hơn tương ứng |
| EBS gp3 30 GB | khoảng 0,1 USD/GB | khoảng 80.000 VND | |
| Public IPv4 / Elastic IP | khoảng 0,005 USD/giờ | khoảng 95.000 VND | nhớ release khi gỡ |
| S3 Standard | khoảng 0,025 USD/GB; 1 giờ audio khoảng 115 MB | < 50.000 VND cho 100 giờ audio | |
| Whisper API – Groq `whisper-large-v3-turbo` | khoảng 0,04 USD/giờ audio | 100 giờ audio khoảng 104.000 VND | live: cửa sổ ngắn gửi lặp lại, chi phí thực tế cao hơn giờ audio |
| Whisper API – OpenAI `whisper-1` | khoảng 0,006 USD/phút | 100 giờ audio khoảng 940.000 VND | phương án dự phòng |
| LLM tóm tắt/dịch (cloud, model nhỏ) | theo token; app log chi phí từng lần chạy | khoảng 130.000 VND | `LLM_PRICE_*_PER_1M` để log chi phí |
| EC2 GPU `g4dn.xlarge` (nếu cần) | khoảng 0,7 USD/giờ | 20 giờ demo khoảng 370.000 VND | không chạy 24/7 |
| Chứng chỉ HTTPS, tên miền | Let's Encrypt miễn phí; sslip.io miễn phí | 0 | tên miền riêng tuỳ chọn |
| Ký số bộ cài (code signing) | – | 0 | ngoài phạm vi (R12) |
| **Tổng cấu hình A, 24/7** | | **khoảng 2,5–3 triệu VND** | |

## 4. Tổng ngân sách

| Khoản | Giá trị |
|---|---|
| Nhân công (BAC nhân công) | [CẦN ĐIỀN: tổng giờ × 100.000] |
| Hạ tầng + API trong thời gian test (giả định 2 tháng) | khoảng 6 triệu VND |
| Dự phòng (10%) | 10% × (nhân công + hạ tầng) |
| **Tổng ngân sách được duyệt** | [CẦN ĐIỀN] |

## 5. Kiểm soát chi phí

- **Theo dõi:** dashboard chi phí của nhóm cập nhật giờ mỗi sprint; EVA (CPI/SPI) trong sprint report
  ([14](14-sprint-status-reports.md), [15](15-earned-value.md)).
- **Cảnh báo:** AWS Budget (email ở mức 80%); log chi phí token của từng lần tóm tắt/dịch.
- **Ngưỡng hành động:** CPI < 0,9 hoặc chi phí ngoài nhân công vượt 25% ngân sách tháng thì PM báo PO và Sponsor,
  cân nhắc cắt phạm vi (Should/Could) hoặc chuyển cấu hình rẻ hơn (CPU + API, tắt máy khi không dùng).
- **Biện pháp kỹ thuật đã có:** `AI_MOCK=true` khi demo; VAD không gửi đoạn im lặng; `LIVE_INTERVAL_SEC` giảm số
  request khi ghi live; engine remote dùng chung một server GPU cho nhiều máy khách.
