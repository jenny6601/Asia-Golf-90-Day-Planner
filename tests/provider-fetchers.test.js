import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchForecaCourseForecast,
  fetchIndependentProviderForecasts,
  fetchVisualCrossingCourseForecast
} from "../scripts/lib/provider-fetchers.mjs";

const course = {
  id: "okinawa-test",
  name: "Okinawa Test Course",
  countryCode: "JP",
  timezone: "Asia/Tokyo",
  latitude: 26.2,
  longitude: 127.7
};

const vcPayload = {
  timezone: "Asia/Tokyo",
  days: [{
    datetime: "2026-12-15",
    precipprob: 20,
    precip: 0.2,
    windspeed: 18,
    windgust: 25,
    hours: [{datetime:"07:00:00",temp:20,feelslike:19,precipprob:10,precip:0,windspeed:18,windgust:25}]
  }]
};

const forecaPayload = {
  forecast: [{
    time: "2026-12-15T07:00+09:00",
    temperature: 20,
    feelsLikeTemp: 19,
    precipProb: 10,
    precipAccum: 0,
    windSpeed: 5,
    windGust: 8,
    windDir: 90,
    relHumidity: 75,
    symbol: "d100"
  }]
};

test("Visual Crossing key is sent in POST body, not URL; response is normalized", async () => {
  let request;
  const result = await fetchVisualCrossingCourseForecast(course, {
    apiKey: "test-credential-never-log",
    fetchedAt: "2026-12-14T00:00:00.000Z",
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {ok:true,json:async()=>vcPayload};
    }
  });
  assert.equal(request.options.method, "POST");
  assert.equal(request.url.includes("test-credential-never-log"), false);
  assert.match(request.options.body, /key=test-credential-never-log/);
  assert.equal(result.days[0].hours[0].time, "2026-12-15T07:00:00");
  assert.ok(Math.abs(result.days[0].hours[0].windSpeedMs - 5) < 0.0001);
});

test("Foreca fetch requests hourly and 3-hourly horizons with IANA timezone", async () => {
  const requests = [];
  const result = await fetchForecaCourseForecast(course, {
    apiKey: "foreca-test-token",
    fetchedAt: "2026-12-14T00:00:00.000Z",
    fetchImpl: async (url, options) => {
      requests.push({url:new URL(url),options});
      return {ok:true,json:async()=>forecaPayload};
    }
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(x=>x.url.pathname.includes("/3hourly/") ? "3hourly" : "hourly").sort(), ["3hourly","hourly"]);
  const hourly = requests.find(x=>x.url.pathname.includes("/hourly/"));
  const threeHourly = requests.find(x=>x.url.pathname.includes("/3hourly/"));
  assert.equal(hourly.url.searchParams.get("periods"), "169");
  assert.equal(threeHourly.url.searchParams.get("periods"), "113");
  assert.equal(hourly.url.searchParams.get("tz"), "Asia/Tokyo");
  assert.equal(hourly.options.headers.Authorization, "Bearer foreca-test-token");
  assert.equal(result.hourly.forecast[0].precipitationAccumulationPeriodHours, 1);
  assert.equal(result.threeHourly.forecast[0].precipitationAccumulationPeriodHours, 3);
});

test("provider orchestration keeps failures separate and never substitutes data", async () => {
  const result = await fetchIndependentProviderForecasts(course, {
    visualCrossingApiKey: "vc-key",
    forecaApiKey: "foreca-key",
    fetchImpl: async (url, options) => {
      if (String(url).includes("visualcrossing")) return {ok:false,status:429};
      if (String(url).includes("foreca")) return {ok:true,json:async()=>forecaPayload};
      throw new Error("unexpected provider");
    }
  });
  assert.equal(result.providers.visualCrossing.status, "unavailable");
  assert.match(result.providers.visualCrossing.error, /HTTP 429/);
  assert.equal(result.providers.foreca.status, "available");
  assert.equal(result.providers.foreca.data.hourly.forecast[0].precipitationMm, 0);
});

test("missing API credentials fail before any network request", async () => {
  let calls = 0;
  await assert.rejects(
    fetchVisualCrossingCourseForecast(course, {apiKey:"",fetchImpl:async()=>{calls++;}}),
    /VISUAL_CROSSING_API_KEY/
  );
  assert.equal(calls, 0);
});
