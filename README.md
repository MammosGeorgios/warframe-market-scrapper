# Warframe Market Scraper

A Node.js scraper that fetches tradable item data from the [warframe.market](https://warframe.market) API (v2).

## Features

- Fetches the complete list of tradable items via `GET /v2/items`
- Fetches full details for each item via `GET /v2/item/{slug}` and saves one JSON file per item
- **Resumable** — skips items that already have fresh data (less than 1 month old)
- **Rate-limit compliant** — sends at most 2.5 requests per second (400ms interval)
- **Retry on 429** — pauses for 2 seconds and retries when rate-limited (up to 5 attempts)
- Zero external dependencies — uses only Node.js built-in modules (`https`, `fs`, `path`)

## Prerequisites

- [Node.js](https://nodejs.org) (v14 or later)

## Setup

```bash
git clone <repo-url>
cd warframe-market-scraper
npm install
```

## Usage

```bash
node index.js
```

This will:

1. Fetch the full item list from `GET /v2/items` and save it to `data/items.json`
2. For each item, fetch its details from `GET /v2/item/{slug}` and save to `data/item/{slug}.json`
   - Items with a fresh local file (less than 1 month old) are skipped
   - Requests are throttled to 2.5 per second to respect the API rate limit
   - On a 429 response the scraper pauses for 2 seconds and retries (up to 5 times)

You can stop the scraper at any time (Ctrl+C) and re-run it — it will pick up where it left off.

### Example output

```
Fetching all tradable items from warframe.market...
Received 1523 items.
Saved to /path/to/warframe-market-scraper/data/items.json
[1/1523] Fetching Secura Dual Cestra...
[2/1523] Fetching Creeping Bullseye...
...
Done. Fetched: 1400, Skipped (fresh): 123, Total: 1523
```

## Output format

Each item in `data/items.json` follows the `ItemShort` model from the API:

```json
{
  "id": "54aae292e7798909064f1575",
  "slug": "secura_dual_cestra",
  "gameRef": "/Lotus/Weapons/Syndicates/PerrinSequence/Pistols/PSDualCestra",
  "tags": ["syndicate", "weapon", "secondary"],
  "i18n": {
    "en": {
      "name": "Secura Dual Cestra",
      "icon": "items/images/en/secura_dual_cestra...png",
      "thumb": "items/images/en/thumbs/secura_dual_cestra...128x128.png"
    }
  }
}
```

## API details

| Setting        | Value                                  |
| -------------- | -------------------------------------- |
| Base URL       | `https://api.warframe.market/v2`       |
| Endpoints      | `GET /v2/items`, `GET /v2/item/{slug}` |
| Language       | `en` (set via `Language` header)       |
| Platform       | `pc` (set via `Platform` header)       |
| Rate limit     | 3 req/s (scraper uses 2.5 req/s)      |
| Retry on 429   | 2 second pause, up to 5 retries        |
| Cache lifetime | 30 days                                |

Full API documentation: [WFM Api v2 Documentation](https://42bytes.notion.site/WFM-Api-v2-Documentation-5d987e4aa2f74b55a80db1a09932459d)

## Project structure

```
warframe-market-scraper/
├── index.js        # Main scraper script
├── package.json
├── README.md
└── data/
    ├── items.json  # Full item list (generated)
    └── item/       # One JSON file per item (generated)
        ├── ash_prime_set.json
        ├── serration.json
        └── ...
```
