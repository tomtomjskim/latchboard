import type { TodaySnapshot } from "../shared/contracts";

declare global {
  interface Window {
    __LATCHBOARD_BOOTSTRAP__?: {
      token?: string;
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

export async function fetchSnapshot(token: string): Promise<TodaySnapshot> {
  const response = await fetch("/api/snapshot", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`snapshot request failed with status ${response.status}`);
  }

  return response.json() as Promise<TodaySnapshot>;
}
