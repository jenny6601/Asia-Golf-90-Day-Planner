/**
 * WeatherAPI adapter for server-side use only.
 * Never import this module from browser-facing code: the API key is a secret.
 */
export const WEATHERAPI_ZONES = Object.freeze([
  { id: "north", label: "北部", place: "名護市", latitude: 26.5916, longitude: 127.9774 },
  { id: "central", label: "中部", place: "沖繩市", latitude: 26.3344, longitude: 127.8056 },
  { id: "south", label: "南部", place: "那霸市", latitude: 26.2123, longitude: 127.6792 }
]);

const ENDPOINT = "https://api.weatherapi.com/v1/forecast.json";

export async function fetchWeatherApiSnapshot({ apiKey, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("WEATHERAPI_KEY 未設定");
  const fetchedAt = now();
  const zones = await Promise.all(WEATHERAPI_ZONES.map(async zone => {
    const params = new URLSearchParams({
      key: apiKey,
      q: `${zone.latitude},${zone.longitude}`,
      days: "3",
      aqi: "no",
      alerts: "no",
      lang: "zh"
    });
    const response = await fetchImpl(`${ENDPOINT}?${params}`);
    if (!response.ok) throw new Error(`WeatherAPI ${zone.id} HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`WeatherAPI ${zone.id}: ${payload.error.message ?? "provider error"}`);
    if (!Array.isArray(payload.forecast?.forecastday) || payload.forecast.forecastday.length === 0) {
      throw new Error(`WeatherAPI ${zone.id} 未回傳逐日預報`);
    }
    return {
      zone,
      location: {
        name: payload.location?.name ?? null,
        localtime: payload.location?.localtime ?? null,
        timezone: payload.location?.tz_id ?? null,
        latitude: payload.location?.lat ?? null,
        longitude: payload.location?.lon ?? null
      },
      current: payload.current ? {
        tempC: payload.current.temp_c ?? null,
        feelsLikeC: payload.current.feelslike_c ?? null,
        humidity: payload.current.humidity ?? null,
        windKph: payload.current.wind_kph ?? null,
        gustKph: payload.current.gust_kph ?? null,
        condition: payload.current.condition?.text ?? null,
        lastUpdated: payload.current.last_updated ?? null
      } : null,
      forecastDays: payload.forecast.forecastday.map(day => ({
        date: day.date,
        day: {
          maxTempC: day.day?.maxtemp_c ?? null,
          minTempC: day.day?.mintemp_c ?? null,
          avgTempC: day.day?.avgtemp_c ?? null,
          maxWindKph: day.day?.maxwind_kph ?? null,
          totalPrecipMm: day.day?.totalprecip_mm ?? null,
          dailyChanceOfRain: day.day?.daily_chance_of_rain ?? null,
          dailyWillRain: day.day?.daily_will_it_rain ?? null,
          condition: day.day?.condition?.text ?? null
        },
        hours: (day.hour ?? []).map(hour => ({
          time: hour.time,
          tempC: hour.temp_c ?? null,
          feelsLikeC: hour.feelslike_c ?? null,
          chanceOfRain: hour.chance_of_rain ?? null,
          willItRain: hour.will_it_rain ?? null,
          precipMm: hour.precip_mm ?? null,
          humidity: hour.humidity ?? null,
          windKph: hour.wind_kph ?? null,
          gustKph: hour.gust_kph ?? null,
          condition: hour.condition?.text ?? null
        }))
      }))
    };
  }));
  return {
    schemaVersion: 1,
    provider: "WeatherAPI.com",
    product: "Forecast API",
    fetchedAt,
    timezone: "Asia/Tokyo",
    forecastDaysRequested: 3,
    zones
  };
}
