import { useMemo } from "react";
import type { TodaySnapshot, WorkstreamSummary } from "../../shared/contracts";
import { observedEmptyLabel } from "../format";
import { childScopeCountLabel, workspaceGroupsFor } from "../view-model";
import { WorkstreamRowButton } from "./ScopeChrome";

export function WorkspaceMap({
  snapshot,
  selected,
  attentionIds,
  onSelect
}: {
  snapshot: TodaySnapshot;
  selected: WorkstreamSummary | null;
  attentionIds: Set<string>;
  onSelect: (workstreamId: string) => void;
}) {
  const groupedScopes = useMemo(() => workspaceGroupsFor(snapshot.workstreams), [snapshot.workstreams]);

  return (
    <section className="workstream-panel" aria-labelledby="workstreams-heading">
      <div className="section-heading">
        <h2 id="workstreams-heading">Workspace Groups</h2>
        <span>{snapshot.workstreams.length} observed</span>
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
