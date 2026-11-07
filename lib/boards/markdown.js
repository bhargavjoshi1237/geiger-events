// Tiny, safe markdown subset for board posts: parses to plain data (never HTML) so rendering can't inject markup.
// Blocks: paragraphs, # headings (1-3), > quotes, - / 1. lists, ``` code fences. Inline: **bold**, *italic*, `code`, links.
// No lookbehind in the inline regex so older mobile Safari can still load the portal.

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function safeUrl(url) {
  const u = String(url || "").trim();
  return SAFE_URL.test(u) ? u : null;
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]{1,200}\]\([^\s)]+\))|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(\*[^*\s][^*\n]*?\*)/g;

// Inline text -> [{ t: "text"|"code"|"strong"|"em"|"link", ... }].
export function parseInline(text, depth = 0) {
  const src = String(text || "");
  const out = [];
  let last = 0;
  const re = new RegExp(INLINE.source, INLINE.flags);
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    const [whole, code, strong, link, bare, em] = m;
    if (code) {
      out.push({ t: "code", v: code.slice(1, -1) });
    } else if (strong) {
      const inner = strong.slice(2, -2);
      out.push({ t: "strong", c: depth < 2 ? parseInline(inner, depth + 1) : [{ t: "text", v: inner }] });
    } else if (link) {
      const close = link.indexOf("](");
      const label = link.slice(1, close);
      const href = safeUrl(link.slice(close + 2, -1));
      if (href) out.push({ t: "link", href, c: [{ t: "text", v: label }] });
      else out.push({ t: "text", v: whole });
    } else if (bare) {
      out.push({ t: "link", href: bare, c: [{ t: "text", v: bare }] });
    } else if (em) {
      const inner = em.slice(1, -1);
      out.push({ t: "em", c: depth < 2 ? parseInline(inner, depth + 1) : [{ t: "text", v: inner }] });
    }
    last = m.index + whole.length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

// Block structure -> [{ t: "p"|"h"|"quote"|"ul"|"ol"|"code", ... }].
export function parseMarkdown(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ t: "p", lines: para.map((l) => parseInline(l)) });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ t: "code", v: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ t: "h", level: heading[1].length, c: parseInline(heading[2]) });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      i -= 1;
      blocks.push({ t: "quote", lines: quote.map((l) => parseInline(l)) });
      continue;
    }
    const listRe = /^\s*([-*•]|\d+[.)])\s+(.*)$/;
    const item = listRe.exec(line);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const items = [];
      while (i < lines.length) {
        const next = listRe.exec(lines[i]);
        if (!next || /\d/.test(next[1]) !== ordered) break;
        items.push(parseInline(next[2]));
        i += 1;
      }
      i -= 1;
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
