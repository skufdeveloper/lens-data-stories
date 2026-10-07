import { z } from "zod";
import { sourceSchema } from "@/lib/types";
import { answer } from "@/lib/server/analysis";
import { boundedBody, errorResponse, guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    guard(request);
    const bytes = await boundedBody(request);
    const body = z
      .object({
        source: sourceSchema,
        question: z.string().trim().min(2).max(500),
        demo: z.boolean().optional(),
      })
      .parse(JSON.parse(new TextDecoder().decode(bytes)));
    return json(await answer(body.source, body.question, body.demo));
  } catch (error) {
    return errorResponse(error);
  }
}
