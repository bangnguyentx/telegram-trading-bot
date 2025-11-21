const axios = require('axios');

// Cấu hình API
const BINANCE_API = {
    klines: (symbol, interval, limit = 300) => 
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    price: (symbol) => 
        `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
};

const TIMEFRAMES = [
    { label: 'D1', interval: '1d', weight: 1.5 },
    { label: 'H4', interval: '4h', weight: 1.3 },
    { label: 'H1', interval: '1h', weight: 1.1 },
    { label: '15M', interval: '15m', weight: 0.8 }
];

// --- CÁC HÀM HỖ TRỢ LOGIC (Giữ nguyên logic toán học của bạn) ---

async function loadCandles(symbol, interval) {
    try {
        const response = await axios.get(BINANCE_API.klines(symbol, interval));
        return response.data.map(candle => ({
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            vol: parseFloat(candle[5]),
            t: candle[0]
        }));
    } catch (error) {
        // console.error(`Error fetching ${symbol} ${interval}`);
        return [];
    }
}

function calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    const trValues = [];
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i-1].close),
            Math.abs(candles[i].low - candles[i-1].close)
        );
        trValues.push(tr);
    }
    let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trValues.length; i++) {
        atr = (atr * (period - 1) + trValues[i]) / period;
    }
    return atr;
}

function isSwingHigh(highs, index, lookback = 3) {
    for (let i = 1; i <= lookback; i++) {
        if (index - i >= 0 && highs[index] <= highs[index - i]) return false;
        if (index + i < highs.length && highs[index] <= highs[index + i]) return false;
    }
    return true;
}

function isSwingLow(lows, index, lookback = 3) {
    for (let i = 1; i <= lookback; i++) {
        if (index - i >= 0 && lows[index] >= lows[index - i]) return false;
        if (index + i < lows.length && lows[index] >= lows[index + i]) return false;
    }
    return true;
}

function analyzeAdvancedMarketStructure(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    const structure = {
        swingHighs: [],
        swingLows: [],
        trend: 'neutral',
        breakOfStructure: false
    };
    
    for (let i = 3; i < candles.length - 3; i++) {
        if (isSwingHigh(highs, i)) structure.swingHighs.push({ index: i, price: highs[i] });
        if (isSwingLow(lows, i)) structure.swingLows.push({ index: i, price: lows[i] });
    }
    
    if (structure.swingHighs.length >= 2 && structure.swingLows.length >= 2) {
        const recentHighs = structure.swingHighs.slice(-2);
        const recentLows = structure.swingLows.slice(-2);
        if (recentHighs[1].price > recentHighs[0].price && recentLows[1].price > recentLows[0].price) {
            structure.trend = 'bullish';
        } else if (recentHighs[1].price < recentHighs[0].price && recentLows[1].price < recentLows[0].price) {
            structure.trend = 'bearish';
        }
    }
    return structure;
}

function findOrderBlocks(candles) {
    const blocks = [];
    for (let i = 1; i < candles.length - 1; i++) {
        const current = candles[i];
        const next = candles[i + 1];
        if (current.close < current.open && next.close < next.open && 
            Math.abs(next.close - next.open) > Math.abs(current.close - current.open) * 1.5) {
            blocks.push({ type: 'bearish', high: current.high, low: current.low, strength: 0.8 });
        }
        if (current.close > current.open && next.close > next.open && 
            Math.abs(next.close - next.open) > Math.abs(current.close - current.open) * 1.5) {
            blocks.push({ type: 'bullish', high: current.high, low: current.low, strength: 0.8 });
        }
    }
    return blocks.slice(-10);
}

function findFairValueGaps(candles) {
    const gaps = [];
    for (let i = 1; i < candles.length - 1; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        const next = candles[i + 1];
        if (curr.low > Math.max(prev.high, next.high)) {
            gaps.push({ type: 'bullish', high: Math.min(prev.low, next.low), low: curr.high });
        }
        if (curr.high < Math.min(prev.low, next.low)) {
            gaps.push({ type: 'bearish', high: curr.low, low: Math.max(prev.high, next.high) });
        }
    }
    return gaps.slice(-8);
}

function findLiquidityLevels(candles) {
    const levels = [];
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    for (let i = 5; i < candles.length - 5; i++) {
        if (isSwingHigh(highs, i, 2)) levels.push({ type: 'resistance', price: highs[i] });
        if (isSwingLow(lows, i, 2)) levels.push({ type: 'support', price: lows[i] });
    }
    return levels.slice(-6);
}

function analyzeTimeframeICT(candles) {
    if(candles.length === 0) return null;
    const price = candles[candles.length - 1].close;
    const marketStructure = analyzeAdvancedMarketStructure(candles);
    const orderBlocks = findOrderBlocks(candles);
    const fairValueGaps = findFairValueGaps(candles);
    const liquidityLevels = findLiquidityLevels(candles);
    const atr = calculateATR(candles);
    
    // Tính toán volume delta đơn giản
    const recentVol = candles.slice(-5).reduce((sum, c) => sum + c.vol, 0) / 5;
    const olderVol = candles.slice(-20, -5).reduce((sum, c) => sum + c.vol, 0) / 15;
    const volumeDelta = olderVol > 0 ? recentVol / olderVol : 1;

    return {
        price,
        trend: marketStructure.trend,
        marketStructure,
        orderBlocks,
        fairValueGaps,
        liquidityLevels,
        atr,
        volumeDelta
    };
}

function calculateRealConfidence(results) {
    let totalScore = 0;
    let maxScore = 0;
    
    for (const [tf, data] of Object.entries(results.timeframes)) {
        if(!data.analysis) continue;
        const analysis = data.analysis;
        const weight = TIMEFRAMES.find(t => t.label === tf)?.weight || 1;
        
        let tfScore = 0;
        if (analysis.marketStructure.trend !== 'neutral') tfScore += 20;
        if (analysis.volumeDelta > 1.2) tfScore += 25;
        tfScore += Math.min(20, analysis.orderBlocks.length * 3);
        tfScore += Math.min(15, analysis.fairValueGaps.length * 2);
        
        totalScore += tfScore * weight;
        maxScore += 100 * weight;
    }
    
    return Math.min(100, (totalScore / maxScore) * 100);
}

function calculateMultiTFBias(timeframesValues) {
    let bias = 0;
    timeframesValues.forEach((tf, index) => {
        if(!tf.analysis) return;
        const weight = TIMEFRAMES[index].weight;
        if (tf.analysis.trend === 'bullish') bias += weight;
        else if (tf.analysis.trend === 'bearish') bias -= weight;
    });
    return bias;
}

function calculateSmartLevels(direction, currentPrice, analysis) {
    const atr = analysis.atr;
    let entry, sl, tp;

    if (direction === 'LONG') {
        entry = currentPrice; // Đơn giản hóa cho bot: entry là giá hiện tại hoặc điều chỉnh nhẹ
        sl = entry - (atr * 2);
        tp = entry + ((entry - sl) * 2); // RR 1:2 mặc định nếu không tìm thấy cản
    } else {
        entry = currentPrice;
        sl = entry + (atr * 2);
        tp = entry - ((sl - entry) * 2);
    }
    
    const rr = Math.abs((tp - entry) / (entry - sl)).toFixed(2);

    return {
        entry: entry,
        sl: sl,
        tp: tp,
        rr: rr
    };
}

// --- HÀM CHÍNH ĐỂ GỌI TỪ BÊN NGOÀI ---

async function analyzeSymbol(symbol) {
    try {
        const results = { timeframes: {} };
        
        // Lấy dữ liệu đa khung thời gian
        for (const tf of TIMEFRAMES) {
            const candles = await loadCandles(symbol, tf.interval);
            if(candles.length > 0) {
                results.timeframes[tf.label] = {
                    candles,
                    price: candles[candles.length - 1].close,
                    analysis: analyzeTimeframeICT(candles)
                };
            }
        }

        const timeframesValues = Object.values(results.timeframes);
        if (timeframesValues.length === 0) return null;

        const currentPrice = timeframesValues[0].price;
        const bias = calculateMultiTFBias(timeframesValues);
        const confidence = calculateRealConfidence(results);

        const direction = bias > 0.5 ? 'LONG' : bias < -0.5 ? 'SHORT' : 'NEUTRAL';
        
        // Chọn khung thời gian chính để tính SL/TP (H1 hoặc H4)
        const mainTF = results.timeframes['H1'] || results.timeframes['H4'] || timeframesValues[0];
        const levels = calculateSmartLevels(direction, currentPrice, mainTF.analysis);

        return {
            symbol: symbol,
            price: currentPrice,
            direction: direction,
            confidence: Math.round(confidence),
            entry: levels.entry,
            sl: levels.sl,
            tp: levels.tp,
            rr: levels.rr
        };
    } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error.message);
        return null;
    }
}

module.exports = { analyzeSymbol };
