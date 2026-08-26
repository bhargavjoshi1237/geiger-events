"use client";

import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { compileTreeCss } from "@/lib/events/page_css";
import { buildBindingContext, resolveProps } from "@/lib/events/bindings";
import { COMPONENT_LIBRARY, UnknownComponent } from "./builder/components";

class ComponentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[page_render] component failed", this.props.type, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        This {this.props.type} block couldn&apos;t render.
      </div>
    );
  }
}

function RenderComponent({ node, event, accent, ctx }) {
  const meta = COMPONENT_LIBRARY[node.type];

  const props = useMemo(
    () => resolveProps(node.props || {}, ctx?.bindings),
    [node.props, ctx?.bindings],
  );

  if (!meta) return <UnknownComponent type={node.type} />;
  if (!meta.render) return null;

  const Renderer = meta.render;
  const children = Array.isArray(node.components)
    ? node.components.map((child) => (
        <ComponentNode key={child.id} node={child} event={event} accent={accent} ctx={ctx} />
      ))
    : null;

  return (
    <ComponentBoundary type={meta.label || node.type}>
      <Renderer props={props} event={event} accent={accent} ctx={ctx}>
        {children}
      </Renderer>
    </ComponentBoundary>
  );
}

function ComponentNode({ node, event, accent, ctx }) {
  const advanced = node.advanced || {};
  const wrapper = (
    <div
      data-ev={node.id}
      data-ev-kind="component"
      id={advanced.htmlId || undefined}
      className={advanced.cssClass || undefined}
    >
      <RenderComponent node={node} event={event} accent={accent} ctx={ctx} />
    </div>
  );
  return ctx?.wrapNode ? ctx.wrapNode(node, "component", wrapper) : wrapper;
}

function ColumnNode({ node, event, accent, ctx }) {
  const advanced = node.advanced || {};
  const wrapper = (
    <div
      data-ev={node.id}
      data-ev-kind="column"
      id={advanced.htmlId || undefined}
      className={advanced.cssClass || undefined}
    >
      {(node.components || []).map((child) => (
        <ComponentNode key={child.id} node={child} event={event} accent={accent} ctx={ctx} />
      ))}
      {ctx?.renderColumnAffordance ? ctx.renderColumnAffordance(node) : null}
    </div>
  );
  return ctx?.wrapNode ? ctx.wrapNode(node, "column", wrapper) : wrapper;
}

function RowNode({ node, event, accent, ctx }) {
  const wrapper = (
    <div data-ev={node.id} data-ev-kind="row">
      {(node.columns || []).map((child) => (
        <ColumnNode key={child.id} node={child} event={event} accent={accent} ctx={ctx} />
      ))}
    </div>
  );
  return ctx?.wrapNode ? ctx.wrapNode(node, "row", wrapper) : wrapper;
}

function SectionNode({ node, event, accent, ctx }) {
  const advanced = node.advanced || {};
  const wrapper = (
    <section
      data-ev={node.id}
      data-ev-kind="section"
      id={advanced.htmlId || advanced.anchor || undefined}
      className={advanced.cssClass || undefined}
    >
      <div className="ev-inner">
        {(node.rows || []).map((child) => (
          <RowNode key={child.id} node={child} event={event} accent={accent} ctx={ctx} />
        ))}
      </div>
    </section>
  );
  return ctx?.wrapNode ? ctx.wrapNode(node, "section", wrapper) : wrapper;
}

export function PageTree({
  tree,
  event,
  accent,
  slots = null,
  runScripts = true,
  editing = null,
  brand = null,
}) {
  const css = useMemo(() => compileTreeCss(tree), [tree]);
  const bindings = useMemo(
    () => buildBindingContext(event, brand || {}),
    [event, brand],
  );

  const ctx = useMemo(
    () => ({
      bindings,
      slots,
      runScripts,
      wrapNode: editing?.wrapNode || null,
      renderColumnAffordance: editing?.renderColumnAffordance || null,
      editing: !!editing,
    }),
    [bindings, slots, runScripts, editing],
  );

  if (!tree?.sections?.length) return null;

  return (
    <div className="ev-tree" style={{ "--ev-accent": accent?.color || "currentColor" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {tree.sections.map((section) => (
        <SectionNode
          key={section.id}
          node={section}
          event={event}
          accent={accent}
          ctx={ctx}
        />
      ))}
    </div>
  );
}

export default PageTree;
