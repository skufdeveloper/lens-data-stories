"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { initialReport, salesSample, tasksSample } from "@/lib/samples";
import { number } from "@/lib/format";
import { Report } from "@/lib/types";
import { AskData } from "./ask-data";
import { DataChart, Sparkline } from "./charts";
import { SourceTable } from "./source-table";
import { Input, UploadDialog } from "./upload-dialog";

function Logo() {
  return (
    <div className="logo">
      <span className="brand-mark">
        <AudioLines size={24} strokeWidth={2.4} />
      </span>
      <span>
        lens<span className="logo-period">.</span>
      </span>
    </div>
  );
}

export function Workspace() {
  const [report, setReport] = useState<Report>(initialReport);
  const [tab, setTab] = useState<"overview" | "data">("overview");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<Report[]>([]);
  const [generation, setGeneration] = useState(0);
  const [exported, setExported] = useState(false);
  const lastInput = useRef<Input | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setConfigured(data.configured))
      .catch(() => {});
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, 2)), 1600);
    return () => clearInterval(timer);
  }, [loading]);

  async function analyze(input: Input, demo = false) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    lastInput.current = input;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setLoading(true);
    setStage(0);
    setError("");
    setSidebarOpen(false);
    setTab("overview");
    const timeout = setTimeout(() => controller.abort(), 58000);
    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if ("file" in input) {
        const form = new FormData();
        form.append("file", input.file);
        if (demo) form.append("demo", "true");
        body = form;
      } else {
        body = JSON.stringify({ ...input, demo });
        headers = { "Content-Type": "application/json" };
      }
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Не получилось прочитать отчёт.");
      if (abort.current !== controller) return;
      setReport(data);
      setGeneration((g) => g + 1);
      setRecent((reports) =>
        [
          data,
          ...reports.filter((r) => r.source.name !== data.source.name),
        ].slice(0, 4),
      );
    } catch (error) {
      if (abort.current !== controller) return;
      setError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "Анализ занял слишком много времени. Попробуйте ещё раз или откройте расчёты без ИИ.",
      );
    } finally {
      clearTimeout(timeout);
      if (abort.current === controller) setLoading(false);
    }
  }
  function switchReport(next: Report) {
    abort.current?.abort();
    abort.current = null;
    setReport(next);
    setGeneration((g) => g + 1);
    setLoading(false);
    setError("");
    setTab("overview");
    setSidebarOpen(false);
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `lens-${report.source.name.replace(/\.[^.]+$/, "")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }
  function openUpload() {
    setUploadOpen(true);
    setSidebarOpen(false);
  }
  const evidence = report.narrative.evidence
    .map((id) => report.profile.facts.find((f) => f.id === id))
    .filter(Boolean);
  const sourceIcon =
    report.source.kind === "text" ? (
      <FileText size={15} />
    ) : (
      <FileSpreadsheet size={15} />
    );
  const overview = () => {
    setTab("overview");
    setSidebarOpen(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        {sidebarOpen && (
          <button
            className="sidebar-scrim"
            aria-label="Закрыть меню"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <Logo />
          <button
            className="workspace-switch"
            onClick={() => setHelpOpen(true)}
          >
            <span className="workspace-avatar">L</span>
            <span>
              Моё пространство<small>Личное рабочее место</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <button className="new-report" onClick={openUpload}>
            <Plus size={17} />
            Новый отчёт<span>↗</span>
          </button>
          <div className="nav-caption">ПРОСТРАНСТВО</div>
          <nav aria-label="Главная навигация">
            <button
              className={tab === "overview" ? "nav-item active" : "nav-item"}
              onClick={overview}
            >
              <LayoutDashboard size={18} />
              Обзор
              <span className="active-dot" />
            </button>
            <button
              className={tab === "data" ? "nav-item active" : "nav-item"}
              onClick={() => {
                setTab("data");
                setSidebarOpen(false);
              }}
            >
              <Database size={18} />
              Исходные данные
            </button>
            <button
              className="nav-item"
              onClick={() => {
                overview();
                setTimeout(
                  () =>
                    document
                      .getElementById("ask-data")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  100,
                );
              }}
            >
              <Sparkles size={18} />
              Спросить данные
            </button>
          </nav>
          <div className="nav-caption reports-caption">
            ПОПРОБУЙТЕ НА ПРИМЕРЕ<span>02</span>
          </div>
          <button
            className={`sample-link ${report.source.name.includes("Продажи") ? "selected" : ""}`}
            disabled={loading}
            onClick={() => analyze({ source: salesSample() }, true)}
          >
            <span className="sample-dot green" />
            Продажи · сентябрь
            <FileSpreadsheet size={13} />
          </button>
          <button
            className={`sample-link ${report.source.name.includes("спринт") ? "selected" : ""}`}
            disabled={loading}
            onClick={() => analyze({ source: tasksSample() }, true)}
          >
            <span className="sample-dot lavender" />
            Командный спринт
            <FileSpreadsheet size={13} />
          </button>
          {recent.length > 0 && (
            <>
              <div className="nav-caption reports-caption">В ЭТОЙ СЕССИИ</div>
              {recent.map((r) => (
                <button
                  className="sample-link recent-link"
                  key={r.source.name}
                  onClick={() => switchReport(r)}
                >
                  <FileText size={14} />
                  <span>{r.source.name}</span>
                </button>
              ))}
            </>
          )}
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <div className="note-icon">
                <Layers size={20} />
                <span>✦</span>
              </div>
              <strong>
                Меньше таблиц.
                <br />
                Больше ясности.
              </strong>
              <p>
                Загрузите данные —<br />
                найдите свою историю.
              </p>
              <button onClick={openUpload}>
                Попробовать
                <ArrowUpRight size={15} />
              </button>
            </div>
            <button
              className="nav-item muted"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={17} />
              Как это работает
              <ArrowUpRight size={14} />
            </button>
            <div className="provider">
              <div className="provider-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <strong>GigaChat</strong>
                <span>
                  <i className={configured ? "online" : ""} />
                  {configured ? "Ключ настроен" : "Деморежим"}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label="Настройки GigaChat"
                onClick={() => setHelpOpen(true)}
              >
                <Settings2 size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="icon-button mobile-menu"
                aria-label="Открыть меню"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={21} />
              </button>
              <FolderOpen size={16} />
              <span>Моё пространство</span>
              <ChevronRight size={13} />
              <strong>
                {tab === "overview" ? "Обзор отчёта" : "Исходные данные"}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="private-label">
                <ShieldCheck size={14} />
                Без сохранения данных
              </span>
              <button
                className="profile-avatar"
                aria-label="О рабочем пространстве"
                onClick={() => setHelpOpen(true)}
              >
                L
              </button>
            </div>
          </header>
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">ИЗ ДАННЫХ — В РЕШЕНИЯ</div>
                <h1>
                  {tab === "overview"
                    ? "Ваши данные. Теперь со смыслом."
                    : "Вся история начинается здесь."}
                </h1>
                <p>
                  {tab === "overview"
                    ? "Главное, что нужно знать о вашем отчёте, — на одном экране."
                    : "Исходные значения, на которых построены графики и выводы."}
                </p>
              </div>
              <button className="button primary" onClick={openUpload}>
                <Plus size={17} />
                Загрузить данные
              </button>
            </div>
            <div className="report-toolbar">
              <div
                className="report-tabs"
                role="tablist"
                aria-label="Представление отчёта"
              >
                <button
                  className={tab === "overview" ? "active" : ""}
                  role="tab"
                  aria-selected={tab === "overview"}
                  onClick={() => setTab("overview")}
                >
                  <ChartNoAxesCombined size={16} />
                  Обзор
                </button>
                <button
                  className={tab === "data" ? "active" : ""}
                  role="tab"
                  aria-selected={tab === "data"}
                  onClick={() => setTab("data")}
                >
                  <TableIcon />
                  Данные
                  <span>
                    {report.source.kind === "table"
                      ? report.source.rows.length
                      : "TXT"}
                  </span>
                </button>
              </div>
              <button
                className="button export-button"
                onClick={download}
                disabled={loading}
              >
                {exported ? <Check size={15} /> : <ArrowDownToLine size={15} />}
                {exported ? "Скачано" : "Экспорт JSON"}
              </button>
            </div>
            <div className="source-bar">
              <div className="source-name">
                {sourceIcon}
                <span>{report.source.name}</span>
                <span className="source-badge">
                  {report.mode === "ai" ? "GigaChat" : "Демо · без ИИ"}
                </span>
              </div>
              <div className="source-period">
                <CalendarDays size={14} />
                <span>{report.profile.period}</span>
              </div>
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-card"
                role="alert"
              >
                <div className="error-symbol">!</div>
                <div>
                  <strong>Не получилось собрать новый отчёт</strong>
                  <p>{error}</p>
                  <div className="error-actions">
                    <button
                      onClick={() =>
                        lastInput.current && analyze(lastInput.current)
                      }
                    >
                      <RotateCcw size={13} />
                      Повторить
                    </button>
                    <button
                      onClick={() =>
                        lastInput.current && analyze(lastInput.current, true)
                      }
                    >
                      Открыть без ИИ
                    </button>
                    <button onClick={openUpload}>Другие данные</button>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label="Закрыть ошибку"
                  onClick={() => setError("")}
                >
                  <X size={17} />
                </button>
              </motion.div>
            )}
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="loading-state"
                  role="status"
                  aria-live="polite"
                >
                  <div className="loading-intro">
                    <div className="loading-orbit">
                      <Sparkles size={25} />
                    </div>
                    <h2>
                      {
                        [
                          "Знакомимся с вашим отчётом",
                          "Считаем то, что имеет значение",
                          "Собираем историю ваших данных",
                        ][stage]
                      }
                    </h2>
                    <p>
                      {configured
                        ? "GigaChat ищет наблюдения и выбирает визуализации"
                        : "Строим проверяемые графики и сводку без ИИ"}
                    </p>
                    <div className="progress-track">
                      <span style={{ width: `${[20, 52, 84][stage]}%` }} />
                    </div>
                    <div className="loading-steps">
                      {[
                        "Читаем данные",
                        "Находим связи",
                        "Готовим дашборд",
                      ].map((label, i) => (
                        <span className={stage >= i ? "done" : ""} key={label}>
                          {stage > i ? (
                            <Check size={13} />
                          ) : stage === i ? (
                            <LoaderCircle size={13} className="spin" />
                          ) : (
                            <i />
                          )}
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="skeleton-grid">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div className="skeleton skeleton-metric" key={i} />
                    ))}
                    <div className="skeleton skeleton-hero" />
                    <div className="skeleton skeleton-chart" />
                    <div className="skeleton skeleton-chart" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`${tab}-${generation}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {report.source.warnings.map((w) => (
                    <div className="warning-note" key={w}>
                      <CircleHelp size={15} />
                      {w}
                    </div>
                  ))}
                  {tab === "data" ? (
                    <SourceTable source={report.source} />
                  ) : (
                    <>
                      <section className="hero-insight">
                        <div className="hero-content">
                          <div className="hero-kicker">
                            <Sparkles size={15} />
                            <span>
                              {report.mode === "ai"
                                ? "ГЛАВНОЕ НАБЛЮДЕНИЕ · GIGACHAT"
                                : "ГЛАВНОЕ НАБЛЮДЕНИЕ"}
                            </span>
                            <span className="hero-status">
                              {report.mode === "ai"
                                ? "AI-инсайт"
                                : "Демосводка"}
                            </span>
                          </div>
                          <h2>{report.narrative.title}</h2>
                          <p>{report.narrative.body}</p>
                          <details className="hero-evidence">
                            <summary>
                              На чём основан вывод
                              <ArrowUpRight size={13} />
                            </summary>
                            {evidence.map((f) => (
                              <div key={f!.id}>
                                <b>{f!.origin}</b>
                                <span>{f!.text}</span>
                              </div>
                            ))}
                          </details>
                        </div>
                        <div className="hero-art" aria-hidden="true">
                          <div className="orbit orbit-one" />
                          <div className="orbit orbit-two" />
                          <div className="orbit orbit-three" />
                          <span className="orbit-core">✦</span>
                          <i className="star star-one">✧</i>
                          <i className="star star-two">✦</i>
                          <i className="star star-three">✧</i>
                          <div className="art-caption">
                            A LITTLE MORE CLARITY.
                          </div>
                        </div>
                      </section>
                      <section
                        className="metrics-grid"
                        aria-label="Основные показатели"
                      >
                        {report.profile.metrics.map((metric, i) => (
                          <div className="metric-card" key={metric.label}>
                            <div className="metric-heading">
                              <span>{metric.label}</span>
                              <span className="metric-index">0{i + 1}</span>
                            </div>
                            <div className="metric-main">
                              <strong>
                                {number(metric.value)}
                                <small>{metric.unit}</small>
                              </strong>
                              <Sparkline metric={metric} />
                            </div>
                            <p>
                              <span className="metric-check">
                                <Check size={10} />
                              </span>
                              {metric.detail}
                            </p>
                          </div>
                        ))}
                      </section>
                      <div className="section-heading">
                        <h2>
                          Картина в деталях
                          <span>Графиков: {report.profile.charts.length}</span>
                        </h2>
                        <span>
                          <span className="tiny-dot" />
                          {report.mode === "ai"
                            ? "Подобрано GigaChat"
                            : "Подобрано по типу данных"}
                        </span>
                      </div>
                      {report.profile.charts.length ? (
                        <div className="charts-grid">
                          {report.profile.charts.map((chart, i) => (
                            <DataChart
                              key={`${generation}-${chart.id}`}
                              chart={chart}
                              index={i}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="no-charts">
                          <ChartNoAxesCombined size={30} />
                          <h3>Здесь важнее слова, чем графики</h3>
                          <p>
                            В отчёте пока нет сопоставимых чисел. Сводка и
                            вопросы доступны. Для графиков добавьте таблицу или
                            строки вида «Завершённые задачи: 24».
                          </p>
                          <button onClick={() => setTab("data")}>
                            Посмотреть исходный текст
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                      <AskData key={generation} report={report} />
                      <button className="another-report" onClick={openUpload}>
                        <Upload size={18} />
                        <span>Новая история начинается с нового отчёта</span>
                        <strong>
                          Загрузить данные
                          <ArrowUpRight size={15} />
                        </strong>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <footer className="page-footer">
              <span className="footer-logo">lens.</span>
              <span>Чуть меньше шума. Чуть больше смысла.</span>
              <button onClick={() => setHelpOpen(true)}>
                Как это работает
                <ArrowUpRight size={12} />
              </button>
            </footer>
          </main>
        </div>
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onAnalyze={analyze}
          configured={configured}
        />
        <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content help-dialog">
              <Dialog.Close
                className="icon-button close-dialog"
                aria-label="Закрыть"
              >
                <X size={20} />
              </Dialog.Close>
              <div className="dialog-symbol">
                <BookOpen size={24} />
              </div>
              <Dialog.Title>Данные становятся понятнее</Dialog.Title>
              <Dialog.Description>
                Lens превращает ваш отчёт в короткую историю.
              </Dialog.Description>
              <div className="help-steps">
                <div>
                  <span>01</span>
                  <section>
                    <h3>Добавьте контекст</h3>
                    <p>
                      CSV, Excel (.xlsx) до 2 МБ или текст до 16 000 символов.
                      Для Excel читается первый непустой лист.
                    </p>
                  </section>
                </div>
                <div>
                  <span>02</span>
                  <section>
                    <h3>Посмотрите на главное</h3>
                    <p>
                      Числа рассчитываются кодом. GigaChat пишет сводку и
                      выбирает графики. Откройте источник под выводом, чтобы
                      проверить его.
                    </p>
                  </section>
                </div>
                <div>
                  <span>03</span>
                  <section>
                    <h3>Задайте свой вопрос</h3>
                    <p>
                      GigaChat выбирает подтверждённые факты. Если ответа нет,
                      Lens скажет об этом. Каждый вопрос рассматривается
                      отдельно.
                    </p>
                  </section>
                </div>
              </div>
              <div className="provider-notice">
                <Sparkles size={18} />
                <div>
                  <strong>
                    {configured
                      ? "GigaChat настроен на сервере"
                      : "Сейчас включён деморежим"}
                  </strong>
                  <p>
                    {configured
                      ? "Для AI-анализа загрузите данные. Встроенные примеры открываются без ИИ; их можно проанализировать кнопкой ниже."
                      : "Примеры и расчёты работают без ключа. Для AI-сводки и свободных вопросов добавьте GIGACHAT_CREDENTIALS в .env.local и перезапустите сервер."}
                  </p>
                </div>
              </div>
              {configured && (
                <button
                  className="button primary full"
                  onClick={() => {
                    setHelpOpen(false);
                    analyze({ source: report.source });
                  }}
                >
                  Проанализировать текущий отчёт с GigaChat
                  <Sparkles size={16} />
                </button>
              )}
              <p className="privacy-detail">
                Отчёты хранятся только в памяти этой вкладки и исчезают после
                обновления страницы. При AI-анализе факты передаются GigaChat.
                Экспорт JSON сохраняет копию на вашем устройстве.
              </p>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </MotionConfig>
  );
}

function TableIcon() {
  return <Database size={15} />;
}
