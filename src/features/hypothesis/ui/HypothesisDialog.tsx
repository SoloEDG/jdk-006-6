import { useMemo, useState } from "react";
import {
  Check,
  CircleHelp,
  CircleCheck,
  FlaskConical,
  Headphones,
  History,
  Play,
  Plus,
  Quote,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  CaseContent,
  EvidenceState,
  HeardHistory,
  HypothesisAttempt,
  HypothesisCitation,
  HypothesisQuestionId,
  HypothesisVerdict,
  VerdictStatus,
} from "../../../shared/types";
import { formatTime } from "../../../shared/time";
import { HYPOTHESIS_QUESTIONS } from "../model/rules";
import {
  availableCitations,
  createDraft,
  replayBlocker,
  type HypothesisDraft,
} from "../model/attempt";
interface Props {
  content: CaseContent;
  evidence: EvidenceState;
  heard: HeardHistory;
  attempts: HypothesisAttempt[];
  onSubmit: (draft: HypothesisDraft) => HypothesisAttempt;
  onReplay: (citation: HypothesisCitation) => void;
  onClose: () => void;
}
const STATUS_META: Record<
  VerdictStatus,
  { label: string; icon: typeof Check }
> = {
  supported: { label: "支持", icon: CircleCheck },
  contradicted: { label: "矛盾", icon: TriangleAlert },
  missing: { label: "缺失", icon: CircleHelp },
};
export function HypothesisDialog({
  content,
  evidence,
  heard,
  attempts,
  onSubmit,
  onReplay,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"build" | "history">("build"),
    [draft, setDraft] = useState<HypothesisDraft>(createDraft),
    [picker, setPicker] = useState<HypothesisQuestionId | null>(null),
    [result, setResult] = useState<HypothesisAttempt | null>(null),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  const candidates = useMemo(
    () => availableCitations(content, evidence, heard),
    [content, evidence, heard],
  );
  const ready = HYPOTHESIS_QUESTIONS.every((q) => draft.choices[q.id]);
  const episodeName = (citation: HypothesisCitation) => {
    const episode = content.episodes.find((e) => e.id === citation.episodeId);
    return episode ? `${episode.title} · ${episode.version}` : "";
  };
  const attach = (question: HypothesisQuestionId, citation: HypothesisCitation) =>
    setDraft((d) => ({
      ...d,
      basis: {
        ...d.basis,
        [question]: d.basis[question].some((c) => c.id === citation.id)
          ? d.basis[question]
          : [...d.basis[question], citation],
      },
    }));
  const detach = (question: HypothesisQuestionId, id: string) =>
    setDraft((d) => ({
      ...d,
      basis: {
        ...d.basis,
        [question]: d.basis[question].filter((c) => c.id !== id),
      },
    }));
  const submit = () => {
    try {
      setResult(onSubmit(draft));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
    }
  };
  const retry = (attempt: HypothesisAttempt) => {
    setResult(null);
    setPicker(null);
    setDraft({
      choices: { ...attempt.choices },
      basis: { cause: [], signal: [], motive: [] },
    });
  };
  const citationRow = (
    citation: HypothesisCitation,
    tone: "problem" | null,
    key?: string,
  ) => {
    const blocker = replayBlocker(content, citation, evidence.clues, heard);
    return (
      <div
        className={`citation-row ${tone === "problem" ? "problem" : ""} ${blocker ? "stale" : ""}`}
        key={key ?? citation.id}
      >
        <Quote size={12} />
        <div className="citation-body">
          <span className="citation-source">
            {citation.kind === "clue"
              ? `声音线索 · ${citation.label}`
              : `${citation.speaker} · ${episodeName(citation)} · ${formatTime(citation.start)}`}
          </span>
          <p>
            {citation.kind === "clue"
              ? content.clues.find((clue) => clue.id === citation.clueId)
                  ?.description
              : citation.label}
          </p>
          {blocker && <em className="replay-blocked">无法重放 · {blocker}</em>}
        </div>
        {!blocker && (
          <button
            className="replay-button"
            aria-label="回听引用片段"
            onClick={() => onReplay(citation)}
          >
            <Play size={11} /> 回听
          </button>
        )}
      </div>
    );
  };
  const verdictCard = (attempt: HypothesisAttempt, verdict: HypothesisVerdict) => {
    const question = HYPOTHESIS_QUESTIONS.find((q) => q.id === verdict.question)!,
      option = question.options.find((o) => o.id === verdict.optionId)!,
      meta = STATUS_META[verdict.status],
      citations = attempt.basis[verdict.question],
      problems = citations.filter((c) =>
        verdict.problemCitationIds.includes(c.id),
      ),
      others = citations.filter(
        (c) => !verdict.problemCitationIds.includes(c.id),
      ),
      Icon = meta.icon;
    return (
      <article className={`verdict-card ${verdict.status}`} key={verdict.question}>
        <header>
          <span className="verdict-question">{question.title}</span>
          <span className={`verdict-badge ${verdict.status}`}>
            <Icon size={12} /> {meta.label}
          </span>
        </header>
        <p className="verdict-choice">「{option.label}」</p>
        {verdict.status === "contradicted" && (
          <div className="verdict-section">
            <strong>与结论矛盾的片段</strong>
            {problems.map((c) => citationRow(c, "problem", `p-${c.id}`))}
          </div>
        )}
        {verdict.status === "missing" && (
          <div className="verdict-section">
            <strong>还缺这些依据</strong>
            <ul className="verdict-missing">
              {verdict.missing.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {others.length > 0 && (
          <div className="verdict-section">
            <strong>本步引用的依据</strong>
            {others.map((c) => citationRow(c, null, `o-${c.id}`))}
          </div>
        )}
        {citations.length === 0 && (
          <p className="verdict-empty">这一步没有引用任何依据。</p>
        )}
      </article>
    );
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="profiles-dialog hypothesis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hypothesis-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">HYPOTHESIS TRIAL</span>
            <h2 id="hypothesis-title">
              <FlaskConical size={20} /> 结案假说试验
            </h2>
          </div>
          <button className="icon-button" aria-label="关闭假说试验" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <p className="panel-description">
          选出事故原因、信号来源与人物动机，并引用已收集的线索和已听证词作为每一步的依据。检验只看依据是否构成因果链，与笔记数量无关。
        </p>
        <div className="hypothesis-tabs">
          <button
            className={tab === "build" ? "active" : ""}
            onClick={() => setTab("build")}
          >
            <FlaskConical size={13} /> 新的试验
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <History size={13} /> 历次结论
            <span className="count-badge">{attempts.length}</span>
          </button>
        </div>
        {tab === "history" ? (
          <div className="attempt-list">
            {attempts.length === 0 ? (
              <div className="empty-notes">
                <History size={26} />
                <p>还没有试验记录</p>
                <small>提交一次假说，结论会保存在这里。</small>
              </div>
            ) : (
              attempts.map((attempt, index) => (
                <article className="attempt-card" key={attempt.id}>
                  <button
                    className="attempt-heading"
                    onClick={() =>
                      setExpanded(expanded === attempt.id ? null : attempt.id)
                    }
                  >
                    <span>
                      第 {attempts.length - index} 次试验
                      <time>
                        {new Date(attempt.createdAt).toLocaleString("zh-CN")}
                      </time>
                    </span>
                    <span className={`attempt-result ${attempt.passed ? "pass" : "fail"}`}>
                      {attempt.passed ? "假说成立" : "尚未成立"}
                    </span>
                  </button>
                  {expanded === attempt.id && (
                    <div className="attempt-detail">
                      {attempt.verdicts.map((verdict) =>
                        verdictCard(attempt, verdict),
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        ) : result ? (
          <div className="trial-result">
            <div className={`result-banner ${result.passed ? "pass" : "fail"}`}>
              <strong>{result.passed ? "假说成立" : "假说尚未成立"}</strong>
              <p>
                {result.passed
                  ? "三步结论都有依据支持。可以前往灯塔，还原那晚的真相。"
                  : "查看逐项结论：矛盾的片段可以回听，缺失的依据需要返回调查补充。"}
              </p>
            </div>
            {result.verdicts.map((verdict) => verdictCard(result, verdict))}
            <div className="dialog-footer result-actions">
              <button className="secondary-button" onClick={onClose}>
                返回调查补充
              </button>
              <button className="secondary-button" onClick={() => retry(result)}>
                重新组织假说
              </button>
            </div>
          </div>
        ) : (
          <div className="trial-build">
            {HYPOTHESIS_QUESTIONS.map((question, index) => (
              <section className="question-card" key={question.id}>
                <header>
                  <span className="question-step">
                    第 {index + 1} 步 · {question.title}
                  </span>
                  <p>{question.prompt}</p>
                </header>
                <div className="option-list">
                  {question.options.map((option) => (
                    <label
                      className={`option-row ${draft.choices[question.id] === option.id ? "selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name={`hypothesis-${question.id}`}
                        checked={draft.choices[question.id] === option.id}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            choices: { ...d.choices, [question.id]: option.id },
                          }))
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <div className="basis-area">
                  <span className="basis-label">
                    本步依据（{draft.basis[question.id].length}）
                  </span>
                  {draft.basis[question.id].map((citation) => (
                    <div className="citation-row draft" key={citation.id}>
                      <Quote size={12} />
                      <div className="citation-body">
                        <span className="citation-source">
                          {citation.kind === "clue"
                            ? `声音线索 · ${citation.label}`
                            : `${citation.speaker} · ${episodeName(citation)} · ${formatTime(citation.start)}`}
                        </span>
                        <p>{citation.label}</p>
                      </div>
                      <button
                        className="replay-button"
                        aria-label="移除引用"
                        onClick={() => detach(question.id, citation.id)}
                      >
                        <X size={11} /> 移除
                      </button>
                    </div>
                  ))}
                  <button
                    className="attach-button"
                    onClick={() =>
                      setPicker(picker === question.id ? null : question.id)
                    }
                  >
                    <Plus size={13} /> 引用线索或证词
                  </button>
                  {picker === question.id && (
                    <div className="citation-picker">
                      <div className="picker-group">
                        <strong>已收集线索（{candidates.clues.length}）</strong>
                        {candidates.clues.length === 0 && (
                          <p className="empty-small">
                            还没有收集到声音线索，回到字幕中收集。
                          </p>
                        )}
                        {candidates.clues.map((citation) => (
                          <button
                            className="picker-item"
                            key={citation.id}
                            disabled={draft.basis[question.id].some(
                              (c) => c.id === citation.id,
                            )}
                            onClick={() => attach(question.id, citation)}
                          >
                            <span className="citation-source">
                              声音线索 · {citation.label}
                            </span>
                            <p>
                              {
                                content.clues.find(
                                  (clue) => clue.id === citation.clueId,
                                )?.description
                              }
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="picker-group">
                        <strong>
                          已听证词（{candidates.testimony.length}）
                        </strong>
                        {candidates.testimony.length === 0 && (
                          <p className="empty-small">
                            还没有听完任何对白，回到录音中收听。
                          </p>
                        )}
                        {candidates.testimony.map(({ citation, stale }) => (
                          <button
                            className={`picker-item ${stale ? "stale" : ""}`}
                            key={citation.id}
                            disabled={
                              stale ||
                              draft.basis[question.id].some(
                                (c) => c.id === citation.id,
                              )
                            }
                            onClick={() => attach(question.id, citation)}
                          >
                            <span className="citation-source">
                              {citation.speaker} · {episodeName(citation)} ·{" "}
                              {formatTime(citation.start)}
                            </span>
                            <p>{citation.label}</p>
                            {stale && (
                              <em className="replay-blocked">
                                旧版录音 · 证词已改写，无法引用
                              </em>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ))}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-footer submit-row">
              <small>
                提交将冻结本次引用的依据；之后编辑笔记或补收线索，只影响下一次试验。
              </small>
              <button
                className="primary-button"
                disabled={!ready}
                onClick={submit}
              >
                <Check size={14} /> 提交假说，接受检验
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
