import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { normaliseCode } from "@/lib/workspace/documents/model";
import { documentStore } from "@/lib/workspace/documents/store";

// Public certificate check: no sign-in, never indexed, never cached.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lookup(id, code) {
  const canonical = normaliseCode(code);
  if (!UUID.test(String(id ?? "")) || !canonical) return { canonical, certificate: null };
  try {
    return { canonical, certificate: await documentStore.publicCertificate(id.toLowerCase(), canonical) };
  } catch (error) {
    console.error("[workspace] certificate check failed", error);
    return { canonical, certificate: null, failed: true };
  }
}

export async function generateMetadata() {
  return { title: "Certificate check", robots: { index: false, follow: false } };
}

const formatDate = (value) => (value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "");

export default async function CertificateCheckPage({ params }) {
  const { id, code } = await params;
  const { canonical, certificate, failed } = await lookup(id, decodeURIComponent(code ?? ""));
  const revoked = Boolean(certificate?.revokedAt);
  const Icon = !certificate ? ShieldQuestion : revoked ? ShieldAlert : ShieldCheck;
  const tone = !certificate ? "text-text-secondary" : revoked ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-background px-4 py-12 text-foreground sm:py-20">
      <div className="w-full max-w-lg space-y-6">
        <div className="rounded-xl border border-border bg-surface-card p-6">
          <div className="flex items-start gap-3">
            <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${tone}`} aria-hidden />
            <div className="min-w-0 space-y-1">
              <h1 className="text-lg font-semibold">
                {!certificate ? (failed ? "Couldn't check this certificate" : "No certificate with this code") : revoked ? "This certificate was revoked" : "This certificate is valid"}
              </h1>
              <p className="text-sm text-text-secondary">
                {!certificate
                  ? (failed ? "Try again in a moment." : "Check the code on the certificate. It looks like ABCD-EFGH-JKLM.")
                  : revoked
                    ? `Revoked on ${formatDate(certificate.revokedAt)}${certificate.revokedReason ? `: ${certificate.revokedReason}` : "."}`
                    : `Issued by ${certificate.eventName || "the organisers"} on ${formatDate(certificate.issuedAt)}.`}
              </p>
            </div>
          </div>

          {certificate ? (
            <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
              {[
                ["Certificate", certificate.title],
                ["Issued to", certificate.holder],
                ...(certificate.data ?? []).map((item) => [item.label, item.value]),
                ["Event", certificate.eventName],
                ["Issued", formatDate(certificate.issuedAt)],
                ["Code", certificate.code],
              ].filter(([, value]) => value).map(([label, value], index) => (
                <div key={`${label}-${index}`} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2.5">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className={label === "Code" ? "font-mono" : "break-words"}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : canonical ? (
            <p className="mt-4 font-mono text-sm text-text-secondary">{canonical}</p>
          ) : null}
        </div>
        <p className="text-center text-xs text-text-tertiary">Certificate checks are provided by Geiger Events for the event&apos;s organisers.</p>
      </div>
    </main>
  );
}
