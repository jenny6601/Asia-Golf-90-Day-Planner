# Phase 12 — Weighted multi-provider itinerary ranking

## Implemented
- `assets/js/weighted-weather-score.js` calculates a transparent component risk score for each complete six-hour source window:
  - Rainfall impact: 65%.
  - Wind impact: 15%.
  - Temperature comfort impact: 20%.
- When at least two providers have complete, comparable six-hour data for the same course and local tee-time window, component scores are combined using the median across available providers.
- Provider count, provider identities, component scores, source-level scores and inter-provider spread are retained.
- `assets/js/multi-provider-itinerary.js` ranks five-day/four-night candidate windows. Golf rounds are on trip days 2, 3 and 4; travel days 1 and 5 are not scored.
- Each golf day requires at least two complete providers for its course. If any round fails this gate, the entire itinerary is excluded from multi-provider ranking.
- Itinerary score = 70% average of the three round scores + 30% worst-round score.
- The live date recommendation action now uses this multi-provider ranking and does not silently fall back to a single-provider score.

## Important interpretation
The 65/15/20 weights are the requested product design weights, not empirically optimized coefficients. Rain, wind and temperature risk thresholds are transparent prototype bands. Provider median reduces sensitivity to one provider's outlier but does not correct systematic provider bias.

The result is a relative planning index, not a probability of rain, cancellation, lightning risk, or course closure. Model calibration remains provisional until historical hindcast and observed-weather backtesting are completed.

## Data gates
- The same six local hourly slots are required from each provider.
- All six precipitation probabilities and amounts are required for rainfall scoring.
- Wind/gust and temperature/apparent-temperature fields are required for the corresponding components.
- Missing fields do not become zero-risk values.
- Foreca three-hourly precipitation accumulation is not used as hourly data.
- At least two independent providers must pass the complete window gate for every round.

## Next validation
1. Run the complete Node test suite on the branch.
2. Deploy a Cloudflare Pages preview and configure server-side Visual Crossing and Foreca secrets.
3. Verify three-provider alignment and timezone behavior for an Okinawa test course.
4. Compare provider differences over multiple forecast issue cycles.
5. Backtest risk thresholds against historical weather and actual golf-day outcomes before describing the model as calibrated.
6. Keep the branch unmerged and production undeployed until explicitly approved.
