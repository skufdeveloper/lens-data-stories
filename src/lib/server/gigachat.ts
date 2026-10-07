import { randomUUID } from "node:crypto";
import https from "node:https";
import { rootCertificates } from "node:tls";
import { z } from "zod";
import { AppError } from "./errors";

let cachedToken: { value: string; expires: number } | undefined;
let pendingToken: Promise<string> | undefined;
export const isAIConfigured = () =>
  Boolean(
    process.env.GIGACHAT_CREDENTIALS || process.env.GIGACHAT_ACCESS_TOKEN,
  );

// Custom CA support is scoped to these requests. TLS verification always remains enabled.
async function requestJson(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const ca = process.env.GIGACHAT_CA_CERT?.replaceAll("\\n", "\n");
    const request = https.request(
      url,
      {
        method: "POST",
        headers,
        ...(ca ? { ca: [...rootCertificates, ca] } : {}),
        timeout: 25000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            response.destroy();
            reject(
              new AppError(
                "Ответ GigaChat слишком большой. Попробуйте меньший отчёт.",
                502,
              ),
            );
          } else chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode ?? 502,
              data: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          } catch {
            reject(
              new AppError(
                "GigaChat вернул нечитаемый ответ. Попробуйте ещё раз.",
                502,
              ),
            );
          }
        });
        response.on("error", () =>
          reject(
            new AppError(
              "Соединение с GigaChat прервалось. Повторите запрос.",
              502,
            ),
          ),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error) => {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      const message = /CERT|ISSUER|VERIFY/.test(code)
        ? "Не удалось проверить сертификат GigaChat. Настройте GIGACHAT_CA_CERT на сервере."
        : "GigaChat не ответил вовремя или недоступен. Попробуйте ещё раз.";
      reject(new AppError(message, 503));
    });
    request.end(body);
  });
}

async function accessToken(): Promise<string> {
  if (process.env.GIGACHAT_ACCESS_TOKEN)
    return process.env.GIGACHAT_ACCESS_TOKEN;
  if (cachedToken && cachedToken.expires > Date.now() + 60000)
    return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const credentials = process.env.GIGACHAT_CREDENTIALS?.replace(
      /^Basic\s+/i,
      "",
    ).trim();
    if (!credentials) throw new AppError("GigaChat пока не подключён.", 503);
    const response = await requestJson(
      "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      new URLSearchParams({
        scope: process.env.GIGACHAT_SCOPE ?? "GIGACHAT_API_PERS",
      }).toString(),
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: randomUUID(),
        Authorization: `Basic ${credentials}`,
      },
    );
    if (response.status !== 200)
      throw new AppError(
        "Не удалось авторизоваться в GigaChat. Проверьте ключ и GIGACHAT_SCOPE на сервере.",
        503,
      );
    const token = z
      .object({ access_token: z.string().min(1), expires_at: z.number() })
      .safeParse(response.data);
    if (!token.success)
      throw new AppError("GigaChat вернул некорректный токен доступа.", 502);
    const expires =
      token.data.expires_at < 1e12
        ? token.data.expires_at * 1000
        : token.data.expires_at;
    cachedToken = { value: token.data.access_token, expires };
    return cachedToken.value;
  })();
  try {
    return await pendingToken;
  } finally {
    pendingToken = undefined;
  }
}

export async function generate<T extends z.ZodType>(
  schema: T,
  system: string,
  context: unknown,
): Promise<z.infer<T>> {
  const base = process.env.GIGACHAT_BASE_URL ?? "https://api.giga.chat/v1";
  if (!base.startsWith("https://"))
    throw new AppError("GIGACHAT_BASE_URL должен использовать HTTPS.", 503);
  const body = JSON.stringify({
    model: process.env.GIGACHAT_MODEL ?? "GigaChat-2",
    temperature: 0.15,
    max_tokens: 2200,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(context) },
    ],
    response_format: {
      type: "json_schema",
      schema: z.toJSONSchema(schema),
      strict: true,
    },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await requestJson(
      `${base.replace(/\/$/, "")}/chat/completions`,
      body,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
    );
    if (
      response.status === 401 &&
      attempt === 0 &&
      !process.env.GIGACHAT_ACCESS_TOKEN
    ) {
      cachedToken = undefined;
      continue;
    }
    if (response.status === 429)
      throw new AppError(
        "GigaChat достиг лимита запросов. Подождите немного и повторите.",
        429,
      );
    if (response.status < 200 || response.status >= 300)
      throw new AppError(
        "GigaChat отклонил запрос. Проверьте доступ к модели, квоту и настройки сервера.",
        502,
      );
    const envelope = z
      .object({
        choices: z
          .array(
            z.object({
              finish_reason: z.string().optional(),
              message: z.object({ content: z.string() }),
            }),
          )
          .min(1),
      })
      .safeParse(response.data);
    if (
      !envelope.success ||
      envelope.data.choices[0].finish_reason === "length"
    )
      throw new AppError(
        "Ответ GigaChat оказался неполным. Попробуйте сократить отчёт.",
        502,
      );
    try {
      return schema.parse(JSON.parse(envelope.data.choices[0].message.content));
    } catch {
      throw new AppError(
        "GigaChat вернул ответ неподходящего формата. Повторите анализ.",
        502,
      );
    }
  }
  throw new AppError("Не удалось обновить токен GigaChat.", 503);
}
