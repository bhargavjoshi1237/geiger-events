// Custom blocks: organiser HTML/CSS/JS in a sandboxed iframe (srcdoc, opaque origin, strict CSP) that talks to the page
// only through window.geiger, whose calls travel as postMessage requests the parent answers. Pure: browser and tests.
export const BRIDGE_VERSION = 1;
export const BRIDGE_CALLS = Object.freeze(["data", "open", "navigate", "resize"]);
export const CUSTOM_LIMITS = Object.freeze({ html: 100_000, css: 50_000, js: 100_000, minHeight: 80, maxHeight: 2000 });

const SCRIPT_HOSTS = "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net";
export const CUSTOM_CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${SCRIPT_HOSTS}`,
  `style-src 'unsafe-inline' ${SCRIPT_HOSTS} https://fonts.googleapis.com`,
  `font-src ${SCRIPT_HOSTS} https://fonts.gstatic.com data:`,
  "img-src https: data: blob:",
  "media-src https: data: blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

// Text that ends the element it sits in can't close it early.
const inScript = (text) => String(text ?? "").replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
const inStyle = (text) => String(text ?? "").replace(/<\//g, "<\\/");
const BACKSLASH = String.fromCharCode(92);
const json = (value) => JSON.stringify(value).replace(/</g, `${BACKSLASH}u003c`).split(String.fromCharCode(0x2028)).join(`${BACKSLASH}u2028`).split(String.fromCharCode(0x2029)).join(`${BACKSLASH}u2029`);

// The script that runs before the organiser's: window.geiger.{data, openRecord, navigate, resize}, plus auto-height.
function bridgeScript(channel, context) {
  return `(function () {
  var channel = ${json(channel)}, next = 0, waiting = {};
  function call(type, payload) {
    return new Promise(function (resolve, reject) {
      var id = ++next;
      waiting[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ geiger: ${BRIDGE_VERSION}, channel: channel, id: id, type: type, payload: payload === undefined ? null : payload }, "*");
    });
  }
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== parent || !data || data.geiger !== ${BRIDGE_VERSION} || data.channel !== channel || !waiting[data.id]) return;
    var pending = waiting[data.id];
    delete waiting[data.id];
    if (data.ok) pending.resolve(data.result); else pending.reject(new Error(data.error || "The page refused."));
  });
  var context = ${json(context)};
  window.geiger = Object.freeze({
    event: context.event, viewer: context.viewer, theme: context.theme,
    data: function (params) { return call("data", params || {}); },
    openRecord: function (id) { return call("open", { id: String(id) }); },
    navigate: function (slug) { return call("navigate", { slug: String(slug) }); },
    resize: function (height) { return call("resize", { height: Number(height) }); }
  });
  var last = 0;
  function measure() {
    var height = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(height - last) > 1) { last = height; call("resize", { height: height, auto: true }).catch(function () {}); }
  }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.documentElement);
  window.addEventListener("load", measure);
})();`;
}

// The whole iframe document. `context` is what the code may know: { event: { id, name }, viewer: { signedIn }, theme }.
export function buildSrcdoc({ html = "", css = "", js = "", channel, context = {} }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CUSTOM_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root{color-scheme:${context.theme === "dark" ? "dark" : "light"}}html,body{margin:0;padding:0}body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:${context.theme === "dark" ? "#f4f4f5" : "#111827"};background:transparent}</style>
<style>${inStyle(css)}</style>
<script>${inScript(bridgeScript(channel, context))}</script>
</head><body>${String(html ?? "")}
<script>${inScript(js)}</script>
</body></html>`;
}

// A message from a custom block's iframe, checked against its channel: { id, type, payload } or null.
export function readBridgeMessage(data, channel) {
  if (!data || typeof data !== "object" || data.geiger !== BRIDGE_VERSION || data.channel !== channel) return null;
  if (!Number.isInteger(data.id) || data.id < 1 || !BRIDGE_CALLS.includes(data.type)) return null;
  const payload = data.payload && typeof data.payload === "object" && !Array.isArray(data.payload) ? data.payload : {};
  if (data.type === "resize") {
    const height = Number(payload.height);
    if (!Number.isFinite(height)) return null;
    return { id: data.id, type: "resize", payload: { height: Math.min(CUSTOM_LIMITS.maxHeight, Math.max(CUSTOM_LIMITS.minHeight, Math.round(height))), auto: payload.auto === true } };
  }
  if (data.type === "open") return typeof payload.id === "string" && /^[0-9a-f-]{36}$/i.test(payload.id) ? { id: data.id, type: "open", payload: { id: payload.id.toLowerCase() } } : null;
  if (data.type === "navigate") return typeof payload.slug === "string" && /^[a-z0-9-]{1,63}$/.test(payload.slug) ? { id: data.id, type: "navigate", payload: { slug: payload.slug } } : null;
  const offset = Number.isInteger(payload.offset) && payload.offset >= 0 ? Math.min(payload.offset, 100_000) : 0;
  const search = typeof payload.search === "string" ? payload.search.slice(0, 100) : undefined;
  return { id: data.id, type: "data", payload: { offset, ...(search ? { search } : {}) } };
}

export const bridgeReply = (channel, id, result, error = null) => ({ geiger: BRIDGE_VERSION, channel, id, ok: !error, ...(error ? { error: String(error).slice(0, 300) } : { result }) });

// Viewer-scoped rows → what custom code gets: values and links by field key, only fields the viewer can see.
export function bridgeRows(list, rows) {
  const fields = list?.fields ?? [];
  return (rows ?? []).map((row) => {
    const values = {};
    const links = {};
    for (const field of fields) {
      const level = row.access?.fields?.[field.id];
      if (level === "hidden" || (row.access?.fields && !level)) continue;
      if (field.type === "link_record" || field.type === "link_event") links[field.key] = (row.links?.[field.id] ?? []).map((link) => ({ id: link.id, label: link.label ?? "" }));
      else values[field.key] = field.type === "lookup" || field.type === "rollup" ? row.computed?.[field.id] ?? null : row.values?.[field.id] ?? null;
    }
    return { id: row.id, number: row.number, title: row.title ?? "", status: row.status ?? null, values, links };
  });
}
