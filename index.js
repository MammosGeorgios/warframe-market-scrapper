const https = require("https");
const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.warframe.market/v2";
const OUTPUT_DIR = path.join(__dirname, "data");
const ITEM_DETAILS_DIR = path.join(OUTPUT_DIR, "item");
const ORDERS_DIR = path.join(OUTPUT_DIR, "orders");
const REQUEST_INTERVAL_MS = 400; // 2.5 requests per second
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 1 month

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          Language: "en",
          Platform: "pc",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 429) {
            reject({ statusCode: 429, message: "Rate limited" });
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse JSON: ${err.message}`));
          }
        });
      }
    );
  });
}

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      const isRetryable = err.statusCode === 429;
      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`  Rate limited, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err instanceof Error ? err : new Error(err.message);
    }
  }
}

function isFresh(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return Date.now() - stat.mtimeMs < STALE_THRESHOLD_MS;
  } catch {
    return false;
  }
}

async function fetchAllItems() {
  console.log("Fetching all tradable items from warframe.market...");

  const response = await fetchWithRetry(`${API_BASE}/items`);

  if (response.error) {
    throw new Error(`API error: ${JSON.stringify(response.error)}`);
  }

  const items = response.data;
  console.log(`Received ${items.length} items.`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, "items.json");
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));
  console.log(`Saved to ${outputPath}`);

  return items;
}

async function fetchItemDetails(items) {
  if (!fs.existsSync(ITEM_DETAILS_DIR)) {
    fs.mkdirSync(ITEM_DETAILS_DIR, { recursive: true });
  }

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filePath = path.join(ITEM_DETAILS_DIR, `${item.slug}.json`);

    if (isFresh(filePath)) {
      skipped++;
      continue;
    }

    const progress = `[${i + 1}/${items.length}]`;
    const name = item.i18n?.en?.name || item.slug;
    console.log(`${progress} Fetching ${name}...`);

    const response = await fetchWithRetry(`${API_BASE}/item/${item.slug}`);

    if (response.error) {
      console.error(`${progress} API error for ${item.slug}: ${JSON.stringify(response.error)}`);
      continue;
    }

    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
    fetched++;

    await sleep(REQUEST_INTERVAL_MS);
  }

  console.log(`\nDone. Fetched: ${fetched}, Skipped (fresh): ${skipped}, Total: ${items.length}`);
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeSellMetrics(orders) {
  const sellPrices = orders
    .filter((o) => o.type === "sell")
    .map((o) => o.platinum)
    .sort((a, b) => a - b);

  if (sellPrices.length === 0) {
    return { lowestSellPrice: null, medianLowestSellPrice: null, medianSellPrice: null, averageSellPrice: null };
  }

  const lowestSellPrice = sellPrices[0];
  const lowest5 = sellPrices.slice(0, 5);
  const medianLowestSellPrice = median(lowest5);
  const medianSellPrice = median(sellPrices);
  const averageSellPrice = Math.round((sellPrices.reduce((s, p) => s + p, 0) / sellPrices.length) * 100) / 100;

  return { lowestSellPrice, medianLowestSellPrice, medianSellPrice, averageSellPrice };
}

async function fetchItemOrders(items) {
  if (!fs.existsSync(ORDERS_DIR)) {
    fs.mkdirSync(ORDERS_DIR, { recursive: true });
  }

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filePath = path.join(ORDERS_DIR, `${item.slug}.json`);

    if (isFresh(filePath)) {
      skipped++;
      continue;
    }

    const progress = `[${i + 1}/${items.length}]`;
    const name = item.i18n?.en?.name || item.slug;
    console.log(`${progress} Fetching orders for ${name}...`);

    const response = await fetchWithRetry(`${API_BASE}/orders/item/${item.slug}`);

    if (response.error) {
      console.error(`${progress} API error for ${item.slug}: ${JSON.stringify(response.error)}`);
      continue;
    }

    const orders = response.data;
    const metrics = computeSellMetrics(orders);

    const output = { slug: item.slug, metrics, orders };
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    fetched++;

    await sleep(REQUEST_INTERVAL_MS);
  }

  console.log(`\nOrders done. Fetched: ${fetched}, Skipped (fresh): ${skipped}, Total: ${items.length}`);
}

function buildPriceEntry(name, slug, rank, orders) {
  const sellOrders = orders.filter((o) => o.type === "sell");
  const metrics = computeSellMetrics(sellOrders);
  return {
    name,
    slug,
    lowestSellPrice: metrics.lowestSellPrice,
    medianLowestSellPrice: metrics.medianLowestSellPrice,
    medianSellPrice: metrics.medianSellPrice,
    averageSellPrice: metrics.averageSellPrice,
    countOfSellOrders: sellOrders.length,
    rank,
  };
}

function buildPrices(items) {
  console.log("Building unified prices.json...");
  const prices = [];

  for (const item of items) {
    const itemPath = path.join(ITEM_DETAILS_DIR, `${item.slug}.json`);
    const ordersPath = path.join(ORDERS_DIR, `${item.slug}.json`);

    if (!fs.existsSync(ordersPath)) continue;

    const ordersData = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
    const orders = ordersData.orders;

    let itemDetail = null;
    if (fs.existsSync(itemPath)) {
      itemDetail = JSON.parse(fs.readFileSync(itemPath, "utf-8"));
    }

    const baseName = itemDetail?.i18n?.en?.name || item.i18n?.en?.name || item.slug;
    const hasRank = orders.some((o) => o.rank !== undefined && o.rank !== null);

    if (hasRank) {
      const maxRank = itemDetail?.maxRank ?? Math.max(...orders.filter((o) => o.rank != null).map((o) => o.rank));

      const rank0Orders = orders.filter((o) => o.rank === 0);
      prices.push(buildPriceEntry(`${baseName} Rank 0`, item.slug, 0, rank0Orders));

      const maxRankOrders = orders.filter((o) => o.rank === maxRank);
      prices.push(buildPriceEntry(`${baseName} Rank ${maxRank}`, item.slug, maxRank, maxRankOrders));
    } else {
      prices.push(buildPriceEntry(baseName, item.slug, null, orders));
    }
  }

  const outputPath = path.join(OUTPUT_DIR, "prices.json");
  fs.writeFileSync(outputPath, JSON.stringify(prices, null, 2));
  console.log(`Saved ${prices.length} entries to ${outputPath}`);
}

async function main() {
  const items = await fetchAllItems();
  await fetchItemDetails(items);
  await fetchItemOrders(items);
  buildPrices(items);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
