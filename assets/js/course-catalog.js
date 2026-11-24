const base = new URL("../../config/global/", import.meta.url);
export async function fetchAsiaCountryRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(new URL("countries.json", base));
  if (!response.ok) throw new Error("亞洲國家清單讀取失敗：" + response.status);
  const countries = await response.json();
  if (!Array.isArray(countries)) throw new TypeError("countries.json 必須是陣列");
  return countries;
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
    if (!["verified","provisional","pending"].includes(course.coordinateStatus)) throw new Error("座標狀態錯誤：" + course.id);
    const hasLat = Number.isFinite(course.latitude), hasLon = Number.isFinite(course.longitude);
    if (hasLat !== hasLon) throw new Error("經緯度必須同時存在或同時缺漏：" + course.id);
    if (course.coordinateStatus === "pending" && (hasLat || hasLon)) throw new Error("待核實座標不得填入推測值：" + course.id);
    if (course.coordinateStatus !== "pending" && (!hasLat || !hasLon)) throw new Error("球場缺少附近座標：" + course.id);
  }
  return courses.filter(course => (!countryCode || course.countryCode === countryCode) && (!enabledOnly || course.enabled));
}
export async function fetchAsiaGolfDirectory({fetchImpl = fetch} = {}) {
  const [countries, courses] = await Promise.all([fetchAsiaCountryRegistry(fetchImpl), fetchAsiaGolfCourseCatalog({enabledOnly:false,fetchImpl})]);
  const known = new Set(countries.map(x=>x.code));
  const unknown = courses.filter(x=>!known.has(x.countryCode));
  if (unknown.length) throw new Error("未登錄國家代碼：" + unknown.map(x=>x.id).join(", "));
  return {countries,courses,countryCount:countries.length,courseCount:courses.length};
}
