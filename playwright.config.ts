import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const tmpDir = resolve('.tmp');
mkdirSync(tmpDir, { recursive: true });

/**
 * 端到端验收：使用本机已安装的 Chrome（channel: 'chrome'），不下载浏览器。
 * webServer 会自动 build + preview，测的是生产构建。
 * TEMP/TMP 指向项目内 .tmp：本机 %TEMP% 下 esbuild 清理临时文件会被系统拒绝（Access is denied）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    actionTimeout: 12_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      ...process.env,
      TEMP: tmpDir,
      TMP: tmpDir,
    },
  },
  projects: [
    {
      name: 'desktop-chrome',
      testIgnore: /mobile\.spec\.ts/,
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      testMatch: /mobile\.spec\.ts/,
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
