import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

const buckets = new Map<string, { count: number; reset: number }>();
export function guard(request: Request) {
  const origin = request.headers.get("origin");
  // Next may expose the bind address (0.0.0.0) in request.url behind a proxy.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (origin && new URL(origin).host !== host)
    throw new AppError("Запрос должен быть отправлен со страницы Lens.", 403);
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  for (const [key, value] of buckets)
    if (value.reset < now) buckets.delete(key);
  if (buckets.size > 10000)
    throw new AppError("Сервис занят. Попробуйте позже.", 429);
  const bucket = buckets.get(ip) ?? { count: 0, reset: now + 60000 };
  if (++bucket.count > 20)
    throw new AppError("Слишком много запросов. Подождите минуту.", 429);
  buckets.set(ip, bucket);
}

export async function boundedBody(
  request: Request,
  limit = 2300000,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError("Запрос слишком большой. Лимит файла — 2 МБ.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Запрос не содержит данных.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new AppError("Запрос слишком большой. Лимит файла — 2 МБ.", 413);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((c) => {
    output.set(c, offset);
    offset += c.length;
  });
  return output;
}

export const json = (value: unknown) =>
  NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
export function errorResponse(error: unknown) {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof ZodError || error instanceof SyntaxError
        ? 400
        : 500;
  const message =
    error instanceof AppError
      ? error.message
      : status === 400
        ? "Данные имеют неправильный формат. Проверьте файл или текст."
        : "Не получилось обработать отчёт. Попробуйте ещё раз.";
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
