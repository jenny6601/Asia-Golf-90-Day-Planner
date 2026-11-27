# Forecast archive schema validation tests

The archive collector uses a shared, unit-tested schema gate before declaring a six-course snapshot complete.

- Exactly the six configured course IDs must appear once each and in configured order.
- Every required hourly and daily field must have a complete finite numeric array.
- Null, NaN, missing keys, and shortened arrays count as missing; they are never coerced to zero.
- A zero-length time axis is invalid, not a successful 0/0 coverage result.
- The quality result is embedded in each snapshot as `quality`; it certifies collection completeness only, not forecast accuracy.

Run locally with `npm test`. No user-facing app code or deployment surface is changed.
