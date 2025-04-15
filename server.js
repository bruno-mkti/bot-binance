const axios = require("axios");
const crypto = require("crypto");

require("dotenv").config();
const API_URL = "https://testnet.binance.vision";
const API_KEY = process.env.API_KEY; 
const SECRET_KEY = process.env.API_SECRET;

const SYMBOL = "BTCUSDT";
const QUANTITY = "0.00020563";
const PERIOD = 14;

let isOpened = false;
let buyCount = 0;
let sellCount = 0;
let profit = 0;
let lastBuyPrice = 0;

function averages(prices, period, startIndex) {
    let gains = 0, losses = 0;
    for (let i = 0; i < period && (i + startIndex) < prices.length; i++) {
        const diff = prices[i + startIndex] - prices[i + startIndex - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }
    return { avgGains: gains / period, avgLosses: losses / period };
}

function RSI(prices, period) {
    let avgGains = 0, avgLosses = 0;
    for (let i = 1; i < prices.length; i++) {
        let newAverages = averages(prices, period, i);
        if (i === 1) {
            avgGains = newAverages.avgGains;
            avgLosses = newAverages.avgLosses;
            continue;
        }
        avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
        avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
    }
    const rs = avgGains / avgLosses;
    return 100 - (100 / (1 + rs));
}

async function newOrder(symbol, quantity, side, price) {
    console.log(`Ordem executada: ${side} ${quantity} de ${symbol} a ${price}`);
    if (side === "BUY") {
        buyCount++;
        lastBuyPrice = price;
    } else if (side === "SELL") {
        sellCount++;
        profit += (price - lastBuyPrice) * parseFloat(quantity);
    }
}

async function start() {
    const { data } = await axios.get(API_URL + "/api/v3/klines?limit=100&interval=15m&symbol=" + SYMBOL);
    const candle = data[data.length - 1];
    const lastPrice = parseFloat(candle[4]);
    const prices = data.map(k => parseFloat(k[4]));
    const rsi = RSI(prices, PERIOD);

    console.clear();
    console.log("Preço Atual BTC: " + lastPrice);
    console.log("RSI: " + rsi);
    console.log("Já comprou: " + isOpened);
    console.log(`Compras: ${buyCount}, Vendas: ${sellCount}, Lucro: ${profit.toFixed(2)} USDT`);

    if (rsi < 30 && isOpened === false) {
        console.log("Sobrevendido, hora de comprar");
        isOpened = true;
        newOrder(SYMBOL, QUANTITY, "BUY", lastPrice);
    } else if (rsi > 70 && isOpened === true) {
        console.log("Sobrecomprado, hora de vender");
        newOrder(SYMBOL, QUANTITY, "SELL", lastPrice);
        isOpened = false;
    } else {
        console.log("Aguardando compra");
    }
}

setInterval(start, 3000);

start();