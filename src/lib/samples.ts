import { Source } from "./types";
import { buildProfile, demoNarrative } from "./profile";
import type { Report } from "./types";

export function salesSample(): Source {
  const rows: Source["rows"] = [];
  const channels = ["Органический поиск", "Прямая реклама", "Социальные сети"];
  for (let day = 1; day <= 28; day++) {
    channels.forEach((channel, i) => {
      const wave = Math.sin(day * 0.75) * 0.2 + Math.cos(day * 0.31) * 0.13;
      const orders = Math.round(
        (i === 0 ? 31 : i === 1 ? 22 : 14) * (1 + day / 70 + wave),
      );
      rows.push([
        `2026-09-${String(day).padStart(2, "0")}`,
        channel,
        orders * (i === 0 ? 2450 : i === 1 ? 2100 : 1850),
        orders,
        Math.round(orders * (i === 0 ? 270 : i === 1 ? 840 : 590)),
      ]);
    });
  }
  return {
    name: "Продажи · сентябрь.csv",
    kind: "table",
    columns: ["Дата", "Канал", "Выручка", "Заказы", "Расходы"],
    rows,
    text: "",
    warnings: [],
  };
}
export function tasksSample(): Source {
  const statuses = ["Ревью", "Ревью", "В работе", "Готово", "Готово"];
  return {
    name: "Командный спринт.csv",
    kind: "table",
    columns: ["Задача", "Статус", "Команда", "Оценка, часы"],
    rows: Array.from({ length: 40 }, (_, i) => [
      `LENS-${100 + i}`,
      statuses[i % 5],
      ["Продукт", "Разработка", "Дизайн"][i % 3],
      2 + (i % 7),
    ]),
    text: "",
    warnings: [],
  };
}
export const sampleText =
  "Отчёт команды за неделю, 21–27 сентября.\nЗавершённые задачи: 24\nЗадачи на ревью: 16\nЗадачи в работе: 10\nКоманда запустила новую страницу оплаты.\nНа ревью задерживаются задачи по интеграции: ожидаем ответы от внешнего поставщика.\nСледующий шаг — согласовать контракт API с поставщиком.";
export function initialReport(): Report {
  const source = salesSample();
  const profile = buildProfile(source);
  return {
    source,
    profile: { ...profile, charts: profile.charts.slice(0, 3) },
    narrative: demoNarrative(profile),
    mode: "demo",
    suggestions: [
      "Какой канал приносит больше выручки?",
      "Сколько всего заказов?",
      "Есть ли пропуски в данных?",
    ],
  };
}
