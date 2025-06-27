const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());

const API_URL = "https://api.binance.com";
const SYMBOL = "BTCUSDT";
const QUANTITY = "0.00020563"; // ajuste conforme seu saldo real
const PERIOD = 14;

let isOpened = false;
let buyCount = 0;
let sellCount = 0;
let profit = 0;
let lastBuyPrice = 0;

function RSI(prices, period) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    gains /= period;
    losses /= period;

    if (losses === 0) return 100;

    let rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

function getSignature(queryString) {
    return crypto.createHmac('sha256', process.env.BINANCE_SECRET_KEY)
        .update(queryString)
        .digest('hex');
}

async function newOrder(side, price) {
    const timestamp = Date.now();
    const queryString = `symbol=${SYMBOL}&side=${side}&type=MARKET&quantity=${QUANTITY}&timestamp=${timestamp}`;
    const signature = getSignature(queryString);

    const url = `${API_URL}/api/v3/order?${queryString}&signature=${signature}`;
    const headers = { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY };

    try {
        const response = await axios.post(url, null, { headers });
        console.log(`✅ Ordem REAL executada: ${side} ${QUANTITY} de ${SYMBOL} a ${price}`);

        if (side === "BUY") {
            buyCount++;
            lastBuyPrice = price;
        } else if (side === "SELL") {
            sellCount++;
            profit += (price - lastBuyPrice) * parseFloat(QUANTITY);
        }
    } catch (error) {
        console.error("❌ Erro ao executar ordem real:", error.response?.data || error.message);
    }
}

async function start() {
    try {
        const { data } = await axios.get(`${API_URL}/api/v3/klines?limit=100&interval=15m&symbol=${SYMBOL}`);
        const prices = data.map(k => parseFloat(k[4]));
        const lastPrice = prices[prices.length - 1];
        const rsi = RSI(prices.slice(-PERIOD - 1), PERIOD);

        console.clear();
        console.log(`🕒 ${new Date().toLocaleTimeString()}`);
        console.log(`📌 Preço Atual BTC: ${lastPrice}`);
        console.log(`📉 RSI: ${rsi.toFixed(2)}`);
        console.log(`📊 Compras: ${buyCount}, Vendas: ${sellCount}, Lucro: ${profit.toFixed(2)} USDT`);

        if (rsi < 30 && !isOpened) {
            console.log("✅ RSI abaixo de 30! COMPRANDO...");
            isOpened = true;
            await newOrder("BUY", lastPrice);
        } else if (rsi > 70 && isOpened) {
            console.log("🔴 RSI acima de 70! VENDENDO...");
            await newOrder("SELL", lastPrice);
            isOpened = false;
        } else {
            console.log("⌛ Aguardando condições de compra/venda...");
        }
    } catch (error) {
        console.error("❌ Erro ao obter dados da Binance:", error.message);
    }
}

setInterval(start, 3000);

// Endpoint para exibir dados no frontend
app.get("/data", async (req, res) => {
    try {
        const { data } = await axios.get(`${API_URL}/api/v3/klines?limit=100&interval=15m&symbol=${SYMBOL}`);
        const prices = data.map(k => parseFloat(k[4]));
        const lastPrice = prices[prices.length - 1];
        const rsi = RSI(prices.slice(-PERIOD - 1), PERIOD);

        const feeRate = 0.002;
        const profitAfterFees = profit * (1 - feeRate);
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

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

start();
