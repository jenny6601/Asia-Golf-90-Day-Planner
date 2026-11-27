import {TRIP_DATE_ENGINE_CONFIG} from "./trip-date-recommendation-engine.js";

const freezeWeights = weights => Object.freeze(Object.fromEntries(
  Object.entries(weights).map(([horizon, values]) => [horizon, Object.freeze({...values})])
));
const baseline = TRIP_DATE_ENGINE_CONFIG.sourceWeights;

export const TRIP_DATE_CANDIDATE_MODELS = Object.freeze({
  baseline: Object.freeze({
    label: "V1 baseline",
    description: "Current production weights; unchanged reference model.",
    sourceWeights: baseline
  }),
  historyEnhanced: Object.freeze({
    label: "History-enhanced",
    description: "Provisional shadow candidate; higher same-calendar historical climate weight.",
    sourceWeights: freezeWeights({
      short: {forecast: 0.50, historical: 0.35, stability: 0.15},
      ec46: {ec46: 0.35, seas5: 0.10, historical: 0.45, stability: 0.10},
      seas5: {seas5: 0.35, historical: 0.50, stability: 0.15}
    })
  }),
  longRangeEnhanced: Object.freeze({
    label: "Long-range-enhanced",
    description: "Provisional shadow candidate; higher EC46/SEAS5 influence at medium and long leads.",
    sourceWeights: freezeWeights({
      short: {forecast: 0.62, historical: 0.23, stability: 0.15},
      ec46: {ec46: 0.55, seas5: 0.20, historical: 0.15, stability: 0.10},
      seas5: {seas5: 0.60, historical: 0.25, stability: 0.15}
    })
  })
});
