import { z } from "zod";
import { buildProfile, demoNarrative } from "../profile";
import { ChatReply, Fact, Profile, Report, Source, UNKNOWN } from "../types";
import { generate, isAIConfigured } from "./gigachat";
import { CHAT_PROMPT, NARRATIVE_PROMPT } from "./prompts";
import { AppError } from "./errors";
import { rowEvidence } from "../retrieval";

const narrativeSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(1100),
  evidence: z.array(z.string()).min(1).max(6),
  charts: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["line", "bar", "donut"]),
        reason: z.string().max(240),
      }),
    )
    .max(3),
  suggestions: z.array(z.string().max(100)).min(1).max(3),
});
export const chatSchema = z.object({
  answerable: z.boolean(),
  evidenceIds: z.array(z.string()).max(4),
});

export function resolveEvidence(ids: string[], facts: Fact[]): Fact[] {
  const evidence = [...new Set(ids)].map((id) =>
    facts.find((f) => f.id === id),
  );
  return evidence.some((f) => !f) ? [] : (evidence as Fact[]);
}

// Reject unsupported numerical claims even when the provider produced schema-valid JSON.
export function supportedNumbers(text: string, evidence: Fact[]) {
  const normalize = (s: string) =>
    s
      .replace(/(\d)[ \u00a0\u202f](?=\d{3}(?:\D|$))/g, "$1")
      .replaceAll(",", ".");
  const numbers = (s: string) => normalize(s).match(/-?\d+(?:\.\d+)?/g) ?? [];
  const allowed = new Set(evidence.flatMap((f) => numbers(f.text)));
  return numbers(text).every((n) => allowed.has(n));
}

export async function analyze(source: Source, demo = false): Promise<Report> {
  const profile = buildProfile(source);
  if (demo || !isAIConfigured())
    return {
      source,
      profile: { ...profile, charts: profile.charts.slice(0, 3) },
      narrative: demoNarrative(profile),
      mode: "demo",
      suggestions:
        source.kind === "text"
          ? [
              "Что сказано о задачах на ревью?",
              "Какой следующий шаг?",
              "Какова прибыль компании?",
            ]
          : [
              "Какие основные показатели?",
              "Какая категория лидирует?",
              "Есть ли пропуски в данных?",
            ],
    };
  const output = await generate(narrativeSchema, NARRATIVE_PROMPT, {
    facts: profile.facts,
    chartCandidates: profile.charts.map(({ id, title, allowed, subtitle }) => ({
      id,
      title,
      allowed,
      subtitle,
    })),
  });
  const evidence = resolveEvidence(output.evidence, profile.facts);
  if (
    !evidence.length ||
    !supportedNumbers(`${output.title} ${output.body}`, evidence)
  )
    throw new AppError(
      "Не удалось подтвердить вывод GigaChat исходными данными. Повторите анализ или откройте расчёты без ИИ.",
      502,
    );
  const selected = output.charts.map((c) => {
    const candidate = profile.charts.find((p) => p.id === c.id);
    if (!candidate || !candidate.allowed.includes(c.type))
      throw new AppError(
        "GigaChat предложил неподходящий график. Повторите анализ.",
        502,
      );
    return { ...candidate, type: c.type, reason: c.reason };
  });
  const unique = [...new Map(selected.map((c) => [c.id, c])).values()];
  for (const c of profile.charts)
    if (
      unique.length < Math.min(3, profile.charts.length) &&
      !unique.some((x) => x.id === c.id)
    )
      unique.push(c);
  return {
    source,
    profile: { ...profile, charts: unique },
    narrative: {
      title: output.title,
      body: output.body,
      evidence: output.evidence,
    },
    mode: "ai",
    suggestions: output.suggestions,
  };
}

export function demoAnswer(question: string, profile: Profile): Fact[] {
  const q = question
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .trim();
  if (
    /прибыл|зарплат|прогноз|будущ|почему|причин|завтра|следующ.*месяц|ignore|игнорир|инструкц|system|промпт/.test(
      q,
    )
  )
    return [];
  if (
    /^(есть ли пропуски( в данных)?|сколько пустых ячеек|какова полнота данных)$/.test(
      q,
    )
  )
    return profile.facts.filter((f) => f.id === "missing");
  if (/^(какие основные показатели|итоги отчёта)$/.test(q))
    return profile.facts.filter((f) => f.id.startsWith("metric-")).slice(0, 3);
  if (q === "какая категория лидирует")
    return profile.facts.filter((f) => f.id.startsWith("group-")).slice(0, 1);
  if (q === "какой канал приносит больше выручки")
    return profile.facts
      .filter(
        (f) => f.id.startsWith("group-") && /^Канал:.*Выручка:/i.test(f.text),
      )
      .slice(0, 1);
  if (/^сколько (всего )?заказов$/.test(q))
    return profile.facts.filter(
      (f) => f.id.startsWith("metric-") && /^Заказы:/i.test(f.text),
    );
  if (
    /^(какая общая выручка|сколько всего выручки|какова сумма выручки)$/.test(q)
  )
    return profile.facts.filter(
      (f) => f.id.startsWith("metric-") && /^Выручка:/i.test(f.text),
    );
  if (/^(какой период отчёта|какие даты в отчёте)$/.test(q))
    return profile.facts.filter((f) => f.id === "period");
  if (profile.facts.some((f) => f.id.startsWith("text-"))) {
    if (q === "что сказано о задачах на ревью")
      return profile.facts.filter((f) => /ревью/i.test(f.text)).slice(0, 3);
    if (q === "какой следующий шаг")
      return profile.facts.filter((f) => /следующий шаг/i.test(f.text));
  }
  return [];
}

export async function answer(
  source: Source,
  question: string,
  demo = false,
): Promise<ChatReply> {
  const profile = buildProfile(source);
  const mode = !demo && isAIConfigured() ? "ai" : "demo";
  let evidence: Fact[];
  if (mode === "ai") {
    const facts = [...profile.facts, ...rowEvidence(source, question)];
    const result = await generate(chatSchema, CHAT_PROMPT, { question, facts });
    evidence = result.answerable
      ? resolveEvidence(result.evidenceIds, facts)
      : [];
  } else evidence = demoAnswer(question, profile);
  return {
    answer: evidence.length
      ? evidence.map((f) => f.text).join("\n\n")
      : UNKNOWN,
    evidence,
    mode,
  };
}
