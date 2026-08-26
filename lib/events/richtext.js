
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function safeHref(url) {
  const href = (url || "").trim();
  return SAFE_HREF.test(href) ? href : null;
}

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

export function parseRichText(src) {
  const lines = String(src || "").split("\n");
  const nodes = [];
  let list = null;

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

export function isRichTextEmpty(src) {
  return !String(src || "").trim();
}
