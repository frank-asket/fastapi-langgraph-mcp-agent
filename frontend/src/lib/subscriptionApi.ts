import { getApiUrl } from "@/lib/api";
import type { GetTokenFn } from "@/hooks/useWorkflowChat";

export type SubscriptionStatus = {
  enforcement_enabled: boolean;
  clerk_account: boolean;
  access_allowed: boolean;
  checks_jwt_claim: boolean;
  checks_entitlements_database: boolean;
  jwt_claim_name: string | null;
  jwt_claim_value: string | null;
  jwt_in_active_set: boolean | null;
  database_subscription_status: string | null;
  database_subscription_plan: string | null;
  database_updated_at: string | null;
  database_in_active_set: boolean | null;
  active_subscription_values: string[];
  manage_subscription_url: string | null;
  detail: string | null;
};

export async function fetchSubscriptionStatus(getToken?: GetTokenFn): Promise<SubscriptionStatus> {
  const headers: Record<string, string> = {};
  if (getToken) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${getApiUrl()}/account/subscription`, {
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text || res.statusText || "Could not load subscription status";
    if (res.status === 401) {
      msg +=
        " For production, use the same Clerk instance on the Next.js app (pk_live) and on the API (CLERK_JWT_ISSUER). Development keys (pk_test) must match a dev issuer—never mix with a live API URL.";
    }
    throw new Error(msg);
  }
  return (await res.json()) as SubscriptionStatus;
}
