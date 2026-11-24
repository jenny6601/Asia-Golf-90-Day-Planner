# Phase 13 — forecast reliability and two-provider date screening

## Goals

- Keep Phase 12 unchanged as the validated baseline.
- Include a golf-day forecast in preliminary playability screening when at least two providers each supply the complete requested hourly window.
- Preserve strict three-provider comparison as a separate metric; never present a two-provider result as three-provider consensus.
- Reduce Foreca rate-limit failures with serialized requests, a minimum request interval, Retry-After handling and bounded exponential backoff.

## Data rules

- A provider is complete only when every required hourly endpoint is present for the requested tee-time window.
- Two or more complete providers make a date eligible for preliminary screening; one provider is insufficient.
- `eligibleDaysAtLeastTwoProviders` counts dates eligible for screening.
- `commonCompleteDays` and `threeProviderCompleteDays` count dates complete across all three named providers.
- Missing providers and values remain unavailable/null. No provider substitutes for another.
- Verified and provisional course-vicinity coordinates remain eligible, with coordinate confidence shown separately.

## Foreca reliability

- Serialize Foreca API requests within the process.
- Default minimum interval: 1,000 ms between requests.
- Retry HTTP 429 up to three times, honoring Retry-After when supplied and otherwise using bounded exponential backoff.
- Do not retry other HTTP errors automatically.
- Keep API credentials out of URLs, logs and generated artifacts.

## Validation

- Unit tests cover two-provider eligibility, one-provider rejection, strict three-provider counts, HTTP 429 retry and Retry-After behavior.
- The live Actions workflow must be rerun to verify actual provider coverage. Unit tests do not prove that Foreca will never rate-limit or that forecasts are accurate.
- Date recommendations continue to require three golf rounds, at least two complete providers per round, and the existing severe-weather veto.
