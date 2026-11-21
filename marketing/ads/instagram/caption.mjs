// Rewrites a post's caption with an LLM into the house format: keyword-led hook, short body, CTA, five hashtags.
// Uses any OpenAI-compatible /chat/completions provider (the same DeepSeek setup as the Dash changelog service).
//
// Env: CAPTION_LLM_BASE_URL, CAPTION_LLM_API_KEY, CAPTION_LLM_MODEL (each falls back to its CHANGELOG_LLM_* twin)

import { products } from "./products.mjs";

const MAX_HASHTAGS = 5;
const MAX_CAPTION = 2200;
const MAX_HOOK = 125;

export function captionLlmConfig(env) {
  const baseUrl = env.CAPTION_LLM_BASE_URL || env.CHANGELOG_LLM_BASE_URL;
  const apiKey = env.CAPTION_LLM_API_KEY || env.CHANGELOG_LLM_API_KEY;
  const model = env.CAPTION_LLM_MODEL || env.CHANGELOG_LLM_MODEL;
  return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

const SYSTEM = `You write Instagram captions for Geiger Studio, a suite of business apps.
Instagram search indexes caption text, so captions must read naturally while carrying the search phrases people use.

Return only JSON: {"hook": string, "body": [string], "hashtags": [string]}

- hook: one line, max ${MAX_HOOK} characters, opens with the main search phrase for the post (e.g. "Event ticketing that..."). No emoji, no hashtags.
- body: 2 or 3 short sentences, each its own line. Plain, specific, benefit-first. Work in 1-2 related search phrases naturally. No emoji, no hashtags, no links.
- hashtags: exactly ${MAX_HASHTAGS}, CamelCase, no spaces. First the product brand tag, then 4 specific niche tags a buyer would search. Never generic tags like #love, #instagood, #business.
- Do not repeat the hook in the body, and leave out any call to action (one is added after the body). British spelling. No exclamation marks. No claims the source copy does not support.`;

function userPrompt(post, product) {
  return [
    `Product: ${post.productName}`,
    `Product page: ${product?.url || "https://geiger.studio"}`,
    `Creative hook: ${post.hook}`,
    `Creative body: ${post.body || ""}`,
    `Image alt text: ${post.alt || ""}`,
    `Brand tag to lead with: ${product?.tags?.[0] || "#GeigerStudio"}`,
    `Candidate niche tags: ${(product?.tags || post.hashtags || []).join(" ")}`,
  ].join("\n");
}

function endpoint(baseUrl) {
  const trimmed = String(baseUrl).trim().replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

function parseJson(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM returned no JSON");
  return JSON.parse(match[0]);
}

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const toTag = (value) => `#${clean(value).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;

// Assembles and validates the caption; throws so the caller can keep the original.
export function formatCaption(result, post) {
  const hook = clean(result.hook);
  const body = (Array.isArray(result.body) ? result.body : [result.body]).map(clean).filter(Boolean).slice(0, 3);
  const tags = [...new Set((result.hashtags || []).map(toTag).filter((tag) => tag.length > 2))].slice(0, MAX_HASHTAGS);
  if (!hook || hook.length > MAX_HOOK) throw new Error(`hook missing or over ${MAX_HOOK} characters`);
  if (!body.length) throw new Error("body missing");
  if (tags.length < 3) throw new Error("too few hashtags");
  if (/#|https?:\/\//.test([hook, ...body].join(" "))) throw new Error("hashtags or links leaked into the copy");
  const caption = [hook, body.join("\n"), post.cta, tags.join(" ")].filter(Boolean).join("\n\n");
  if (caption.length > MAX_CAPTION) throw new Error(`caption is ${caption.length} characters`);
  return caption;
}

export async function writeCaption(post, config) {
  const res = await fetch(endpoint(config.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(post, products[post.product]) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `LLM provider returned ${res.status}`);
  return formatCaption(parseJson(data?.choices?.[0]?.message?.content), post);
}

// Gives the post an LLM caption once; on any failure the original caption is kept.
export async function ensureCaption(post, config) {
  if (!config || post.captionSource === "llm") return;
  try {
    const caption = await writeCaption(post, config);
    post.originalCaption ??= post.caption;
    post.caption = caption;
    post.captionSource = "llm";
  } catch (error) {
    console.log(`  caption: kept the original for #${post.number} (${error.message})`);
  }
}
