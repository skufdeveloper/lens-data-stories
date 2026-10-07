import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const transport = vi.hoisted(() => ({
  queue: [] as { status: number; data: unknown }[],
  requests: [] as {
    url: string;
    options: Record<string, unknown>;
    body: string;
  }[],
}));
vi.mock("node:https", () => ({
  default: {
    request: (
      url: string,
      options: Record<string, unknown>,
      callback: (
        response: EventEmitter & { statusCode: number; destroy: () => void },
      ) => void,
    ) => {
      const request = new EventEmitter() as EventEmitter & {
        end: (body: string) => void;
        destroy: (error: Error) => void;
      };
      request.destroy = (error) => request.emit("error", error);
      request.end = (body) => {
        transport.requests.push({ url, options, body });
        queueMicrotask(() => {
          const reply = transport.queue.shift();
          if (!reply) {
            request.emit("timeout");
            return;
          }
          const response = Object.assign(new EventEmitter(), {
            statusCode: reply.status,
            destroy: () => {},
          });
          callback(response);
          response.emit("data", Buffer.from(JSON.stringify(reply.data)));
          response.emit("end");
        });
      };
      return request;
    },
  },
}));
const token = (value: string) => ({
  status: 200,
  data: { access_token: value, expires_at: Date.now() + 1800000 },
});
const success = {
  status: 200,
  data: {
    choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
  },
};
const schema = z.object({ ok: z.boolean() });

describe("GigaChat REST adapter (mock transport; no live API calls)", () => {
  beforeEach(() => {
    vi.resetModules();
    transport.queue.length = 0;
    transport.requests.length = 0;
    vi.stubEnv("GIGACHAT_CREDENTIALS", "test-only-credentials");
    vi.stubEnv("GIGACHAT_ACCESS_TOKEN", "");
    vi.stubEnv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS");
  });
  it("obtains and caches OAuth token and uses GigaChat's response_format.schema", async () => {
    transport.queue.push(token("test-token"), success, success);
    const { generate } = await import("./gigachat");
    expect(await generate(schema, "system", { facts: [] })).toEqual({
      ok: true,
    });
    await generate(schema, "system", {});
    expect(
      transport.requests.filter((r) => r.url.includes("oauth")),
    ).toHaveLength(1);
    expect(transport.requests[0].body).toBe("scope=GIGACHAT_API_PERS");
    expect(transport.requests[0].options.headers).toMatchObject({
      Authorization: "Basic test-only-credentials",
      RqUID: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    const body = JSON.parse(transport.requests[1].body);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.schema.properties.ok.type).toBe("boolean");
    expect(transport.requests[1].options).not.toHaveProperty(
      "rejectUnauthorized",
      false,
    );
  });
  it("renews token on a 401 and retries once", async () => {
    transport.queue.push(
      token("old"),
      { status: 401, data: {} },
      token("new"),
      success,
    );
    const { generate } = await import("./gigachat");
    await generate(schema, "system", {});
    expect(transport.requests).toHaveLength(4);
    expect(transport.requests[3].options.headers).toMatchObject({
      Authorization: "Bearer new",
    });
  });
  it("surfaces malformed output and rate limits as recoverable errors", async () => {
    transport.queue.push(
      token("test"),
      {
        status: 200,
        data: { choices: [{ message: { content: '{"invented":true}' } }] },
      },
      { status: 429, data: {} },
    );
    const { generate } = await import("./gigachat");
    await expect(generate(schema, "system", {})).rejects.toThrow("формата");
    await expect(generate(schema, "system", {})).rejects.toThrow("лимита");
  });
  it("turns a timeout into a useful error without exposing secrets", async () => {
    const { generate } = await import("./gigachat");
    await expect(generate(schema, "system", {})).rejects.toThrow("недоступен");
  });
});
