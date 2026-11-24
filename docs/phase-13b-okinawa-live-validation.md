# Phase 13-B — Okinawa live provider validation

## Purpose

Run the Phase 13 unit tests and then collect a fresh, independent live forecast snapshot for all six Okinawa pilot courses. This is a connectivity and coverage validation, not a forecast-accuracy test.

## Workflow

Run `.github/workflows/phase13-okinawa-provider-validation.yml` manually on branch `phase-13-forecast-reliability-two-provider`.

The workflow:
1. Runs `npm test`.
2. Collects Open-Meteo, Visual Crossing and Foreca data using the repository Actions secrets.
3. Builds six-hour playability coverage for the 10:00–16:00 local window.
4. Publishes a GitHub Actions step summary and uploads JSON/Markdown artifacts.

## Coverage rules

- Preliminary date screening requires complete hourly endpoints from at least two of the three forecast providers for the selected six-hour window.
- Strict three-provider common coverage is reported separately and must not be inferred from the two-provider result.
- A missing provider remains unavailable; no provider fills another provider's values.
- Numeric provisional course-vicinity coordinates may be used for preliminary weather screening, with coordinate confidence visible in the report.
- JMA MSM remains not configured until a verified operational adapter is available.

## Foreca reliability behavior

- Requests are serialized within the workflow process.
- The default minimum interval is 1,000 ms between requests.
- HTTP 429 is retried up to three times; Retry-After is honored when present, otherwise bounded exponential backoff is used.
- Other HTTP failures remain visible as provider-unavailable results.

## Secrets

The repository must have:
- `VISUAL_CROSSING_API_KEY`
- `FORECA_API_KEY`

If a secret is absent, that provider reports unavailable; no credentials are printed in the artifact.

## Acceptance criteria

- Unit tests pass.
- Live report contains six course records, with explicit coordinate status.
- Provider availability counts are visible for Open-Meteo, Visual Crossing, Foreca and JMA MSM.
- Each course reports eligible six-hour days with at least two complete providers and separate three-provider complete-day counts.
- Chura Orchard must be included in preliminary screening on days when Open-Meteo and Visual Crossing both provide complete windows, even if Foreca is rate-limited.
- A successful workflow is not evidence of forecast accuracy. Forecast accuracy requires archived forecasts matched to observed weather.
