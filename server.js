// ==========================================
// FX 24時間監視アラートBot (Render対応版)
// ==========================================

const http = require('http');

// ① Renderの強制終了を防ぐための「ダミーWebサーバー」
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('FX監視Botは正常に24時間稼働中です！\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`ダミーサーバーがポート ${PORT} で起動しました。`);
});

// ② ここから下がBotのメイン処理
const API_KEY = "f1531e013da54f35a8498e91a862be5f"; // TwelveDataのAPIキー
const SYMBOL = "USD/JPY";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1511227514977124392/lJ2pJnYWws-X6Ym8lxYSzUK80tIFA6TSW4uG4regt35YZb_M37OhUleEL_YFNfyHeuA5";

let alertTargets = [
    { id: 1, price: 155.500, isActive: true },
    { id: 2, price: 150.000, isActive: true }
];

let previousPrice = null;

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
        console.log(`[${new Date().toLocaleString()}] 価格をチェック中...`);
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${SYMBOL}&apikey=${API_KEY}`);
        const data = await response.json();

        if (!data.price) return;
        const currentPrice = parseFloat(data.price);
        console.log(`現在の ${SYMBOL} の価格: ${currentPrice} 円`);

        if (previousPrice !== null) {
            for (let i = 0; i < alertTargets.length; i++) {
                const target = alertTargets[i];
                if (!target.isActive) continue;

                let isHit = false; let direction = "";
                if (previousPrice <= target.price && currentPrice > target.price) { isHit = true; direction = "上抜け"; } 
                else if (previousPrice >= target.price && currentPrice < target.price) { isHit = true; direction = "下抜け"; }

                if (isHit) {
                    await sendDiscordNotification(`🎯 【ライン到達】\n設定価格（${target.price.toFixed(3)} 円）を【${direction}】しました！\n現在の価格: ${currentPrice.toFixed(3)} 円`);
                    target.isActive = false; 
                }
            }
        }
        previousPrice = currentPrice;
    } catch (error) {
        console.error("システムエラー:", error);
    }
}

sendDiscordNotification("監視Botのサーバーがクラウド上で起動しました。24時間体制で価格をチェックします。");
checkPrice();
setInterval(checkPrice, 120000); // 2分（12万ミリ秒）ごとに実行