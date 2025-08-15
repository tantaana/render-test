const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const http = require('http');

// Keep Render worker alive
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Render worker is alive!');
}).listen(PORT, () => {
  console.log(`✅ HTTP server running on port ${PORT}`);
});

// Telegram setup
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Target URL
const url = 'https://www.goethe.de/ins/bd/en/spr/prf/gzb1.cfm';

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

  // Block images, CSS, and fonts for faster load
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
      // Navigate freshly each loop
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Wait 3s for spinner + buttons
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Query buttons fresh (never keep old references)
      const buttons = await page.$$eval('.pr-buttons button', btns =>
        btns.map(btn => ({
          text: btn.innerText.replace(/\s*\n\s*/g, ' ').trim(),
          active: !btn.disabled
        }))
      );

      const now = formatTimestamp(new Date());

      for (const btn of buttons) {
        console.log(`[${now}] Button text: "${btn.text}" | Active: ${btn.active}`);

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
      // Wait a tiny bit before next refresh to prevent detached frames
      setTimeout(checkLoop, 500); // 0.5s pause is safer
    }
  }

  console.log(`[${formatTimestamp(new Date())}] ✅ STARTING LOOP...`);
  checkLoop();

})();
