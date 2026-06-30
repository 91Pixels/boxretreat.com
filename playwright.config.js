// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    retries: 1,
    reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'node server.js',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: true,
        timeout: 15000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile',
            use: { ...devices['iPhone 14'] },
        },
    ],
});
