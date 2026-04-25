const https = require("https");
const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.warframe.market/v2";
const OUTPUT_DIR = path.join(__dirname, "data");

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
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
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

async function fetchAllItems() {
  console.log("Fetching all tradable items from warframe.market...");

  const response = await fetchJson(`${API_BASE}/items`);

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
}

fetchAllItems().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
