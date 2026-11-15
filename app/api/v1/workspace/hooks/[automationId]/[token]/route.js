import { isObject } from "@/lib/workspace/contracts";
import { processAfter } from "@/lib/workspace/process/after";
import { processService } from "@/lib/workspace/process/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 64 * 1024;
const fail = (status, code, message) => Response.json({ error: { status, code, message } }, { status, headers: { "Cache-Control": "no-store" } });

// Incoming webhook for an automation started by "A webhook is received"; the token in the address is the credential.
export async function POST(request, { params }) {
  const { automationId, token } = await params;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return fail(413, "too_large", "Send at most 64 KB.");
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return fail(413, "too_large", "Send at most 64 KB.");

  let payload = {};
  if (raw.trim()) {
    if ((request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      payload = Object.fromEntries(new URLSearchParams(raw));
    } else {
      try { payload = JSON.parse(raw); } catch { return fail(400, "invalid_json", "Send a JSON body (or a form)."); }
    }
  }
  if (!isObject(payload)) payload = { value: payload };

  let result;
  try {
    result = await processService.receiveHook({ automationId, token, payload });
  } catch (error) {
    console.error("[workspace.hook]", error);
    return fail(503, "unavailable", "Couldn't take the request right now. Try again shortly.");
  }
  if (!result) return fail(404, "not_found", "This webhook address isn't active.");
  processAfter(result, 20_000);
  return Response.json({ accepted: true, id: result.queued }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
