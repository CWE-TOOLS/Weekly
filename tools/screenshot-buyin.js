// Standalone visual check for the buy-in print layout.
// Renders tools/preview-buyin.html in a 1056×816 viewport (landscape letter
// at 96 DPI) and saves a PNG so the layout can be compared to the source
// PDF without having to trigger the real print dialog.

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

        const fileUrl = 'file:///' + path.resolve(__dirname, 'preview-buyin.html').replace(/\\/g, '/');
        console.log('Opening:', fileUrl);
        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

        await new Promise(r => setTimeout(r, 250));

        const out = path.resolve(__dirname, '..', 'buyin-screenshot.png');
        await page.screenshot({ path: out, fullPage: false });
        console.log('Saved:', out);
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
