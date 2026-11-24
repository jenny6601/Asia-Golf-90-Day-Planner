# Okinawa weather forecast and golf-date decision policy

## 1. Planning unit

A candidate trip is five calendar days and four nights. Day 1 and Day 5 are travel days. Golf is scheduled on Days 2, 3 and 4, in the user's selected course order. The default tee time is configurable from 06:00 to 13:00 local time. Each golf round is evaluated over the six hours immediately after tee-off.

## 2. Forecast evidence by lead time

| Lead time | Evidence | Allowed interpretation |
|---|---|---|
| 1–16 days | Hourly/daily numerical forecasts from course-vicinity points | Six-hour round assessment when the required hourly values are present |
| 17–46 days | ECMWF extended-range weekly precipitation EFI/anomalies | Broad wet/dry tendency for the applicable weekly period |
| 47–90 days | Seasonal/monthly precipitation mean and anomaly | Broad monthly wet/dry tendency only |

Do not display 17–90 day values as daily rain probabilities, exact daily rainfall, or deterministic daily weather. Do not compare a short-range numeric risk index directly with a long-range ordinal tendency class.

## 3. Core weather indicators

Keep these indicators visible separately:
- Rain probability by hour, six-hour total reported precipitation, peak hourly precipitation and wet-hour count.
- Sustained wind, gust and wind direction.
- Air temperature and apparent temperature.
- Relative humidity and Humidex, where valid inputs are available.
- Thunderstorm/weather-code signals.
- Solar radiation and UV exposure, where returned by the provider.

## 4. Multi-provider comparison

Compare identical local timestamps and compatible accumulation intervals. A multi-provider round score requires at least two complete providers. Never silently coerce three-hour accumulation into hourly precipitation, fill missing values across providers, or interpret provider spread as an accuracy score.

Use provider-wise median component scores:
- Rainfall 65%.
- Wind 15%.
- Temperature comfort 20%.

The itinerary risk is the mean of the three round risks weighted 70%, plus the worst round weighted 30%. Lower is better. Return up to three distinct trip windows separated by at least five days.

## 5. Severe-weather exclusion

Apply the existing six-hour playability overlay as a separate veto, not as a hidden change to the rainfall score. Exclude a candidate window when a golf day has a severe thunderstorm signal, extreme wind/gust, or extreme apparent-temperature signal. If the playability inputs are incomplete, mark the window as insufficient data; do not assume safe conditions.

This is a conservative screening rule, not a safety certification or a calibrated cancellation probability.

## 6. Coordinate confidence

Both verified and provisional numeric course-vicinity points may be used for preliminary weather forecasting and date screening. Show coordinate confidence separately. Pending points without numeric coordinates are excluded. Provisional does not mean surveyed or exact to the fairway.

## 7. Forecast confidence and booking decision

Forecast/data confidence is separate from weather risk. Display provider count, coverage, update/issue time, forecast lead, and provider disagreement where available. A low-risk forecast with poor data coverage must not be described as high confidence.

Before booking, recheck the three golf dates at short lead time and confirm tee-time availability and course operating status directly with each course. Historical hindcast calibration remains a prerequisite for presenting the prototype scores as calibrated probabilities.
