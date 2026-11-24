const finiteOrNull = value =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function validateCourse(course) {
  if (!course || typeof course !== "object") throw new TypeError("course is required");
  if (!course.id || !course.name) throw new TypeError("course.id and course.name are required");
  if (!Number.isFinite(course.latitude) || !Number.isFinite(course.longitude)) {
    throw new TypeError("course latitude/longitude must be verified numeric coordinates");
  }
  if (!course.countryCode || !course.timezone) {
    throw new TypeError("course countryCode and IANA timezone are required");
  }
  try {
    new Intl.DateTimeFormat("en-US", {timeZone: course.timezone}).format(new Date(0));
  } catch {
    throw new TypeError("course timezone must be a valid IANA timezone");
  }
  return {
    id: course.id,
    name: course.name,
    countryCode: course.countryCode,
    timezone: course.timezone,
    latitude: course.latitude,
    longitude: course.longitude
  };
}

function kmhToMs(value) {
  const numeric = finiteOrNull(value);
  return numeric === null ? null : Number((numeric / 3.6).toFixed(4));
}

function normalizeHour({time, temperature, feelsLike, humidity, precipProbability,
  precipitationMm, windSpeedMs, windGustMs, windDirectionDeg, weatherCode,
  accumulationPeriodHours = 1}) {
  return {
    time,
    temperatureC: finiteOrNull(temperature),
    feelsLikeC: finiteOrNull(feelsLike),
    relativeHumidityPct: finiteOrNull(humidity),
    precipitationProbabilityPct: finiteOrNull(precipProbability),
    precipitationMm: finiteOrNull(precipitationMm),
    precipitationAccumulationPeriodHours: accumulationPeriodHours,
    windSpeedMs: finiteOrNull(windSpeedMs),
    windGustMs: finiteOrNull(windGustMs),
    windDirectionDeg: finiteOrNull(windDirectionDeg),
    weatherCode: weatherCode ?? null
  };
}

/**
 * Normalize Visual Crossing Timeline API hourly data.
 * Timeline timestamps are local wall-clock strings; retain the provider's
 * IANA timezone instead of converting them through the machine's timezone.
 */
export function normalizeVisualCrossing(payload, course, fetchedAt = new Date().toISOString()) {
  const location = validateCourse(course);
  if (!payload || !Array.isArray(payload.days) || !payload.days.length) {
    throw new TypeError("Visual Crossing payload is missing days");
  }
  const timezone = payload.timezone || location.timezone;
  if (timezone !== location.timezone) {
    throw new Error(`Visual Crossing timezone mismatch for ${location.id}`);
  }
  const days = payload.days.map(day => {
    if (typeof day.datetime !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.datetime)) {
      throw new TypeError("Visual Crossing day has an invalid local date");
    }
    const hours = Array.isArray(day.hours) ? day.hours.map(hour => normalizeHour({
      time: hour.datetime ? `${day.datetime}T${hour.datetime}` : null,
      temperature: hour.temp,
      feelsLike: hour.feelslike,
      humidity: hour.humidity,
      precipProbability: hour.precipprob,
      precipitationMm: hour.precip,
      windSpeedMs: kmhToMs(hour.windspeed),
      windGustMs: kmhToMs(hour.windgust),
      windDirectionDeg: hour.winddir,
      weatherCode: hour.icon ?? hour.conditions,
      accumulationPeriodHours: 1
    })) : [];
    return {
      date: day.datetime,
      daily: {
        precipitationProbabilityPct: finiteOrNull(day.precipprob),
        precipitationMm: finiteOrNull(day.precip),
        minTemperatureC: finiteOrNull(day.mint),
        maxTemperatureC: finiteOrNull(day.maxt),
        maxWindSpeedMs: kmhToMs(day.windspeed),
        maxWindGustMs: kmhToMs(day.windgust)
      },
      hours
    };
  });
  return {
    provider: "Visual Crossing",
    product: "Timeline Weather API",
    fetchedAt,
    course: location,
    timezone,
    temporalResolution: "hourly",
    days
  };
}

/**
 * Normalize Foreca hourly or three-hourly forecast.
 * Foreca timestamps include their UTC offset; keep them unchanged. Its
 * precipitation accumulation is per hour or per three-hour interval,
 * depending on the endpoint used.
 */
export function normalizeForeca(payload, course, {
  fetchedAt = new Date().toISOString(),
  temporalResolution = "hourly"
} = {}) {
  const location = validateCourse(course);
  if (!["hourly", "three-hourly"].includes(temporalResolution)) {
    throw new TypeError("Foreca temporalResolution must be hourly or three-hourly");
  }
  if (!payload || !Array.isArray(payload.forecast) || !payload.forecast.length) {
    throw new TypeError("Foreca payload is missing forecast");
  }
  const periodHours = temporalResolution === "hourly" ? 1 : 3;
  const forecast = payload.forecast.map(item => {
    if (typeof item.time !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(item.time) ||
        !Number.isFinite(Date.parse(item.time))) {
      throw new TypeError("Foreca forecast has an invalid ISO timestamp");
    }
    return normalizeHour({
      time: item.time,
      temperature: item.temperature,
      feelsLike: item.feelsLikeTemp,
      humidity: item.relHumidity,
      precipProbability: item.precipProb,
      precipitationMm: item.precipAccum,
      windSpeedMs: item.windSpeed,
      windGustMs: item.windGust,
      windDirectionDeg: item.windDir,
      weatherCode: item.symbol,
      accumulationPeriodHours: periodHours
    });
  });
  return {
    provider: "Foreca",
    product: "Point Forecast API",
    fetchedAt,
    course: location,
    timezone: location.timezone,
    temporalResolution,
    forecast
  };
}

/**
 * Validate a course record for the eight-country catalogue. Country support
 * is not inferred from a browser locale; each course must declare its own
 * ISO country code, IANA timezone and verified coordinates.
 */
export function validateMulticountryCourse(course) {
  const location = validateCourse(course);
  const supported = new Set(["JP", "KR", "CN", "VN", "TH", "MY", "SG", "ID"]);
  if (!supported.has(location.countryCode)) {
    throw new RangeError(`Unsupported country code: ${location.countryCode}`);
  }
  return location;
}
