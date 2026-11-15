import { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-singlefile-cjs-release-sync";

// Runs organiser code from automations in QuickJS (WASM): no network, timers, modules or host objects, with memory,
// time, source and output limits. Input arrives as plain JSON; the result goes back as JSON.
export const LIMITS = Object.freeze({ memoryBytes: 32 * 1024 * 1024, stackBytes: 512 * 1024, timeMs: 1000, sourceBytes: 65_536, outputBytes: 262_144, logLines: 50 });

let modulePromise = null;
const loadModule = () => {
  modulePromise ??= newQuickJSWASMModuleFromVariant(variant.default ?? variant).catch((error) => { modulePromise = null; throw error; });
  return modulePromise;
};

const byteLength = (text) => Buffer.byteLength(text, "utf8");

// The code becomes the body of an async function with record, event, trigger and steps in scope.
const wrap = (code) => `(async function (record, event, trigger, steps) {\n"use strict";\n${code}\n})(__input.record, __input.event, __input.trigger, __input.steps)
  .then((value) => { __done(JSON.stringify(value === undefined ? null : value) ?? "null"); }, (error) => { __fail(String(error) + (error && error.stack ? " | " + error.stack.trim() : "")); });`;

// Limit errors in plain words; anything else as QuickJS reported it.
function friendly(message, limits, deadline) {
  if (/out of memory/i.test(message)) return `It used more than ${limits.memoryBytes / 1024 / 1024} MB of memory.`;
  if (/interrupted/i.test(message) || Date.now() >= deadline) return `It ran longer than ${limits.timeMs / 1000} second.`;
  return String(message).slice(0, 2000);
}

function describe(vm, handle) {
  const value = vm.dump(handle);
  if (value && typeof value === "object") return value.message ? `${value.name ?? "Error"}: ${value.message}` : JSON.stringify(value);
  return String(value);
}

// → { ok: true, value, logs, ms } or { ok: false, error, logs, ms }.
export async function runCode(code, input = {}, { limits = LIMITS } = {}) {
  const started = Date.now();
  const logs = [];
  const finish = (out) => ({ ...out, logs, ms: Date.now() - started });
  if (typeof code !== "string" || !code.trim()) return finish({ ok: false, error: "There's no code to run." });
  if (byteLength(code) > limits.sourceBytes) return finish({ ok: false, error: `Code can be up to ${Math.round(limits.sourceBytes / 1024)} KB.` });
  const inputJson = JSON.stringify(input ?? {});

  const QuickJS = await loadModule();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(limits.memoryBytes);
  runtime.setMaxStackSize(limits.stackBytes);
  const deadline = Date.now() + limits.timeMs;
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));
  const vm = runtime.newContext();
  let settled = null;
  try {
    const define = (name, fn) => { const handle = vm.newFunction(name, fn); vm.setProp(vm.global, name, handle); handle.dispose(); };
    define("__done", (text) => { settled = { ok: true, text: vm.getString(text) }; });
    define("__fail", (text) => { settled = { ok: false, error: vm.getString(text) }; });
    const consoleObject = vm.newObject();
    const log = vm.newFunction("log", (...args) => {
      if (logs.length < limits.logLines) logs.push(args.map((arg) => { const value = vm.dump(arg); return typeof value === "string" ? value : JSON.stringify(value); }).join(" ").slice(0, 2000));
    });
    for (const name of ["log", "info", "warn", "error"]) vm.setProp(consoleObject, name, log);
    vm.setProp(vm.global, "console", consoleObject);
    log.dispose();
    consoleObject.dispose();
    const parsed = vm.evalCode(`globalThis.__input = JSON.parse(${JSON.stringify(inputJson)}); undefined;`);
    if (parsed.error) { const message = describe(vm, parsed.error); parsed.error.dispose(); return finish({ ok: false, error: message }); }
    parsed.value.dispose();

    const result = vm.evalCode(wrap(code), "automation.js");
    if (result.error) {
      const message = describe(vm, result.error);
      result.error.dispose();
      return finish({ ok: false, error: friendly(message, limits, deadline) });
    }
    result.value.dispose();
    // Async code: run queued promise jobs until the code settles or the time is up.
    while (!settled) {
      const jobs = runtime.executePendingJobs();
      if (jobs.error) { const message = describe(vm, jobs.error); jobs.error.dispose(); settled = { ok: false, error: message }; break; }
      if (jobs.value === 0) break;
    }
    if (!settled) return finish({ ok: false, error: Date.now() >= deadline ? `It ran longer than ${limits.timeMs / 1000} second.` : "The code never finished (it waits on something that can't happen here)." });
    if (!settled.ok) return finish({ ok: false, error: friendly(settled.error, limits, deadline) });
    if (byteLength(settled.text) > limits.outputBytes) return finish({ ok: false, error: `The result is larger than ${Math.round(limits.outputBytes / 1024)} KB.` });
    return finish({ ok: true, value: JSON.parse(settled.text) });
  } catch (error) {
    const message = String(error?.message ?? error);
    return finish({ ok: false, error: /out of memory|memory/i.test(message) ? `It used more than ${limits.memoryBytes / 1024 / 1024} MB of memory.` : message.slice(0, 500) });
  } finally {
    // After an out-of-memory error QuickJS can refuse to free cleanly; then the WASM module is dropped and rebuilt next time.
    try { vm.dispose(); runtime.dispose(); } catch { modulePromise = null; }
  }
}

const isPlain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// What a code step's return value means: { set: { field_key: value }, status, output }; anything else is just output.
export function codeResult(value) {
  if (!isPlain(value) || !("set" in value || "status" in value || "output" in value)) return { set: {}, status: null, output: value ?? null };
  if (value.set !== undefined && !isPlain(value.set)) throw new Error("`set` must be an object of field keys and values.");
  if (value.status !== undefined && value.status !== null && typeof value.status !== "string") throw new Error("`status` must be a status key.");
  const set = value.set ?? {};
  if (Object.keys(set).length > 150) throw new Error("Set up to 150 fields at once.");
  return { set, status: value.status ?? null, output: value.output ?? null };
}
