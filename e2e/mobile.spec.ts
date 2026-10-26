import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page) {
  await page.goto('/#/');
  const enter = page.getByRole('button', { name: /以参与者身份进入/ });
  await expect(enter).toBeVisible();
  await enter.click();
  await expect(page.getByRole('heading', { name: '线上相遇，线下来聚' })).toBeVisible();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('移动端 375px', () => {
  test('首页无横向溢出，底部导航可用', async ({ page }) => {
    await enterDemo(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const nav = page.getByRole('navigation', { name: '底部导航' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: '找搭子' })).toBeVisible();
    await nav.getByRole('link', { name: '找搭子' }).click();
    await expect(page.getByRole('heading', { name: '找搭子' })).toBeVisible();
  });

  test('活动详情无横向溢出，底部主操作可见', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/activity/a_wuda_cherry');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: '申请加入' }).first()).toBeVisible();
    await page.waitForTimeout(300);
    const boxes = await page
      .getByRole('button', { name: '申请加入' })
      .evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return { y: rect.y, height: rect.height };
        }),
      );
    // 页面内操作卡 + 固定底栏两个入口；至少有一个必须落在 375×812 视口内
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    expect(boxes.some((box) => box.y >= 0 && box.y + box.height <= 812 + 1)).toBe(true);
  });

  test('群聊输入框不被底部导航遮挡', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/messages/conv_1');
    const input = page.getByRole('textbox', { name: '输入群聊消息' });
    await expect(input).toBeVisible();
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(812 + 1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('创建活动表单在 375px 下可填写且无横向溢出', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/create');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByPlaceholder(/例如：东湖绿道 · 落日夜走/).fill('移动端创建测试');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
