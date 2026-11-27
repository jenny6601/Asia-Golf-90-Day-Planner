const base = new URL("../../config/global/", import.meta.url);

export async function fetchAsiaCountryRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(new URL("countries.json", base));
  if (!response.ok) throw new Error("亞洲國家清單讀取失敗：" + response.status);
  const countries = await response.json();
  if (!Array.isArray(countries)) throw new TypeError("countries.json 必須是陣列");
  return countries;
}

export async function fetchAsiaWeatherSubregionRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(new URL("weather-subregions.json", base));
  if (!response.ok) throw new Error("亞洲次分區代表球場清單讀取失敗：" + response.status);
  const registry = await response.json();
  if (!Array.isArray(registry.countries)) throw new TypeError("weather-subregions.json countries 必須是陣列");
  return registry.countries.flatMap(group => (group.subregions || []).map(subregion => ({
    ...subregion,
    countryCode: group.countryCode,
    countryNameZh: group.countryNameZh
  })));
}

export async function fetchAsiaGolfCourseCatalog({countryCode, enabledOnly = true, fetchImpl = fetch} = {}) {
  const response = await fetchImpl(new URL("courses.json", base));
  if (!response.ok) throw new Error("亞洲球場清單讀取失敗：" + response.status);
  const courses = await response.json();
  if (!Array.isArray(courses)) throw new TypeError("courses.json 必須是陣列");
  const ids = new Set();
  for (const course of courses) {
    if (!course.id || ids.has(course.id)) throw new Error("球場 ID 缺漏或重複：" + course.id);
    ids.add(course.id);
    if (!/^[A-Z]{2}$/.test(course.countryCode || "")) throw new Error("球場國家代碼錯誤：" + course.id);
    if (!course.name || !course.timezone) throw new Error("球場名稱或時區缺漏：" + course.id);
    if (!["verified", "provisional", "pending", "user_provided_google_maps"].includes(course.coordinateStatus)) throw new Error("座標狀態錯誤：" + course.id);
    const hasLat = Number.isFinite(course.latitude), hasLon = Number.isFinite(course.longitude);
    if (hasLat !== hasLon) throw new Error("球場經緯度必須同時存在或同時缺漏：" + course.id);
    if (course.coordinateStatus === "pending" && (hasLat || hasLon)) throw new Error("待核實座標不得填入推測值：" + course.id);
    if (course.coordinateStatus !== "pending" && (!hasLat || !hasLon)) throw new Error("球場缺少可用附近座標：" + course.id);
  }
  return courses.filter(course => (!countryCode || course.countryCode === countryCode) && (!enabledOnly || course.enabled));
}

export async function fetchAsiaGolfDirectory({fetchImpl = fetch} = {}) {
  const [countries, courses, subregions] = await Promise.all([
    fetchAsiaCountryRegistry(fetchImpl),
    fetchAsiaGolfCourseCatalog({enabledOnly: false, fetchImpl}),
    fetchAsiaWeatherSubregionRegistry(fetchImpl)
  ]);
  const countryCodes = new Set(countries.map(country => country.code));
  const unknown = courses.filter(course => !countryCodes.has(course.countryCode));
  if (unknown.length) throw new Error("球場使用未登錄國家代碼：" + unknown.map(x => x.id).join(", "));

  const courseById = new Map(courses.map(course => [course.id, course]));
  const subregionById = new Map(subregions.map(subregion => [subregion.id, subregion]));
  if (subregionById.size !== subregions.length) throw new Error("次分區 ID 重複");
  for (const subregion of subregions) {
    const representative = courseById.get(subregion.representativeCourseId);
    if (!representative) throw new Error("次分區缺少代表球場：" + subregion.id);
    if (representative.countryCode !== subregion.countryCode || representative.subregionId !== subregion.id) {
      throw new Error("代表球場與次分區歸屬不一致：" + subregion.id + " → " + subregion.representativeCourseId);
    }
    const point = subregion.candidateCoordinates;
    if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude) || !point?.timezone) {
      throw new Error("次分區缺少有效區域代表座標或時區：" + subregion.id);
    }
  }

  const enrichedCourses = courses.map(course => {
    const subregion = subregionById.get(course.subregionId);
    if (!subregion) return course;
    return {
      ...course,
      regionalRepresentativeCourseId: subregion.representativeCourseId,
      regionalSubregionId: subregion.id,
      regionalSubregionLabel: subregion.label || subregion.subregion || subregion.id,
      regionalMacroRegion: subregion.region,
      regionalMacroRegionDisplayName: subregion.regionDisplayName || subregion.region,
      regionalClimate: {
        subregionId: subregion.id,
        macroRegion: subregion.region,
        macroRegionDisplayName: subregion.regionDisplayName || subregion.region,
        label: subregion.label || subregion.subregion || subregion.id,
        representativeCourseId: subregion.representativeCourseId,
        representativeCourseName: courseById.get(subregion.representativeCourseId)?.name || subregion.candidateCourseName,
        representativePoint: {
          latitude: subregion.candidateCoordinates.latitude,
          longitude: subregion.candidateCoordinates.longitude
        },
        timezone: subregion.candidateCoordinates.timezone,
        isRepresentative: course.id === subregion.representativeCourseId,
        weatherPointEligible: false
      }
    };
  });
  return {
    countries,
    courses: enrichedCourses,
    subregions,
    countryCount: countries.length,
    courseCount: enrichedCourses.length,
    subregionCount: subregions.length
  };
}
