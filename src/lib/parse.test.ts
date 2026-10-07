import { describe, expect, it } from "vitest";
import { parseCsv, parseFile, parseText, tableFromRows } from "./parse";
import { dateValue, numeric } from "./format";
import ExcelJS from "exceljs";

describe("input normalization", () => {
  it("handles BOM, semicolons, quoted cells, decimal commas, and blank cells", () => {
    const result = parseCsv(
      '\ufeffКанал;Выручка;Комментарий\n"Поиск; SEO";"1 250,50";"строка\nвторая"\nРеклама;;нет',
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual([
      "Поиск; SEO",
      "1 250,50",
      "строка\nвторая",
    ]);
    expect(result.rows[1][1]).toBeNull();
    expect(numeric(result.rows[0][1])).toBe(1250.5);
  });
  it("deduplicates column names without collisions", () => {
    const result = tableFromRows("dup.csv", [
      ["a", "a", "a (2)"],
      [1, 2, 3],
    ]);
    expect(new Set(result.columns).size).toBe(3);
  });
  it("does not silently truncate ragged rows or oversized inputs", () => {
    expect(() => parseCsv("a,b\n1,2,3")).toThrow("больше полей");
    expect(() =>
      tableFromRows("big", [["a"], ...Array.from({ length: 1001 }, () => [1])]),
    ).toThrow("1000");
    expect(() => parseText("x".repeat(16001))).toThrow("16000");
  });
  it("rejects broken, empty, binary and unsupported files", async () => {
    expect(() => parseCsv("")).toThrow("пуст");
    expect(() => parseCsv('a,b\n1,"broken')).toThrow("кавычки");
    expect(() => parseCsv("a,b\n1,\0")).toThrow("кодировку");
    await expect(
      parseFile(new File(["broken"], "broken.xlsx")),
    ).rejects.toThrow("повреждён");
    await expect(parseFile(new File(["xls"], "old.xls"))).rejects.toThrow(
      ".xlsx",
    );
  });
  it("reads real XLSX dates, cached formula values and warns about extra sheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Данные");
    sheet.addRow(["Дата", "Сумма"]);
    sheet.addRow([
      new Date("2026-09-01T00:00:00Z"),
      { formula: "2+3", result: 5 },
    ]);
    const second = workbook.addWorksheet("Другой");
    second.addRow(["not analyzed"]);
    const bytes = await workbook.xlsx.writeBuffer();
    const source = await parseFile(
      new File([new Uint8Array(bytes)], "real.xlsx"),
    );
    expect(source.rows[0]).toEqual(["2026-09-01", 5]);
    expect(source.warnings).toHaveLength(2);
  });
  it("recognizes real dates and numeric formats without treating years as dates", () => {
    expect(dateValue("2026")).toBeNull();
    expect(dateValue("2026-02-30")).toBeNull();
    expect(dateValue("01.09.2026")).toBe("2026-09-01");
    expect(numeric("1,234.50")).toBe(1234.5);
    expect(numeric("—")).toBeNull();
    expect(numeric("42%")).toBe(42);
  });
});
