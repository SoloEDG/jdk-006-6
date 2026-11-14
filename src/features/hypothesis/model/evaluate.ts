import type {
  HypothesisCitation,
  HypothesisQuestionId,
  HypothesisVerdict,
} from "../../../shared/types";
import {
  HYPOTHESIS_QUESTIONS,
  findOption,
  type CitationRef,
  type HypothesisOption,
} from "./rules";
export function citationMatches(
  ref: CitationRef,
  citation: HypothesisCitation,
): boolean {
  if (ref.kind !== citation.kind) return false;
  if (ref.kind === "clue") return citation.clueId === ref.clueId;
  return (
    citation.episodeId === ref.episodeId && citation.cueId === ref.cueId
  );
}
export function evaluateOption(
  option: HypothesisOption,
  citations: HypothesisCitation[],
): Pick<HypothesisVerdict, "status" | "problemCitationIds" | "missing"> {
  const problems = citations.filter((citation) =>
    option.contradictedBy.some((ref) => citationMatches(ref, citation)),
  );
  if (problems.length)
    return {
      status: "contradicted",
      problemCitationIds: problems.map((citation) => citation.id),
      missing: [],
    };
  if (!option.provable)
    return {
      status: "missing",
      problemCitationIds: [],
      missing: ["已掌握的线索与证词中，没有任何能支持这一说法的依据"],
    };
  const missing = option.support
    .filter(
      (group) =>
        !citations.some((citation) =>
          group.anyOf.some((ref) => citationMatches(ref, citation)),
        ),
    )
    .map((group) => group.label);
  return missing.length
    ? { status: "missing", problemCitationIds: [], missing }
    : { status: "supported", problemCitationIds: [], missing: [] };
}
export function evaluateHypothesis(
  choices: Record<HypothesisQuestionId, string>,
  basis: Record<HypothesisQuestionId, HypothesisCitation[]>,
): HypothesisVerdict[] {
  return HYPOTHESIS_QUESTIONS.map((question) => {
    const option = findOption(question, choices[question.id]);
    return {
      question: question.id,
      optionId: option.id,
      ...evaluateOption(option, basis[question.id] ?? []),
    };
  });
}
