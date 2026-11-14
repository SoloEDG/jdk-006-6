import type { HypothesisQuestionId } from "../../../shared/types";
export interface CitationRef {
  kind: "clue" | "testimony";
  clueId?: string;
  episodeId?: string;
  cueId?: string;
}
export interface SupportGroup {
  label: string;
  anyOf: CitationRef[];
}
export interface HypothesisOption {
  id: string;
  label: string;
  provable: boolean;
  support: SupportGroup[];
  contradictedBy: CitationRef[];
}
export interface HypothesisQuestion {
  id: HypothesisQuestionId;
  title: string;
  prompt: string;
  options: HypothesisOption[];
}
const clue = (clueId: string): CitationRef => ({ kind: "clue", clueId });
const line = (episodeId: string, cueId: string): CitationRef => ({
  kind: "testimony",
  episodeId,
  cueId,
});
export const HYPOTHESIS_QUESTIONS: HypothesisQuestion[] = [
  {
    id: "cause",
    title: "事故原因",
    prompt: "二十年前的那场海难，真正的原因是什么？",
    options: [
      {
        id: "cause-beacon",
        label: "有人关掉了灯塔航标，渡轮在雾中失去了方向",
        provable: true,
        support: [
          {
            label: "能证明航标被人为关闭的证据（如灯塔里的磁带证词）",
            anyOf: [clue("key"), line("tower-normal", "line-3")],
          },
        ],
        contradictedBy: [],
      },
      {
        id: "cause-storm",
        label: "暴风雨导致渡轮触礁，只是一场天灾",
        provable: false,
        support: [],
        contradictedBy: [clue("key"), line("tower-normal", "line-3")],
      },
      {
        id: "cause-wreck",
        label: "渡轮年久失修，因机械故障自行沉没",
        provable: false,
        support: [],
        contradictedBy: [],
      },
    ],
  },
  {
    id: "signal",
    title: "信号来源",
    prompt: "深夜那通没有号码的电话，声音究竟来自哪里？",
    options: [
      {
        id: "signal-tape",
        label: "电话播放的，是灯塔控制室里那盘二十年前的磁带",
        provable: true,
        support: [
          {
            label: "指出电话与旧磁带关系的证词（如灯塔录音的结尾）",
            anyOf: [line("tower-normal", "line-4")],
          },
        ],
        contradictedBy: [],
      },
      {
        id: "signal-survivor",
        label: "当年的幸存者，从海上打来的实时求救",
        provable: false,
        support: [],
        contradictedBy: [line("tower-normal", "line-4")],
      },
      {
        id: "signal-prank",
        label: "电台内部有人故意安排的恶作剧",
        provable: false,
        support: [],
        contradictedBy: [],
      },
    ],
  },
  {
    id: "motive",
    title: "人物动机",
    prompt: "周姨隐瞒了二十年，又引你找到磁带——她真正想要的是什么？",
    options: [
      {
        id: "motive-truth",
        label: "让真相被听见，让遇难者的名字不再被潮水带走",
        provable: true,
        support: [
          {
            label: "周姨亲口说明心意的证词（如钟声之后的坦白）",
            anyOf: [
              line("interview-aware", "line-4"),
              line("finale-normal", "line-2"),
            ],
          },
        ],
        contradictedBy: [],
      },
      {
        id: "motive-revenge",
        label: "向当年关闭航标的人复仇",
        provable: false,
        support: [],
        contradictedBy: [line("finale-normal", "line-2")],
      },
      {
        id: "motive-hide",
        label: "掩盖她自己与当年事故的干系",
        provable: false,
        support: [],
        contradictedBy: [
          line("interview-aware", "line-4"),
          line("finale-normal", "line-2"),
        ],
      },
    ],
  },
];
export function findQuestion(id: HypothesisQuestionId): HypothesisQuestion {
  const question = HYPOTHESIS_QUESTIONS.find((q) => q.id === id);
  if (!question) throw new Error("未知的假说问题");
  return question;
}
export function findOption(
  question: HypothesisQuestion,
  optionId: string,
): HypothesisOption {
  const option = question.options.find((o) => o.id === optionId);
  if (!option) throw new Error("未知的假说选项");
  return option;
}
