import { expect, test, type Page } from '@playwright/test';

/**
 * 端到端验收（对应 docs/product/HOPPA_功能验收与数据埋点.xlsx 的测试用例页）
 * 覆盖：首页浏览 / 组合筛选 / 详情与申请 / 组织者审核 / 创建活动与持久化 /
 *      状态机推进 / 评价闭环 / 群聊持久化 / 安全边界 / 重置演示数据。
 */

async function enterDemo(page: Page) {
  await page.goto('/#/');
  const enter = page.getByRole('button', { name: /以参与者身份进入/ });
  await expect(enter).toBeVisible();
  await enter.click();
  await expect(page.getByRole('heading', { name: '线上相遇，线下来聚' })).toBeVisible();
}

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('演示入口', () => {
  test('欢迎页可分别以参与者 / 组织者身份进入', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByText('线上相遇，线下来聚。')).toBeVisible();
    await expect(page.getByText(/数据为模拟数据/).first()).toBeVisible();
    await page.getByRole('button', { name: '以组织者身份进入' }).click();
    await expect(page.getByText('已进入组织者视角')).toBeVisible();
    await expect(page.getByText('陈屿').first()).toBeVisible();
  });
});

test.describe('发现与筛选', () => {
  test('首页至少展示 6 条活动，搜索与品类筛选真实改变列表', async ({ page }) => {
    await enterDemo(page);

    await expect(page.getByRole('heading', { name: /发现活动 \d+/ })).toBeVisible();
    const cards = page.locator('a[href*="#/activity/"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(6);

    const search = page.getByRole('textbox', { name: '搜索活动' });
    await search.fill('东湖');
    await expect(page.getByRole('link', { name: /东湖绿道 · 落日 City Walk/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /黄鹤楼夜游/ })).toHaveCount(0);

    await search.fill('');
    await page.getByRole('button', { name: '展览', exact: true }).click();
    await expect(page.getByRole('link', { name: /湖北省博/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /黄鹤楼夜游/ })).toHaveCount(0);

    await page.getByRole('button', { name: '清除筛选' }).first().click();
    await expect(page.getByRole('link', { name: /黄鹤楼夜游/ })).toBeVisible();
  });

  test('组合筛选（时间 + 预算）只保留符合条件的活动', async ({ page }) => {
    await enterDemo(page);
    await page.getByRole('button', { name: '本周末', exact: true }).click();
    await page.getByRole('button', { name: '≤ ¥100', exact: true }).click();

    await expect(page.getByRole('link', { name: /青山江滩骑行/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /知音号/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /湖北省博/ })).toHaveCount(0);
  });

  test('找搭子可按社群/个人切换且推荐理由可见', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/buddy');
    await expect(page.getByRole('heading', { name: /推荐活动 \d+/ })).toBeVisible();
    await page.getByRole('button', { name: /个人活动/ }).click();
    await expect(page.getByText(/个人活动/).first()).toBeVisible();
    await page.getByRole('button', { name: '开始匹配' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /立即匹配|开始匹配|应用/ }).last().click();
    await expect(page.getByText(/匹配度 \d+/).first()).toBeVisible();
  });
});

test.describe('申请与审核', () => {
  test('申请加入活动：留言 → 二次确认 → 提交成功', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/activity/a_wuda_cherry');
    await expect(page.getByRole('heading', { name: /武大樱花大道/ })).toBeVisible();

    await page.getByRole('button', { name: '申请加入' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('申请加入活动');
    await dialog.locator('textarea').fill('E2E：想一起看樱花，可以带相机。');
    await dialog.getByRole('button', { name: '下一步：确认信息' }).click();

    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('确认申请信息');
    await confirm.getByRole('button', { name: '提交申请' }).click();

    await expect(page.getByText(/等待组织者审核|已申请/).first()).toBeVisible();
  });

  test('已有待审核申请时不再出现「申请加入」按钮', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/activity/a_donghu_sunset');
    await expect(page.getByText(/等待组织者审核|待审核|已提交/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '申请加入' })).toHaveCount(0);
  });

  test('组织者通过申请后成员数增加', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/manage/a_boardgame_night');
    await expect(page.getByRole('heading', { name: '活动管理' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /成员（4\/6）/ })).toBeVisible();

    await page.getByRole('button', { name: '通过' }).first().click();
    await expect(page.getByRole('heading', { name: /成员（5\/6）/ })).toBeVisible();
    await expect(page.getByText('已通过').first()).toBeVisible();
  });
});

test.describe('创建活动', () => {
  test('过去时间被拦截，必填项缺失有错误提示', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/create');
    await page.getByPlaceholder(/例如：东湖绿道 · 落日夜走/).fill('E2E 过去时间活动');
    await page.locator('#activity-date').fill('2020-01-01');
    await page.locator('#activity-time').fill('19:30');
    await page.getByRole('button', { name: '发布活动' }).click();
    await expect(page.getByText(/必须在未来/).first()).toBeVisible();
    await expect(page).toHaveURL(/#\/create/);
  });

  test('创建活动成功、跳转详情且刷新后仍在（本地持久化）', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/create');

    await page.getByPlaceholder(/例如：东湖绿道 · 落日夜走/).fill('E2E 周末江滩散步');
    await page.getByRole('button', { name: 'City Walk', exact: true }).click();
    await page.locator('#activity-date').fill(futureDate(3));
    await page.locator('#activity-time').fill('19:30');
    await page.getByPlaceholder(/例如：东湖绿道湖光序曲驿站门口/).fill('汉口江滩三阳广场');
    await page.locator('#activity-description').fill('沿着江滩走一小时，节奏很慢，适合下班后出来透气。');
    await page.getByRole('button', { name: '免费', exact: true }).click();
    await page.getByRole('button', { name: '发布活动' }).click();

    await expect(page).toHaveURL(/#\/activity\//);
    await expect(page.getByRole('heading', { name: 'E2E 周末江滩散步' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'E2E 周末江滩散步' })).toBeVisible();
    await expect(page.getByRole('link', { name: '管理活动' })).toBeVisible();
  });
});

test.describe('活动闭环', () => {
  test('组织者推进状态：准备中 → 进行中 → 待评价 → 评价后已结束', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/manage/a_boardgame_night');

    await page.getByRole('button', { name: '开始活动' }).click();
    await page.getByRole('button', { name: '提前开始' }).click();
    await expect(page.getByText('进行中').first()).toBeVisible();

    await page.getByRole('button', { name: '结束活动' }).click();
    const endDialog = page.getByRole('dialog');
    await expect(endDialog).toBeVisible();
    await endDialog.getByRole('button').last().click();
    await expect(page.getByText('待评价').first()).toBeVisible();

    await page.goto('/#/review/a_boardgame_night');
    await page.getByRole('button', { name: '5 星' }).click();
    await page.getByRole('button', { name: '组织清晰' }).click();
    await page.locator('#review-comment').fill('E2E：流程顺畅，规则讲得清楚。');
    await page.getByRole('button', { name: '提交评价' }).click();

    await expect(page).toHaveURL(/#\/card\/a_boardgame_night/);
    await expect(page.getByRole('heading', { name: '旅行名片' })).toBeVisible();
    await expect(page.getByText('5.0')).toBeVisible();
  });

  test('群聊发送消息并刷新保留（本地持久化）', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/messages/conv_1');
    const box = page.getByRole('textbox', { name: '输入群聊消息' });
    await box.fill('E2E 消息：周五见。');
    await box.press('Enter');
    await expect(page.getByText('E2E 消息：周五见。')).toBeVisible();

    await page.reload();
    await expect(page.getByText('E2E 消息：周五见。')).toBeVisible();
  });
});

test.describe('安全边界', () => {
  test('演示紧急求助明确不拨号、不定位、不发送数据', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/safety/a_eastlake_ride');
    await page.getByRole('button', { name: '演示求助' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('不会拨打电话');
    await expect(dialog).toContainText('不会获取你的定位');
    await expect(dialog).toContainText('向任何第三方发送数据');
    await dialog.getByRole('button').last().click();
  });

  test('安全中心可提交模拟举报并显示「已记录（演示）」', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/safety/a_eastlake_ride');
    await page.getByRole('button', { name: '举报' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '虚假信息' }).click();
    await dialog.getByRole('button', { name: /提交|记录/ }).last().click();
    await expect(page.getByText(/已记录（演示）/).first()).toBeVisible();
  });
});

test.describe('演示工具', () => {
  test('重置演示数据恢复初始状态', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/#/messages/conv_1');
    const box = page.getByRole('textbox', { name: '输入群聊消息' });
    await box.fill('重置前消息');
    await box.press('Enter');
    await expect(page.getByText('重置前消息')).toBeVisible();

    await page.getByRole('button', { name: '打开演示工具' }).click();
    await page.getByRole('button', { name: '重置演示数据' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认重置' }).click();
    await expect(page.getByText('演示数据已重置')).toBeVisible();

    await page.goto('/#/messages/conv_1');
    await expect(page.getByText('重置前消息')).toHaveCount(0);
  });
});
