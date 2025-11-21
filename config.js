module.exports = {
    // Bot Configuration
    BOT_TOKEN: process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
    
    // Trading Configuration
    MIN_CONFIDENCE: 60,
    RISK_PERCENT: 1,
    ACCOUNT_BALANCE: 1000,
    
    // Auto Analysis Schedule
    ANALYSIS_INTERVAL: 2.5 * 60 * 60 * 1000, // 2.5 hours in milliseconds
    ACTIVE_HOURS: {
        start: 4,    // 4:00 AM
        end: 23.5    // 11:30 PM
    },
    
    // Popular Cryptocurrencies (40 coins)
    POPULAR_COINS: [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
        'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT',
        'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT', 'XLMUSDT',
        'ALGOUSDT', 'TRXUSDT', 'ETCUSDT', 'XMRUSDT', 'EOSUSDT',
        'AAVEUSDT', 'XTZUSDT', 'SUSHIUSDT', 'MKRUSDT', 'COMPUSDT',
        'YFIUSDT', 'SNXUSDT', 'CRVUSDT', 'SANDUSDT', 'MANAUSDT',
        'GALAUSDT', 'ENJUSDT', 'CHZUSDT', 'BATUSDT', 'ZILUSDT',
        'IOTAUSDT', 'FILUSDT', 'THETAUSDT', 'VETUSDT', 'HOTUSDT'
    ],
    
    // Binance API Endpoints
    BINANCE_API: {
        klines: (symbol, interval, limit = 500) => 
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        price: (symbol) => 
            `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
        fundingRate: (symbol) => 
            `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`,
        ticker24h: (symbol) => 
            `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`
    },

    // Timeframes for analysis
    TIMEFRAMES: [
        { label: 'D1', interval: '1d', weight: 1.5 },
        { label: 'H4', interval: '4h', weight: 1.3 },
        { label: 'H1', interval: '1h', weight: 1.1 },
        { label: '15M', interval: '15m', weight: 0.8 }
    ]
};
