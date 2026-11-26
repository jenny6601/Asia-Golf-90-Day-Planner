/**
 * Regional weather grouping for golf-trip planning.
 * Courses sharing weatherRegionId consume one regional weather signal.
 * This grouping is intentionally independent of course-centre coordinates.
 */
export function groupCoursesByWeatherRegion(courses) {
  if (!Array.isArray(courses)) throw new TypeError("courses must be an array");
  const groups = new Map();
  const seen = new Set();
  for (const course of courses) {
    if (!course || typeof course.id !== "string" || !course.id.trim()) {
      throw new TypeError("every course requires an id");
    }
    if (seen.has(course.id)) throw new Error("duplicate course id: " + course.id);
    seen.add(course.id);
    if (typeof course.countryCode !== "string" || !/^[A-Z]{2}$/.test(course.countryCode)) {
      throw new TypeError("course requires a valid countryCode: " + course.id);
    }
    if (typeof course.weatherRegionId !== "string" || !course.weatherRegionId.trim()) {
      throw new Error("course has no explicit weatherRegionId: " + course.id);
    }
    const key = course.weatherRegionId;
    const label = course.weatherRegionLabel || key;
    if (!groups.has(key)) groups.set(key, { weatherRegionId:key, label, countryCode:course.countryCode, courseIds:[], courses:[] });
    const group = groups.get(key);
    if (group.countryCode !== course.countryCode) throw new Error("weather region cannot span countries: " + key);
    if (group.label !== label) throw new Error("inconsistent weather region label: " + key);
    group.courseIds.push(course.id);
    group.courses.push(course);
  }
  return [...groups.values()]
    .sort((a,b) => a.weatherRegionId.localeCompare(b.weatherRegionId))
    .map(group => ({...group, courseCount:group.courses.length}));
}

/**
 * Resolve a selected course to its shared region, without reading coordinates.
 */
export function findCourseWeatherRegion(courseId, courses) {
  if (typeof courseId !== "string" || !courseId) return null;
  const course = (Array.isArray(courses) ? courses : []).find(item => item?.id === courseId);
  if (!course?.weatherRegionId) return null;
  const group = groupCoursesByWeatherRegion(courses).find(item => item.weatherRegionId === course.weatherRegionId);
  return group ?? null;
}
