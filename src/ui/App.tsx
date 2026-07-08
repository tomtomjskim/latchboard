import "./styles.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TodaySnapshot } from "../shared/contracts";
import { fetchSnapshot, readBootstrapSnapshot, readBootstrapToken } from "./api";
import { DashboardShell, type SnapshotUpdatePulse } from "./components/DashboardShell";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import type { RefreshStatus } from "./format";
import { selectedFromSnapshot } from "./view-model";

const snapshotPollMs = 2000;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: TodaySnapshot; refreshStatus: RefreshStatus; liveUpdate?: SnapshotUpdatePulse };

function snapshotUpdatePulse(previous: TodaySnapshot | null, next: TodaySnapshot): SnapshotUpdatePulse | undefined {
  if (!previous) {
    return undefined;
  }

  const parsedDelta = next.sourceStatus.parsedLineCount - previous.sourceStatus.parsedLineCount;
  const observedDelta = next.workstreams.length - previous.workstreams.length;
  const pulseKey = [
    next.generatedAt,
    next.sourceStatus.parsedLineCount,
    next.workstreams.length,
    next.attention.length
  ].join(":");
  const changed =
    parsedDelta !== 0 ||
    observedDelta !== 0 ||
    next.attention.length !== previous.attention.length ||
    next.generatedAt !== previous.generatedAt;

  return changed ? { parsedDelta, observedDelta, changed, pulseKey } : undefined;
}

export function AppView({
  snapshot,
  refreshStatus = "ready",
  liveUpdate,
  token,
  onSnapshot
}: {
  snapshot: TodaySnapshot;
  refreshStatus?: RefreshStatus;
  liveUpdate?: SnapshotUpdatePulse;
  token?: string;
  onSnapshot?: (snapshot: TodaySnapshot) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    snapshot.attention[0]?.workstreamId ?? snapshot.workstreams[0]?.workstreamId ?? null
  );
  const selected = useMemo(() => selectedFromSnapshot(snapshot, selectedId), [snapshot, selectedId]);
  const attentionIds = useMemo(() => new Set(snapshot.attention.map((row) => row.workstreamId)), [snapshot.attention]);

  return (
    <DashboardShell
      snapshot={snapshot}
      selected={selected}
      attentionIds={attentionIds}
      refreshStatus={refreshStatus}
      snapshotPollMs={snapshotPollMs}
      liveUpdate={liveUpdate}
      token={token}
      onSnapshot={onSnapshot}
      onSelect={setSelectedId}
    />
  );
}

export function App({ pollMs = snapshotPollMs }: { pollMs?: number } = {}) {
  const [state, setState] = useState<LoadState>(() => {
    const snapshot = readBootstrapSnapshot();
    return snapshot ? { status: "ready", snapshot, refreshStatus: "ready" } : { status: "loading" };
  });
  const hasReadySnapshot = useRef(state.status === "ready");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    let token: string;
    try {
      token = readBootstrapToken();
      setToken(token);
    } catch {
      setState({ status: "error", message: "Snapshot unavailable" });
      return () => {
        cancelled = true;
      };
    }

    async function load(initial: boolean) {
      if (!initial && !cancelled) {
        setState((current) =>
          current.status === "ready"
            ? { ...current, refreshStatus: current.snapshot.sourceStatus.connected ? "refreshing" : "disconnected" }
            : current
        );
      }

      try {
        const snapshot = await fetchSnapshot(token);
        if (!cancelled) {
          hasReadySnapshot.current = true;
          setState((current) => {
            const previousSnapshot = current.status === "ready" ? current.snapshot : null;
            return {
              status: "ready",
              snapshot,
              refreshStatus: snapshot.sourceStatus.connected ? "ready" : "disconnected",
              liveUpdate: snapshotUpdatePulse(previousSnapshot, snapshot)
            };
          });
        }
      } catch {
        if (!cancelled && initial && !hasReadySnapshot.current) {
          setState({ status: "error", message: "Snapshot unavailable" });
        } else if (!cancelled) {
          setState((current) => (current.status === "ready" ? { ...current, refreshStatus: "retrying" } : current));
        }
      }
    }

    if (!hasReadySnapshot.current) {
      void load(true);
    }
    interval = setInterval(() => {
      void load(false);
    }, pollMs);

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [pollMs]);

  if (state.status === "loading") {
    return <LoadingSkeleton />;
  }

  if (state.status === "error") {
    return <main className="app app-state">{state.message}</main>;
  }

  return (
    <AppView
      snapshot={state.snapshot}
      refreshStatus={state.refreshStatus}
      liveUpdate={state.liveUpdate}
      token={token ?? undefined}
      onSnapshot={(snapshot) =>
        setState((current) => {
          const previousSnapshot = current.status === "ready" ? current.snapshot : null;
          return {
            status: "ready",
            snapshot,
            refreshStatus: "ready",
            liveUpdate: snapshotUpdatePulse(previousSnapshot, snapshot)
          };
        })
      }
    />
  );
}
