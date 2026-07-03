import type { TodaySnapshot } from "../shared/contracts";

declare global {
  interface Window {
    __LATCHBOARD_BOOTSTRAP__?: {
      token?: string;
      snapshot?: TodaySnapshot;
    };
  }
}

export function readBootstrapToken(): string {
  const token = window.__LATCHBOARD_BOOTSTRAP__?.token;
  if (!token) {
    throw new Error("missing bootstrap token");
  }
  return token;
}

export function readBootstrapSnapshot(): TodaySnapshot | null {
  return window.__LATCHBOARD_BOOTSTRAP__?.snapshot ?? null;
}

export async function fetchSnapshot(token: string): Promise<TodaySnapshot> {
  const response = await fetch("/api/snapshot", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`snapshot request failed with status ${response.status}`);
  }

  return response.json() as Promise<TodaySnapshot>;
}

export async function registerSafeLabel(token: string, workstreamId: string, safeTitle: string): Promise<TodaySnapshot> {
  const response = await fetch(`/api/workstreams/${encodeURIComponent(workstreamId)}/label`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ safeTitle })
  });

  if (!response.ok) {
    throw new Error(`label registration failed with status ${response.status}`);
  }

  const body = (await response.json()) as { snapshot: TodaySnapshot };
  return body.snapshot;
}
