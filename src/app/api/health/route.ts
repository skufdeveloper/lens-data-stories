import { isAIConfigured } from "@/lib/server/gigachat";
import { json } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export function GET() {
  return json({ provider: "GigaChat", configured: isAIConfigured() });
}
