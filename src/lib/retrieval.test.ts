import { describe, expect, it } from "vitest";
import { rowEvidence } from "./retrieval";
import { parseCsv } from "./parse";
describe("row context retrieval", () => {
  it("finds an exact task and retains row provenance", () => {
    const source = parseCsv("Задача,Статус\nLENS-104,Ревью\nLENS-105,Готово");
    expect(rowEvidence(source, "Какой статус у LENS-104?")).toEqual([
      {
        id: "row-1",
        text: "Задача: LENS-104; Статус: Ревью",
        origin: "Строка данных 1 (без заголовка)",
      },
    ]);
  });
  it("does not manufacture matches and bounds context", () => {
    const source = parseCsv(
      "Задача,Статус\n" +
        Array.from({ length: 100 }, (_, i) => `LENS-${i},Ревью`).join("\n"),
    );
    expect(rowEvidence(source, "зарплата директора")).toEqual([]);
    expect(rowEvidence(source, "Задачи на ревью")).toHaveLength(40);
  });
});
