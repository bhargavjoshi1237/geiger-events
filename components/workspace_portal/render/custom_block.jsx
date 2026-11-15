"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { bridgeReply, bridgeRows, buildSrcdoc, readBridgeMessage } from "@/lib/workspace/code/bridge.js";
import { BlockFrame } from "./block_frame";
import { useList, useOpenRecord, usePortalView } from "./portal_context";

const newChannel = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// Organiser code in a sandboxed iframe (scripts only: no same-origin, forms, popups or top navigation). It asks the page
// for data through window.geiger and gets the same rows the viewer could see in a table block.
export function CustomBlock({ block, fill }) {
  const config = block.config;
  const { api, page, record, session, eventId, version } = usePortalView();
  const { list } = useList(config.source?.objectId);
  const openRecord = useOpenRecord();
  const { resolvedTheme } = useTheme();
  const frame = useRef(null);
  const [channel] = useState(newChannel);
  const [height, setHeight] = useState(config.height ?? 320);
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const srcDoc = useMemo(() => buildSrcdoc({
    html: config.html, css: config.css, js: config.js, channel,
    context: { event: { id: eventId, name: session?.event?.name ?? "" }, viewer: { signedIn: Boolean(session?.member) }, theme },
  }), [config.html, config.css, config.js, channel, eventId, session, theme]);

  useEffect(() => {
    const onMessage = async (event) => {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target) return;
      const message = readBridgeMessage(event.data, channel);
      if (!message) return;
      const reply = (result, error) => target.postMessage(bridgeReply(channel, message.id, result, error), "*");
      if (message.type === "resize") {
        setHeight(message.payload.auto ? Math.max(config.height ?? 320, message.payload.height) : message.payload.height);
        reply({ height: message.payload.height });
      } else if (message.type === "open") {
        openRecord({ id: message.payload.id, objectId: config.source?.objectId });
        reply({ opened: true });
      } else if (message.type === "navigate") {
        api.navigate?.(message.payload.slug);
        reply({ navigated: true });
      } else if (!config.source) {
        reply(null, "This block has no list. Choose one in its settings.");
      } else {
        const { data, error } = await api.blockData({ pageId: page?.id, blockId: block.id, params: message.payload, recordId: record?.id ?? null });
        if (error) reply(null, error.message);
        else reply({ rows: bridgeRows(list, data?.rows), total: data?.total ?? 0, list: list ? { key: list.key, name: list.name, plural: list.plural } : null });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [api, block.id, channel, config.height, config.source, list, openRecord, page, record]);

  const body = (
    <iframe ref={frame} key={version} title={config.title || "Custom section"} sandbox="allow-scripts" srcDoc={srcDoc} referrerPolicy="no-referrer"
      className="block w-full border-0 bg-transparent" style={{ height }} />
  );
  if (config.frame === false) return body;
  return <BlockFrame title={config.title} fill={fill}>{body}</BlockFrame>;
}
