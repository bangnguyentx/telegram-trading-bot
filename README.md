# AI Trading Bot 🤖

Bot Telegram tự động phân tích crypto với ICT concepts và gửi tín hiệu trading.

## 🚀 Tính năng

- ✅ Tự động phân tích 40 coin phổ biến mỗi 2.5 giờ
- ✅ Chỉ gửi tín hiệu Confidence Score 60-100%
- ✅ Hoạt động từ 4:00 - 23:30 hàng ngày
- ✅ Menu tương tác với người dùng
- ✅ Cho phép user gửi tín hiệu cộng đồng
- ✅ Chạy ngầm trên Render 24/7

## ⚙️ Cài đặt

1. **Tạo Bot Telegram**
   - Chat với @BotFather trên Telegram
   - Tạo bot mới và lấy token

2. **Deploy lên Render**
   - Fork repository này
   - Tạo Web Service mới trên Render
   - Thêm biến môi trường: `BOT_TOKEN=your_telegram_bot_token`

3. **Cấu hình**
   ```javascript
   // Trong config.js
   MIN_CONFIDENCE: 60,          // Ngưỡng Confidence Score
   ANALYSIS_INTERVAL: 2.5 * 60 * 60 * 1000, // 2.5 giờ
   ACTIVE_HOURS: { start: 4, end: 23.5 }    // 4:00 - 23:30
