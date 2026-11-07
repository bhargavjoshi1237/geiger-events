"use client";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@geiger/ui/accordion";
import { Badge } from "@geiger/ui/badge";
import {
  API_SCOPES,
  AUTO_DISABLE_AFTER,
  DELIVERY_TIMEOUT_MS,
  MAX_ATTEMPTS,
  RATE_LIMIT,
  WEBHOOK_EVENT_TYPES,
} from "@/lib/api_webhooks/catalog";
import { API_ENDPOINTS, API_ERRORS, DOC_FACTS, DOC_SNIPPETS } from "@/lib/api_webhooks/docs";
import { CodeBlock, CopyField } from "./code_block";

function Prose({ children }) {
  return <div className="space-y-2 text-sm leading-relaxed text-text-secondary">{children}</div>;
}

function Code({ children }) {
  return <code className="rounded bg-surface-card px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

function RefTable({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-card text-xs text-text-secondary">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-text-secondary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsTab() {
  return (
    <div className="space-y-5">
      <SectionCard title="Authentication" description="Every request needs an API key from the API keys tab.">
        <Prose>
          <p>
            Send the key as a bearer token: <Code>Authorization: Bearer gev_live_…</Code>. A key only ever sees this
            project, and only what its permissions allow. Keys belong on your server; never ship one in a browser or
            mobile app.
          </p>
        </Prose>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Base URL</p>
            <CopyField value={DOC_FACTS.baseUrl} copyMessage="Base URL copied" />
          </div>
          <CodeBlock label="Example" code={DOC_SNIPPETS.curl} />
        </div>
        <div className="mt-4">
          <RefTable
            head={["Permission", "Allows"]}
            rows={API_SCOPES.map((s) => [<Code key="k">{s.key}</Code>, s.description])}
          />
        </div>
      </SectionCard>

      <SectionCard title="Endpoints" description="All responses are JSON. Times are ISO 8601 in UTC; amounts are decimals in the event's currency.">
        <RefTable
          head={["Endpoint", "Permission", "Parameters", "Returns"]}
          rows={API_ENDPOINTS.map((e) => [
            <span key="p" className="whitespace-nowrap font-mono text-xs text-foreground">
              <Badge variant="outline" className="mr-1.5 font-mono">
                {e.method}
              </Badge>
              {e.path}
            </span>,
            <Code key="s">{e.scope}</Code>,
            <span key="q" className="font-mono text-xs">
              {e.params || "—"}
            </span>,
            e.description,
          ])}
        />
        <div className="mt-4">
          <CodeBlock label="Check a guest in" code={DOC_SNIPPETS.checkin} />
        </div>
      </SectionCard>

      <SectionCard title="Pagination" description="Lists are newest first and use cursors, so pages stay stable while data changes.">
        <Prose>
          <p>
            Pass <Code>limit</Code> (default {DOC_FACTS.pageDefault}, up to {DOC_FACTS.pageMax}). When{" "}
            <Code>has_more</Code> is true, ask for the next page with <Code>starting_after</Code> set to{" "}
            <Code>next_cursor</Code>. To sync changes, keep the time of your last run and pass it as{" "}
            <Code>updated_since</Code> (or <Code>since</Code> for check-ins).
          </p>
        </Prose>
        <CodeBlock className="mt-4" label="List response" code={DOC_SNIPPETS.list} />
      </SectionCard>

      <SectionCard title="Errors and rate limits">
        <Prose>
          <p>Errors use HTTP status codes and the same body shape everywhere:</p>
        </Prose>
        <CodeBlock className="mt-3" label="Error response" code={DOC_SNIPPETS.error} />
        <div className="mt-4">
          <RefTable
            head={["Status", "Codes", "Meaning"]}
            rows={API_ERRORS.map((e) => [
              <span key="s" className="font-mono text-xs text-foreground">
                {e.status}
              </span>,
              <span key="c" className="font-mono text-xs">
                {e.codes}
              </span>,
              e.meaning,
            ])}
          />
        </div>
        <Prose>
          <p className="mt-4">
            Each key can make {RATE_LIMIT.limit} requests a minute. Every response carries{" "}
            <Code>X-RateLimit-Limit</Code>, <Code>X-RateLimit-Remaining</Code> and <Code>X-RateLimit-Reset</Code>{" "}
            (unix seconds); past the limit you get a 429 with <Code>Retry-After</Code>.
          </p>
        </Prose>
      </SectionCard>

      <SectionCard title="Webhooks" description="How Geiger sends events to your endpoints.">
        <Prose>
          <p>
            Events are sent in a daily batch, so allow up to a day before one arrives; test sends, retries and
            replays from this screen go out immediately.
          </p>
          <p>
            Each event is POSTed as JSON to every enabled endpoint subscribed to its type. Answer with any 2xx within{" "}
            {DELIVERY_TIMEOUT_MS / 1000} seconds; do slow work after responding. Redirects aren&apos;t followed.
          </p>
          <p>
            Anything else is retried {MAX_ATTEMPTS - 1} times, after {DOC_FACTS.retrySchedule}, then marked failed. You
            can retry or replay any delivery from the Deliveries tab. An endpoint that fails {AUTO_DISABLE_AFTER} times
            in a row with no success for a day is turned off; turn it back on from the Webhooks tab.
          </p>
          <p>
            Deliveries can arrive more than once and out of order. Use <Code>Geiger-Event-Id</Code> (the same as the
            body&apos;s <Code>id</Code>) to skip events you&apos;ve already handled, and <Code>data.updated_at</Code>{" "}
            to keep the newest state.
          </p>
        </Prose>
        <CodeBlock className="mt-4" label="A delivery" code={DOC_SNIPPETS.envelope} />
      </SectionCard>

      <SectionCard title="Verifying signatures" description="Reject anything whose signature doesn't match your endpoint's signing secret.">
        <Prose>
          <p>
            <Code>Geiger-Signature</Code> is <Code>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</Code>, where v1 is the
            HMAC-SHA256 of <Code>{"`${t}.${rawBody}`"}</Code> keyed with the endpoint&apos;s signing secret. Compare in
            constant time and reject timestamps more than five minutes old.
          </p>
        </Prose>
        <CodeBlock className="mt-4" label="Node.js (Express)" code={DOC_SNIPPETS.verify} maxHeight="max-h-[28rem]" />
      </SectionCard>

      <SectionCard title="Event types" description="The data field holds the same object the REST API returns.">
        <Accordion type="single" collapsible className="w-full">
          {WEBHOOK_EVENT_TYPES.map((t) => (
            <AccordionItem key={t.type} value={t.type} className="border-border">
              <AccordionTrigger className="text-left text-sm text-foreground hover:no-underline">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-[13px]">{t.type}</span>
                  <span className="text-xs font-normal text-text-secondary">{t.description}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <CodeBlock label="data" code={JSON.stringify(t.sample, null, 2)} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionCard>
    </div>
  );
}
