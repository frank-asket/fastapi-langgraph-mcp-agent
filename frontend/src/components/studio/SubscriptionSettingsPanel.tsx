"use client";

import type { GetTokenFn } from "@/hooks/useWorkflowChat";
import { fetchSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscriptionApi";
import { useCallback, useEffect, useState } from "react";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide " +
        (ok ? "bg-emerald-500/15 text-emerald-200/95" : "bg-amber-500/15 text-amber-100/95")
      }
    >
      {label}
    </span>
  );
}

export function SubscriptionSettingsPanel({
  getToken,
  hasClerk,
}: {
  getToken?: GetTokenFn;
  hasClerk: boolean;
}) {
  const [data, setData] = useState<SubscriptionStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const s = await fetchSubscriptionStatus(getToken);
      setData(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load subscription");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section
        id="subscription"
        className="scroll-mt-8 rounded-2xl border border-sc-line bg-sc-elev p-5"
      >
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Subscription</h2>
        <p className="mt-3 text-sm text-[#8c9a90]">Loading…</p>
      </section>
    );
  }

  if (err || !data) {
    return (
      <section id="subscription" className="scroll-mt-8 rounded-2xl border border-sc-line bg-sc-elev p-5">
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Subscription</h2>
        <p className="mt-3 text-sm text-amber-200/90">{err ?? "Unavailable"}</p>
      </section>
    );
  }

  const showTechnical =
    data.enforcement_enabled && (data.checks_jwt_claim || data.checks_entitlements_database);

  return (
    <section id="subscription" className="scroll-mt-8 rounded-2xl border border-sc-line bg-sc-elev p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-white">Subscription</h2>
        {data.enforcement_enabled && data.clerk_account ? (
          <StatusBadge ok={data.access_allowed} label={data.access_allowed ? "Active" : "Action needed"} />
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#8c9a90]">
        {data.detail ??
          (data.access_allowed
            ? "You can use Coach and the rest of the workspace."
            : "Your account does not meet the subscription requirement for this app.")}
      </p>

      {data.manage_subscription_url ? (
        <p className="mt-4">
          <a
            href={data.manage_subscription_url}
            className="inline-flex rounded-full border border-sc-gold/40 bg-sc-leaf/80 px-4 py-2 text-sm font-semibold text-[#f4faf7] transition hover:bg-sc-leaf"
            target="_blank"
            rel="noreferrer"
          >
            Manage subscription
          </a>
        </p>
      ) : data.enforcement_enabled && data.clerk_account && !data.access_allowed ? (
        <p className="mt-3 text-xs text-[#6a756d]">
          Ask your administrator to set{" "}
          <code className="rounded bg-sc-bg px-1 py-0.5 font-mono text-sc-gold/90">SUBSCRIPTION_MANAGE_URL</code>{" "}
          for a billing link, or complete checkout in your provider and sign out and back in.
        </p>
      ) : null}

      {!hasClerk ? (
        <p className="mt-3 text-xs text-[#6a756d]">
          Clerk is not configured on this frontend — subscription checks apply when the API authenticates you with a
          Clerk session.
        </p>
      ) : null}

      {showTechnical ? (
        <div className="mt-6 rounded-xl border border-sc-line/80 bg-sc-bg/40 px-3 py-3 text-xs text-[#9caaa0]">
          <p className="font-semibold uppercase tracking-wide text-[#6a756d]">How this deployment checks access</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {data.checks_jwt_claim ? (
              <li>
                Session claim{" "}
                <code className="font-mono text-sc-mist">{data.jwt_claim_name ?? "—"}</code>
                {data.jwt_claim_value != null ? (
                  <>
                    {" "}
                    = <code className="font-mono text-sc-mist">{data.jwt_claim_value}</code>
                    {data.jwt_in_active_set != null ? (
                      <span className={data.jwt_in_active_set ? " text-emerald-200/80" : " text-amber-200/80"}>
                        {" "}
                        ({data.jwt_in_active_set ? "matches" : "does not match"} active set)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-amber-200/80"> (missing in token — add via Clerk session template)</span>
                )}
              </li>
            ) : null}
            {data.checks_entitlements_database ? (
              <li>
                Database record: status{" "}
                <code className="font-mono text-sc-mist">{data.database_subscription_status ?? "—"}</code>
                {data.database_subscription_plan ? (
                  <>
                    , plan <code className="font-mono text-sc-mist">{data.database_subscription_plan}</code>
                  </>
                ) : null}
                {data.database_in_active_set != null ? (
                  <span className={data.database_in_active_set ? " text-emerald-200/80" : " text-amber-200/80"}>
                    {" "}
                    ({data.database_in_active_set ? "matches" : "does not match"} active set)
                  </span>
                ) : null}
                {data.database_updated_at ? (
                  <span className="text-[#6a756d]"> — updated {data.database_updated_at}</span>
                ) : null}
              </li>
            ) : null}
            {data.active_subscription_values.length > 0 ? (
              <li>Active values: {data.active_subscription_values.join(", ")}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
