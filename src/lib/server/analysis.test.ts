import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv } from "../parse";
import { UNKNOWN } from "../types";
const mocked = vi.hoisted(() => ({ generate: vi.fn(), configured: true }));
vi.mock("./gigachat", () => ({
  generate: mocked.generate,
  isAIConfigured: () => mocked.configured,
}));
import { analyze, answer } from "./analysis";
const source = parseCsv(
  "Дата,Канал,Выручка\n2026-09-01,Поиск,100\n2026-09-02,Реклама,300",
);
describe("AI orchestration", () => {
  beforeEach(() => {
    mocked.generate.mockReset();
    mocked.configured = true;
  });
  it("uses model chart choices but always supplies code-computed values", async () => {
    mocked.generate.mockResolvedValue({
      title: "Выручка — 400",
      body: "Выручка: 400. В отчёте 2 строки данных и 3 столбца.",
      evidence: ["metric-2", "rows"],
      charts: [{ id: "trend-2", type: "bar", reason: "Сравнение дней" }],
      suggestions: ["Какая общая выручка?"],
    });
    const result = await analyze(source);
    expect(result.mode).toBe("ai");
    expect(result.profile.charts[0].type).toBe("bar");
    expect(result.profile.charts[0].points.map((p) => p.value)).toEqual([
      100, 300,
    ]);
  });
  it("rejects invented narrative numbers and invalid chart ids", async () => {
    const valid = {
      title: "Выручка",
      body: "Выручка 400.",
      evidence: ["metric-2"],
      charts: [{ id: "made-up", type: "donut", reason: "test" }],
      suggestions: ["Вопрос"],
    };
    mocked.generate.mockResolvedValue({
      ...valid,
      body: "Выручка выросла на 99%",
    });
    await expect(analyze(source)).rejects.toThrow("подтвердить");
    mocked.generate.mockResolvedValue(valid);
    await expect(analyze(source)).rejects.toThrow("неподходящий график");
  });
  it("renders only server facts, rejects forged ids, and handles an explicit refusal", async () => {
    mocked.generate.mockResolvedValue({
      answerable: true,
      evidenceIds: ["metric-2"],
    });
    expect((await answer(source, "Выручка?")).answer).toContain("400");
    mocked.generate.mockResolvedValue({
      answerable: true,
      evidenceIds: ["external"],
    });
    expect((await answer(source, "Кто президент?")).answer).toBe(UNKNOWN);
    mocked.generate.mockResolvedValue({
      answerable: false,
      evidenceIds: ["metric-2"],
    });
    expect((await answer(source, "Почему растёт?")).answer).toBe(UNKNOWN);
  });
  it("does not silently disguise a provider failure as an AI result", async () => {
    mocked.generate.mockRejectedValue(new Error("provider unavailable"));
    await expect(analyze(source)).rejects.toThrow("provider unavailable");
    const explicitDemo = await analyze(source, true);
    expect(explicitDemo.mode).toBe("demo");
  });
});
