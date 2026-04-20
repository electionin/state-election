# State Election in India - 2026

A multi-state, data-driven election dashboard built with React + TanStack Router.

This app is designed to serve election elector summaries for various Indian states using state-scoped routes and CSV datasets.

## Features
- State-aware routing (`/:state/...`) using lowercase state codes
- District-wise dashboard with sortable columns
- District drilldown (`/:state/data/:district`) with AC-wise details
- Polling station drilldown (`/:state/data/:district/:acCode/ps/:lang`) for AC-level TA/EN views
- Polling station left-pane grouping by `Polling Stations`, `Voters`, `Vanniyar`, `SC`, `Minority`, `Female`
- Polling station right-pane voter/community summary tables for selected station
- Inline clear (`X`) actions in polling station search boxes
- Header search by district name, AC name, and AC number
- State switcher menu controlled by `show_in_menu`
- Strict NotFound handling for invalid states/districts
- Python scrapers for generating state CSV datasets

## Tech Stack
- Vite + React + TypeScript
- TanStack Router + TanStack Query
- Tailwind CSS
- PapaParse for CSV parsing
- Python scripts for data ingestion

## Repository Structure
```text
src/
  routes/
    __root.tsx
    index.tsx
    $state/data/index.tsx
    $state/data/$district.tsx
    $state/data/$district/$acCode/ps/$lang.tsx
    $state/map.tsx
  services/
    appConfig.ts
    electors.ts
    pollingStations.ts
    pollingStationsView.ts
  components/common/

public/data/
  states.json
  states/<state_code>/
    config.json
    electors.csv
    polling-stations/<acCode>/
      polling_stations.csv
      polling_stations_en.csv

scripts/
  scrape_<state>_ac_electors.py
  test_scrape_<state>_ac_electors.py
```

## State Data Model

### 1) State Registry
`public/data/states.json`

Controls:
- available state codes
- state display names
- `show_in_menu` visibility in header dropdown

### 2) State Config
`public/data/states/<code>/config.json`

Controls:
- `state_id`
- UI labels (`district_label`, `ac_label`, etc.)
- `election_title`, `election_subtitle`
- CSV path (`elector_csv_path`)

### 3) Electors CSV
`public/data/states/<code>/electors.csv`

Common fields used by UI:
- `district_name`
- `ac_no`
- `ac_name`
- `male`
- `female`
- `third_gender`
- `total`

Optional fields supported:
- `district_no`
- `polling_stations`

### 4) Polling Stations CSV (AC-level)
`public/data/states/<code>/polling-stations/<acCode>/polling_stations.csv` (Tamil)
`public/data/states/<code>/polling-stations/<acCode>/polling_stations_en.csv` (English)

Fields used by UI:
- `serial_no`
- `polling_station_no`
- `polling_station_location`
- `section`
- `parts_covered`
- `category`
- `all_voters_covered`
- `male`
- `female`
- `third_gender`
- `total`
- `vanniyar`
- `sc`
- `minority`
- `others`
- `total_votes`

Note:
- English polling station rows are enriched with shared numeric/community fields from the Tamil CSV for the same AC, so grouping and summaries remain available in both `ta` and `en` views.

## Polling Station Page Behavior
- Left pane:
  - Search by polling station number/location
  - Section search
  - Parent grouping controlled by radio options: `Polling Stations`, `Voters`, `Vanniyar`, `SC`, `Minority`, `Female`
- Right pane:
  - Parts covered list for selected station
  - Voter summary table: `Male`, `Female`, `Third Gender`, `Total Votes`
  - Community summary table: `Vanniyar`, `SC`, `Minority`, `Others`

## Currently Added States
- `tn` (Tamil Nadu)
- `py` (Puducherry)
- `kl` (Kerala)
- `as` (Assam)
- `wb` (West Bengal)

Menu visibility is controlled by `show_in_menu` in `public/data/states.json`.

## How to Run the Repo

## Prerequisites
- Node.js 20+
- npm 10+
- Python 3.10+
- `pdftotext` (required for PDF-based scrapers)
- `curl` (used by some scrapers)

## Install Dependencies
```bash
npm install
```

## Start Development Server
```bash
npm run dev
```

Open the app at the local URL printed by Vite (usually `http://localhost:5173`).

## Build for Production
```bash
npm run build
```

## Preview Production Build
```bash
npm run preview
```

## Lint
```bash
npm run lint
```

## Route Examples
- `/tn/data`
- `/kl/data`
- `/as/data`
- `/wb/data`
- `/wb/data/COOCHBEHAR` (district drilldown example)
- `/tn/data/Cuddalore/ac154/ps/ta` (Tamil polling stations view)
- `/tn/data/Cuddalore/ac154/ps/en` (English polling stations view)

## Add a New State
1. Add entry in `public/data/states.json`
2. Set `show_in_menu` as needed
3. Create `public/data/states/<code>/config.json`
4. Generate/add `public/data/states/<code>/electors.csv`
5. Verify:
   - `/<code>/data`
   - `/<code>/data/<district>`
   - `/<code>/data/<district>/ac<acNo>/ps/ta`
   - `/<code>/data/<district>/ac<acNo>/ps/en`
6. Run:
   - `npm run lint`
   - `npm run build`

## Troubleshooting
- State opens NotFound:
  - Check state `code` in `states.json`
  - Ensure `public/data/states/<code>/config.json` exists and `state_id` matches code
  - Ensure `elector_csv_path` points to existing CSV

- District route opens NotFound:
  - District name in URL must exist in that state CSV

- Polling station route opens NotFound:
  - Confirm AC exists under the district in `electors.csv`
  - Confirm files exist under `public/data/states/<code>/polling-stations/ac<acNo>/`
  - CSV must include required polling station headers (including `section`)

- Scraper fails on PDF:
  - Ensure `pdftotext` is installed and available in PATH

## License
MIT License
