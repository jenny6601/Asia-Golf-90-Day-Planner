const base = new URL("../../config/global/", import.meta.url);

export async function fetchAsiaCountryRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(new URL("countries.json", base));
  if (!response.ok) throw new Error("亞洲國家清單讀取失敗：" + response.status);
  const countries = await response.json();
  if (!Array.isArray(countries)) throw new TypeError("countries.json 必須是陣列");
  return countries;
}

export async function fetchAsiaWeatherRegionRegistry({countryCode, activeOnly = false, fetchImpl = fetch} = {}) {
  const response = await fetchImpl(new URL("weather-regions.json", base));
  if (!response.ok) throw new Error("亞洲旅遊氣象區域清單讀取失敗：" + response.status);
  const regions = await response.json();
  if (!Array.isArray(regions)) throw new TypeError("weather-regions.json 必須是陣列");
  const ids = new Set();
  for (const region of regions) {
    if (!region.id || ids.has(region.id)) throw new Error("氣象區域 ID 缺漏或重複：" + region.id);
    ids.add(region.id);
    if (!/^[A-Z]{2}$/.test(region.countryCode || "")) throw new Error("氣象區域國家代碼錯誤：" + region.id);
    if (!region.label || !region.planningCity || !region.timezone) throw new Error("氣象區域必要欄位缺漏：" + region.id);
    if (!["active", "planned"].includes(region.status)) throw new Error("氣象區域狀態錯誤：" + region.id);
    if (region.weatherUnit !== "regional") throw new Error("旅遊規劃必須使用區域氣象單位：" + region.id);
  }
  return regions.filter(region => (!countryCode || region.countryCode === countryCode) && (!activeOnly || region.status === "active"));
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
    if (!["verified", "provisional", "pending"].includes(course.coordinateStatus)) throw new Error("座標狀態錯誤：" + course.id);
    const hasLat = Number.isFinite(course.latitude), hasLon = Number.isFinite(course.longitude);
    if (hasLat !== hasLon) throw new Error("球場經緯度必須同時存在或同時缺漏：" + course.id);
    if (course.coordinateStatus === "pending" && (hasLat || hasLon)) throw new Error("待核實座標不得填入推測值：" + course.id);
    if (course.coordinateStatus !== "pending" && (!hasLat || !hasLon)) throw new Error("球場缺少可用附近座標：" + course.id);
  }
  return courses.filter(course => (!countryCode || course.countryCode === countryCode) && (!enabledOnly || course.enabled));
}

export async function fetchAsiaGolfDirectory({fetchImpl = fetch} = {}) {
  const [countries, courses, weatherRegions] = await Promise.all([
    fetchAsiaCountryRegistry(fetchImpl),
    fetchAsiaGolfCourseCatalog({enabledOnly: false, fetchImpl}),
    fetchAsiaWeatherRegionRegistry({fetchImpl})
  ]);
  const countryCodes = new Set(countries.map(country => country.code));
  const unknown = [...courses, ...weatherRegions].filter(item => !countryCodes.has(item.countryCode));
  if (unknown.length) throw new Error("使用未登錄國家代碼：" + unknown.map(x => x.id).join(", "));
  const regionById = new Map(weatherRegions.map(region => [region.id, region]));
  for (const course of courses) {
    const region = regionById.get(course.weatherRegionId);
    if (!region) throw new Error("球場未連結已登錄氣象區域：" + course.id);
    if (region.countryCode !== course.countryCode) throw new Error("球場與氣象區域國家不一致：" + course.id);
    if (region.status !== "active") throw new Error("球場不可連結尚未啟用的氣象區域：" + course.id);
  }
  return {countries, courses, weatherRegions, countryCount:countries.length, courseCount:courses.length, weatherRegionCount:weatherRegions.length};
}
