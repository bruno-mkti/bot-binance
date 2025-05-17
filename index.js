const express = require("express");
const axios = require("axios");
const cors = require("cors");

require("dotenv").config();
const app = express();
const PORT = 3000;

app.use(cors());

const API_URL = "http://100.106.19.113:3000/data"; // Substitua pela URL da API real http://api.binance.com
const SYMBOL = "BTCUSDT";
const QUANTITY = "0.00020563"; // Aproximadamente 100,00
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

async function newOrder(side, price) {
    console.log(`Ordem executada: ${side} ${QUANTITY} de ${SYMBOL} a ${price}`);
    
    if (side === "BUY") {
        buyCount++;
        lastBuyPrice = price;
    } else if (side === "SELL") {
        sellCount++;
        profit += (price - lastBuyPrice) * parseFloat(QUANTITY);
    }
}

async function start() {
    try {
        const { data } = await axios.get(`${API_URL}/api/v3/klines?limit=100&interval=15m&symbol=${SYMBOL}`);
        const lastPrice = parseFloat(data[data.length - 1][4]);
        const prices = data.map(k => parseFloat(k[4]));
        const rsi = RSI(prices, PERIOD);

        console.clear();
        console.log(`📌 Preço Atual BTC: ${lastPrice}`);
        console.log(`📉 RSI: ${rsi}`);
        console.log(`📊 Compras: ${buyCount}, Vendas: ${sellCount}, Lucro: ${profit.toFixed(2)} USDT`);

        if (rsi < 30 && isOpened === false) {
            console.log("✅ RSI abaixo de 30! Comprando...");
            isOpened = true;
            newOrder("BUY", lastPrice);
        } else if (rsi > 70 && isOpened === true) {
            console.log("🔴 RSI acima de 70! Vendendo...");
            newOrder("SELL", lastPrice);
            isOpened = false;
        } else {
            console.log("⌛ Aguardando...");
        }
    } catch (error) {
        console.error("Erro ao obter dados da Binance:", error.message);
    }
}

setInterval(start, 3000);

// API para enviar dados ao frontend
app.get("/data", async (req, res) => {
    try {
        const { data } = await axios.get(`${API_URL}/api/v3/klines?limit=100&interval=15m&symbol=${SYMBOL}`);
        const lastPrice = parseFloat(data[data.length - 1][4]);
        const prices = data.map(k => parseFloat(k[4]));
        const rsi = RSI(prices, PERIOD);

        // 0.2% de taxa por operação completa (compra+venda)
        const feeRate = 0.002; // 0.2% em decimal
        const profitAfterFees = profit * (1 - feeRate);

        // Cotação do dólar para real (pode ser atualizado dinamicamente depois)
        const usdtToBRL = 5.05;
        const profitBRL = profitAfterFees * usdtToBRL;

        res.json({ 
            price: lastPrice, 
            rsi, 
            buyCount, 
            sellCount, 
            profit: profit.toFixed(2), 
            profitAfterFees: profitAfterFees.toFixed(2),
            profitBRL: profitBRL.toFixed(2)
});


    } catch (error) {
        res.status(500).json({ error: "Erro ao obter dados" });
    }
});

// Iniciar servidor Express
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

start();
