// Webhook URL rules, shared by the endpoint form, the settings API and the dispatcher: public https only.

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

function ipv4Parts(host) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

function isPrivateIpv4([a, b]) {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

// IPv6 text -> 8 numeric groups (handles "::" and a trailing dotted IPv4), or null.
function ipv6Groups(host) {
  let h = host.toLowerCase().replace(/%.*$/, "");
  const dotted = h.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const p = ipv4Parts(dotted[2]);
    if (!p) return null;
    h = `${dotted[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

// Loopback, unique-local, link-local, multicast, and IPv4-embedded forms (mapped, compatible, NAT64, 6to4) of private IPv4.
function isPrivateIpv6(host) {
  const g = ipv6Groups(host);
  if (!g) return true;
  const tail4 = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
  if (g.slice(0, 6).every((x) => x === 0)) return isPrivateIpv4(tail4);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateIpv4(tail4);
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPrivateIpv4(tail4);
  if (g[0] === 0x2002) return isPrivateIpv4([g[1] >> 8, g[1] & 255, g[2] >> 8, g[2] & 255]);
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;
}

// True for a literal IP (v4 or v6) in a private, loopback or otherwise non-public range; used on DNS answers too.
export function isPrivateAddress(ip) {
  const host = String(ip || "").toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = ipv4Parts(host);
  if (v4) return isPrivateIpv4(v4);
  return host.includes(":") ? isPrivateIpv6(host) : true;
}

// { ok: true, value } with the normalised URL, or { ok: false, error } in words for the form.
export function checkWebhookUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, error: "Enter the URL that should receive events." };
  if (raw.length > 2048) return { ok: false, error: "That URL is too long." };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Enter a full URL, starting with https://" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Webhook URLs must use https://" };
  if (url.username || url.password) return { ok: false, error: "Remove the username and password from the URL." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, error: "Enter a full URL, starting with https://" };
  const internal =
    host === "localhost" ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    (ipv4Parts(host) && isPrivateIpv4(ipv4Parts(host))) ||
    (host.includes(":") && isPrivateIpv6(host));
  if (internal) return { ok: false, error: "Use a public address. Local and private network hosts can't be reached." };
  url.hash = "";
  return { ok: true, value: url.toString() };
}
