"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { seatKey } from "./order_payload";

export function RegistrationQuestions({ questions, answers, setAnswer }) {
  return questions.map((q) => {
    const val = answers[q.id];
    if (q.type === "checkbox") {
      return (
        <label
          key={q.id}
          className="flex items-center gap-2.5 text-sm text-muted-foreground"
        >
          <Checkbox
            checked={!!val}
            onCheckedChange={(v) => setAnswer(q.id)(!!v)}
          />
          {q.label}
          {q.required ? <span className="text-red-400">*</span> : null}
        </label>
      );
    }
    return (
      <div key={q.id} className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          {q.label}
          {q.required ? <span className="ml-1 text-red-400">*</span> : null}
        </label>
        {q.type === "long" ? (
          <Textarea
            rows={2}
            value={val || ""}
            onChange={(e) => setAnswer(q.id)(e.target.value)}
          />
        ) : (
          <Input
            type={q.type === "number" ? "number" : "text"}
            value={val || ""}
            onChange={(e) => setAnswer(q.id)(e.target.value)}
          />
        )}
      </div>
    );
  });
}

export function DietaryInquiry({
  questions,
  daConfig,
  answers,
  inquiryKey,
  setAnswer,
  toggleInquiryMulti,
  accent,
}) {
  if (!questions.length) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-3">
      {daConfig?.inquiryTitle ? (
        <p className="text-sm font-semibold text-foreground">
          {daConfig.inquiryTitle}
        </p>
      ) : null}
      {daConfig?.inquiryDescription ? (
        <p className="-mt-1 text-xs text-text-secondary">
          {daConfig.inquiryDescription}
        </p>
      ) : null}
      {questions.map((q) => {
        const key = inquiryKey(q);
        const val = answers[key];
        return (
          <div key={q.id} className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {q.label}
              {q.required ? <span className="ml-1 text-red-400">*</span> : null}
            </label>
            <div className="flex flex-col gap-1.5">
              {(q.options || []).map((opt) => {
                const checked =
                  q.type === "multiselect"
                    ? Array.isArray(val) && val.includes(opt.label)
                    : val === opt.label;
                return (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground"
                  >
                    {q.type === "multiselect" ? (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleInquiryMulti(q, opt.label)}
                      />
                    ) : (
                      <span
                        role="radio"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => setAnswer(key)(opt.label)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAnswer(key)(opt.label);
                          }
                        }}
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border",
                          checked ? "border-transparent" : "border-border-strong",
                        )}
                        style={checked ? { backgroundColor: accent.color } : undefined}
                      >
                        {checked ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: accent.text }}
                          />
                        ) : null}
                      </span>
                    )}
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TicketQuestions({ questions, qty, ticketAnswers, setTicketAnswer }) {
  if (!questions.length) return null;

  return (
    <div className="space-y-4">
      {Array.from({ length: qty }).map((_, seat) => (
        <div
          key={seat}
          className="space-y-3 rounded-xl border border-border bg-surface-subtle p-3"
        >
          {qty > 1 ? (
            <p className="text-sm font-semibold text-foreground">
              Attendee {seat + 1} of {qty}
            </p>
          ) : null}
          {questions.map((q) => {
            const key = seatKey(seat, q.id);
            const val = ticketAnswers[key];
            if (q.type === "checkbox") {
              return (
                <label
                  key={q.id}
                  className="flex items-center gap-2.5 text-sm text-muted-foreground"
                >
                  <Checkbox
                    checked={!!val}
                    onCheckedChange={(v) => setTicketAnswer(seat, q.id)(!!v)}
                  />
                  {q.label}
                  {q.required ? <span className="text-red-400">*</span> : null}
                </label>
              );
            }
            return (
              <div key={q.id} className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {q.label}
                  {q.required ? <span className="ml-1 text-red-400">*</span> : null}
                </label>
                {q.type === "textarea" ? (
                  <Textarea
                    rows={2}
                    value={val || ""}
                    onChange={(e) => setTicketAnswer(seat, q.id)(e.target.value)}
                  />
                ) : q.type === "select" ? (
                  <Select
                    value={val || ""}
                    onValueChange={(v) => setTicketAnswer(seat, q.id)(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map((opt, oi) => (
                        <SelectItem key={oi} value={String(opt)}>
                          {String(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={
                      q.type === "number"
                        ? "number"
                        : q.type === "email"
                          ? "email"
                          : "text"
                    }
                    value={val || ""}
                    onChange={(e) => setTicketAnswer(seat, q.id)(e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
