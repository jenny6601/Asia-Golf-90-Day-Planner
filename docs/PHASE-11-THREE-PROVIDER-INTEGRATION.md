# Phase 11 — Three-provider course forecast integration

## Implemented components
- `functions/api/course-weather.js`: Cloudflare Pages Function. Accepts 1–3 selected course records and invokes Visual Crossing and Foreca independently on the server.
- `scripts/lib/provider-fetchers.mjs`: existing provider adapters are reused; credentials are read only from server-side environment variables.
- `assets/js/provider-comparison.js`: aligns the same local six-hour golf window and summarizes precipitation probability, accumulated rainfall, temperature/apparent temperature and wind.
- `assets/js/app.js`: after Open-Meteo course forecast succeeds, calls `/api/course-weather` and displays the three sources side-by-side per course.

## Security and deployment requirements
The function is a Cloudflare Pages Functions endpoint. It does not run on a plain GitHub Pages static site. To enable Visual Crossing and Foreca in a Cloudflare Pages deployment:
1. Connect the repository to Cloudflare Pages with the repository root as the project root.
2. Add server-side environment variables `VISUAL_CROSSING_API_KEY` and `FORECA_API_KEY` in Cloudflare Pages Settings → Environment variables. Never add these keys to frontend code, HTML, or repository files.
3. Deploy the Pages Functions runtime with the static site.
4. Confirm `POST /api/course-weather` returns one result per selected course. A provider can independently report unavailable if its key or API is unavailable.

If the app is opened from GitHub Pages, the API route is absent. The interface therefore retains Open-Meteo and explicitly reports that VC/Foreca are not connected; it does not pretend all three sources succeeded.

## Comparison rules
- All sources are compared on the same course-local date and same six-hour tee-time window.
- Visual Crossing Timeline hourly records and Foreca hourly records are eligible for six-hour comparisons.
- Foreca three-hourly accumulation is not converted into hourly precipitation and is not used for the six-hour hourly comparison.
- Missing values, provider failures and incomplete six-hour coverage remain explicit.
- No source fills another source's missing values.
- Values are source-specific observations/forecasts, not averaged into a synthetic consensus.

## Current limitations / next validation
- The browser comparison is an evidence table, not yet a calibrated multi-provider consensus model.
- Open-Meteo remains the current input to the existing short-range recommendation engine; VC/Foreca are shown independently for cross-checking until timestamp, interval, and historical bias validation are complete.
- The existing 65% rainfall / 15% wind / 20% temperature weighting is a product requirement; do not claim that the three-provider recommendation engine is complete until each component is implemented and tested.
- Run CI and verify the Pages Function in a Cloudflare preview environment before using the comparison for booking decisions.
- No merge to main or production deployment is authorized by this change.
