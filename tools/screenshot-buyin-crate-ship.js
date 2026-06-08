// Visual check for the combined Crate/Ship buy-in page.
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1104, height: 870, deviceScaleFactor: 1 });
        const fileUrl = 'file:///' + path.resolve(__dirname, 'preview-buyin-crate-ship.html').replace(/\\/g, '/');
        console.log('Opening:', fileUrl);
        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 250));
        const out = path.resolve(__dirname, '..', 'buyin-crate-ship-screenshot.png');
        await page.screenshot({ path: out, fullPage: false });
        console.log('Saved:', out);
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
