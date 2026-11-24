# Phase 9.3 — Japan course catalogue seed

## Scope
This increment adds two Japan mainland course records to the shared course catalogue. It does not enable forecast requests for them: GPS latitude and longitude remain null until independently verified.

## Seed records

| Country / region | Course | Address | GPS state |
|---|---|---|---|
| Japan / Chiba | Narita Golf Club | 127 Omuro, Narita-shi, Chiba 286-0821, Japan | Pending |
| Japan / Hokkaido | Hokkaido Classic Golf Club | 406 Tomioka, Hayakita, Abira-cho, Yufutsu-gun, Hokkaido 059-1434, Japan | Pending |

## Provenance
- Narita Golf Club official club information: https://www.accordiagolf.com/en/grand/narita/information.php
- Narita Golf Club official access page: https://reserve.accordiagolf.com/en/global/golfcourse/chiba/narita/access/
- Hokkaido Classic Golf Club official company / club information: https://www.hcgc.jp/en/contents/about/index.html
- Japan National Tourism Organization's regional golf directory is used as a discovery cross-check, not as GPS evidence: https://www.japan.travel/en/sports/golf/courses/

## Data quality policy
1. Official identity and address can be recorded before GPS verification.
2. No coordinates are inferred from address text or geocoding guesses.
3. Pending records remain visible in the destination course list but cannot be selected for forecast requests.
4. Forecast eligibility requires numeric latitude and longitude, traceable coordinate source, verification date, and valid course-local IANA timezone.
5. The two new records are not yet forecast-ready. Provider availability is pending for each provider.

## Next work
Verify the two locations against official club maps or authoritative map coordinates, then add additional Japan regions in batches. Expand to Vietnam and Thailand only after the Japan catalogue workflow is stable.
