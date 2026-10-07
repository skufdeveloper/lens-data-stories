"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal">
      <div className="brand-mark">l</div>
      <h1>Что-то пошло не по плану</h1>
      <p>Не получилось отобразить отчёт. Попробуем ещё раз?</p>
      <button className="button primary" onClick={reset}>
        Перезагрузить дашборд
      </button>
    </main>
  );
}
