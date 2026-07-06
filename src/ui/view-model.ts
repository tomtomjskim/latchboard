import type { TodaySnapshot, WorkstreamSummary } from "../shared/contracts";

export type WorkspaceGroup = {
  workspace: WorkstreamSummary;
  children: WorkstreamSummary[];
};

export type GroupedScopes = {
  groups: WorkspaceGroup[];
  ungrouped: WorkstreamSummary[];
};

export function childScopeCountLabel(count: number): string {
  return `${count} child ${count === 1 ? "scope" : "scopes"}`;
}

export function workspaceGroupsFor(workstreams: WorkstreamSummary[]): GroupedScopes {
  const groupsById = new Map<string, WorkspaceGroup>();
  const groups: WorkspaceGroup[] = [];
  const ungrouped: WorkstreamSummary[] = [];

  workstreams.forEach((workstream) => {
    if (workstream.scopeKind !== "workspace") {
      return;
    }

    const group = { workspace: workstream, children: [] };
    groupsById.set(workstream.workstreamId, group);
    groups.push(group);
  });

  workstreams.forEach((workstream) => {
    if (workstream.scopeKind === "workspace") {
      return;
    }

    const parentGroup = workstream.parentScopeId ? groupsById.get(workstream.parentScopeId) : undefined;
    if (parentGroup) {
      parentGroup.children.push(workstream);
    } else {
      ungrouped.push(workstream);
    }
  });

  return { groups, ungrouped };
}

export function selectedFromSnapshot(snapshot: TodaySnapshot, selectedId: string | null): WorkstreamSummary | null {
  return selectedId ? (snapshot.workstreams.find((workstream) => workstream.workstreamId === selectedId) ?? null) : null;
}
