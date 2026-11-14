export { HYPOTHESIS_QUESTIONS, findQuestion, findOption } from "./model/rules";
export { citationMatches, evaluateOption, evaluateHypothesis } from "./model/evaluate";
export {
  MAX_ATTEMPTS,
  createHypotheses,
  createDraft,
  buildAttempt,
  appendAttempt,
  availableCitations,
  replayTarget,
  replayBlocker,
} from "./model/attempt";
export type { HypothesisDraft, CitationCandidate } from "./model/attempt";
export { HypothesisDialog } from "./ui/HypothesisDialog";
