// ==========================================
// FX 24時間監視アラートBot (外部通信・受信対応版)
// ==========================================

const http = require('http');

const API_KEY = "f1531e013da54f35a8498e91a862be5f"; // TwelveDataのAPIキー
const SYMBOL = "USD/JPY";

// Web画面から送られてくるデータを格納する変数
let DISCORD_WEBHOOK_URL = ""; 
let alertTargets = [];
let previousPrice = null;

// ==========================================
// ① Web画面からのデータを受け取る受信サーバー
// ==========================================
const server = http.createServer((req, res) => {
    // セキュリティ壁（CORS）を解除して、Netlifyからの通信を許可する設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // ブラウザの事前確認（プレフライトリクエスト）への対応
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ブラウザで直接URLを開いたときの状態確認用
    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: '稼働中', activeAlerts: alertTargets.length }));
        return;
    }

    // Netlify画面からアラート情報が送られてきたときの処理（POST受信）
    if (req.method === 'POST' && req.url === '/update-alerts') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                // DiscordのURLを更新
                if (data.webhookUrl) {
                    DISCORD_WEBHOOK_URL = data.webhookUrl;
                }
                
                // アラート価格のリストを更新
                if (data.alerts && Array.isArray(data.alerts)) {
                    alertTargets = data.alerts.map((price, index) => ({
                        id: index + 1,
                        price: price,
                        isActive: true
                    }));
                    console.log(`[受信成功] 新しいアラートを ${alertTargets.length} 件セットしました。`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'アラートを更新しました' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'データの形式が不正です' }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`受信サーバーがポート ${PORT} で起動しました。`);
});


// ==========================================
// ② 24時間監視ロジック（Botの心臓部）
// ==========================================
async function sendDiscordNotification(message) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `🤖 **【24時間Bot稼働中】**\n${message}` })
        });
    } catch (error) {
        console.error("Discord通知エラー:", error);
    }
}

async function checkPrice() {
    try {
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${SYMBOL}&apikey=${API_KEY}`);
        const data = await response.json();

        if (!data.price) return;
        const currentPrice = parseFloat(data.price);
        console.log(`[${new Date().toLocaleString()}] USD/JPY 現在価格: ${currentPrice} 円 (監視中: ${alertTargets.length}件)`);

        if (previousPrice !== null) {
            for (let i = 0; i < alertTargets.length; i++) {
                const target = alertTargets[i];
                if (!target.isActive) continue;

                let isHit = false; let direction = "";
                if (previousPrice <= target.price && currentPrice > target.price) { isHit = true; direction = "上抜け"; } 
                else if (previousPrice >= target.price && currentPrice < target.price) { isHit = true; direction = "下抜け"; }

                if (isHit) {
                    await sendDiscordNotification(`🎯 【ライン到達】\n設定価格（${target.price.toFixed(3)} 円）を【${direction}】しました！\n現在の価格: ${currentPrice.toFixed(3)} 円`);
                    target.isActive = false; // 一度通知したらストップ
                }
            }
        }
        previousPrice = currentPrice;
    } catch (error) {
        console.error("価格取得エラー:", error);
    }
}

// 2分（12万ミリ秒）ごとに価格をチェック
setInterval(checkPrice, 120000);