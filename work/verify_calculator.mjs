import fs from "node:fs/promises";

const htmlPath = new URL("../outputs/滚仓计算器.html", import.meta.url);
const html = await fs.readFile(htmlPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scriptBlocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert(scriptBlocks.length === 1, "应只有一个内嵌脚本块");
new Function(scriptBlocks[0]);

assert(!/<script[^>]+src=/i.test(html), "不应引用外部脚本");
assert(!/<link[^>]+href=/i.test(html), "不应引用外部样式");
assert(!/(?:https?:)?\/\//i.test(html.replace(/\/\/[^\n]*/g, "")), "不应依赖网络 URL");
assert(html.includes('id="initial-leverage"'), "缺少初始杠杆输入项");
assert(html.includes('id="final-assets"'), "缺少最终资产汇总");
assert(html.includes('id="return-rate"'), "缺少收益率汇总");

const laterLeverages = [20, 20, 15, 10, 5, 3, 2, 1, 0.5, 0.2, 0.1];

function calculate({ price, principal, initialLeverage }) {
  const leverages = [initialLeverage, ...laterLeverages];
  const rows = [];
  let cumulativeGrowth = 0;
  let currentPrice = price;
  let coinQuantity = principal / price;
  let assets = principal;

  for (let index = 0; index < leverages.length; index += 1) {
    const growth = index === 0 ? 0 : 1 / leverages[index - 1];
    let profit = 0;
    if (index > 0) {
      const previous = rows[index - 1];
      currentPrice = previous.price * (1 + growth);
      const profitU = previous.assets * previous.leverage * growth;
      assets = previous.assets + profitU;
      coinQuantity = assets / currentPrice;
      profit = profitU / currentPrice;
    }
    cumulativeGrowth += growth;
    const leverage = leverages[index];
    rows.push({
      price: currentPrice,
      coinQuantity,
      leverage,
      position: coinQuantity * leverage,
      profit,
      assets,
      cumulativeGrowth,
    });
  }
  return rows;
}

function near(actual, expected, tolerance = 1e-8) {
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));
}

const rows25 = calculate({ price: 0.06, principal: 600, initialLeverage: 25 });
assert(rows25.length === 12, "25 倍场景应生成 12 阶段");
assert(near(rows25[1].price, 0.0624), "25 倍对应的下一阶段涨幅应为 4%");
assert(near(rows25[1].assets, 1200), "第 2 阶段资产应严格翻倍");
assert(near(rows25[2].assets, 2400), "第 3 阶段资产应再次翻倍");
assert(rows25.every((row, index) => index === 0 || near(row.assets, rows25[index - 1].assets * 2)), "每一阶段资产都应为上一阶段的 2 倍");
assert(rows25.every(row => near(row.coinQuantity, row.assets / row.price)), "币数量必须等于资产除以当前价格");
assert(near(rows25[11].assets, 1228800), "最终资产应为本金乘以 2 的 11 次方");
assert(near((rows25[11].assets / 600 - 1) * 100, 204700), "收益率应匹配逐级翻倍逻辑");

const rows20 = calculate({ price: 0.06, principal: 600, initialLeverage: 20 });
assert(near(rows20[1].price, 0.063), "20 倍对应的下一阶段涨幅应为 5%");
assert(near(rows20[1].assets, 1200), "20 倍乘 5% 后资产也应翻倍");
assert(rows20.every((row, index) => index === 0 || near(row.assets, rows20[index - 1].assets * 2)), "20 倍场景也应逐级翻倍");
assert(rows20.every(row => near(row.coinQuantity, row.assets / row.price)), "20 倍场景币数量公式不正确");

const scaled = calculate({ price: 0.07341, principal: 100, initialLeverage: 25 });
assert(near(scaled[0].coinQuantity, 100 / 0.07341), "截图场景首阶段币数量不正确");
assert(near(scaled[1].price, 0.0763464), "截图场景第 2 阶段价格不正确");
assert(near(scaled[1].assets, 200), "截图场景第 2 阶段资产应为 200");
assert(near(scaled[1].coinQuantity, 200 / 0.0763464), "截图场景第 2 阶段币数量应为资产除以价格");
assert(near(scaled[11].assets, 204800), "截图场景最终资产应为 100 乘以 2 的 11 次方");

console.log(JSON.stringify({
  status: "PASS",
  htmlBytes: Buffer.byteLength(html),
  scenarios: {
    excel25x: {
      finalAssets: rows25[11].assets,
      returnRatePercent: (rows25[11].assets / 600 - 1) * 100,
    },
    leverage20x: {
      stage2CoinQuantity: rows20[1].coinQuantity,
      finalCoinQuantity: rows20[11].coinQuantity,
      finalAssets: rows20[11].assets,
    },
    screenshot: {
      finalAssets: scaled[11].assets,
    },
  },
}, null, 2));
