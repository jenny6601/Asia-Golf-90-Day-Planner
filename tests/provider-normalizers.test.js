import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeForeca,
  normalizeVisualCrossing,
  validateMulticountryCourse
} from "../assets/js/provider-normalizers.js";

const course = {
  id: "okinawa-test",
  name: "Okinawa Test Course",
  countryCode: "JP",
  timezone: "Asia/Tokyo",
  latitude: 26.2,
  longitude: 127.7
};

test("Visual Crossing normalization retains local date/time and metric values", () => {
  const result = normalizeVisualCrossing({
    timezone: "Asia/Tokyo",
    days: [{
      datetime: "2026-12-15",
      precipprob: 40,
      precip: 2.5,
      mint: 18,
      maxt: 24,
      windspeed: 5,
      windgust: 9,
      hours: [{
        datetime: "07:00:00",
        temp: 20,
        feelslike: 19,
        humidity: 80,
        precipprob: 35,
        precip: 0.4,
        windspeed: 4,
        windgust: 7,
        winddir: 45,
        conditions: "Rain"
      }]
    }]
  }, course, "2026-12-14T22:00:00.000Z");
  assert.equal(result.course.countryCode, "JP");
  assert.equal(result.timezone, "Asia/Tokyo");
  assert.equal(result.days[0].hours[0].time, "2026-12-15T07:00:00");
  assert.equal(result.days[0].hours[0].precipitationMm, 0.4);
  assert.equal(result.days[0].hours[0].windSpeedMs, 4 / 3.6);
});

test("Visual Crossing missing values remain null and timezone mismatch fails closed", () => {
  const payload = {timezone:"Asia/Tokyo",days:[{datetime:"2026-12-15",hours:[{datetime:"08:00:00"}]}]};
  const result = normalizeVisualCrossing(payload, course);
  assert.equal(result.days[0].hours[0].precipitationMm, null);
  assert.equal(result.days[0].hours[0].precipitationProbabilityPct, null);
  assert.throws(() => normalizeVisualCrossing({...payload,timezone:"Asia/Seoul"},course), /timezone mismatch/);
});

test("Foreca hourly normalization preserves offset timestamp and hourly accumulation semantics", () => {
  const result = normalizeForeca({forecast:[{
    time:"2026-12-15T07:00+09:00",
    temperature:20,
    feelsLikeTemp:19,
    windSpeed:4,
    windGust:7,
    windDir:45,
    precipProb:35,
    precipAccum:0.4,
    symbol:"d300"
  }]}, course, {temporalResolution:"hourly"});
  assert.equal(result.forecast[0].time,"2026-12-15T07:00+09:00");
  assert.equal(result.forecast[0].precipitationAccumulationPeriodHours,1);
  assert.equal(result.forecast[0].precipitationMm,0.4);
  assert.equal(result.forecast[0].relativeHumidityPct,null);
});

test("Foreca three-hourly precipitation is not mislabeled as hourly", () => {
  const result = normalizeForeca({forecast:[{
    time:"2026-12-15T09:00+09:00",precipAccum:1.2
  }]}, course, {temporalResolution:"three-hourly"});
  assert.equal(result.forecast[0].precipitationAccumulationPeriodHours,3);
  assert.equal(result.forecast[0].precipitationMm,1.2);
});

test("multicountry course validation accepts only the original eight country codes", () => {
  for (const countryCode of ["JP","KR","CN","VN","TH","MY","SG","ID"]) {
    assert.equal(validateMulticountryCourse({...course,countryCode}).countryCode,countryCode);
  }
  assert.throws(() => validateMulticountryCourse({...course,countryCode:"US"}), /Unsupported country code/);
});

test("course records without timezone or coordinates are rejected", () => {
  assert.throws(() => validateMulticountryCourse({...course,timezone:""}), /IANA timezone/);
  assert.throws(() => validateMulticountryCourse({...course,latitude:null}), /verified numeric coordinates/);
});
