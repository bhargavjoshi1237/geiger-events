import { lookup } from "node:dns/promises";
import { checkWebhookUrl, isPrivateAddress } from "../../api_webhooks/url.js";

// Fetches a public https address for workspace features (document images, webhook steps): no private hosts, size and time caps.
export class FetchRefused extends Error {}

async function guard(url) {
  const checked = checkWebhookUrl(url);
  if (!checked.ok) throw new FetchRefused(checked.error.replace("Webhook URLs", "Addresses").replace("receive events", "be fetched"));
  const host = new URL(checked.value).hostname.replace(/^\[|\]$/g, "");
  let answers;
  try {
    answers = await lookup(host, { all: true, verbatim: true });
  } catch (error) {
    throw new FetchRefused(`Couldn't find ${host}${error?.code ? ` (${error.code})` : ""}.`);
  }
  if (!answers.length || answers.some((answer) => isPrivateAddress(answer.address))) throw new FetchRefused(`${host} points at a private network.`);
  return checked.value;
}

async function readCapped(response, maxBytes) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new FetchRefused(`The response is larger than ${Math.round(maxBytes / 1024)} KB.`);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw new FetchRefused(`The response is larger than ${Math.round(maxBytes / 1024)} KB.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// GET follows up to 3 redirects, re-checking each hop; other methods never follow redirects.
export async function safeFetch(url, { method = "GET", headers = {}, body, maxBytes = 1024 * 1024, timeoutMs = 8000, redirects = 3 } = {}) {
  let target = await guard(url);
  for (let hop = 0; ; hop += 1) {
    let response;
    try {
      response = await fetch(target, { method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new FetchRefused(`No answer within ${timeoutMs / 1000} seconds.`);
      throw new FetchRefused(`Couldn't connect: ${error?.cause?.code ?? error?.message ?? "network error"}.`);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      response.body?.cancel().catch(() => {});
      if (method !== "GET" || hop >= redirects) throw new FetchRefused(`Redirected (HTTP ${response.status}).`);
      target = await guard(new URL(response.headers.get("location"), target).toString());
      continue;
    }
    return { status: response.status, ok: response.ok, contentType: (response.headers.get("content-type") ?? "").toLowerCase(), bytes: await readCapped(response, maxBytes) };
  }
}
