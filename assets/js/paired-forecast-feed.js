const SNAPSHOT_URL = "https://raw.githubusercontent.com/jenny6601/Asia-Golf-90-Day-Planner/forecast-data/data/latest.json";

const $ = id => document.getElementById(id);
const value = (x, suffix = "") => Number.isFinite(x) ? `${x}${suffix}` : "—";
const dateLabel = date => new Intl.DateTimeFormat("zh-TW", {
  month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo"
}).format(new Date(date + "T00:00:00+09:00"));

function table(headers, rows) {
  const host = document.createElement("div");
  host.className = "weather-table";
  for (const [index, values] of [headers, ...rows].entries()) {
    const row = document.createElement("div");
    row.className = index === 0 ? "weather-row weather-head" : "weather-row";
    for (const text of values) {
      const cell = document.createElement("span");
      cell.textContent = text;
      row.append(cell);
    }
    host.append(row);
  }
  return host;
}

function render(snapshot) {
  const host = $("paired-forecast-results");
  host.replaceChildren();
  const weatherApiZones = snapshot.weatherApi.zones;
  const openMeteoZones = snapshot.openMeteo.zones;
  const comparisons = new Map(snapshot.comparison.zones.map(x => [x.zone.id, x]));
  const zoneLabels = { north: "北部｜名護", central: "中部｜沖繩市", south: "南部｜那霸" };

  for (const zone of openMeteoZones) {
    const card = document.createElement("article");
    card.className = "weather-card";
    const title = document.createElement("h3");
    title.textContent = zoneLabels[zone.zone.id] || zone.zone.label || zone.zone.id;
    card.append(title);

    const wa = weatherApiZones.find(x => x.zone.id === zone.zone.id);
    const waDays = new Map((wa?.forecastDays || []).map(x => [x.date, x]));
    const rows = zone.daily.time.map((date, i) => {
      const other = waDays.get(date);
      const omRain = zone.daily.precipitation_probability_max?.[i];
      const omMm = zone.daily.precipitation_sum?.[i];
      return [
        dateLabel(date),
        value(omRain, "%"),
        value(omMm, " mm"),
        other ? value(other.day.dailyChanceOfRain, "%") : "—",
        other ? value(other.day.totalPrecipMm, " mm") : "—",
        other ? "雙來源" : "Open-Meteo"
      ];
    });
    card.append(table(["日期", "OM 降雨機率", "OM 雨量", "WeatherAPI 機率", "WeatherAPI 雨量", "資料來源"], rows));

    const comparison = comparisons.get(zone.zone.id);
    if (comparison) {
      const metrics = comparison.metrics;
      const summary = document.createElement("p");
      summary.className = "data-note";
      summary.textContent =
        `共同逐時比較 ${comparison.comparedHours} 小時｜機率差異 MAE ${value(metrics.chanceOfRain?.meanAbsoluteDifference, " 個百分點")}｜雨量差異 ${value(metrics.precipMm?.meanAbsoluteDifference, " mm")}｜氣溫差異 ${value(metrics.tempC?.meanAbsoluteDifference, " °C")}｜陣風差異 ${value(metrics.gustKph?.meanAbsoluteDifference, " km/h")}。來源一致程度不等於預報準確度。`;
      card.append(summary);
    }
    host.append(card);
  }
}

export async function initPairedForecastFeed() {
  const button = $("fetch-paired-forecast");
  const status = $("paired-forecast-status");
  if (!button || !status) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "正在讀取已發布的 WeatherAPI／Open-Meteo 配對資料…";
    try {
      const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`資料讀取失敗（HTTP ${response.status}）`);
      const snapshot = await response.json();
      if (snapshot.schemaVersion !== 2 || !snapshot.weatherApi?.zones || !snapshot.openMeteo?.zones || !snapshot.comparison?.zones) {
        throw new Error("資料格式或版本不符，已停止顯示");
      }
      const captured = new Date(snapshot.capturedAt);
      if (!Number.isFinite(captured.getTime())) throw new Error("資料時間格式錯誤");
      render(snapshot);
      const ageHours = (Date.now() - captured.getTime()) / 3600000;
      const stamp = new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo"
      }).format(captured);
      status.textContent = ageHours > 30
        ? `資料已發布，但已超過30小時未更新｜擷取時間（日本）：${stamp}｜請留意資料過期。`
        : `讀取成功｜Open-Meteo 16天＋WeatherAPI 3天｜三區配對比較｜擷取時間（日本）：${stamp}`;
    } catch (error) {
      status.textContent = `${error.message}。不以舊資料或合成資料冒充即時預報。`;
      $("paired-forecast-results").replaceChildren();
    } finally {
      button.disabled = false;
    }
  });
}
