# Asia Eight-Country Shared Engine

## Scope

This project supports only eight Asian markets: Japan (JP), South Korea (KR), China (CN), Vietnam (VN), Thailand (TH), Malaysia (MY), Singapore (SG) and Indonesia (ID). Do not add other markets.

## Shared course directory

- `config/global/countries.json` is the country registry.
- `config/global/courses.json` is the single course catalog.
- Every course carries its own IANA timezone, coordinates, coordinate provenance and coordinate confidence.
- Pending coordinates stay null; provisional vicinity coordinates may be used when present and must remain labeled provisional.
- Add courses as data records. Do not create country-specific course modules or workflows.

## Shared browser modules

- `assets/js/course-catalog.js` loads and validates the shared country and course directory.
- `assets/js/course-time.js` formats dates and times using each course's IANA timezone.
- `assets/js/weather-api.js` requests the course forecast using `course.timezone`; Japan is only a backward-compatible fallback for legacy Okinawa records.

## Forecast and decision policy

- Existing forecast provider and date-decision engines remain shared; no country-specific scoring formula.
- Preliminary multi-provider assessment requires at least two complete providers.
- Strict three-provider comparison remains a separate quality measure.
- Five days/four nights, three golf rounds, six-hour tee-time windows and rainfall as the primary objective remain the default trip design.
- Do not claim forecast accuracy from API availability or unit tests. Hindcast validation remains a separate later task.

## Rollout

1. Complete shared country/course/timezone and provider adapters.
2. Connect the existing PWA to the shared directory without changing its stable user experience.
3. Register Vietnam's initial courses using sourced course-vicinity coordinates and local timezone.
4. Only after the shared architecture is complete, run the combined Okinawa and Vietnam integration test.
5. Add remaining Asian course records using the same schema.

## Change discipline

Work on a feature branch. Preserve the stable `main` branch until architecture review and one consolidated validation are complete. Avoid country-specific workflows and unnecessary architecture layers.
