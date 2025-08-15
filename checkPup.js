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

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ BOT_TOKEN or CHAT_ID is missing. Telegram notifications won't be sent.");
}

// === Target URL ===
const url = 'https://www.goethe.de/ins/bd/en/spr/prf/gzb1.cfm';

// Helper for formatted time
function formatTimestamp(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Dhaka'
  }).format(date).replace(',', ';');
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-extensions'
    ],
  });

  const page = await browser.newPage();

  // Block images, fonts, css for faster load
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['stylesheet', 'font', 'image'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // Initial load
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log(`[${formatTimestamp(new Date())}] ✅ Browser launched and first page loaded.`);

  async function checkButtons() {
    const startTime = formatTimestamp(new Date());
    console.log(`[${startTime}] Starting a new check...`);

    try {
      // Use goto instead of reload
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const buttons = await page.$$eval('.pr-buttons button', btns =>
        btns.map(btn => ({
          text: btn.innerText.replace(/\s*\n\s*/g, ' ').trim(),
          active: !btn.disabled
        }))
      );

      for (const btn of buttons) {
        const logTime = formatTimestamp(new Date());
        console.log(`[${logTime}] Button text: "${btn.text}" | Active: ${btn.active}`);

        if (btn.active && BOT_TOKEN && CHAT_ID) {
          const notifTime = formatTimestamp(new Date());
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: `🎉 Goethe BD button is ACTIVE!\nButton text: "${btn.text}"\nTime: ${notifTime}`
            })
          });
          console.log(`[${notifTime}] ✅ Telegram notification sent`);
        }
      }
    } catch (err) {
      const errTime = formatTimestamp(new Date());
      console.error(`[${errTime}] ❌ Error:`, err.message);
    } finally {
      const randomDelay = 2000 + Math.random() * 500; // ~2.0–2.5s
      console.log(`[${formatTimestamp(new Date())}] ⏱ Next check in ${(randomDelay / 1000).toFixed(2)} seconds`);
      setTimeout(checkButtons, randomDelay);
    }
  }

  checkButtons();
})();
