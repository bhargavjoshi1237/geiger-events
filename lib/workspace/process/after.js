import { after } from "next/server";
import { automationEngine } from "./engine.js";

// Runs this event's queued automations once the response has gone out.
export function processAfter(context, budgetMs = 20_000) {
  if (!context?.projectId || !context?.eventId) return;
  after(async () => {
    try {
      await automationEngine.process({ projectId: context.projectId, eventId: context.eventId, budgetMs });
    } catch (error) {
      console.error("[workspace.automations]", error);
    }
  });
}
