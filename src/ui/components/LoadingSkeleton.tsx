export function LoadingSkeleton() {
  return (
    <main className="app loading-shell" aria-label="Loading dashboard skeleton">
      <div className="skeleton-topbar">
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-pill" />
        <span className="skeleton-line skeleton-pill" />
      </div>
      <div className="skeleton-command-row">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
      <div className="skeleton-grid">
        <section className="skeleton-panel skeleton-panel-large" />
        <section className="skeleton-panel" />
        <section className="skeleton-panel skeleton-panel-wide" />
      </div>
    </main>
  );
}
