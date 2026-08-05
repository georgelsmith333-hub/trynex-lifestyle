import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Eye, ShieldAlert, Sparkles, X } from "lucide-react";

type GuidanceStep = {
  id: string;
  title: string;
  description: string;
};

type QualityIssue = {
  id: string;
  label: string;
  detail: string;
  tone: "warning" | "danger" | "info";
  actionLabel?: string;
  onAction?: () => void;
};

export function StudioFirstUseGuide({
  storageKey = "trynex-studio-v1-guide-dismissed",
  onDismiss,
  onFocusCanvas,
  steps,
}: {
  storageKey?: string;
  onDismiss?: () => void;
  onFocusCanvas?: () => void;
  steps: GuidanceStep[];
}) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(storageKey) !== "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!visible) window.localStorage.setItem(storageKey, "1");
  }, [storageKey, visible]);

  if (!visible) return null;

  return (
    <section className="rounded-3xl border border-violet-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5" aria-label="Design Studio guidance">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Quick start for the V1 Studio</p>
            <p className="text-sm leading-6 text-slate-600">
              Follow the reviewed workflow, or dismiss this helper and work directly on the canvas.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setVisible(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" aria-label="Dismiss studio guidance">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">Step {index + 1}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {onFocusCanvas && (
          <button type="button" onClick={onFocusCanvas} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Jump to canvas
          </button>
        )}
        <button type="button" onClick={() => setVisible(false)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
          Dismiss guide
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="sr-only" aria-hidden="true">
          Hidden dismiss callback
        </button>
      )}
    </section>
  );
}

export function StudioQualityBanner({
  issues,
  onShowPrintZone,
}: {
  issues: QualityIssue[];
  onShowPrintZone?: () => void;
}) {
  const summary = useMemo(() => {
    const danger = issues.filter((issue) => issue.tone === "danger").length;
    const warning = issues.filter((issue) => issue.tone === "warning").length;
    return { danger, warning };
  }, [issues]);

  if (issues.length === 0) return null;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm" aria-label="Print quality status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-700">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-950">
              Print check: {summary.danger > 0 ? "blocked until fixed" : "review before checkout"}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              {summary.warning > 0 ? `${summary.warning} warning${summary.warning === 1 ? "" : "s"}` : "No warnings"}{summary.danger > 0 ? ` and ${summary.danger} blocking issue${summary.danger === 1 ? "" : "s"}` : ""}.
            </p>
          </div>
        </div>
        {onShowPrintZone && (
          <button type="button" onClick={onShowPrintZone} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
            Show print zone
          </button>
        )}
      </div>
      <ul className="mt-4 grid gap-2">
        {issues.map((issue) => (
          <li key={issue.id} className={`rounded-2xl border p-3 ${issue.tone === "danger" ? "border-red-200 bg-white" : issue.tone === "warning" ? "border-amber-200 bg-white" : "border-sky-200 bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{issue.label}</p>
              {issue.actionLabel && issue.onAction && (
                <button type="button" onClick={issue.onAction} className="inline-flex min-h-10 items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2">
                  {issue.actionLabel}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{issue.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}