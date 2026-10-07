import { describe, expect, it } from "vitest";
import { boundedBody, guard } from "./http";
describe("request boundaries", () => {
  it("accepts localhost Origin when Next binds to 0.0.0.0", () => {
    expect(() =>
      guard(
        new Request("http://0.0.0.0:3000/api/chat", {
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("rejects a foreign Origin", () => {
    expect(() =>
      guard(
        new Request("https://lens.example/api/chat", {
          headers: { origin: "https://evil.example", host: "lens.example" },
        }),
      ),
    ).toThrow("со страницы Lens");
  });
  it("bounds actual request bytes even without Content-Length", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: "abcdef",
    });
    await expect(boundedBody(request, 3)).rejects.toThrow("слишком большой");
  });
});
