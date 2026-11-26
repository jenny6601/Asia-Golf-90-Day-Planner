/**
 * Eight-country shared-engine readiness audit. Disabled countries remain in
 * the matrix; readiness describes available inputs, not forecast skill.
 */
export function buildCountryCoverageMatrix(countries, courses, providerIds = []) {
  const list = Array.isArray(countries) ? countries : [];
  const courseList = Array.isArray(courses) ? courses : [];
  return list.map(country => {
    const countryCourses = courseList.filter(c => c.countryCode === country.code);
    const located = countryCourses.filter(c =>
      Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    const enabledCourses = countryCourses.filter(c => c.enabled !== false);
    return {
      countryCode: country.code,
      countryName: country.name,
      enabled: country.enabled === true,
      courseCount: countryCourses.length,
      enabledCourseCount: enabledCourses.length,
      geocodedCourseCount: located.length,
      missingCoordinateCourseIds: countryCourses.filter(c =>
        !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)).map(c => c.id),
      configuredProviders: [...providerIds],
      readiness: !country.enabled ? "country-disabled" :
        !enabledCourses.length ? "no-enabled-courses" :
        located.length < enabledCourses.length ? "course-coordinates-incomplete" :
        !providerIds.length ? "no-provider-configured" : "inputs-configured"
    };
  });
}
