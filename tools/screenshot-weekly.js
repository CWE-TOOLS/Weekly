const puppeteer = require('puppeteer');
const path = require('path');
const { spawn } = require('child_process');

async function takeWeeklyScreenshot() {
    // Start a local HTTP server
    const port = 8766;
    console.log(`Starting local HTTP server on port ${port}...`);

    const server = spawn('python', ['-m', 'http.server', port.toString()], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        const url = `http://localhost:${port}/index.html`;
        console.log(`Opening: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Wait for the schedule grid to render
        await page.waitForSelector('.schedule-grid', { timeout: 45000 });

        // Wait for the loading overlay to hide
        try {
            await page.waitForFunction(() => {
                const overlay = document.getElementById('loading-overlay');
                return !overlay || overlay.classList.contains('hidden');
            }, { timeout: 30000 });
            console.log('✓ Data loaded successfully');
        } catch (e) {
            console.log('⚠ Loading overlay did not hide, capturing anyway...');
        }

        // Let layout/scroll settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        const screenshotPath = path.join(__dirname, '..', 'weekly-screenshot.png');
        await page.screenshot({
            path: screenshotPath,
            fullPage: false
        });

        console.log(`✓ Screenshot saved to: ${screenshotPath}`);
        return screenshotPath;
    } catch (error) {
        console.error('Error taking screenshot:', error);
        throw error;
    } finally {
        await browser.close();
        console.log('Stopping HTTP server...');
        server.kill();
    }
}

takeWeeklyScreenshot()
    .then(() => {
        console.log('\nScreenshot complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nScreenshot failed:', error);
        process.exit(1);
    });
