function assertTimezone(timezone) {
  try { new Intl.DateTimeFormat("en", {timeZone:timezone}).format(0); }
  catch { throw new RangeError("Invalid IANA timezone: " + timezone); }
}
export function formatCourseDate(value, timezone, locale = "zh-TW") {
  assertTimezone(timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00Z") : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date value");
  return new Intl.DateTimeFormat(locale,{year:"numeric",month:"numeric",day:"numeric",timeZone:timezone}).format(date);
}
export function formatCourseDateTime(value, timezone, locale = "zh-TW") {
  assertTimezone(timezone);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date-time value");
  return new Intl.DateTimeFormat(locale,{year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:timezone}).format(date);
}
