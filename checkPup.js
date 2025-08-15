const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// === Telegram setup ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error("❌ BOT_TOKEN or CHAT_ID is missing. Please set your environment variables!");
    // Don't exit, just continue; Render will keep the worker alive
}

// === Target URL ===
const url = 'https://www.goethe.de/ins/bd/en/spr/prf/gzb1.cfm';

// Helper function to format timestamp in Bangladesh time (12-hour format)
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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    console.log(`[${formatTimestamp(new Date())}] ✅ Browser launched and page loaded. Render worker is running 24x7.`);

    // Function to check buttons
    async function checkButtons() {
        const startTime = formatTimestamp(new Date());
        console.log(`[${startTime}] Starting a new check...`);

        try {
            // Reload page each check
            await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });

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
                    console.log(`[${notifTime}] ✅ Telegram notification sent for active button`);
                }
            }
        } catch (err) {
            const errTime = formatTimestamp(new Date());
            console.error(`[${errTime}] ❌ Error:`, err.message);
        } finally {
            // Random interval between 3.4–3.9 seconds
            const randomInterval = 3400 + Math.random() * 500;
            console.log(`[${formatTimestamp(new Date())}] ⏱ Next check in ${(randomInterval / 1000).toFixed(2)} seconds`);
            setTimeout(checkButtons, randomInterval);
        }
    }

    // Start the loop
    checkButtons();
})();
