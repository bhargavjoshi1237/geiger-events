import { handleOperationsRequest } from "@/lib/operations/server/commands";
import { OperationsError } from "@/lib/operations/errors";
import { authorizeWorker, processOperationsNotices } from "@/lib/operations/notifications/worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  return handleOperationsRequest(async () => {
    if (!authorizeWorker(request.headers.get("authorization"))) {
      throw new OperationsError("unauthenticated", 401, "Worker authentication required.");
    }
    // Three provider timeouts fit the bounded scheduler runtime; CLI handles larger batches.
    return processOperationsNotices({ limit: 3 });
  });
}
