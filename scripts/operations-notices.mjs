import "dotenv/config";
import { processOperationsNotices } from "../lib/operations/notifications/worker.js";

// This worker only sends persisted, due, claimed operational notices. Run once per scheduler tick.
const limit = process.argv[2] === undefined ? 25 : Number(process.argv[2]);
try {
  const result = await processOperationsNotices({ limit });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`Operations notice worker failed: ${error.code ?? "internal_error"}\n`);
  process.exitCode = 1;
}
