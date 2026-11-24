# Global Golf Weather — shared foundation

This repository is moving from country-specific pilots toward one shared data and validation foundation.

## Add a country

1. Add or update its two-letter entry in `config/global/countries.json`.
2. Add courses to `config/global/courses.json` with country code, region, address, per-course IANA timezone, coordinate provenance and coordinate status.
3. Keep coordinates null when they are pending. Use numeric course-vicinity coordinates only when available, and mark them provisional until verified.
4. Do not create a country-specific workflow. The same global validation workflow checks every country and course.

## Shared forecast policy

- Open-Meteo, Visual Crossing and Foreca are shared provider adapters.
- At least two complete providers are required for preliminary screening.
- Strict three-provider comparison remains a separate metric.
- Missing values are never filled from another provider.
- Trip decision defaults remain five days/four nights and three rounds, with minimum rainfall as the primary objective.

## Time zones

Every course stores its own IANA timezone. Do not infer a single timezone for a country: Indonesia and other multi-zone markets require per-course time zones.

## Current scope

The eight launch markets are registered. The six Okinawa pilot courses are migrated into the shared catalog. Other markets are registered but not yet populated with verified course records. This foundation does not yet claim global live forecast collection or forecast accuracy.
