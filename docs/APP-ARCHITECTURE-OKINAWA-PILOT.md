# App Architecture — Okinawa-Only Pilot

## Scope decision
The current validation scope is Okinawa Main Island only. Do not add, verify, test, score, or recommend courses in other Japanese regions or countries during this phase. Existing non-Okinawa catalogue records may remain stored but must not enter the pilot UI, weather requests, scoring, or test fixtures.

## Product objective
Validate that the application can reliably produce three distinct 5-day / 4-night candidate travel windows for four travelers, with golf on trip days 2, 3, and 4. The primary objective is minimum rainfall risk. Weights: rainfall 65%, wind 15%, temperature comfort 20%. Forecast confidence is reported separately from weather risk.

## Logical architecture

1. **Presentation layer**
   - Pilot destination: Okinawa Main Island.
   - Select from Okinawa pilot courses only.
   - Trip constraints and tee-time inputs.
   - Weather-source comparison, date recommendations, itinerary detail, and data-quality disclosure.
   - No selectable non-Okinawa destination/course during pilot validation.

2. **Application layer**
   - Destination/course selection service.
   - Forecast orchestration service.
   - Trip-window generation and ranking.
   - Itinerary composition.
   - Forecast-confidence and data-quality presentation.

3. **Weather provider adapters**
   - Open-Meteo Forecast.
   - Visual Crossing.
   - Foreca.
   - EC46 / SEAS5 seasonal outlook adapter for long-range context.
   - Each adapter preserves provider-native payload metadata before normalization.

4. **Normalization and quality layer**
   - Normalize timestamps to the course IANA timezone (Asia/Tokyo for Okinawa).
   - Normalize units and precipitation interval semantics before comparison.
   - Preserve provider, model, issue time, valid time, lead time, and retrieval time.
   - Missing values remain null/unavailable; never replace missing rainfall with zero or synthetic values.
   - Keep forecast risk separate from forecast confidence.

5. **Persistence/cache layer**
   - Separate provider cache records by provider, course, model, and valid time.
   - Record fetch status, issue time, retrieval time, schema version, and validation errors.
   - Keep raw/normalized data traceable; cache writes must not happen during read-only smoke tests.

## Forecast horizon policy

- Days 1–16: deterministic daily/hourly forecasts, limited to actual provider coverage.
- Days 17–46: extended-range / EC46 weekly trend signals; not deterministic daily rain forecasts.
- Days 47–90: SEAS5 seasonal probabilities and climatological context; never render as precise daily forecasts.
- Do not combine unlike horizons into one apparently precise daily risk score.

## Course readiness gate
A course may be used for operational forecast scoring only when its course-point GPS is verified with traceable evidence and its timezone is explicit. Provisional or pending coordinates may be shown as catalogue metadata but must not enter production date recommendations.

Current Okinawa catalogue status (as of this architecture review): six records; one verified coordinate (The Southern Links), four provisional coordinates and one pending. The Southern Links pin is sourced from the official Accordia Golf access page embedded Google Maps map. This establishes an official course-location pin, not a surveyed course polygon or tee-by-tee coordinate set. Therefore, live API connectivity tests may validate adapter behavior, but cannot yet validate course-specific forecast accuracy or booking recommendations.

## Core data contracts

### Course
- id, countryCode, region, city, courseName
- latitude, longitude, timezone
- coordinateStatus, coordinateSource, coordinateSourceUrl, coordinateVerifiedAt
- providerAvailability per provider

### Forecast observation
- courseId, provider, model
- issuedAt, fetchedAt, validTime, leadTime
- precipitationProbability, precipitationAmount, precipitationInterval
- temperature, apparentTemperature, windSpeed, windGust
- sourceUnits, normalizedUnits, qualityStatus

### Candidate window
- startDate, endDate, golfDates[3]
- rainfallRisk, windRisk, temperatureComfort
- weightedWeatherScore
- forecastConfidence (separate field)
- coverageStatus, missingInputs, explanation

## Recommendation rules
- Rank three distinct 5-day windows, with golf on days 2–4 and travel on days 1 and 5.
- Weighted weather score: rainfall 65%, wind 15%, temperature comfort 20%.
- Lower weather risk is better; confidence is not added to the risk score.
- A window is not scored when required data coverage is insufficient.
- Days 17–90 outputs are labelled as trend-based candidate windows with lower confidence, not deterministic daily forecasts.

## Validation gates

1. **Scope gate:** only Okinawa courses appear in the pilot UI and requests.
2. **Course identity/GPS gate:** official identity, address, course-point GPS and timezone are independently checked.
3. **Provider contract gate:** each adapter passes schema, units, timezone, interval and missing-data tests.
4. **Comparison gate:** provider comparisons use aligned valid times and precipitation intervals.
5. **Recommendation gate:** three distinct windows are generated only where data coverage supports them.
6. **Mobile usability gate:** all key flows work on a phone without hidden/ambiguous status.
7. **Release gate:** no merge to main or production deployment without explicit user approval.

## Immediate implementation sequence

- A. Isolate Okinawa in the pilot UI; keep non-Okinawa records out of the user flow.
- B. Establish verified GPS for the selected Okinawa test course(s) before claiming course-specific forecast validity.
- C. Run provider adapters independently and compare normalized outputs.
- D. Build the 1–16 / 17–46 / 47–90 day presentation and confidence labels.
- E. Validate three candidate windows and the 5-day itinerary flow on mobile.

## Non-goals for this phase
- No new country or non-Okinawa course catalogue work.
- No expansion of course counts.
- No production booking integration.
- No fabricated weather data or coordinate inference from provider grid points.
- No merge to main or deployment without explicit approval.
