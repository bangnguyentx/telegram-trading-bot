const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const express = require('express'); // THÊM EXPRESS
const TradingAnalyzer = require('./analyzer');
const config = require('./config');

class TradingBot {
    constructor() {
        this.bot = new Telegraf(config.BOT_TOKEN);
        this.analyzer = new TradingAnalyzer();
        this.userSignals = new Map();
        this.setupHandlers();
        
        // Khởi tạo Express server để Render không báo lỗi
        this.setupHttpServer();
    }

    setupHttpServer() {
        const app = express();
        const PORT = process.env.PORT || 3000;

        app.get('/', (req, res) => {
            res.json({ 
                status: 'AI Trading Bot is running!',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        // Khởi động server
        this.server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 HTTP Server running on port ${PORT}`);
        });
    }
    
        // Start command
        this.bot.start((ctx) => {
            const userName = ctx.from.first_name || 'Trader';
            ctx.reply(
                `👋 Chào ${userName}!\n` +
                `🧠 ĐÂY LÀ AI TRADING VIP PRO.\n\n` +
                `⚡AI đang trong quá trình test, theo AI tối đa 1% risk.\n` +
                `👑 Bot created by Hoàng Dũng: @HOANGDUNGG789`,
                this.getMainMenu()
            );
        });

        // Analyze symbol command
        this.bot.command('analyzesymbol', async (ctx) => {
            const symbol = ctx.message.text.split(' ')[1];
            if (!symbol) {
                return ctx.reply('Vui lòng cung cấp symbol. Ví dụ: /analyzesymbol BTCUSDT');
            }

            try {
                await ctx.reply(`🔄 Đang phân tích ${symbol}...`);
                const analysis = await this.analyzer.performICTComprehensiveAnalysis(symbol.toUpperCase());
                
                if (analysis.signals.direction !== 'NO_TRADE' && analysis.signals.confidence >= config.MIN_CONFIDENCE) {
                    const signalCount = this.analyzer.incrementSignalCount();
                    const message = this.formatSignalMessage(analysis, symbol.toUpperCase(), signalCount, 'user');
                    ctx.reply(message);
                } else {
                    ctx.reply(`❌ Không có tín hiệu cho ${symbol}. Confidence: ${analysis.signals.confidence}%`);
                }
            } catch (error) {
                ctx.reply(`❌ Lỗi khi phân tích ${symbol}: ${error.message}`);
            }
        });

        // User signal command
        this.bot.command('signal', (ctx) => {
            const parts = ctx.message.text.split(' ');
            if (parts.length < 6) {
                return ctx.reply('Sai format. Ví dụ: /signal BTCUSDT Long 50000 49000 52000');
            }

            const symbol = parts[1].toUpperCase();
            const direction = parts[2];
            const entry = parts[3];
            const sl = parts[4];
            const tp = parts[5];

            const signalCount = this.analyzer.incrementSignalCount();
            const message = this.formatUserSignal(symbol, direction, entry, sl, tp, signalCount, ctx.from);

            // Gửi đến tất cả users (trong thực tế cần lưu trữ user database)
            this.broadcastMessage(message);
            ctx.reply('✅ Đã gửi tín hiệu đến cộng đồng!');
        });

        // Main menu handlers
        this.bot.action('analyze_menu', (ctx) => {
            ctx.reply('Nhập symbol để phân tích (ví dụ: BTCUSDT) hoặc dùng lệnh /analyzesymbol BTCUSDT');
        });

        this.bot.action('send_signal', (ctx) => {
            ctx.reply('Gửi tín hiệu bằng lệnh: /signal SYMBOL DIRECTION ENTRY SL TP\nVí dụ: /signal BTCUSDT Long 50000 49000 52000');
        });

        this.bot.action('status', (ctx) => {
            const signalCount = this.analyzer.getCurrentSignalCount();
            ctx.reply(`📊 Hôm nay đã gửi ${signalCount} tín hiệu\n⏰ Bot hoạt động từ 4:00 - 23:30`);
        });
    }

    getMainMenu() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Analyze Symbol', 'analyze_menu')],
            [Markup.button.callback('📤 Gửi Tín Hiệu', 'send_signal')],
            [Markup.button.callback('📊 Trạng Thái', 'status')]
        ]);
    }

    formatSignalMessage(analysis, symbol, signalCount, source = 'bot') {
        const riskWarning = `\n\n⚠️ Nhất định phải tuân thủ quản lý rủi ro – Đi tối đa 1-2% risk\n🤖 Bot chỉ để tham khảo, win 3 lệnh nên ngưng`;

        if (source === 'bot') {
            return `🤖 Tín hiệu #${signalCount} trong ngày\n` +
                   `#${symbol} – ${analysis.signals.direction} 📌\n\n` +
                   `🟢 Entry: ${analysis.signals.entry}\n` +
                   `🆗 Take Profit: ${analysis.signals.takeProfit}\n` +
                   `🙅‍♂️ Stop-Loss: ${analysis.signals.stopLoss}\n` +
                   `🪙 Tỉ lệ RR: ${analysis.signals.riskReward}\n\n` +
                   `🧠 By AI Trading Bot (@HOANGDUNGG789)` +
                   riskWarning;
        } else {
            return `🤖 Tín hiệu #${signalCount} trong ngày\n` +
                   `#${symbol} – ${analysis.signals.direction} 📌\n\n` +
                   `🟢 Entry: ${analysis.signals.entry}\n` +
                   `🆗 Take Profit: ${analysis.signals.takeProfit}\n` +
                   `🙅‍♂️ Stop-Loss: ${analysis.signals.stopLoss}\n` +
                   `🪙 Tỉ lệ RR: ${analysis.signals.riskReward}\n\n` +
                   `🧠 By User Analysis` +
                   riskWarning;
        }
    }

    formatUserSignal(symbol, direction, entry, sl, tp, signalCount, user) {
        const rr = (Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2);
        const userName = user.first_name || 'User';
        const userTag = user.username ? `@${user.username}` : 'User';

        return `🤖 Tín hiệu #${signalCount} trong ngày\n` +
               `#${symbol} – ${direction} 📌\n\n` +
               `🟢 Entry: ${entry}\n` +
               `🆗 Take Profit: ${tp}\n` +
               `🙅‍♂️ Stop-Loss: ${sl}\n` +
               `🪙 Tỉ lệ RR: ${rr}\n\n` +
               `🧠 By ${userName} (${userTag})\n\n` +
               `⚠️ Nhất định phải tuân thủ quản lý rủi ro – Đi tối đa 1-2% risk\n🤖 Bot chỉ để tham khảo, win 3 lệnh nên ngưng`;
    }

    broadcastMessage(message) {
        // Trong thực tế, cần lưu trữ chat IDs của tất cả users
        // Ở đây chỉ log ra console
        console.log('📤 Broadcasting message:', message);
    }

    isWithinActiveHours() {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        return currentHour >= config.ACTIVE_HOURS.start && currentHour <= config.ACTIVE_HOURS.end;
    }

    async analyzeAllCoins() {
        if (!this.isWithinActiveHours()) {
            console.log('⏸️ Bot không hoạt động ngoài giờ (4:00 - 23:30)');
            return;
        }

        console.log(`🔄 Bắt đầu phân tích ${config.POPULAR_COINS.length} coins...`);
        
        for (const symbol of config.POPULAR_COINS) {
            try {
                console.log(`🔍 Đang phân tích ${symbol}...`);
                const analysis = await this.analyzer.performICTComprehensiveAnalysis(symbol);
                
                if (analysis.signals.direction !== 'NO_TRADE' && analysis.signals.confidence >= config.MIN_CONFIDENCE) {
                    const signalCount = this.analyzer.incrementSignalCount();
                    const message = this.formatSignalMessage(analysis, symbol, signalCount, 'bot');
                    
                    console.log(`✅ Tìm thấy tín hiệu ${symbol}: ${analysis.signals.direction} (${analysis.signals.confidence}%)`);
                    this.broadcastMessage(message);
                    
                    // Delay để tránh rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log(`⏭️ Bỏ qua ${symbol}: Confidence ${analysis.signals.confidence}%`);
                }
            } catch (error) {
                console.error(`❌ Lỗi phân tích ${symbol}:`, error.message);
            }
        }
    }

    startAutoAnalysis() {
        // Chạy ngay lần đầu
        this.analyzeAllCoins();

        // Lập lịch mỗi 2.5 giờ
        setInterval(() => {
            this.analyzeAllCoins();
        }, config.ANALYSIS_INTERVAL);

        // Lời chào hàng ngày lúc 4:00
        cron.schedule('0 4 * * *', () => {
            const message = '🌞 Chào buổi sáng! AI Trading Bot đã sẵn sàng phân tích thị trường hôm nay! 🚀';
            this.broadcastMessage(message);
        });

        console.log('🤖 Bot đã khởi động - Auto analysis mỗi 2.5 giờ từ 4:00 đến 23:30');
    }

    start() {
        // Khởi động bot trước
        this.bot.launch().then(() => {
            console.log('✅ Telegram Bot đã khởi động thành công!');
            this.startAutoAnalysis();
        }).catch(error => {
            console.error('❌ Lỗi khởi động bot:', error);
        });

        // Enable graceful stop
        process.once('SIGINT', () => {
            console.log('🛑 Shutting down gracefully...');
            this.bot.stop('SIGINT');
            this.server?.close();
        });
        process.once('SIGTERM', () => {
            console.log('🛑 Shutting down gracefully...');
            this.bot.stop('SIGTERM');
            this.server?.close();
        });
    }
}

// Khởi động bot
const tradingBot = new TradingBot();
tradingBot.start();
