import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";

const columns = ["Дата", "Канал", "Выручка", "Заказы", "Расходы"];
const rows = [];
for (let day = 1; day <= 28; day++) {
  ["Органический поиск", "Прямая реклама", "Социальные сети"].forEach(
    (channel, i) => {
      const wave = Math.sin(day * 0.75) * 0.2 + Math.cos(day * 0.31) * 0.13;
      const orders = Math.round([31, 22, 14][i] * (1 + day / 70 + wave));
      rows.push([
        `2026-09-${String(day).padStart(2, "0")}`,
        channel,
        orders * [2450, 2100, 1850][i],
        orders,
        Math.round(orders * [270, 840, 590][i]),
      ]);
    },
  );
}
await mkdir("public/examples", { recursive: true });
await writeFile(
  "public/examples/sales.csv",
  "\ufeff" + [columns, ...rows].map((r) => r.join(";")).join("\n"),
);
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Продажи");
sheet.addRow(columns);
rows.forEach((r) => sheet.addRow(r));
sheet.getRow(1).font = { bold: true };
sheet.columns.forEach((c) => {
  c.width = 24;
});
await workbook.xlsx.writeFile("public/examples/sales.xlsx");
console.log("Created reproducible CSV/XLSX demo fixtures.");
