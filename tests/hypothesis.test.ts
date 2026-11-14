import test from "node:test";
import assert from "node:assert/strict";
import { CASE_CONTENT } from "../src/features/story/index";
import {
  HYPOTHESIS_QUESTIONS,
  createHypotheses,
  createDraft,
  buildAttempt,
  appendAttempt,
  availableCitations,
  replayTarget,
  replayBlocker,
  MAX_ATTEMPTS,
} from "../src/features/hypothesis/index";
import {
  createEvidence,
  addNote,
  editNote,
} from "../src/features/evidence/index";
import {
  createSnapshot,
  validateSnapshot,
  createSlot,
  exportSlot,
  parseImported,
} from "../src/features/profiles/index";
import type {
  HeardHistory,
  HypothesisCitation,
  Investigation,
} from "../src/shared/types";
const fullHeard: HeardHistory = Object.fromEntries(
  CASE_CONTENT.episodes.map((episode) => [episode.id, episode.duration]),
);
const allClues = CASE_CONTENT.clues.map((clue) => clue.id);
const story: Investigation = {
  sceneId: "tower",
  visited: ["arrival", "harbor", "interview", "tower"],
  decisions: [],
  ending: null,
};
function candidates(clues: string[], heard: HeardHistory = fullHeard) {
  return availableCitations(
    CASE_CONTENT,
    { ...createEvidence(), clues },
    heard,
  );
}
function clueCitation(clueId: string): HypothesisCitation {
  const found = candidates(allClues).clues.find((c) => c.clueId === clueId);
  assert.ok(found, `缺少线索引用 ${clueId}`);
  return found;
}
function lineCitation(episodeId: string, cueId: string): HypothesisCitation {
  const found = candidates(allClues).testimony.find(
    ({ citation: c }) => c.episodeId === episodeId && c.cueId === cueId,
  );
  assert.ok(found, `缺少证词引用 ${episodeId}#${cueId}`);
  return found.citation;
}
function solvedDraft() {
  const draft = createDraft();
  draft.choices = {
    cause: "cause-beacon",
    signal: "signal-tape",
    motive: "motive-truth",
  };
  draft.basis.cause = [clueCitation("key")];
  draft.basis.signal = [lineCitation("tower-normal", "line-4")];
  draft.basis.motive = [lineCitation("interview-aware", "line-4")];
  return draft;
}
test("supported verdicts require the right causal citations, not note volume", () => {
  const attempt = buildAttempt(solvedDraft());
  assert.equal(attempt.passed, true);
  assert.deepEqual(
    attempt.verdicts.map((v) => v.status),
    ["supported", "supported", "supported"],
  );
  const empty = createDraft();
  empty.choices = {
    cause: "cause-beacon",
    signal: "signal-tape",
    motive: "motive-truth",
  };
  const blank = buildAttempt(empty);
  assert.equal(blank.passed, false);
  assert.deepEqual(
    blank.verdicts.map((v) => v.status),
    ["missing", "missing", "missing"],
  );
  assert.ok(blank.verdicts[0].missing[0].includes("航标"));
});
test("contradicting citations are flagged per step and wrong options never pass on notes alone", () => {
  const draft = createDraft();
  draft.choices = {
    cause: "cause-storm",
    signal: "signal-survivor",
    motive: "motive-revenge",
  };
  draft.basis.cause = [clueCitation("key")];
  draft.basis.signal = [lineCitation("tower-normal", "line-4")];
  const attempt = buildAttempt(draft);
  assert.equal(attempt.passed, false);
  assert.deepEqual(
    attempt.verdicts.map((v) => v.status),
    ["contradicted", "contradicted", "missing"],
  );
  assert.deepEqual(attempt.verdicts[0].problemCitationIds, ["clue:key"]);
  assert.deepEqual(attempt.verdicts[1].problemCitationIds, [
    "line:tower-normal:line-4",
  ]);
  assert.equal(attempt.verdicts[2].problemCitationIds.length, 0);
});
test("submitting freezes the basis: later edits and new clues only affect the next attempt", () => {
  let evidence = { ...createEvidence(), clues: ["key"] };
  const draft = createDraft();
  draft.choices = {
    cause: "cause-beacon",
    signal: "signal-tape",
    motive: "motive-truth",
  };
  draft.basis.cause = [clueCitation("key")];
  const attempt = buildAttempt(draft);
  assert.equal(attempt.verdicts[0].status, "supported");
  assert.equal(attempt.verdicts[1].status, "missing");
  const before = JSON.stringify(attempt);
  const noted = addNote(evidence, { sceneId: "tower", start: 1, end: 3 }, "补充");
  evidence = editNote(noted, noted.notes[0].id, "改写笔记");
  evidence = { ...evidence, clues: [...evidence.clues, "bell", "horn"] };
  draft.basis.signal = [lineCitation("tower-normal", "line-4")];
  draft.basis.cause[0].label = "被篡改的引用";
  assert.equal(JSON.stringify(attempt), before);
  const next = buildAttempt(draft);
  assert.equal(next.verdicts[0].status, "supported");
  assert.equal(next.verdicts[1].status, "supported");
  assert.notEqual(next.id, attempt.id);
});
test("stale testimony cannot be replayed and is never swapped for the new version", () => {
  const stale = lineCitation("interview-normal", "line-2");
  assert.deepEqual(replayTarget(CASE_CONTENT, stale, [], fullHeard), {
    sceneId: "interview",
    position: 4.388,
  });
  assert.equal(replayBlocker(CASE_CONTENT, stale, [], fullHeard), null);
  assert.equal(replayTarget(CASE_CONTENT, stale, ["bell"], fullHeard), null);
  assert.match(
    replayBlocker(CASE_CONTENT, stale, ["bell"], fullHeard) ?? "",
    /旧版录音/,
  );
  const unheard = { ...fullHeard };
  delete unheard["interview-normal"];
  assert.equal(replayTarget(CASE_CONTENT, stale, [], unheard), null);
  const key = clueCitation("key");
  assert.deepEqual(
    replayTarget(CASE_CONTENT, key, allClues, fullHeard),
    { sceneId: "tower", position: 14.582 },
  );
  const staticClue = clueCitation("static");
  assert.equal(staticClue.sceneId, "interview");
  assert.deepEqual(
    replayTarget(CASE_CONTENT, staticClue, ["bell"], fullHeard),
    { sceneId: "interview", position: 14.557 },
  );
});
test("picker only offers collected clues and heard testimony, old versions marked stale", () => {
  const { clues, testimony } = candidates(["bell"], {
    "interview-normal": 24,
    "interview-aware": 28,
  });
  assert.deepEqual(
    clues.map((c) => c.clueId),
    ["bell"],
  );
  assert.ok(testimony.length > 0);
  const byEpisode = (id: string) =>
    testimony.filter(({ citation }) => citation.episodeId === id);
  assert.ok(byEpisode("interview-normal").every(({ stale }) => stale));
  assert.ok(byEpisode("interview-aware").every(({ stale }) => !stale));
  assert.equal(
    testimony.some(
      ({ citation }) => citation.episodeId === "tower-normal",
    ),
    false,
  );
});
test("attempts persist in snapshots, survive export, and old saves default to empty", () => {
  const attempt = buildAttempt(solvedDraft());
  const state = appendAttempt(createHypotheses(), attempt);
  const snapshot = createSnapshot(
    CASE_CONTENT,
    story,
    { ...createEvidence(), clues: allClues },
    fullHeard,
    { sceneId: "tower", position: 3, rate: 1 },
    state,
  );
  const checked = validateSnapshot(
    JSON.parse(JSON.stringify(snapshot)),
    CASE_CONTENT,
  );
  assert.equal(checked.hypotheses.attempts.length, 1);
  assert.deepEqual(checked.hypotheses.attempts[0], attempt);
  const slot = createSlot("假说存档", snapshot);
  const imported = parseImported(exportSlot(slot), CASE_CONTENT);
  assert.equal(imported.snapshot.hypotheses.attempts.length, 1);
  const legacy = JSON.parse(JSON.stringify(snapshot));
  delete legacy.hypotheses;
  assert.deepEqual(validateSnapshot(legacy, CASE_CONTENT).hypotheses, {
    attempts: [],
  });
  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.hypotheses.attempts[0].choices.cause = "cause-unknown";
  assert.throws(() => validateSnapshot(tampered, CASE_CONTENT), /假说/);
  const swapped = JSON.parse(JSON.stringify(snapshot));
  swapped.hypotheses.attempts[0].basis.cause[0] = {
    ...swapped.hypotheses.attempts[0].basis.cause[0],
    episodeId: "interview-aware",
    cueId: "line-99",
    kind: "testimony",
  };
  assert.throws(() => validateSnapshot(swapped, CASE_CONTENT));
});
test("attempt history is capped", () => {
  let state = createHypotheses();
  for (let i = 0; i < MAX_ATTEMPTS + 5; i++)
    state = appendAttempt(state, buildAttempt(solvedDraft()));
  assert.equal(state.attempts.length, MAX_ATTEMPTS);
});
test("every rule reference points at real content", () => {
  for (const question of HYPOTHESIS_QUESTIONS)
    for (const option of question.options) {
      const refs = [
        ...option.contradictedBy,
        ...option.support.flatMap((group) => group.anyOf),
      ];
      for (const ref of refs) {
        if (ref.kind === "clue") {
          assert.ok(
            CASE_CONTENT.clues.some((clue) => clue.id === ref.clueId),
            `未知线索 ${ref.clueId}`,
          );
        } else {
          const episode = CASE_CONTENT.episodes.find(
            (item) => item.id === ref.episodeId,
          );
          assert.ok(episode, `未知音源 ${ref.episodeId}`);
          assert.ok(
            episode.cues.some((cue) => cue.id === ref.cueId),
            `未知对白 ${ref.episodeId}#${ref.cueId}`,
          );
        }
      }
    }
});
