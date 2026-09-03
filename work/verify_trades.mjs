import { chromium } from "playwright";

const htmlPath = new URL("../outputs/滚仓计算器.html", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto(htmlPath.href);

await page.waitForSelector("#result-body tr");

// 1. 添加 3 条实盘记录：+500、-50、-250 => 总收益 +200
const records = [
  { time: "2026-09-01T10:30", token: "DOGE", position: "100", result: "500", note: "突破前高后追多，杠杆 25 倍，拿到目标位离场" },
  { time: "2026-09-01T15:00", token: "PEPE", position: "50", result: "-50", note: "追高被套，止损离场" },
  { time: "2026-09-02T09:20", token: "BTC", position: "200", result: "-250", note: "假突破，插针打掉止损" },
];

for (const record of records) {
  await page.fill("#trade-time", record.time);
  await page.fill("#trade-token", record.token);
  await page.fill("#trade-position", record.position);
  await page.fill("#trade-result", record.result);
  await page.fill("#trade-note", record.note);
  await page.click("#trades-form button[type=submit]");
}

await page.waitForFunction(() => document.querySelectorAll("#trades-body tr").length === 3);

// 2. 校验总和与笔数
const totalText = await page.textContent("#trades-total");
assert(totalText.includes("+200"), `总收益应为 +200 U，实际 ${totalText}`);
assert((await page.textContent("#trades-total-count")) === "3", "操作笔数应为 3");
assert((await page.textContent("#trades-count")).includes("3"), "徽标应为 3 笔");

// 3. 时间倒序排列（最新在最上）
const firstRowToken = await page.locator("#trades-body tr").first().locator("td").nth(1).textContent();
assert(firstRowToken === "BTC", `最新记录应排在最上，实际第一行代币为 ${firstRowToken}`);

// 4. 盈利/亏损颜色约定（盈利红、亏损绿）
assert((await page.locator("#trades-body td.pos-result").count()) === 1, "应有 1 个盈利单元格");
assert((await page.locator("#trades-body td.neg-result").count()) === 2, "应有 2 个亏损单元格");

// 5. 表单已重置、时间回到当前
assert((await page.inputValue("#trade-token")) === "", "提交后代币输入应清空");

// 6. 刷新持久化
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rollcalc.trades.v1") || "[]").length);
assert(stored === 3, `localStorage 应有 3 条实盘记录，实际 ${stored}`);
await page.reload();
await page.waitForSelector("#result-body tr");
await page.waitForFunction(() => document.querySelectorAll("#trades-body tr").length === 3);
assert((await page.textContent("#trades-total")).includes("+200"), "刷新后总收益仍应为 +200");
const noteShown = await page.locator("#trades-body td.remark").first().textContent();
assert(noteShown.length > 5, "备注应正常显示");

// 7. 删除（两次点击确认）
await page.locator("#trades-body tr").first().locator(".btn-delete").click();
assert((await page.locator("#trades-body tr").first().locator(".btn-delete").textContent()).includes("确认删除"), "第一次点击应进入确认状态");
await page.locator("#trades-body tr").first().locator(".btn-delete").click();
await page.waitForFunction(() => document.querySelectorAll("#trades-body tr").length === 2);
const totalAfterDelete = await page.textContent("#trades-total");
assert(totalAfterDelete.includes("+450"), `删除后总收益应为 +450 U，实际 ${totalAfterDelete}`);

// 8. 校验提示（空代币）
await page.fill("#trade-position", "50");
await page.click("#trades-form button[type=submit]");
const errText = await page.textContent("#trades-error");
assert(errText.includes("代币"), `应提示代币必填，实际：${errText}`);

// 9. 移动端视口：卡片式布局、无页面级横向滚动
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
assert(!hasHorizontalScroll, "390px 视口不应出现页面级横向滚动");
assert(!(await page.locator(".trades-table thead").isVisible()), "移动端应隐藏表头（卡片布局）");
assert((await page.locator("#trades-body td[data-label]").count()) > 0, "移动端应有字段标签");

await browser.close();
console.log(JSON.stringify({ status: "PASS", flows: ["添加记录", "总收益累加", "倒序排列", "盈亏配色", "持久化", "删除确认", "表单校验", "移动端卡片布局"] }, null, 2));
