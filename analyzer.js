const axios = require('axios');
const config = require('./config');

class TradingAnalyzer {
    constructor() {
        this.signalCount = 0;
        this.dailySignals = new Map();
    }

    async fetchMarketData(symbol) {
        try {
            const [priceData, fundingData, tickerData] = await Promise.all([
                axios.get(config.BINANCE_API.price(symbol)),
                axios.get(config.BINANCE_API.fundingRate(symbol)),
                axios.get(config.BINANCE_API.ticker24h(symbol))
            ]);

            return {
                symbol,
                price: parseFloat(priceData.data.price),
                fundingRate: parseFloat(fundingData.data[0]?.fundingRate || 0),
                volume: parseFloat(tickerData.data.volume),
                priceChange: parseFloat(tickerData.data.priceChange),
                priceChangePercent: parseFloat(tickerData.data.priceChangePercent),
                high: parseFloat(tickerData.data.highPrice),
                low: parseFloat(tickerData.data.lowPrice)
            };
        } catch (error) {
            throw new Error(`Market data fetch failed: ${error.message}`);
        }
    }

    async loadCandles(symbol, interval, limit = 500) {
        try {
            const response = await axios.get(config.BINANCE_API.klines(symbol, interval, limit));
            const data = response.data;
            
            return data.map(candle => ({
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                vol: parseFloat(candle[5]),
                t: candle[0]
            }));
        } catch (error) {
            throw new Error(`Failed to load candles for ${symbol} ${interval}: ${error.message}`);
        }
    }

    calculateATR(candles, period = 14) {
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

    isSwingHigh(highs, index, lookback = 3) {
        for (let i = 1; i <= lookback; i++) {
            if (index - i >= 0 && highs[index] <= highs[index - i]) return false;
            if (index + i < highs.length && highs[index] <= highs[index + i]) return false;
        }
        return true;
    }

    isSwingLow(lows, index, lookback = 3) {
        for (let i = 1; i <= lookback; i++) {
            if (index - i >= 0 && lows[index] >= lows[index - i]) return false;
            if (index + i < lows.length && lows[index] >= lows[index + i]) return false;
        }
        return true;
    }

    analyzeAdvancedMarketStructure(candles) {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        
        const structure = {
            swingHighs: [],
            swingLows: [],
            trend: 'neutral',
            breakOfStructure: false,
            changeOfCharacter: false
        };
        
        for (let i = 3; i < candles.length - 3; i++) {
            if (this.isSwingHigh(highs, i)) {
                structure.swingHighs.push({
                    index: i,
                    price: highs[i],
                    time: candles[i].t
                });
            }
            if (this.isSwingLow(lows, i)) {
                structure.swingLows.push({
                    index: i,
                    price: lows[i],
                    time: candles[i].t
                });
            }
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

    findOrderBlocks(candles) {
        const blocks = [];
        
        for (let i = 1; i < candles.length - 1; i++) {
            const current = candles[i];
            const next = candles[i + 1];
            
            if (current.close < current.open && next.close < next.open && 
                Math.abs(next.close - next.open) > Math.abs(current.close - current.open) * 1.5) {
                blocks.push({
                    type: 'bearish',
                    high: current.high,
                    low: current.low,
                    time: current.t,
                    strength: Math.random() * 0.5 + 0.5
                });
            }
            
            if (current.close > current.open && next.close > next.open && 
                Math.abs(next.close - next.open) > Math.abs(current.close - current.open) * 1.5) {
                blocks.push({
                    type: 'bullish',
                    high: current.high,
                    low: current.low,
                    time: current.t,
                    strength: Math.random() * 0.5 + 0.5
                });
            }
        }
        
        return blocks.slice(-10);
    }

    findFairValueGaps(candles) {
        const gaps = [];
        
        for (let i = 1; i < candles.length - 1; i++) {
            const prev = candles[i - 1];
            const curr = candles[i];
            const next = candles[i + 1];
            
            if (curr.low > Math.max(prev.high, next.high)) {
                gaps.push({
                    type: 'bullish',
                    high: Math.min(prev.low, next.low),
                    low: curr.high,
                    time: curr.t,
                    strength: Math.random() * 0.5 + 0.5
                });
            }
            
            if (curr.high < Math.min(prev.low, next.low)) {
                gaps.push({
                    type: 'bearish',
                    high: curr.low,
                    low: Math.max(prev.high, next.high),
                    time: curr.t,
                    strength: Math.random() * 0.5 + 0.5
                });
            }
        }
        
        return gaps.slice(-8);
    }

    analyzeVolumeProfile(candles) {
        const volumeByPrice = {};
        let totalVolume = 0;
        
        candles.forEach(candle => {
            const range = candle.high - candle.low;
            const step = range / 10;
            for (let i = 0; i < 10; i++) {
                const priceLevel = (candle.low + step * i).toFixed(2);
                if (!volumeByPrice[priceLevel]) volumeByPrice[priceLevel] = 0;
                volumeByPrice[priceLevel] += candle.vol / 10;
            }
            totalVolume += candle.vol;
        });
        
        let poc = 0;
        let maxVolume = 0;
        for (const [price, volume] of Object.entries(volumeByPrice)) {
            if (volume > maxVolume) {
                maxVolume = volume;
                poc = parseFloat(price);
            }
        }
        
        return {
            poc,
            totalVolume,
            averageVolume: totalVolume / candles.length,
            volumeDelta: this.calculateVolumeDelta(candles)
        };
    }

    calculateVolumeDelta(candles) {
        const recent = candles.slice(-5).reduce((sum, c) => sum + c.vol, 0) / 5;
        const older = candles.slice(-20, -5).reduce((sum, c) => sum + c.vol, 0) / 15;
        return recent / older;
    }

    findLiquidityLevels(candles) {
        const levels = [];
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        
        for (let i = 5; i < candles.length - 5; i++) {
            if (this.isSwingHigh(highs, i, 2)) {
                levels.push({
                    type: 'resistance',
                    price: highs[i],
                    time: candles[i].t,
                    strength: 'strong'
                });
            }
            if (this.isSwingLow(lows, i, 2)) {
                levels.push({
                    type: 'support',
                    price: lows[i],
                    time: candles[i].t,
                    strength: 'strong'
                });
            }
        }
        
        return levels.slice(-6);
    }

    analyzeTimeframeICT(candles, timeframe) {
        const price = candles[candles.length - 1].close;
        const marketStructure = this.analyzeAdvancedMarketStructure(candles);
        const orderBlocks = this.findOrderBlocks(candles);
        const fairValueGaps = this.findFairValueGaps(candles);
        const volumeAnalysis = this.analyzeVolumeProfile(candles);
        const liquidityLevels = this.findLiquidityLevels(candles);
        const atr = this.calculateATR(candles);
        
        return {
            price,
            trend: marketStructure.trend,
            strength: this.calculateTrendStrength(marketStructure),
            marketStructure,
            orderBlocks: this.filterRelevantLevels(orderBlocks, price),
            fairValueGaps: this.filterRelevantLevels(fairValueGaps, price),
            volumeAnalysis,
            liquidityLevels: this.filterRelevantLevels(liquidityLevels, price),
            atr,
            confidence: this.calculateTimeframeConfidence(marketStructure, volumeAnalysis, orderBlocks.length)
        };
    }

    calculateTrendStrength(marketStructure) {
        if (marketStructure.swingHighs.length < 2 || marketStructure.swingLows.length < 2) return 0;
        
        const highSlope = (marketStructure.swingHighs[1].price - marketStructure.swingHighs[0].price) / 
                        (marketStructure.swingHighs[1].index - marketStructure.swingHighs[0].index);
        const lowSlope = (marketStructure.swingLows[1].price - marketStructure.swingLows[0].price) / 
                       (marketStructure.swingLows[1].index - marketStructure.swingLows[0].index);
        
        return Math.abs(highSlope + lowSlope) / 2;
    }

    filterRelevantLevels(levels, currentPrice) {
        return levels.filter(level => {
            const distance = Math.abs(level.price - currentPrice) / currentPrice;
            return distance < 0.05;
        });
    }

    calculateTimeframeConfidence(marketStructure, volumeAnalysis, obCount) {
        let confidence = 50;
        
        if (marketStructure.trend !== 'neutral') confidence += 20;
        if (volumeAnalysis.volumeDelta > 1.2) confidence += 15;
        if (obCount > 0) confidence += 10;
        
        return Math.min(95, confidence);
    }

    calculateRealConfidence(results) {
        let totalScore = 0;
        let maxScore = 0;
        
        for (const [tf, data] of Object.entries(results.timeframes)) {
            const weight = this.getTimeframeWeight(tf);
            const tfScore = this.calculateTFScoreICT(data.analysis);
            
            totalScore += tfScore * weight;
            maxScore += 100 * weight;
        }
        
        const confluenceBonus = this.calculateConfluenceBonus(results);
        totalScore += confluenceBonus;
        
        return Math.min(100, (totalScore / maxScore) * 100);
    }

    getTimeframeWeight(tf) {
        const weights = { 'D1': 1.5, 'H4': 1.3, 'H1': 1.1, '15M': 0.8 };
        return weights[tf] || 1.0;
    }

    calculateTFScoreICT(analysis) {
        let score = 0;
        
        score += analysis.marketStructure.trend !== 'neutral' ? 20 : 0;
        score += analysis.marketStructure.breakOfStructure ? 10 : 0;
        score += analysis.marketStructure.changeOfCharacter ? 5 : 0;
        
        if (analysis.volumeAnalysis.volumeDelta) {
            score += Math.min(25, (analysis.volumeAnalysis.volumeDelta - 1) * 50);
        }
        
        score += Math.min(20, analysis.orderBlocks.length * 3);
        score += Math.min(15, analysis.fairValueGaps.length * 2);
        
        if (analysis.liquidityLevels.length > 0) {
            score += 10;
            const nearLiquidity = analysis.liquidityLevels.some(level => 
                Math.abs(analysis.price - level.price) < analysis.atr * 0.5
            );
            if (nearLiquidity) score += 10;
        }
        
        return Math.min(100, score);
    }

    calculateConfluenceBonus(results) {
        let bonus = 0;
        const timeframes = Object.values(results.timeframes);
        
        const bullishSignals = timeframes.filter(tf => 
            tf.analysis.trend === 'bullish' && 
            tf.analysis.orderBlocks.some(ob => ob.type === 'bullish')
        ).length;
        
        const bearishSignals = timeframes.filter(tf => 
            tf.analysis.trend === 'bearish' && 
            tf.analysis.orderBlocks.some(ob => ob.type === 'bearish')
        ).length;
        
        const confluence = Math.max(bullishSignals, bearishSignals);
        bonus = confluence * 8;
        
        return Math.min(30, bonus);
    }

    calculateMultiTFBias(timeframes) {
        let bias = 0;
        
        timeframes.forEach((tf, index) => {
            const weight = config.TIMEFRAMES[index].weight;
            const analysis = tf.analysis;
            
            if (analysis.trend === 'bullish') bias += weight;
            else if (analysis.trend === 'bearish') bias -= weight;
            
            if (analysis.marketStructure.breakOfStructure) {
                if (analysis.marketStructure.trend === 'bullish') bias += weight * 0.5;
                else if (analysis.marketStructure.trend === 'bearish') bias -= weight * 0.5;
            }
        });
        
        return bias;
    }

    async performICTComprehensiveAnalysis(symbol) {
        const results = {
            timeframes: {},
            marketStructure: {},
            volumeAnalysis: {},
            signals: {},
            ictConcepts: {}
        };

        for (const tf of config.TIMEFRAMES) {
            try {
                const candles = await this.loadCandles(symbol, tf.interval, 300);
                results.timeframes[tf.label] = {
                    candles,
                    price: candles[candles.length - 1].close,
                    analysis: this.analyzeTimeframeICT(candles, tf.label)
                };
            } catch (error) {
                console.error(`Error analyzing ${tf.label}:`, error);
            }
        }

        results.signals = this.generateTradingSignalsICT(results);
        return results;
    }

    generateTradingSignalsICT(results) {
        const timeframes = Object.values(results.timeframes);
        const currentPrice = timeframes[0].price;
        
        const bias = this.calculateMultiTFBias(timeframes);
        const confidence = this.calculateRealConfidence(results);
        
        if (confidence < config.MIN_CONFIDENCE) {
            return {
                direction: 'NO_TRADE',
                confidence: Math.round(confidence),
                reason: `Confidence ${Math.round(confidence)}% < Minimum ${config.MIN_CONFIDENCE}%`
            };
        }
        
        const direction = bias > 0.5 ? 'LONG' : bias < -0.5 ? 'SHORT' : 'NO_TRADE';
        
        if (direction === 'NO_TRADE') {
            return {
                direction: 'NO_TRADE',
                confidence: Math.round(confidence),
                reason: 'No clear bias across timeframes'
            };
        }
        
        const primaryAnalysis = timeframes.find(tf => tf.analysis.confidence > 70) || timeframes[0];
        const levels = this.calculateSmartLevels(direction, currentPrice, primaryAnalysis.analysis, results);
        
        const positionData = this.calculatePositionSize(
            config.RISK_PERCENT, 
            config.ACCOUNT_BALANCE, 
            parseFloat(levels.entry), 
            parseFloat(levels.sl), 
            direction
        );
        
        return {
            direction,
            confidence: Math.round(confidence),
            entry: levels.entry,
            stopLoss: levels.sl,
            takeProfit: levels.tp,
            riskReward: levels.rr,
            positionSize: positionData.size,
            maxLoss: positionData.maxLoss
        };
    }

    calculateSmartLevels(direction, currentPrice, analysis, multiTimeframeAnalysis) {
        const atr = analysis.atr;
        
        if (direction === 'LONG') {
            const entry = this.findOptimalLongEntry(currentPrice, analysis, multiTimeframeAnalysis);
            const sl = this.calculateSmartStopLoss(entry, direction, analysis, multiTimeframeAnalysis);
            const tp = this.calculateSmartTakeProfit(entry, sl, direction, analysis, multiTimeframeAnalysis);
            
            return { 
                entry: entry.toFixed(4), 
                sl: sl.toFixed(4), 
                tp: tp.toFixed(4),
                rr: ((tp - entry) / (entry - sl)).toFixed(2)
            };
        } else {
            const entry = this.findOptimalShortEntry(currentPrice, analysis, multiTimeframeAnalysis);
            const sl = this.calculateSmartStopLoss(entry, direction, analysis, multiTimeframeAnalysis);
            const tp = this.calculateSmartTakeProfit(entry, sl, direction, analysis, multiTimeframeAnalysis);
            
            return { 
                entry: entry.toFixed(4), 
                sl: sl.toFixed(4), 
                tp: tp.toFixed(4),
                rr: ((entry - tp) / (sl - entry)).toFixed(2)
            };
        }
    }

    findOptimalLongEntry(currentPrice, analysis, multiTF) {
        const relevantOBs = analysis.orderBlocks.filter(ob => 
            ob.type === 'bullish' && currentPrice > ob.low && currentPrice < ob.high * 1.02
        );
        
        if (relevantOBs.length > 0) {
            const bestOB = relevantOBs.reduce((best, current) => 
                current.strength > best.strength ? current : best
            );
            return bestOB.low * 0.998;
        }
        
        const relevantFVGs = analysis.fairValueGaps.filter(fvg => 
            fvg.type === 'bullish' && currentPrice > fvg.low && currentPrice < fvg.high
        );
        
        if (relevantFVGs.length > 0) {
            const bestFVG = relevantFVGs[0];
            return Math.max(bestFVG.low, currentPrice * 0.995);
        }
        
        const supports = analysis.liquidityLevels
            .filter(level => level.type === 'support')
            .map(level => level.price)
            .filter(price => price < currentPrice)
            .sort((a, b) => b - a);
        
        if (supports.length > 0) {
            return supports[0] * 1.001;
        }
        
        return currentPrice * 0.998;
    }

    findOptimalShortEntry(currentPrice, analysis, multiTF) {
        const relevantOBs = analysis.orderBlocks.filter(ob => 
            ob.type === 'bearish' && currentPrice < ob.high && currentPrice > ob.low * 0.98
        );
        
        if (relevantOBs.length > 0) {
            const bestOB = relevantOBs.reduce((best, current) => 
                current.strength > best.strength ? current : best
            );
            return bestOB.high * 1.002;
        }
        
        const relevantFVGs = analysis.fairValueGaps.filter(fvg => 
            fvg.type === 'bearish' && currentPrice < fvg.high && currentPrice > fvg.low
        );
        
        if (relevantFVGs.length > 0) {
            const bestFVG = relevantFVGs[0];
            return Math.min(bestFVG.high, currentPrice * 1.005);
        }
        
        const resistances = analysis.liquidityLevels
            .filter(level => level.type === 'resistance')
            .map(level => level.price)
            .filter(price => price > currentPrice)
            .sort((a, b) => a - b);
        
        if (resistances.length > 0) {
            return resistances[0] * 0.999;
        }
        
        return currentPrice * 1.002;
    }

    calculateSmartStopLoss(entry, direction, analysis, multiTF) {
        const atr = analysis.atr;
        
        if (direction === 'LONG') {
            const supports = analysis.liquidityLevels
                .filter(level => level.type === 'support')
                .map(level => level.price)
                .filter(price => price < entry)
                .sort((a, b) => b - a);
            
            if (supports.length > 0) {
                const nearestSupport = supports[0];
                const atrBasedSL = entry - (atr * 1.5);
                return Math.min(nearestSupport, atrBasedSL);
            }
            
            return entry - (atr * 2);
        } else {
            const resistances = analysis.liquidityLevels
                .filter(level => level.type === 'resistance')
                .map(level => level.price)
                .filter(price => price > entry)
                .sort((a, b) => a - b);
            
            if (resistances.length > 0) {
                const nearestResistance = resistances[0];
                const atrBasedSL = entry + (atr * 1.5);
                return Math.max(nearestResistance, atrBasedSL);
            }
            
            return entry + (atr * 2);
        }
    }

    calculateSmartTakeProfit(entry, sl, direction, analysis, multiTF) {
        const risk = Math.abs(entry - sl);
        const atr = analysis.atr;
        
        if (direction === 'LONG') {
            const resistances = analysis.liquidityLevels
                .filter(level => level.type === 'resistance')
                .map(level => level.price)
                .filter(price => price > entry)
                .sort((a, b) => a - b);
            
            if (resistances.length > 0) {
                const nearestResistance = resistances[0];
                const minTP = entry + risk * 1.5;
                return Math.max(nearestResistance, minTP);
            }
            
            return entry + risk * 2.5;
        } else {
            const supports = analysis.liquidityLevels
                .filter(level => level.type === 'support')
                .map(level => level.price)
                .filter(price => price < entry)
                .sort((a, b) => b - a);
            
            if (supports.length > 0) {
                const nearestSupport = supports[0];
                const minTP = entry - risk * 1.5;
                return Math.min(nearestSupport, minTP);
            }
            
            return entry - risk * 2.5;
        }
    }

    calculatePositionSize(riskPercent, accountBalance, entry, sl, direction) {
        const riskAmount = accountBalance * (riskPercent / 100);
        const riskPerUnit = Math.abs(entry - sl);
        const size = (riskAmount / riskPerUnit).toFixed(4);
        
        return {
            size: size,
            maxLoss: riskAmount.toFixed(2)
        };
    }

    incrementSignalCount() {
        const today = new Date().toDateString();
        if (!this.dailySignals.has(today)) {
            this.dailySignals.clear();
            this.dailySignals.set(today, 0);
        }
        const count = this.dailySignals.get(today) + 1;
        this.dailySignals.set(today, count);
        return count;
    }

    getCurrentSignalCount() {
        const today = new Date().toDateString();
        return this.dailySignals.get(today) || 0;
    }
}

module.exports = TradingAnalyzer;
