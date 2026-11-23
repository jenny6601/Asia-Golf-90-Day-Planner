/**
 * Unified 1-90 day presentation layer.
 * Short-range numeric rain-impact scores and seasonal ordinal tendency tiers
 * remain separate and are never compared or merged into one artificial score.
 */
export function combineHorizonRecommendations({shortRange,longRange,shortFetchedAt=null,longFetchedAt=null}){
 const shortItems=shortRange?.recommendations??[];
 const longItems=longRange?.recommendations??[];
 const short=shortItems.map(x=>({
  horizon:"1-16天",kind:"short-range",rank:x.recommendationRank,
  tripStart:x.tripStart,tripEnd:x.tripEnd,
  metric:"rain-impact-index",value:x.itineraryRisk,label:x.label,
  confidence:x.confidenceLabel??"中等（未校準）",
  source:"三個所選球場 GPS 的逐時預報",
  rounds:x.rounds.map(r=>({date:r.date,courseName:r.courseName,value:r.score.rainRisk,label:r.score.label}))
 }));
 const long=longItems.map(x=>({
  horizon:"17-90天",kind:"seasonal",rank:x.recommendationRank,
  tripStart:x.tripStart,tripEnd:x.tripEnd,
  metric:"regional-tendency-tier",value:x.tendencyRank,label:x.tendency,
  confidence:x.confidence??"低",
  source:"沖繩北／中／南 ECMWF 週／月尺度展望",
  rounds:x.rounds.map(r=>({date:r.date,zone:r.worstZoneLabel,value:r.rank,label:r.worstSignal.label}))
 }));
 const timeline=[...short,...long].sort((a,b)=>a.tripStart.localeCompare(b.tripStart));
 return {
  status:short.length||long.length?"ready":"empty",
  shortRange:{count:short.length,items:short,fetchedAt:shortFetchedAt,meaning:"數值為未校準的相對降雨影響指數，只能在短期組內比較"},
  longRange:{count:long.length,items:long,fetchedAt:longFetchedAt,meaning:"數值為週／月尺度區域濕潤趨勢分級，只能在長期組內比較"},
  timeline,
  crossHorizonComparison:false,
  note:"短期降雨影響指數與長期季節趨勢分級不是同一量尺，不提供跨期間總排名。"
 };
}
