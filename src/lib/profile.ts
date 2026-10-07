import { Chart, Fact, Metric, Profile, Source } from "./types";
import { dateLabel, dateValue, number, numeric } from "./format";
import { AppError } from "./server/errors";

const unitFor = (label: string) =>
  /₽|руб|выруч|доход|расход|стоимость|бюджет/i.test(label)
    ? "₽"
    : /%|процент|конверсия|доля/i.test(label)
      ? "%"
      : "";
const isRate = (label: string) =>
  /%|процент|конверсия|доля|средн|цена|рейтинг|rate|ratio|average|price/i.test(
    label,
  );
const isId = (label: string) =>
  /(^id$|_id$|^id_|номер|идентификатор|артикул|телефон|индекс)/i.test(label);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function buildProfile(source: Source): Profile {
  if (source.kind === "text") return profileText(source);
  const { columns, rows } = source;
  const facts: Fact[] = [
    {
      id: "rows",
      text: `В отчёте ${number(rows.length)} строк данных и ${columns.length} столбцов.`,
      origin: "Вся таблица",
    },
  ];
  const metrics: Metric[] = [];
  const charts: Chart[] = [];
  let missing = 0;
  const info = columns.map((label, index) => {
    const cells = rows
      .map((r) => r[index])
      .filter((v) => v != null && v !== "");
    missing += rows.length - cells.length;
    const numbers = cells.map(numeric).filter((n): n is number => n !== null);
    if (numbers.some((n) => Math.abs(n) > 1e12))
      throw new AppError(
        "Числа в отчёте должны быть в диапазоне от −1 трлн до 1 трлн.",
      );
    const dates = cells.map(dateValue).filter((d): d is string => d !== null);
    const type =
      cells.length && dates.length === cells.length
        ? "date"
        : cells.length && numbers.length === cells.length && !isId(label)
          ? "number"
          : "category";
    return { label, index, cells, numbers, dates, type, unit: unitFor(label) };
  });
  const nums = info.filter((c) => c.type === "number");
  const categories = info.filter(
    (c) =>
      c.type === "category" &&
      !isId(c.label) &&
      new Set(c.cells.map(String)).size >= 2 &&
      new Set(c.cells.map(String)).size <= 12,
  );
  const date = info.find((c) => c.type === "date");
  for (const column of nums) {
    const mean = sum(column.numbers) / column.numbers.length;
    const total = sum(column.numbers);
    const aggregate = isRate(column.label) ? mean : total;
    const aggregation = isRate(column.label)
      ? "Среднее по заполненным строкам"
      : "Сумма по заполненным строкам";
    if (metrics.length < 4)
      metrics.push({
        label: column.label,
        value: aggregate,
        unit: column.unit,
        detail: aggregation,
        values: column.numbers.slice(-18),
      });
    facts.push({
      id: `metric-${column.index}`,
      text: `${column.label}: ${number(aggregate)} ${column.unit}. ${aggregation}; заполнено ${column.numbers.length} из ${rows.length} строк.`,
      origin: `Столбец «${column.label}»`,
    });
    facts.push({
      id: `range-${column.index}`,
      text: `${column.label}: минимум ${number(Math.min(...column.numbers))}, максимум ${number(Math.max(...column.numbers))}, среднее ${number(mean)} ${column.unit}.`,
      origin: `Столбец «${column.label}»`,
    });
  }
  const measure = nums.find((n) => !isRate(n.label)) ?? nums[0];
  if (date) {
    const days = [...new Set(date.dates)].sort();
    facts.push({
      id: "period",
      text: `Период отчёта: ${dateLabel(days[0])} — ${dateLabel(days.at(-1)!)} ${days.at(-1)!.slice(0, 4)}.`,
      origin: `Столбец «${date.label}»`,
    });
    for (const numericColumn of nums.slice(0, 3)) {
      const grouped = new Map<string, number[]>();
      rows.forEach((row) => {
        const day = dateValue(row[date.index]);
        const value = numeric(row[numericColumn.index]);
        if (day && value !== null)
          grouped.set(day, [...(grouped.get(day) ?? []), value]);
      });
      const daily = [...grouped]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, values]) => ({
          label,
          value: isRate(numericColumn.label)
            ? sum(values) / values.length
            : sum(values),
        }));
      if (daily.length >= 2 && daily.length <= 60) {
        daily.forEach((p) =>
          facts.push({
            id: `day-${numericColumn.index}-${p.label}`,
            text: `${dateLabel(p.label)} ${p.label.slice(0, 4)}: ${numericColumn.label} — ${number(p.value)} ${numericColumn.unit}.`,
            origin: `Строки с датой ${p.label}`,
          }),
        );
        charts.push({
          id: `trend-${numericColumn.index}`,
          title: `${numericColumn.label} в динамике`,
          subtitle: isRate(numericColumn.label)
            ? "Среднее по дням"
            : "Сумма по дням",
          type: "line",
          allowed: ["line", "bar"],
          unit: numericColumn.unit,
          points: daily.map((p) => ({ ...p, label: dateLabel(p.label) })),
          reason: "Линия показывает изменение показателя во времени.",
        });
      }
    }
  }
  for (const category of categories.slice(0, 3)) {
    const labels = [...new Set(category.cells.map(String))];
    const countPoints = labels
      .map((label) => ({
        label,
        value: rows.filter((r) => String(r[category.index]) === label).length,
      }))
      .sort((a, b) => b.value - a.value);
    const groupMeasure =
      measure && !isRate(measure.label) ? measure : undefined;
    const points = groupMeasure
      ? labels
          .map((label) => ({
            label,
            value: sum(
              rows
                .filter((r) => String(r[category.index]) === label)
                .map((r) => numeric(r[groupMeasure.index]))
                .filter((v): v is number => v !== null),
            ),
          }))
          .sort((a, b) => b.value - a.value)
      : countPoints;
    const total = sum(points.map((p) => p.value));
    const complete = category.cells.length === rows.length;
    const nonnegative = points.every((p) => p.value >= 0) && total > 0;
    points.forEach((p, i) =>
      facts.push({
        id: `group-${category.index}-${i}`,
        text: `${category.label}: «${p.label}» — ${groupMeasure?.label ?? "число строк"}: ${number(p.value)} ${groupMeasure?.unit ?? ""}${nonnegative ? ` (${number((p.value / total) * 100)}% от суммы групп с заполненным полем «${category.label}»)` : ""}.`,
        origin: `Группировка по «${category.label}»`,
      }),
    );
    countPoints.forEach((p, i) =>
      facts.push({
        id: `count-${category.index}-${i}`,
        text: `«${p.label}»: ${p.value} строк, ${number((p.value / rows.length) * 100)}% всех строк.`,
        origin: `Столбец «${category.label}»`,
      }),
    );
    charts.push({
      id: `groups-${category.index}`,
      title: groupMeasure
        ? `${groupMeasure.label}: ${category.label.toLowerCase()}`
        : `Распределение: ${category.label.toLowerCase()}`,
      subtitle: complete
        ? `Категорий: ${labels.length} · весь отчёт`
        : `Категорий: ${labels.length} · только заполненные значения`,
      type: nonnegative && labels.length <= 5 ? "donut" : "bar",
      allowed: nonnegative && labels.length <= 6 ? ["bar", "donut"] : ["bar"],
      unit: groupMeasure?.unit ?? "",
      points,
      reason:
        "Сравнение категорий; доли показываются только для неотрицательных значений.",
    });
    const secondary = nums.find((n) => n !== groupMeasure && !isRate(n.label));
    if (secondary) {
      const otherPoints = labels
        .map((label) => ({
          label,
          value: sum(
            rows
              .filter((r) => String(r[category.index]) === label)
              .map((r) => numeric(r[secondary.index]))
              .filter((v): v is number => v !== null),
          ),
        }))
        .sort((a, b) => b.value - a.value);
      otherPoints.forEach((p, i) =>
        facts.push({
          id: `secondary-${category.index}-${i}`,
          text: `${category.label}: «${p.label}» — ${secondary.label}: ${number(p.value)} ${secondary.unit}.`,
          origin: `Столбцы «${category.label}» и «${secondary.label}»`,
        }),
      );
      charts.push({
        id: `counts-${category.index}`,
        title: `${secondary.label}: ${category.label.toLowerCase()}`,
        subtitle: "Сумма по категориям",
        type: "bar",
        allowed: ["bar"],
        unit: secondary.unit,
        points: otherPoints,
        reason:
          "Столбцы показывают второй показатель в разрезе тех же категорий.",
      });
    } else if (groupMeasure)
      charts.push({
        id: `counts-${category.index}`,
        title: `${category.label}: количество записей`,
        subtitle: "Количество строк в каждой категории",
        type: "bar",
        allowed: ["bar", "donut"],
        unit: "",
        points: countPoints,
        reason: "Столбцы позволяют сравнить количество записей по категориям.",
      });
  }
  if (!charts.length && nums.length) {
    for (const column of nums.slice(0, 3)) {
      const min = Math.min(...column.numbers),
        max = Math.max(...column.numbers);
      const step = (max - min) / 5 || 1;
      const points = Array.from({ length: max === min ? 1 : 5 }, (_, i) => ({
        label:
          max === min
            ? number(min)
            : `${number(min + step * i)}–${number(min + step * (i + 1))}`,
        value: 0,
      }));
      column.numbers.forEach(
        (n) =>
          points[Math.min(points.length - 1, Math.floor((n - min) / step))]
            .value++,
      );
      charts.push({
        id: `hist-${column.index}`,
        title: `Распределение: ${column.label.toLowerCase()}`,
        subtitle: "Число строк по диапазонам значений",
        type: "bar",
        allowed: ["bar"],
        unit: "",
        points,
        reason:
          "Без даты или категории уместно показать распределение значений.",
      });
    }
  }
  if (!metrics.length)
    metrics.push({
      label: "Записей в отчёте",
      value: rows.length,
      unit: "",
      detail: "Без строки заголовков",
      values: [],
    });
  if (metrics.length < 4)
    metrics.push({
      label: "Полнота данных",
      value:
        Math.round((1 - missing / (rows.length * columns.length)) * 1000) / 10,
      unit: "%",
      detail: `${missing} пустых ячеек`,
      values: [],
    });
  facts.push({
    id: "missing",
    text: `В отчёте ${missing} пустых ячеек. Пропуски исключены из числовых агрегатов, а не заменены нулями.`,
    origin: "Проверка всех ячеек",
  });
  // Prefer diverse views; extra candidates remain available for the model.
  const prioritized = [
    ...charts.filter((c) => c.id.startsWith("trend")).slice(0, 1),
    ...charts.filter((c) => c.id.startsWith("groups")).slice(0, 1),
    ...charts.filter((c) => c.id.startsWith("counts")).slice(0, 1),
  ];
  const unique = [
    ...new Map([...prioritized, ...charts].map((c) => [c.id, c])).values(),
  ];
  return {
    metrics,
    charts: unique,
    facts,
    missing,
    period:
      facts
        .find((f) => f.id === "period")
        ?.text.replace("Период отчёта: ", "")
        .replace(/\.$/, "") ?? "Весь отчёт",
  };
}

function profileText(source: Source): Profile {
  const sentences = source.text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const facts = sentences.map((text, i) => ({
    id: `text-${i}`,
    text,
    origin: `Фрагмент ${i + 1} исходного текста`,
  }));
  // Only explicit "label: number unit" lines become measurements; never invent a series from prose.
  const measurements = sentences.flatMap((text) => {
    const match = text.match(
      /^([^:\n]{2,60}):\s*(-?\d+(?:[ .,]\d+)*)\s*(₽|руб\.?|%|заказов|заказа|задач|задачи|шт\.?)?\s*[.;]?$/i,
    );
    if (!match) return [];
    const value = numeric(match[2]);
    return value === null
      ? []
      : [
          {
            label: match[1],
            value,
            unit: /₽|руб/.test(match[3] ?? "") ? "₽" : (match[3] ?? ""),
          },
        ];
  });
  const units = [...new Set(measurements.map((m) => m.unit))];
  const charts: Chart[] = units.flatMap((unit, i) => {
    const points = measurements
      .filter((m) => m.unit === unit)
      .map(({ label, value }) => ({ label, value }));
    return points.length >= 2
      ? [
          {
            id: `text-chart-${i}`,
            title: unit ? `Показатели, ${unit}` : "Показатели из отчёта",
            subtitle: "Явные значения из исходного текста",
            type: "bar" as const,
            allowed: ["bar" as const],
            unit,
            points,
            reason:
              "Сравниваются только явно указанные значения с одинаковой единицей.",
          },
        ]
      : [];
  });
  const metrics: Metric[] = measurements
    .slice(0, 4)
    .map((m) => ({ ...m, detail: "Указано в исходном тексте", values: [] }));
  if (!metrics.length)
    metrics.push({
      label: "Фрагменты отчёта",
      value: sentences.length,
      unit: "",
      detail: "Доступны для вопросов",
      values: [],
    });
  return { metrics, charts, facts, period: "Текстовый отчёт", missing: 0 };
}

export function demoNarrative(profile: Profile) {
  const group = profile.facts.find((f) => f.id.startsWith("group-"));
  const metric = profile.facts.find((f) => f.id.startsWith("metric-"));
  const selected = [group, metric].filter((f): f is Fact => !!f);
  if (!selected.length) selected.push(...profile.facts.slice(0, 2));
  const firstChart = profile.charts.find((c) => c.id.startsWith("groups"));
  const leader = firstChart?.points[0];
  const total = firstChart?.points.reduce((a, p) => a + p.value, 0) ?? 0;
  const title =
    firstChart && leader
      ? /выручка/i.test(firstChart.title) &&
        total > 0 &&
        firstChart.points.every((p) => p.value >= 0)
        ? `«${leader.label}» приносит ${number((leader.value / total) * 100)}% выручки`
        : `Лидирует категория «${leader.label}»`
      : "За цифрами всегда есть история.";
  return {
    title,
    body: selected.map((f) => f.text).join(" "),
    evidence: selected.map((f) => f.id),
  };
}
