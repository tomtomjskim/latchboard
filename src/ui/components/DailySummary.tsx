import type { TodaySnapshot } from "../../shared/contracts";

export function DailySummary({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <section className="daily-strip" aria-label="Daily summary">
      <h2>Daily Summary</h2>
      <div className="summary-grid">
        <div>
          <span>Unresolved</span>
          <strong>{snapshot.dailySummary.unresolved}</strong>
        </div>
        <div>
          <span>Verified</span>
          <strong>{snapshot.dailySummary.verifiedDone}</strong>
        </div>
        <div>
          <span>Carry-over</span>
          <strong>{snapshot.dailySummary.carryOver}</strong>
        </div>
        <div>
          <span>Parsed</span>
          <strong>{snapshot.sourceStatus.parsedLineCount}</strong>
        </div>
      </div>
    </section>
  );
}
