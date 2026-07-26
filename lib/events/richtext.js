// Minimal markdown-lite parser for organizer-authored public-page copy.
//
// Deliberately small: headings, paragraphs, bullet/numbered lists, and the
// inline marks (**bold**, *italic*, [text](url)) that real event copy actually
// needs. Returns a plain node tree — no JSX — so this stays a pure lib and the
// component layer owns rendering (page_blocks.jsx).
//
//   parseRichText(src) -> [{ type: "heading"|"paragraph"|"list", … }]
//   node.spans         -> [{ text, bold?, italic?, href? }]

// Bold before italic so `**x**` never tokenizes as two italics.
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

// Drop anything that isn't a plain navigable link (javascript:, data:, …) —
// this copy is authored in the dashboard but rendered on a public page.
function safeHref(url) {
  const href = (url || "").trim();
  return SAFE_HREF.test(href) ? href : null;
}

/** Split one line into styled spans. Always returns at least one span. */
export function parseInline(line) {
  const text = line || "";
  const spans = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let match = INLINE_RE.exec(text);
  while (match) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) {
      spans.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      spans.push({ text: match[2], italic: true });
    } else {
      const href = safeHref(match[4]);
      spans.push(href ? { text: match[3], href } : { text: match[3] });
    }
    last = match.index + match[0].length;
    match = INLINE_RE.exec(text);
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text: "" }];
}

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;

/** Parse a markdown-lite source string into a flat list of block nodes. */
export function parseRichText(src) {
  const lines = String(src || "").split("\n");
  const nodes = [];
  let list = null; // open list node, flushed on any non-item line

  const closeList = () => {
    if (list) nodes.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      closeList();
      nodes.push({
        type: "heading",
        level: heading[1].length,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const ordered = bullet ? null : ORDERED_RE.exec(line);
    if (bullet || ordered) {
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) {
        closeList();
        list = { type: "list", ordered: isOrdered, items: [] };
      }
      list.items.push(parseInline((bullet || ordered)[1]));
      continue;
    }

    closeList();
    nodes.push({ type: "paragraph", spans: parseInline(line) });
  }

  closeList();
  return nodes;
}

/** True when the source has no renderable content. */
export function isRichTextEmpty(src) {
  return !String(src || "").trim();
}
