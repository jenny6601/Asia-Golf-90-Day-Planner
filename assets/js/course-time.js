const validTimezone = timezone => {
  try { new Intl.DateTimeFormat("en", {timeZone:timezone}).format(0); return true; }
  catch { return false; }
};

export function formatCourseDate(value, timezone, locale = "zh-TW") {
  if (!validTimezone(timezone)) throw new RangeError("Invalid IANA timezone: " + timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00Z") : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date value");
  return new Intl.DateTimeFormat(locale, {year:"numeric",month:"numeric",day:"numeric",timeZone:timezone}).format(date);
}

export function getCourseLocalDateTime(date, hour, timezone) {
  if (!validTimezone(timezone)) throw new RangeError("Invalid IANA timezone: " + timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new TypeError("Invalid local date or hour");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(date + "T" + String(hour).padStart(2,"0") + ":00:00Z"));
  return Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
}
