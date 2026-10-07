import Papa from "papaparse";
import {
  MAX_COLUMNS,
  MAX_FILE_BYTES,
  MAX_ROWS,
  MAX_TEXT,
  Source,
  sourceSchema,
} from "./types";
import { AppError } from "./server/errors";

export function tableFromRows(
  name: string,
  input: unknown[][],
  warnings: string[] = [],
): Source {
  const data = input.filter((row) =>
    row.some((c) => c !== null && c !== undefined && String(c).trim() !== ""),
  );
  if (data.length < 2)
    throw new AppError("В файле нужны заголовки и хотя бы одна строка данных.");
  if (data.length - 1 > MAX_ROWS)
    throw new AppError(
      `В MVP можно загрузить до ${MAX_ROWS} строк. Разделите файл на части.`,
    );
  if (data[0].length > MAX_COLUMNS)
    throw new AppError(
      `В таблице должно быть не больше ${MAX_COLUMNS} столбцов.`,
    );
  const seen = new Set<string>();
  const columns = data[0].map((c, i) => {
    const base = String(c ?? "").trim() || `Столбец ${i + 1}`;
    if (base.length > 100)
      throw new AppError("Название столбца длиннее 100 символов.");
    let name = base;
    let n = 2;
    while (seen.has(name)) name = `${base} (${n++})`;
    seen.add(name);
    return name;
  });
  let ragged = false;
  const rows = data.slice(1).map((row) => {
    if (
      row.length > columns.length &&
      row.slice(columns.length).some((c) => c != null && String(c).trim())
    )
      throw new AppError(
        "В строках больше полей, чем заголовков. Проверьте разделитель и структуру таблицы.",
      );
    if (row.length < columns.length) ragged = true;
    return columns.map((_, i) => {
      const cell = row[i];
      if (cell == null || String(cell).trim() === "") return null;
      if (typeof cell === "number" && Number.isFinite(cell)) return cell;
      const text = String(cell).trim();
      if (text.length > 2000)
        throw new AppError(
          "Одна из ячеек слишком длинная. Ограничение — 2000 символов.",
        );
      return text;
    });
  });
  if (ragged)
    warnings.push(
      "Незаполненные поля в коротких строках отмечены как пропуски.",
    );
  return sourceSchema.parse({
    name: name.slice(0, 160),
    kind: "table",
    columns,
    rows,
    text: "",
    warnings,
  });
}

export function parseCsv(text: string, name = "report.csv"): Source {
  if (!text.trim())
    throw new AppError("Файл пуст. Загрузите таблицу с данными.");
  if (text.includes("\0") || text.includes("\ufffd"))
    throw new AppError(
      "Не удалось прочитать кодировку. Сохраните CSV в UTF-8.",
    );
  const result = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  if (
    result.errors.some(
      (e) => e.code === "MissingQuotes" || e.code === "InvalidQuotes",
    )
  )
    throw new AppError(
      "В CSV не закрыты кавычки. Проверьте файл и попробуйте ещё раз.",
    );
  if (!result.meta.delimiter || result.data[0]?.length < 2)
    throw new AppError(
      "Не найден разделитель CSV. Поддерживаются запятая, точка с запятой и табуляция. Обычный текст можно вставить отдельно.",
    );
  return tableFromRows(name, result.data);
}

export function parseText(text: string, name = "Текстовый отчёт"): Source {
  const clean = text.replace(/\r\n/g, "\n").replace(/\0/g, "").trim();
  if (clean.length < 20)
    throw new AppError("Добавьте чуть больше контекста: минимум 20 символов.");
  if (clean.length > MAX_TEXT)
    throw new AppError(`Сократите отчёт до ${MAX_TEXT} символов.`);
  return {
    name,
    kind: "text",
    text: clean,
    columns: [],
    rows: [],
    warnings: [],
  };
}

export async function parseFile(file: File): Promise<Source> {
  if (file.size > MAX_FILE_BYTES)
    throw new AppError(
      "Файл больше 2 МБ. Попробуйте загрузить небольшой фрагмент.",
      413,
    );
  if (!file.size) throw new AppError("Файл пуст. Загрузите таблицу с данными.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "tsv")
    return parseCsv(await file.text(), file.name);
  if (extension === "txt") return parseText(await file.text(), file.name);
  if (extension !== "xlsx")
    throw new AppError(
      "Поддерживаются CSV, XLSX и TXT. Старый Excel (.xls) сохраните как .xlsx.",
    );
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { default: AdmZip } = await import("adm-zip");
    const entries = new AdmZip(bytes).getEntries();
    if (
      entries.length > 500 ||
      entries.reduce((sum, entry) => sum + entry.header.size, 0) >
        15 * 1024 * 1024
    )
      throw new AppError(
        "Excel слишком большой после распаковки. Уберите лишние листы и форматирование.",
      );
    for (const entry of entries) if (!entry.isDirectory) entry.getData();
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const sheets = workbook.worksheets.filter((s) => s.actualRowCount > 0);
    const sheet = sheets[0];
    if (!sheet) throw new AppError("В Excel не найдено листов с данными.");
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS)
      throw new AppError(
        "В Excel допустимо до 1000 строк и 30 столбцов. Удалите лишние пустые строки и столбцы.",
      );
    const rows: unknown[][] = [];
    let formulas = false;
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = Array.from({ length: sheet.columnCount }, (_, i) => {
        const value = row.getCell(i + 1).value;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        if (value && typeof value === "object") {
          if ("formula" in value || "sharedFormula" in value) {
            formulas = true;
            return value.result ?? null;
          }
          if ("richText" in value)
            return value.richText.map((v) => v.text).join("");
          if ("text" in value) return value.text;
          return null;
        }
        return value;
      });
      rows.push(values);
    });
    const warnings: string[] = [];
    if (sheets.length > 1)
      warnings.push(
        `Проанализирован первый лист «${sheet.name}». Остальные ${sheets.length - 1} не включены.`,
      );
    if (formulas)
      warnings.push(
        "Для формул использованы сохранённые Excel результаты; формулы без результата отмечены как пропуски.",
      );
    return tableFromRows(file.name, rows, warnings);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Не удалось открыть Excel. Возможно, файл повреждён или защищён паролем.",
    );
  }
}
