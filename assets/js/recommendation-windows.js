// Five-day golf-trip candidates. The central three dates are the intended play days.
const PLAYABLE_STATUSES = new Set(["適打", "可打"]);
const dateGap = (a, b) => Math.abs((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);

export function buildFiveDayWindows(assessment, dates) {
  const byDate = new Map((Array.isArray(assessment) ? assessment : []).filter(x => x && x.valid && x.date).map(x => [x.date, x]));
  const windows = [];
  for (let i = 0; i <= dates.length - 5; i++) {
    const days = dates.slice(i, i + 5).map(date => byDate.get(date));
    if (days.length !== 5 || days.some(x => !x || !Number.isFinite(x.grade) || !Number.isFinite(x.chance) || !Number.isFinite(x.amount))) continue;
    const coreDays = days.slice(1, 4);
    const coreEligible = coreDays.filter(x => PLAYABLE_STATUSES.has(x.status) || x.playable === true).length;
    windows.push({ start: days[0].date, end: days[4].date, days, coreDays, coreStart: coreDays[0].date, coreEnd: coreDays[2].date, coreEligible, qualifies: coreEligible === 3, suitable: days.filter(x => x.status === "適打" || x.playable === true).length, possible: days.filter(x => x.status === "可打").length, eligibleDays: days.filter(x => PLAYABLE_STATUSES.has(x.status) || x.playable === true).length, grade: days.reduce((sum, x) => sum + x.grade, 0) / 5, coreGrade: coreDays.reduce((sum, x) => sum + x.grade, 0) / 3, chance: days.reduce((sum, x) => sum + x.chance, 0) / 5, amount: days.reduce((sum, x) => sum + x.amount, 0) / 5 });
  }
  return windows.sort((a, b) => a.grade - b.grade || a.chance - b.chance || a.amount - b.amount || a.start.localeCompare(b.start));
}

// Qualifying windows come first; closest alternatives fill any remaining slots.
export function pickRecommendedFiveDayWindows(windows, limit = 3) {
  const compare = (a, b) => b.coreEligible - a.coreEligible || a.coreGrade - b.coreGrade || b.eligibleDays - a.eligibleDays || a.grade - b.grade || a.chance - b.chance || a.amount - b.amount || a.start.localeCompare(b.start);
  const qualified = windows.filter(x => x.qualifies).sort(compare);
  const fallback = windows.filter(x => !x.qualifies).sort(compare);
  const picked = [];
  const addSeparated = list => { for (const item of list) { if (picked.length >= limit) break; if (!picked.some(x => dateGap(item.start, x.start) < 5)) picked.push(item); } };
  addSeparated(qualified);
  // Fill remaining distinct trip slots with the closest non-qualifying windows
  // before considering overlapping qualifying windows.
  addSeparated(fallback);
  if (picked.length < limit) for (const item of fallback) { if (picked.length >= limit) break; if (!picked.includes(item)) picked.push(item); }
  return picked.map(item => ({ ...item, recommendationType: item.qualifies ? "符合核心條件" : "接近條件（替代推薦）", explanation: item.qualifies ? "中間連續3天均達到適打或可打，符合主要打球日條件。" : "中間連續3天有" + item.coreEligible + "天達到適打或可打；已依核心日適打程度及五天整體條件，選出最接近的替代日期。" }));
}