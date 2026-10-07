import { z } from "zod";
import { parseFile, parseText } from "@/lib/parse";
import { sourceSchema } from "@/lib/types";
import { analyze } from "@/lib/server/analysis";
import { boundedBody, errorResponse, guard, json } from "@/lib/server/http";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    guard(request);
    const bytes = await boundedBody(request);
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await new Response(bytes, {
        headers: { "Content-Type": type },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new AppError("Выберите файл для загрузки.");
      return json(
        await analyze(await parseFile(file), form.get("demo") === "true"),
      );
    }
    const body = z
      .object({
        text: z.string().optional(),
        source: sourceSchema.optional(),
        demo: z.boolean().optional(),
      })
      .parse(JSON.parse(new TextDecoder().decode(bytes)));
    const source = body.source ?? parseText(body.text ?? "");
    return json(await analyze(source, body.demo));
  } catch (error) {
    return errorResponse(error);
  }
}
