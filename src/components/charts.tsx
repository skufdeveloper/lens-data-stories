"use client";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined, Info, Table2 } from "lucide-react";
import { Chart, Metric } from "@/lib/types";
import { compact, number } from "@/lib/format";

const colors = [
  "#238776",
  "#a8c7b2",
  "#d8e5aa",
  "#899a86",
  "#bacbd0",
  "#d1bbb0",
];
const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e5e9e5",
  borderRadius: 12,
  boxShadow: "0 8px 30px #1a322815",
  padding: "10px 14px",
  fontSize: 12,
};

export function Sparkline({ metric }: { metric: Metric }) {
  const points = metric.values;
  if (points.length < 2)
    return (
      <div className="metric-dots">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    );
  const min = Math.min(...points),
    max = Math.max(...points);
  const path = points
    .map(
      (n, i) =>
        `${(i / (points.length - 1)) * 90},${30 - ((n - min) / (max - min || 1)) * 25}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 94 36" aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DataChart({ chart, index }: { chart: Chart; index: number }) {
  const id = useId().replaceAll(":", "");
  const [table, setTable] = useState(false);
  const total = chart.points.reduce((sum, p) => sum + p.value, 0);
  const format = (value: unknown) => `${number(Number(value))} ${chart.unit}`;
  return (
    <section className={`chart-card ${index === 0 ? "chart-main" : ""}`}>
      <div className="card-heading">
        <div>
          <h3>{chart.title}</h3>
          <p>{chart.subtitle}</p>
        </div>
        <div className="chart-tools">
          <span
            className="chart-info"
            title={chart.reason}
            tabIndex={0}
            aria-label={chart.reason}
          >
            <Info size={15} />
          </span>
          <button
            className="icon-button"
            onClick={() => setTable(!table)}
            title={table ? "Показать график" : "Показать значения"}
            aria-label={table ? "Показать график" : "Показать значения"}
          >
            {table ? <ChartNoAxesCombined size={17} /> : <Table2 size={17} />}
          </button>
        </div>
      </div>
      {table ? (
        <div className="chart-data">
          <table>
            <caption className="sr-only">Данные графика {chart.title}</caption>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Значение</th>
              </tr>
            </thead>
            <tbody>
              {chart.points.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td>{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : chart.type === "donut" ? (
        <div className="donut-layout">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={188}>
              <PieChart accessibilityLayer>
                <Pie
                  data={chart.points}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={64}
                  outerRadius={83}
                  paddingAngle={4}
                  cornerRadius={5}
                  stroke="none"
                >
                  {chart.points.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={format} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{compact(total)}</strong>
              <span>{chart.unit || "записей"} всего</span>
            </div>
          </div>
          <div className="chart-legend">
            {chart.points.map((p, i) => (
              <div key={p.label}>
                <span className="legend-label">
                  <i style={{ background: colors[i % colors.length] }} />
                  {p.label}
                </span>
                <strong>{total ? number((p.value / total) * 100) : 0}%</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cartesian-wrap">
          <ResponsiveContainer width="100%" height={230}>
            {chart.type === "line" ? (
              <AreaChart
                data={chart.points}
                margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#308f7c" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#308f7c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#728071", fontSize: 11 }}
                  minTickGap={34}
                  tickMargin={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#728071", fontSize: 11 }}
                  tickFormatter={compact}
                  tickCount={4}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={format} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={chart.title}
                  stroke="#238776"
                  strokeWidth={2.5}
                  fill={`url(#${id})`}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 3 }}
                  animationDuration={650}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chart.points}
                margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#728071", fontSize: 11 }}
                  interval={0}
                  tickFormatter={(v) =>
                    String(v).length > 16
                      ? String(v).slice(0, 14) + "…"
                      : String(v)
                  }
                  tickMargin={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#728071", fontSize: 11 }}
                  tickFormatter={compact}
                  tickCount={4}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#f5f7f2" }}
                  formatter={format}
                />
                <Bar
                  dataKey="value"
                  name={chart.title}
                  maxBarSize={54}
                  radius={[5, 5, 0, 0]}
                  animationDuration={650}
                >
                  {chart.points.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <div className="chart-foot">
        <span className="tiny-dot" />
        {chart.type === "line"
          ? "Динамика"
          : chart.type === "donut"
            ? "Доли категорий"
            : "Сравнение"}
        <span>Точек данных: {chart.points.length}</span>
      </div>
    </section>
  );
}
