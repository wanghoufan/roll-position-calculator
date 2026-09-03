import { chromium } from "playwright";

const htmlPath = new URL("../outputs/滚仓计算器.html", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto(htmlPath.href);

// 1. 初始渲染
await page.waitForSelector("#result-body tr");
assert(await page.locator("#result-body tr").count() === 12, "初始应渲染 12 个阶段");

// 2. 保存一条记录
await page.click("#save-button");
await page.waitForSelector(".history-item");
assert(await page.locator(".history-item").count() === 1, "保存后应出现 1 条历史记录");
assert(await page.locator("#history-count").textContent() === "1", "计数应为 1");

// 3. 修改参数再计算并保存第二条
await page.fill("#token", "PEPE");
await page.fill("#price", "0.00001");
await page.fill("#principal", "1000");
await page.fill("#initial-leverage", "10");
await page.click("#calculator-form button[type=submit]");
await page.waitForFunction(() => document.querySelector("#result-body tr td").textContent === "1");
await page.click("#save-button");
await page.waitForFunction(() => document.querySelectorAll(".history-item").length === 2, null, { timeout: 3000 });

// 4. 回退到第一条（DOGE 600U 25x）
await page.locator(".history-item").nth(1).locator("button", { hasText: "查看 / 回退" }).click();
await page.waitForFunction(() => document.getElementById("token").value === "DOGE");
assert(await page.inputValue("#price") === "0.06", "回退后价格应为 0.06");
assert(await page.inputValue("#principal") === "600", "回退后本金应为 600");
assert(await page.inputValue("#initial-leverage") === "25", "回退后杠杆应为 25");
const finalAssets = await page.textContent("#final-assets");
assert(finalAssets.replace(/,/g, "") === "1228800", `回退后最终资产应为 1228800，实际 ${finalAssets}`);

// 5. localStorage 持久化检查（刷新后仍在）
const storedCount = await page.evaluate(() => {
  const raw = localStorage.getItem("rollcalc.history.v1");
  return raw ? JSON.parse(raw).length : 0;
});
assert(storedCount === 2, `localStorage 应有 2 条，实际 ${storedCount}`);
await page.reload();
await page.waitForSelector(".history-item");
assert(await page.locator(".history-item").count() === 2, "刷新后历史记录应仍在");
await page.waitForSelector("#result-body tr");

// 6. 删除：第一次点击只确认，第二次才删
await page.locator(".history-item").first().locator(".btn-delete").click();
assert((await page.locator(".history-item").first().locator(".btn-delete").textContent()).includes("确认删除"), "第一次点击应进入确认状态");
await page.locator(".history-item").first().locator(".btn-delete").click();
await page.waitForFunction(() => document.querySelectorAll(".history-item").length === 1, null, { timeout: 3000 });

// 7. 清空全部（两次点击）
await page.click("#clear-history");
assert((await page.textContent("#clear-history")).includes("确认清空"), "清空应先进入确认状态");
await page.click("#clear-history");
await page.waitForSelector(".history-empty", { timeout: 3000 });
const cleared = await page.evaluate(() => localStorage.getItem("rollcalc.history.v1"));
assert(cleared === "[]", "清空后 localStorage 应为空数组");

// 8. 面板收起/展开
await page.click("#history-toggle");
assert((await page.locator("#history-panel.collapsed").count()) === 1, "点击后应收起");
assert(!(await page.locator("#history-list").isVisible()), "收起时列表不可见");
await page.click("#history-toggle");
assert(await page.locator("#history-list").isVisible(), "再次点击应展开");

// 9. 导出功能（捕获下载）
await page.click("#save-button");
await page.waitForSelector(".history-item");
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-history")]);
assert(download.suggestedFilename().endsWith(".json"), "导出应为 json 文件");

// 10. 导入功能：用下载的文件直接导入
const importPath = await download.path();
await page.click("#clear-history");
await page.click("#clear-history");
await page.setInputFiles("#import-file", importPath);
await page.waitForSelector(".history-item", { timeout: 3000 });
assert(await page.locator(".history-item").count() === 1, "导入后应有 1 条记录");

// 11. 移动端视口冒烟
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
assert(!hasHorizontalScroll, "390px 视口不应出现页面级横向滚动");

await browser.close();
console.log(JSON.stringify({ status: "PASS", flows: ["保存", "回退", "持久化", "删除确认", "清空确认", "收起展开", "导出", "导入", "移动端视口"] }, null, 2));
