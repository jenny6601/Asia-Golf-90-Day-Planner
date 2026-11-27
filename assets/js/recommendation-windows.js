// Shared five-day trip-window ranking for monthly and weekly recommendation views.
// Lower grade, lower rain probability, and lower rainfall are better, in that order.
export function buildFiveDayWindows(assessment, dates) {
  const byDate = new Map((Array.isArray(assessment) ? assessment : [])
    .filter(x => x && x.valid && x.date)
    .map(x => [x.date, x]));
  const windows = [];
  for (let i = 0; i <= dates.length - 5; i++) {
    const days = dates.slice(i, i + 5).map(date => byDate.get(date));
    if (days.length !== 5 || days.some(x => !x || !Number.isFinite(x.grade) || !Number.isFinite(x.chance) || !Number.isFinite(x.amount))) continue;
    windows.push({
      start: days[0].date,
      end: days[4].date,
      days,
      grade: days.reduce((sum, x) => sum + x.grade, 0) / 5,
      chance: days.reduce((sum, x) => sum + x.chance, 0) / 5,
      amount: days.reduce((sum, x) => sum + x.amount, 0) / 5,
      suitable: days.filter(x => x.status === "適打" || x.playable === true).length,
      possible: days.filter(x => x.status === "可打").length
    });
  }
  return windows.sort((a, b) => a.grade - b.grade || a.chance - b.chance || a.amount - b.amount || a.start.localeCompare(b.start));
}

export function pickTopNonOverlappingWindows(windows, limit = 3) {
  const picked = [];
  for (const item of windows) {
    if (picked.every(x => Math.abs((Date.parse(item.start + "T12:00:00Z") - Date.parse(x.start + "T12:00:00Z")) / 86400000) >= 5)) {
      picked.push(item);
      if (picked.length === limit) break;
    }
  }
  return picked;
}
