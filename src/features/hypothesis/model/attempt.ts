import type {
  CaseContent,
  EvidenceState,
  HeardHistory,
  HypothesisAttempt,
  HypothesisCitation,
  HypothesisQuestionId,
  HypothesisState,
  SceneId,
} from "../../../shared/types";
import { hasHeardThrough } from "../../../shared/heard";
import { resolveEpisode } from "../../story/lib/resolveEpisode";
import { evaluateHypothesis } from "./evaluate";
import { HYPOTHESIS_QUESTIONS } from "./rules";
export interface HypothesisDraft {
  choices: Partial<Record<HypothesisQuestionId, string>>;
  basis: Record<HypothesisQuestionId, HypothesisCitation[]>;
}
export interface CitationCandidate {
  citation: HypothesisCitation;
  stale: boolean;
}
export const MAX_ATTEMPTS = 20;
export function createHypotheses(): HypothesisState {
  return { attempts: [] };
}
export function createDraft(): HypothesisDraft {
  return { choices: {}, basis: { cause: [], signal: [], motive: [] } };
}
export function buildAttempt(draft: HypothesisDraft): HypothesisAttempt {
  const choices = {} as Record<HypothesisQuestionId, string>;
  for (const question of HYPOTHESIS_QUESTIONS) {
    const optionId = draft.choices[question.id];
    if (!optionId || !question.options.some((o) => o.id === optionId))
      throw new Error(`请先为「${question.title}」选择一个结论`);
    choices[question.id] = optionId;
  }
  const basis = {
    cause: structuredClone(draft.basis.cause),
    signal: structuredClone(draft.basis.signal),
    motive: structuredClone(draft.basis.motive),
  };
  const verdicts = evaluateHypothesis(choices, basis);
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    choices,
    basis,
    verdicts,
    passed: verdicts.every((verdict) => verdict.status === "supported"),
  };
}
export function appendAttempt(
  state: HypothesisState,
  attempt: HypothesisAttempt,
): HypothesisState {
  return { attempts: [attempt, ...state.attempts].slice(0, MAX_ATTEMPTS) };
}
function clueSegment(
  content: CaseContent,
  clueId: string,
  clues: string[],
): { sceneId: SceneId; start: number; end: number } | null {
  const matches = content.episodes.flatMap((episode) =>
    episode.cues
      .filter((cue) => cue.sound?.clueId === clueId)
      .map((cue) => ({ episode, cue })),
  );
  if (!matches.length) return null;
  const current =
    matches.find(
      ({ episode }) =>
        resolveEpisode(content, episode.sceneId, clues).id === episode.id,
    ) ?? matches[0];
  const sound = current.cue.sound!;
  return { sceneId: current.episode.sceneId, start: sound.start, end: sound.end };
}
export function availableCitations(
  content: CaseContent,
  evidence: EvidenceState,
  heard: HeardHistory,
): { clues: HypothesisCitation[]; testimony: CitationCandidate[] } {
  const clues = evidence.clues.flatMap((clueId) => {
    const definition = content.clues.find((clue) => clue.id === clueId);
    const segment = clueSegment(content, clueId, evidence.clues);
    if (!definition || !segment) return [];
    const citation: HypothesisCitation = {
      id: `clue:${clueId}`,
      kind: "clue",
      clueId,
      episodeId: null,
      cueId: null,
      sceneId: segment.sceneId,
      speaker: null,
      label: definition.title,
      start: segment.start,
      end: segment.end,
    };
    return [citation];
  });
  const testimony: CitationCandidate[] = [];
  for (const episode of content.episodes) {
    const current =
      resolveEpisode(content, episode.sceneId, evidence.clues).id ===
      episode.id;
    for (const cue of episode.cues) {
      if (!hasHeardThrough(heard, episode.id, cue.end)) continue;
      testimony.push({
        stale: !current,
        citation: {
          id: `line:${episode.id}:${cue.id}`,
          kind: "testimony",
          clueId: null,
          episodeId: episode.id,
          cueId: cue.id,
          sceneId: episode.sceneId,
          speaker: cue.speaker,
          label: cue.text,
          start: cue.start,
          end: cue.end,
        },
      });
    }
  }
  return { clues, testimony };
}
export function replayTarget(
  content: CaseContent,
  citation: HypothesisCitation,
  clues: string[],
  heard: HeardHistory,
): { sceneId: SceneId; position: number } | null {
  if (replayBlocker(content, citation, clues, heard)) return null;
  if (citation.kind === "testimony")
    return { sceneId: citation.sceneId, position: citation.start };
  const episode = resolveEpisode(content, citation.sceneId, clues);
  const cue = episode.cues.find((c) => c.sound?.clueId === citation.clueId);
  return cue?.sound
    ? { sceneId: citation.sceneId, position: cue.sound.start }
    : null;
}
export function replayBlocker(
  content: CaseContent,
  citation: HypothesisCitation,
  clues: string[],
  heard: HeardHistory,
): string | null {
  if (citation.kind === "testimony") {
    const episode = content.episodes.find((e) => e.id === citation.episodeId);
    if (!episode || !episode.cues.some((cue) => cue.id === citation.cueId))
      return "引用的证词已不在当前案件中";
    if (resolveEpisode(content, citation.sceneId, clues).id !== episode.id)
      return "这段证词来自旧版录音，证词已随新线索改写，无法重放";
    if (!hasHeardThrough(heard, episode.id, citation.end))
      return "当时的收听记录已不在，无法重放";
    return null;
  }
  const episode = resolveEpisode(content, citation.sceneId, clues);
  if (!episode.cues.some((cue) => cue.sound?.clueId === citation.clueId))
    return "这条线索的声音不在当前录音版本中，无法重放";
  return null;
}
