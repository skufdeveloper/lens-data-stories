"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Source } from "@/lib/types";
export function SourceTable({ source }: { source: Source }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  if (source.kind === "text")
    return (
      <section className="source-card">
        <div className="card-heading">
          <div>
            <h3>Исходный текст</h3>
            <p>{source.name}</p>
          </div>
        </div>
        <pre className="raw-text">{source.text}</pre>
      </section>
    );
  const rows = source.rows
    .map((cells, index) => ({ cells, index }))
    .filter((row) =>
      row.cells.some((c) =>
        String(c ?? "")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const current = Math.min(page, pages - 1);
  return (
    <section className="source-card">
      <div className="card-heading">
        <div>
          <h3>Данные, на которых всё построено</h3>
          <p>
            {source.rows.length} строк · {source.columns.length} столбцов
          </p>
        </div>
        <label className="table-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Поиск по таблице"
            aria-label="Поиск по таблице"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Исходные данные: {source.name}</caption>
          <thead>
            <tr>
              <th>#</th>
              {source.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(current * 15, (current + 1) * 15)
              .map(({ cells, index }) => (
                <tr key={index}>
                  <td className="row-index">{index + 1}</td>
                  {cells.map((c, j) => (
                    <td key={j}>
                      {c === null ? (
                        <span className="empty-cell">—</span>
                      ) : (
                        String(c)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="table-empty">
            Ничего не найдено. Попробуйте другой запрос.
          </div>
        )}
      </div>
      <div className="table-pagination">
        <span>Найдено {rows.length} строк</span>
        <div>
          <button
            className="icon-button"
            disabled={!current}
            onClick={() => setPage(current - 1)}
            aria-label="Предыдущая страница"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="icon-button"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
            aria-label="Следующая страница"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
