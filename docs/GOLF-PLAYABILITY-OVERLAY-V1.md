# Golf Playability Overlay V1

## Scope
Add a six-hour playability overlay for each selected course round, independent of the existing rainfall impact index. The overlay considers wind, gusts, apparent temperature and thunderstorm weather codes.

## Provisional thresholds
- Wind: 8 m/s or gusts 12 m/s -> caution; wind 10 m/s or gusts 15 m/s -> not recommended.
- Apparent temperature: below 15°C or above 30°C -> mild caution; below 10°C or above 32°C -> caution; below 5°C or above 35°C -> not recommended.
- WMO/Open-Meteo thunderstorm codes 95, 96, 99 -> not recommended signal.
- The worst hour within the six-hour window determines the displayed severity, so a short severe episode is not averaged away.

## Output
- Grade: good / acceptable / caution / not recommended.
- Peak wind and gust, minimum/maximum apparent temperature, thunderstorm signal and reasons.
- Missing inputs return insufficient-data, never a benign grade.

## Important limitations
- Thresholds are operational starting points, not medical or safety thresholds.
- No Okinawa-specific historical hindcast or user-preference calibration has been performed.
- This overlay is not merged numerically with the 0–100 rainfall impact index.
- Thunderstorm weather codes are model forecast signals and do not replace official lightning alerts or on-course decisions.
