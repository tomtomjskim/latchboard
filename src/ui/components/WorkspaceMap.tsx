import { useEffect, useMemo, useState } from "react";
import type { TodaySnapshot, WorkstreamSummary } from "../../shared/contracts";
import { observedEmptyLabel } from "../format";
import { childScopeCountLabel, workspaceGroupsFor } from "../view-model";
import { WorkstreamRowButton } from "./ScopeChrome";

type WorkstreamFilter = "all" | "active" | "idle" | "needs_label";
type WorkstreamSort = "activity" | "recent" | "repo";

const activeActivityStates = new Set(["running_tool", "waiting_for_input", "tool_error"]);
const activeRawStates = new Set(["running", "waiting"]);

function needsSafeLabel(workstream: WorkstreamSummary): boolean {
  return workstream.displayHints?.includes("needs_safe_label") ?? false;
}

function isActiveWorkstream(workstream: WorkstreamSummary): boolean {
  return activeRawStates.has(workstream.rawState) || activeActivityStates.has(workstream.activity?.state ?? "");
}

function isIdleWorkstream(workstream: WorkstreamSummary): boolean {
  return !isActiveWorkstream(workstream) && workstream.activity?.state === "idle";
}

function filterWorkstream(workstream: WorkstreamSummary, filter: WorkstreamFilter): boolean {
  if (filter === "active") {
    return isActiveWorkstream(workstream);
  }
  if (filter === "idle") {
    return isIdleWorkstream(workstream);
  }
  if (filter === "needs_label") {
    return needsSafeLabel(workstream);
  }
  return true;
}

function activityRank(workstream: WorkstreamSummary): number {
  if (isActiveWorkstream(workstream)) {
    return 0;
  }
  if (needsSafeLabel(workstream)) {
    return 1;
  }
  if (isIdleWorkstream(workstream)) {
    return 2;
  }
  return 3;
}

function repoSortKey(workstream: WorkstreamSummary): string {
  return workstream.scopeAlias ? `0:${workstream.scopeAlias.label.toLowerCase()}` : `1:${workstream.label.toLowerCase()}`;
}

function sortWorkstreams(workstreams: WorkstreamSummary[], sort: WorkstreamSort): WorkstreamSummary[] {
  return [...workstreams].sort((left, right) => {
    if (sort === "repo") {
      const repoDelta = repoSortKey(left).localeCompare(repoSortKey(right));
      return repoDelta === 0 ? left.label.localeCompare(right.label) : repoDelta;
    }

    const timeDelta = Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
    if (sort === "recent") {
      return timeDelta === 0 ? left.label.localeCompare(right.label) : timeDelta;
    }

    const activityDelta = activityRank(left) - activityRank(right);
    return activityDelta === 0 ? (timeDelta === 0 ? left.label.localeCompare(right.label) : timeDelta) : activityDelta;
  });
}

function filterCount(workstreams: WorkstreamSummary[], filter: WorkstreamFilter): number {
  return workstreams.filter((workstream) => filterWorkstream(workstream, filter)).length;
}

export function WorkspaceMap({
  snapshot,
  selected,
  attentionIds,
  onSelect
}: {
  snapshot: TodaySnapshot;
  selected: WorkstreamSummary | null;
  attentionIds: Set<string>;
  onSelect: (workstreamId: string | null) => void;
}) {
  const [filter, setFilter] = useState<WorkstreamFilter>("all");
  const [sort, setSort] = useState<WorkstreamSort>("activity");
  const filteredWorkstreams = useMemo(
    () => sortWorkstreams(snapshot.workstreams.filter((workstream) => filterWorkstream(workstream, filter)), sort),
    [filter, snapshot.workstreams, sort]
  );
  const groupedScopes = useMemo(() => workspaceGroupsFor(filteredWorkstreams), [filteredWorkstreams]);
  const observedLabel =
    filteredWorkstreams.length === snapshot.workstreams.length
      ? `${snapshot.workstreams.length} observed`
      : `${filteredWorkstreams.length} of ${snapshot.workstreams.length} observed`;
  const filterButtons: Array<{ id: WorkstreamFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: snapshot.workstreams.length },
    { id: "active", label: "Active", count: filterCount(snapshot.workstreams, "active") },
    { id: "idle", label: "Idle", count: filterCount(snapshot.workstreams, "idle") },
    { id: "needs_label", label: "Needs label", count: filterCount(snapshot.workstreams, "needs_label") }
  ];

  useEffect(() => {
    const selectedId = selected?.workstreamId ?? null;
    const nextSelectedId = filteredWorkstreams.some((workstream) => workstream.workstreamId === selectedId)
      ? selectedId
      : (filteredWorkstreams[0]?.workstreamId ?? null);

    if (nextSelectedId === selectedId) {
      return;
    }

    onSelect(nextSelectedId);
  }, [filteredWorkstreams, onSelect, selected?.workstreamId]);

  return (
    <section className="workstream-panel" aria-labelledby="workstreams-heading">
      <div className="section-heading">
        <h2 id="workstreams-heading">Workspace Groups</h2>
        <span>{observedLabel}</span>
      </div>
      <div className="workspace-controls">
        <div className="filter-tabs" aria-label="Workspace filters">
          {filterButtons.map((item) => (
            <button
              key={item.id}
              className={`filter-tab ${filter === item.id ? "is-active" : ""}`}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label} {item.count}
            </button>
          ))}
        </div>
        <label className="sort-control">
          <span>Sort</span>
          <select
            aria-label="Sort workspace groups"
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as WorkstreamSort)}
          >
            <option value="activity">Activity first</option>
            <option value="recent">Recent first</option>
            <option value="repo">Repo</option>
          </select>
        </label>
      </div>
      <div className="workstream-list">
        <div className="workstream-row workstream-head" aria-hidden="true">
          <span>Name</span>
          <span>State</span>
          <span>Signal</span>
          <span>Attention</span>
          <span>Last Activity</span>
        </div>
        <div className="workstream-items" role="list" aria-label="Workspace groups">
          {snapshot.workstreams.length === 0 ? (
            <div role="listitem">
              <p className="empty-state">{observedEmptyLabel(snapshot)}</p>
            </div>
          ) : filteredWorkstreams.length === 0 ? (
            <div role="listitem">
              <p className="empty-state">No scopes match this view</p>
            </div>
          ) : (
            <>
              {groupedScopes.groups.map((group) => (
                <div className="scope-group" key={group.workspace.workstreamId} role="listitem">
                  <WorkstreamRowButton
                    workstream={group.workspace}
                    isSelected={selected?.workstreamId === group.workspace.workstreamId}
                    hasAttention={attentionIds.has(group.workspace.workstreamId)}
                    onSelect={() => onSelect(group.workspace.workstreamId)}
                    className="workspace-group-row"
                    relationshipLabel={childScopeCountLabel(group.children.length)}
                  />
                  {group.children.length > 0 ? (
                    <div className="scope-group-children">
                      {group.children.map((child) => (
                        <WorkstreamRowButton
                          key={child.workstreamId}
                          workstream={child}
                          isSelected={selected?.workstreamId === child.workstreamId}
                          hasAttention={attentionIds.has(child.workstreamId)}
                          onSelect={() => onSelect(child.workstreamId)}
                          className="is-child"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {groupedScopes.ungrouped.length > 0 ? (
                <div className="scope-group ungrouped" role="listitem">
                  <div className="scope-group-label">Ungrouped Scopes</div>
                  <div className="scope-group-children">
                    {groupedScopes.ungrouped.map((workstream) => (
                      <WorkstreamRowButton
                        key={workstream.workstreamId}
                        workstream={workstream}
                        isSelected={selected?.workstreamId === workstream.workstreamId}
                        hasAttention={attentionIds.has(workstream.workstreamId)}
                        onSelect={() => onSelect(workstream.workstreamId)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
