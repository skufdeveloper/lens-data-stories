import { Fact, Source } from "./types";

const stopWords = new Set([
  "какой",
  "какая",
  "какие",
  "сколько",
  "почему",
  "отчёт",
  "отчет",
  "данные",
  "этого",
  "этой",
  "всего",
  "покажи",
  "скажи",
  "были",
  "были",
  "есть",
  "what",
  "which",
  "total",
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("ё", "е")
    .match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];

/** Retrieve complete matching rows; never truncate a cell and present it as complete evidence. */
export function rowEvidence(source: Source, question: string): Fact[] {
  if (source.kind !== "table") return [];
  const query = words(question).filter((w) => !stopWords.has(w));
  if (!query.length) return [];
  const ranked = source.rows
    .map((row, index) => {
      const text = source.columns
        .map((c, i) => `${c}: ${row[i] ?? "[пусто]"}`)
        .join("; ");
      const tokens = words(row.map((c) => c ?? "").join(" "));
      const score = query.reduce(
        (score, q) =>
          score +
          tokens.filter(
            (t) =>
              t === q ||
              (q.length >= 5 &&
                /^[а-я]+$/.test(q) &&
                t.startsWith(q.slice(0, -1))),
          ).length,
        0,
      );
      return { text, index, score };
    })
    .filter((r) => r.score > 0 && r.text.length <= 4000)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  let characters = 0;
  const result: Fact[] = [];
  for (const row of ranked) {
    if (result.length >= 40) break;
    if (characters + row.text.length > 20000) continue;
    result.push({
      id: `row-${row.index + 1}`,
      text: row.text,
      origin: `Строка данных ${row.index + 1} (без заголовка)`,
    });
    characters += row.text.length;
  }
  return result;
}
