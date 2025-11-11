const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

async function takeReleasabilityScreenshot() {
    // Start a local HTTP server
    const port = 8765;
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

        // Set viewport to a larger size to capture the full table
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });

        // Access via local server
        const url = `http://localhost:${port}/releasability.html`;

        console.log(`Opening: ${url}`);

        // Navigate to the page
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for the grid to load
        await page.waitForSelector('#releasability-grid-container', { timeout: 10000 });

        // Wait for loading state to disappear and data to be rendered
        try {
            await page.waitForSelector('.loading-state', { hidden: true, timeout: 15000 });
            console.log('✓ Data loaded successfully');
        } catch (e) {
            console.log('⚠ Loading state did not disappear, capturing anyway...');
        }

        // Wait a bit more for any animations or dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Take screenshot
        const screenshotPath = path.join(__dirname, '..', 'releasability-screenshot.png');
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });

        console.log(`✓ Screenshot saved to: ${screenshotPath}`);

        return screenshotPath;
    } catch (error) {
        console.error('Error taking screenshot:', error);
        throw error;
    } finally {
        await browser.close();
        // Stop the HTTP server
        console.log('Stopping HTTP server...');
        server.kill();
    }
}

// Run the script
takeReleasabilityScreenshot()
    .then(screenshotPath => {
        console.log('\nScreenshot complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nScreenshot failed:', error);
        process.exit(1);
    });
