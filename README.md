# Warframe Market Scraper

A Node.js scraper that fetches tradable item data from the [warframe.market](https://warframe.market) API (v2).

## Features

- Fetches the complete list of tradable items via `GET /v2/items`
- Saves the response as a formatted JSON file in `data/items.json`
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

1. Send a `GET` request to `https://api.warframe.market/v2/items`
2. Parse the JSON response and extract the `data` array
3. Write the items to `data/items.json`

### Example output

```
Fetching all tradable items from warframe.market...
Received 1523 items.
Saved to /path/to/warframe-market-scraper/data/items.json
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

| Setting  | Value                                    |
| -------- | ---------------------------------------- |
| Base URL | `https://api.warframe.market/v2`         |
| Endpoint | `GET /v2/items`                          |
| Language | `en` (set via `Language` header)         |
| Platform | `pc` (set via `Platform` header)         |
| Rate limit | 3 requests per second                  |

Full API documentation: [WFM Api v2 Documentation](https://42bytes.notion.site/WFM-Api-v2-Documentation-5d987e4aa2f74b55a80db1a09932459d)

## Project structure

```
warframe-market-scraper/
├── index.js        # Main scraper script
├── package.json
├── README.md
└── data/
    └── items.json  # Generated output (git-ignored)
```
