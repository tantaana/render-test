const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const http = require('http');

// Simple HTTP server to satisfy Render web service requirement
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Render worker is alive!');
}).listen(PORT, () => {
  console.log(`✅ HTTP server running on port ${PORT}, keeping Render web service alive`);
});

// === Telegram setup ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

function formatTimestamp(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date).replace(',', ';');
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
  });

  const page = await browser.newPage();

  // Block heavy resources
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['stylesheet', 'image', 'font'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  async function checkLoop() {
    try {
      // 1) Go/Reload
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // 2) Wait until spinner is gone -> until buttons appear
      await page.waitForSelector('.pr-buttons button', { timeout: 10000 });

      // 3) Check buttons
      const buttons = await page.$$eval('.pr-buttons button', btns =>
        btns.map(btn => ({
          text: btn.innerText.replace(/\s*\n\s*/g, ' ').trim(),
          active: !btn.disabled
        }))
      );

      const now = formatTimestamp(new Date());

      for (const btn of buttons) {
        console.log(`[${now}] Button text: "${btn.text}" | Active: ${btn.active}`);

        // If active, fire Telegram message every time
        if (btn.active && BOT_TOKEN && CHAT_ID) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: `🎉 Goethe BD button ACTIVE!\nButton text: "${btn.text}"\nTime: ${now}`
            })
          });
          console.log(`[${now}] ✅ Telegram sent`);
        }
      }
    } catch (err) {
      const now = formatTimestamp(new Date());
      console.error(`[${now}] ❌ Error: `, err.message);
    } finally {
      // Immediately repeat (no delay or small delay)
      setTimeout(checkLoop, 500); // slight 0.5s pause to avoid crashing
    }
  }

  console.log(`[${formatTimestamp(new Date())}] ✅ STARTING LOOP...`);
  checkLoop();

})();
