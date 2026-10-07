"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  Upload,
  X,
} from "lucide-react";
import { MAX_FILE_BYTES, MAX_TEXT, Source } from "@/lib/types";
import { sampleText } from "@/lib/samples";

export type Input = { file: File } | { text: string } | { source: Source };
export function UploadDialog({
  open,
  onOpenChange,
  onAnalyze,
  configured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyze: (input: Input) => void;
  configured: boolean;
}) {
  const [tab, setTab] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  function upload(file?: File) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES)
      return setError("Файл больше 2 МБ. Выберите небольшой фрагмент отчёта.");
    if (!/\.(csv|tsv|xlsx|txt)$/i.test(file.name))
      return setError(
        "Нужен CSV, XLSX или TXT. Старый .xls сохраните как .xlsx.",
      );
    setError("");
    onAnalyze({ file });
    onOpenChange(false);
  }
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDrag(false);
    if (event.dataTransfer.files.length > 1)
      setError("Загрузите один отчёт за раз.");
    else upload(event.dataTransfer.files[0]);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content upload-dialog">
          <Dialog.Close
            className="icon-button close-dialog"
            aria-label="Закрыть"
          >
            <X size={20} />
          </Dialog.Close>
          <div className="dialog-symbol">
            <Upload size={25} />
          </div>
          <Dialog.Title>Начнём с ваших данных</Dialog.Title>
          <Dialog.Description>
            Одна таблица. Совсем другой взгляд на цифры.
          </Dialog.Description>
          <div
            className="input-tabs"
            role="tablist"
            aria-label="Способ загрузки"
          >
            <button
              role="tab"
              aria-selected={tab === "file"}
              className={tab === "file" ? "active" : ""}
              onClick={() => {
                setTab("file");
                setError("");
              }}
            >
              <FileSpreadsheet size={17} />
              Загрузить файл
            </button>
            <button
              role="tab"
              aria-selected={tab === "text"}
              className={tab === "text" ? "active" : ""}
              onClick={() => {
                setTab("text");
                setError("");
              }}
            >
              <FileText size={17} />
              Вставить текст
            </button>
          </div>
          {tab === "file" ? (
            <>
              <button
                className={`dropzone ${drag ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={drop}
                onClick={() => fileInput.current?.click()}
              >
                <div className="file-stack">
                  <FileSpreadsheet size={32} />
                </div>
                <strong>Перетащите отчёт сюда</strong>
                <span>
                  или <em>выберите файл</em> на компьютере
                </span>
                <small>CSV, XLSX, TXT · до 2 МБ · до 1 000 строк</small>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.tsv,.xlsx,.txt"
                className="sr-only"
                aria-label="Файл с данными"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </>
          ) : (
            <div className="text-upload">
              <label className="sr-only" htmlFor="report-text">
                Текст отчёта
              </label>
              <textarea
                id="report-text"
                value={text}
                maxLength={MAX_TEXT}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "Что произошло за эту неделю?\n\nВставьте заметки, отчёт команды или показатели в формате «Выручка: 120000 ₽»."
                }
                autoFocus
              />
              <div className="text-meta">
                <button onClick={() => setText(sampleText)}>
                  Вставить пример
                </button>
                <span>{text.length.toLocaleString("ru")} / 16 000</span>
              </div>
              <button
                className="button primary full"
                disabled={text.trim().length < 20}
                onClick={() => {
                  onAnalyze({ text });
                  onOpenChange(false);
                }}
              >
                Найти историю в данных
                <ArrowUpRight size={18} />
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <p className="upload-privacy">
            <LockKeyhole size={14} />
            {configured
              ? "Данные обрабатываются на сервере и передаются в GigaChat. Мы их не сохраняем."
              : "Деморежим: данные обрабатываются без ИИ и не сохраняются на сервере."}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
