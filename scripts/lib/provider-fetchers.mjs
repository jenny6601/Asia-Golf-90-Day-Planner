import {
  normalizeForeca,
  normalizeVisualCrossing,
  validateMulticountryCourse
} from "../../assets/js/provider-normalizers.js";

const VC_ENDPOINT = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
const FORECA_ENDPOINT = "https://weatherapi.foreca.net/api/v1/forecast";

async function readJson(response, provider) {
  if (!response?.ok) {
    const status = response?.status ?? "unknown";
    throw new Error(`${provider} API HTTP ${status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${provider} returned invalid JSON`);
  }
}

function requireCredential(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing server-side credential: ${name}`);
  }
  return value.trim();
}

/**
 * Visual Crossing accepts credentials in a POST form body. Keeping the key
 * out of the URL also reduces exposure in request logs and error messages.
 */
export async function fetchVisualCrossingCourseForecast(course, {
  apiKey,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  includeRawDiagnostics = false
} = {}) {
  const location = validateMulticountryCourse(course);
  const key = requireCredential(apiKey, "VISUAL_CROSSING_API_KEY");
  const path = `${location.latitude},${location.longitude}`;
  const url = `${VC_ENDPOINT}/${encodeURIComponent(path)}`;
  const body = new URLSearchParams({
    key,
    unitGroup: "metric",
    include: "days,hours",
    contentType: "json",
    lang: "en"
  });
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {"content-type": "application/x-www-form-urlencoded"},
    body: body.toString()
  });
  const payload = await readJson(response, "Visual Crossing");
  const normalized = normalizeVisualCrossing(payload, location, fetchedAt);
  if (includeRawDiagnostics) {
    normalized.rawFieldDiagnostics = (payload.days ?? []).flatMap(day =>
      (day.hours ?? []).map(hour => ({
        time: hour.datetime ? `${day.datetime}T${hour.datetime}` : null,
        temperatureRaw: hour.temp ?? null,
        feelsLikeRaw: hour.feelslike ?? null,
        humidityRaw: hour.humidity ?? null,
        windSpeedRawKmh: hour.windspeed ?? null,
        windGustRawKmh: hour.windgust ?? null,
        precipitationRawMm: hour.precip ?? null,
        precipitationProbabilityRawPct: hour.precipprob ?? null
      }))
    );
  }
  return normalized;
}

async function fetchForecaResolution(course, token, {
  fetchImpl,
  fetchedAt,
  temporalResolution,
  includeRawDiagnostics = false
}) {
  const location = validateMulticountryCourse(course);
  const endpoint = temporalResolution === "hourly" ? "hourly" : "3hourly";
  const periods = temporalResolution === "hourly" ? "169" : "113";
  const point = `${location.longitude},${location.latitude}`;
  const url = new URL(`${FORECA_ENDPOINT}/${endpoint}/${point}`);
  url.searchParams.set("periods", periods);
  url.searchParams.set("tempunit", "C");
  url.searchParams.set("windunit", "MS");
  url.searchParams.set("tz", location.timezone);
  url.searchParams.set("dataset", "full");
  url.searchParams.set("rounding", "0");
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`}
  });
  const payload = await readJson(response, "Foreca");
  const normalized = normalizeForeca(payload, location, {fetchedAt, temporalResolution});
  if (includeRawDiagnostics) {
    normalized.rawFieldDiagnostics = (payload.forecast ?? []).map(item => ({
      time: item.time ?? null,
      temperatureRaw: item.temperature ?? null,
      feelsLikeRaw: item.feelsLikeTemp ?? null,
      humidityRaw: item.relHumidity ?? null,
      windSpeedRawMs: item.windSpeed ?? null,
      windGustRawMs: item.windGust ?? null,
      precipitationRawMm: item.precipAccum ?? null,
      precipitationProbabilityRawPct: item.precipProb ?? null
    }));
  }
  return normalized;
}

/**
 * Retrieve both Foreca temporal resolutions independently. Hourly data is
 * limited to seven days; three-hourly data extends to fourteen days.
 */
export async function fetchForecaCourseForecast(course, {
  apiKey,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  includeRawDiagnostics = false
} = {}) {
  const token = requireCredential(apiKey, "FORECA_API_KEY");
  const location = validateMulticountryCourse(course);
  const [hourly, threeHourly] = await Promise.all([
    fetchForecaResolution(location, token, {fetchImpl, fetchedAt, temporalResolution: "hourly", includeRawDiagnostics}),
    fetchForecaResolution(location, token, {fetchImpl, fetchedAt, temporalResolution: "three-hourly", includeRawDiagnostics})
  ]);
  return {provider: "Foreca", course: location, fetchedAt, hourly, threeHourly};
}

/**
 * Keep provider failures independent: one provider can be unavailable while
 * the other remains usable. Never fill one provider with the other's values.
 */
export async function fetchIndependentProviderForecasts(course, {
  visualCrossingApiKey,
  forecaApiKey,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  includeRawDiagnostics = false
} = {}) {
  const location = validateMulticountryCourse(course);
  const [visualCrossing, foreca] = await Promise.allSettled([
    fetchVisualCrossingCourseForecast(location, {
      apiKey: visualCrossingApiKey, fetchImpl, fetchedAt, includeRawDiagnostics
    }),
    fetchForecaCourseForecast(location, {
      apiKey: forecaApiKey, fetchImpl, fetchedAt, includeRawDiagnostics
    })
  ]);
  return {
    course: location,
    fetchedAt,
    providers: {
      visualCrossing: visualCrossing.status === "fulfilled"
        ? {status: "available", data: visualCrossing.value}
        : {status: "unavailable", error: visualCrossing.reason?.message ?? "Visual Crossing request failed"},
      foreca: foreca.status === "fulfilled"
        ? {status: "available", data: foreca.value}
        : {status: "unavailable", error: foreca.reason?.message ?? "Foreca request failed"}
    }
  };
}
