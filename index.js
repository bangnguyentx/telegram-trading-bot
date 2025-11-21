require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment-timezone');
const express = require('express');
const { analyzeSymbol } = require('./analysis');

// --- CẤU HÌNH ---
// Thay TOKEN của bạn vào file .env hoặc hardcode tạm vào đây (không khuyến khích)
const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN_HERE'; 
const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// Danh sách 40 coin nổi tiếng để quét
const TARGET_COINS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'LINKUSDT', 'MATICUSDT',
    'DOTUSDT', 'LTCUSDT', 'SHIBUSDT', 'AVAXUSDT', 'UNIUSDT', 'ATOMUSDT', 'XMRUSDT', 'ETCUSDT', 'XLMUSDT', 'BCHUSDT',
    'FILUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'RNDRUSDT', 'LDOUSDT', 'TIAUSDT', 'SUIUSDT',
    'SEIUSDT', 'PEPEUSDT', 'FETUSDT', 'AGIXUSDT', 'GALAUSDT', 'SANDUSDT', 'MANAUSDT', 'AAVEUSDT', 'SNXUSDT', 'IMXUSDT'
];

// --- BIẾN TRẠNG THÁI ---
let chatIdToSendAlerts = null; // Lưu ID nhóm/người dùng để gửi auto alert
let signalCountToday = 0;

// --- SERVER EXPRESS (KEEP-ALIVE) ---
// Render cần 1 web service để giữ app chạy. Chúng ta tạo 1 trang web đơn giản.
app.get('/', (req, res) => {
    res.send('AI Trading Bot is Running...');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- CÁC HÀM TIỆN ÍCH ---

function getVietnamTime() {
    return moment().tz("Asia/Ho_Chi_Minh");
}

function formatSignalMessage(data, signalIndex) {
    const icon = data.direction === 'LONG' ? '🟢' : '🔴';
    const entry = parseFloat(data.entry);
    const sl = parseFloat(data.sl);
    const tp = parseFloat(data.tp);
    
    // Định dạng số thập phân thông minh
    const fmt = (num) => num > 10 ? num.toFixed(2) : num.toFixed(4);

    return `🤖 Tín hiệu [${signalIndex} trong ngày]
#${data.symbol.replace('USDT', '')} – [${data.direction}] 📌

${icon} Entry: ${fmt(entry)}
🆗 Take Profit: ${fmt(tp)}
🙅‍♂️ Stop-Loss: ${fmt(sl)}
🪙 Tỉ lệ RR: ${data.rr} (Conf: ${data.confidence}%)

🧠 By [bot, tên @HOANGDUNGG789] 

Nhất định phải tuân thủ quản lý rủi ro – Đi tối đa 1-2% risk, Bot chỉ để tham khảo, win 3 lệnh nên ngưng`;
}

// --- AUTO REFRESH LOGIC ---

async function runAutoAnalysis() {
    const now = getVietnamTime();
    const currentHour = now.hours();
    const currentMinute = now.minutes();

    // Chỉ chạy từ 4h đến 23h30
    if (currentHour < 4 || (currentHour === 23 && currentMinute > 30)) {
        console.log('Out of operating hours (04:00 - 23:30). Sleeping...');
        return;
    }

    console.log(`Starting Auto Analysis at ${now.format('HH:mm')}`);
    
    if (!chatIdToSendAlerts) {
        console.log('No Chat ID set for alerts. Use /start to set.');
        return;
    }

    for (const coin of TARGET_COINS) {
        // Delay nhỏ để tránh spam API Binance
        await new Promise(r => setTimeout(r, 1000)); 

        const result = await analyzeSymbol(coin);
        
        if (result && result.direction !== 'NEUTRAL') {
            // Điều kiện: Confidence Score trên 60%
            if (result.confidence >= 60 && result.confidence <= 100) {
                signalCountToday++;
                const msg = formatSignalMessage(result, signalCountToday);
                bot.sendMessage(chatIdToSendAlerts, msg);
            }
        }
    }
}

// Gửi lời chào mỗi ngày mới (Reset count)
function checkDailyGreeting() {
    const now = getVietnamTime();
    // Kiểm tra nếu là 4:00 AM
    if (now.hours() === 4 && now.minutes() === 0) {
        signalCountToday = 0; // Reset đếm tín hiệu
        if (chatIdToSendAlerts) {
            bot.sendMessage(chatIdToSendAlerts, "🌞 Chào ngày mới các nhà giao dịch! AI Trading Bot đã sẵn sàng săn tìm cơ hội. Chúc mọi người Big Win!");
        }
    }
}

// Thiết lập Interval: 
// 1. Quét tín hiệu 2.5 tiếng/lần (2.5 * 60 * 60 * 1000 ms)
const ANALYSIS_INTERVAL = 2.5 * 60 * 60 * 1000;
setInterval(runAutoAnalysis, ANALYSIS_INTERVAL);

// 2. Kiểm tra giờ chào mỗi phút
setInterval(checkDailyGreeting, 60 * 1000);

// --- BOT COMMANDS ---

// /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatIdToSendAlerts = chatId; // Lưu ID này để gửi tin nhắn tự động
    
    const userName = msg.from.first_name;
    const welcomeMsg = `👋 Chào ${userName}!
🧠 ĐÂY LÀ AI TRADING VIP PRO.

⚡AI đang trong quá trình test, theo AI tối đa 1% risk.
👑 Bot created by Hoàng Dũng: @HOANGDUNGG789`;

    const opts = {
        reply_markup: {
            keyboard: [
                ['Gửi tín hiệu'],
                ['Analyze Symbol']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };

    bot.sendMessage(chatId, welcomeMsg, opts);
});

// Xử lý Menu Button và Lệnh Manual
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Xử lý nút Menu
    if (text === 'Gửi tín hiệu') {
        bot.sendMessage(chatId, 'Để gửi tín hiệu, hãy nhập theo cú pháp:\n/[BTCUSDT] [Long], [Entry], [Sl], [TP]');
    } else if (text === 'Analyze Symbol' || text === 'analyze symbol') {
        bot.sendMessage(chatId, 'Hãy nhập lệnh: /analyzesymbol [Tên coin]\nVí dụ: /analyzesymbol BTCUSDT');
    }

    // Xử lý lệnh gửi tín hiệu riêng: /[Tên coin], [Long/Short], ...
    // Regex bắt cú pháp /[...] ...
    if (text.startsWith('/[') && text.includes(']')) {
        // Logic đơn giản để gửi lại tin nhắn cho mọi người (trong group)
        // Hoặc bot chỉ forward lại nội dung đẹp hơn
        bot.sendMessage(chatId, `📣 Tín hiệu từ thành viên:\n${text.substring(1)}`); // Bỏ dấu / đầu tiên
    }
});

// /analyzesymbol [Coin]
bot.onText(/\/analyzesymbol (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let symbol = match[1].toUpperCase().trim();
    
    // Thêm USDT nếu user quên
    if (!symbol.endsWith('USDT')) symbol += 'USDT';

    bot.sendMessage(chatId, `⏳ Đang phân tích ${symbol}... vui lòng đợi.`);

    const result = await analyzeSymbol(symbol);

    if (result) {
        // Với lệnh manual, ta luôn gửi kết quả dù confidence thấp, nhưng cảnh báo
        let advice = "";
        if (result.confidence < 60) advice = "\n⚠️ Cảnh báo: Confidence Score thấp (<60%), rủi ro cao.";
        
        const msgContent = formatSignalMessage(result, "MANUAL") + advice;
        bot.sendMessage(chatId, msgContent);
    } else {
        bot.sendMessage(chatId, `❌ Không tìm thấy dữ liệu cho ${symbol} hoặc lỗi API.`);
    }
});

console.log('Bot is running...');
