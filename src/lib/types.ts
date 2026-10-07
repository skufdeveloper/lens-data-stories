import { z } from "zod";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 1000;
export const MAX_COLUMNS = 30;
export const MAX_TEXT = 16000;
export const UNKNOWN = "В этом отчете нет такой информации";

const cellSchema = z.union([
  z.string().max(2000),
  z.number().finite().min(-1e12).max(1e12),
  z.null(),
]);
export const sourceSchema = z
  .object({
    name: z.string().min(1).max(160),
    kind: z.enum(["table", "text"]),
    columns: z.array(z.string().min(1).max(100)).max(MAX_COLUMNS),
    rows: z.array(z.array(cellSchema).max(MAX_COLUMNS)).max(MAX_ROWS),
    text: z.string().max(MAX_TEXT),
    warnings: z.array(z.string().max(300)).max(12),
  })
  .superRefine((s, ctx) => {
    if (
      s.kind === "table" &&
      (!s.columns.length ||
        !s.rows.length ||
        new Set(s.columns).size !== s.columns.length ||
        s.rows.some((r) => r.length !== s.columns.length))
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Таблица должна содержать уникальные столбцы и строки одинаковой длины.",
      });
    }
    if (s.kind === "text" && !s.text.trim())
      ctx.addIssue({ code: "custom", message: "Добавьте текст отчёта." });
  });
export type Source = z.infer<typeof sourceSchema>;
export type Fact = { id: string; text: string; origin: string };
export type Metric = {
  label: string;
  value: number;
  unit: string;
  detail: string;
  values: number[];
};
export type ChartKind = "line" | "bar" | "donut";
export type Chart = {
  id: string;
  title: string;
  subtitle: string;
  type: ChartKind;
  allowed: ChartKind[];
  unit: string;
  points: { label: string; value: number }[];
  reason: string;
};
export type Profile = {
  metrics: Metric[];
  charts: Chart[];
  facts: Fact[];
  period: string;
  missing: number;
};
export type Report = {
  source: Source;
  profile: Profile;
  narrative: { title: string; body: string; evidence: string[] };
  mode: "ai" | "demo";
  suggestions: string[];
};
export type ChatReply = {
  answer: string;
  evidence: Fact[];
  mode: "ai" | "demo";
};
