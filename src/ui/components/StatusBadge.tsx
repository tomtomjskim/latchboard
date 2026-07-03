import type { TodaySnapshot } from "../../shared/contracts";
import { refreshStatusLabel, sourceModeLabel, sourceModeTone, type RefreshStatus } from "../format";

export function SourceModeBadge({ snapshot }: { snapshot: TodaySnapshot }) {
  return <span className={`source-mode-badge ${sourceModeTone(snapshot)}`}>{sourceModeLabel(snapshot)}</span>;
}

export function RefreshStatusBadge({
  status,
  snapshot
}: {
  status: RefreshStatus;
  snapshot: TodaySnapshot;
}) {
  return <span className={`refresh-status ${status}`}>{refreshStatusLabel(status, snapshot)}</span>;
}
