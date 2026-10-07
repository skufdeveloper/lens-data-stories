import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const headers = { Origin: new URL(base).origin };
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).provider, "GigaChat");

let report;
for (const ext of ["csv", "xlsx"]) {
  const file = await readFile(`public/examples/sales.${ext}`);
  const form = new FormData();
  form.set("file", new File([file], `sales.${ext}`));
  form.set("demo", "true");
  const response = await fetch(`${base}/api/analyze`, { method: "POST", headers, body: form });
  assert.equal(response.status, 200, await response.clone().text());
  report = await response.json();
  assert.equal(report.mode, "demo");
  assert.equal(report.source.rows.length, 84);
  assert.equal(report.profile.metrics[0].value, 5098100);
  assert.equal(report.profile.charts.length, 3);
  console.log(`${ext.toUpperCase()}: 84 rows, verified revenue and 3 charts`);
}
for (const [question, expected] of [["Сколько всего заказов?", "2 307"], ["Какая зарплата у директора?", "В этом отчете нет такой информации"], ["Сколько всего заказов в октябре?", "В этом отчете нет такой информации"]]) {
  const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ source: report.source, question, demo: true }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.answer.includes(expected), data.answer);
}
const broken = new FormData(); broken.set("file", new File(["not a workbook"], "broken.xlsx"));
const failure = await fetch(`${base}/api/analyze`, { method: "POST", headers, body: broken });
assert.equal(failure.status, 400);
assert.ok((await failure.json()).error.includes("повреждён"));
console.log("Chat: grounded total + 2 refusals; corrupt Excel: recoverable 400. All smoke checks passed.");
