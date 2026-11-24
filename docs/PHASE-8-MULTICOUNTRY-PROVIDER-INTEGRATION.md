# Phase 8 — Multi-country provider integration

## Scope
The target catalogue remains the original eight countries: Japan (JP), South Korea (KR), China (CN), Vietnam (VN), Thailand (TH), Malaysia (MY), Singapore (SG), and Indonesia (ID). Okinawa is the first integration pilot; the provider adapter contract is country-neutral.

## Current repository audit
- The browser application currently calls Open-Meteo directly from `assets/js/weather-api.js`.
- No Visual Crossing or Foreca adapter was present in the Phase 7 branch.
- The existing Pages deployment is static. API credentials must not be placed in browser JavaScript, HTML, public JSON, or committed workflow output.
- No workflow on the Phase 7 branch references Visual Crossing or Foreca secrets. GitHub Actions secrets are repository-scoped unless organization/environment configuration is deliberately shared; a key stored in a different repository is not automatically available here.
- This phase is isolated on `phase-8-multicountry-provider-integration`; no merge to main and no Pages deployment is authorized.

## Provider coverage contract
| Provider | Lead-time detail | Handling |
|---|---|---|
| Visual Crossing Timeline | Up to 15 days; hourly and daily | Request metric units and retain provider timezone. Treat days beyond the numerical forecast horizon, if any, as statistical/climatological context only; do not score them as deterministic hourly forecasts. |
| Foreca hourly | Up to 7 days (maximum 169 hourly periods) | Preserve ISO-8601 offset timestamps; precipitation accumulation is per hour. |
| Foreca three-hourly | Up to 14 days (maximum 113 periods) | Preserve the 3-hour accumulation interval; never compare its amount directly with a 1-hour amount without explicit aggregation. |
| Foreca daily | Up to 14 days (maximum 15 periods) | Daily summary only; do not synthesize hourly values. |
| Open-Meteo Forecast | Existing application source | Retain as an independent source. |

The application must display provider agreement and disagreement side by side. Do not average raw provider values, probabilities, or rainfall totals unless their valid times, temporal aggregation, units, and definitions have first been aligned and documented.

## Eight-country location contract
Every course record must provide:
- ISO-3166-1 alpha-2 country code from the approved eight-country set;
- IANA timezone for the course itself (not the user's timezone);
- verified latitude and longitude;
- coordinate source and verification status.

Do not infer an Indonesian course's timezone from country alone; Indonesia spans multiple IANA time zones. China, Japan, Korea, Vietnam, Thailand, Malaysia, and Singapore also require an explicit course-level timezone field even when a country commonly uses one standard zone.

## Security and deployment design
1. Provider requests run only in GitHub Actions or another server-side runtime.
2. Expected repository secret names are `VISUAL_CROSSING_API_KEY` and `FORECA_API_KEY`. This repository's existing workflows did not yet reference either name. Add credentials through the repository's Settings → Secrets and variables → Actions; never paste keys into chat or source files.
3. A server-side job writes normalized JSON cache with provider, course, fetched time, valid time, timezone, units, and quality metadata. Raw credential-bearing request URLs and headers must never be logged.
4. The public Pages app reads only the sanitized cache; it never calls credentialed providers directly.
5. A failed or missing provider remains unavailable. Never substitute zero, fabricate hourly data from daily values, or silently copy another provider's values.

## Horizon separation
- Days 1–7: Visual Crossing hourly, Foreca hourly, Open-Meteo hourly where available.
- Days 8–14: Visual Crossing hourly, Foreca 3-hourly/daily, Open-Meteo hourly where available. Keep resolution differences explicit.
- Day 15: Visual Crossing forecast coverage may remain available; Foreca daily may return up to 15 periods, but do not assume the 15th day exists—check the actual returned date axis.
- Days 16–46: retain the existing EC46 ensemble outlook as a separate evidence tier.
- Days 47–90: retain the existing SEAS5 seasonal outlook as a separate evidence tier.

VC statistical extensions beyond the 15-day model forecast, if returned, must not be represented as numerical deterministic forecasts.

## Phase 8 implementation sequence
- 8.1 Provider-independent normalization and unit/time semantics (this commit).
- 8.2 Server-side read-only fetchers for Visual Crossing and Foreca with mocked tests.
- 8.3 GitHub Actions workflow using repository secrets and sanitized cache output.
- 8.4 Okinawa live API smoke test and comparison report; do not activate automatic ranking until quality is assessed.
- 8.5 Expand the same contract to the remaining seven countries after course catalogue and timezone verification.

## Official provider references
- Visual Crossing Timeline API: https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
- Foreca authorization: https://developer.foreca.com/docs/authorization
- Foreca point forecast endpoints: https://developer.foreca.com/docs/point-forecasts
- Foreca quickstart: https://developer.foreca.com/docs/quickstart
