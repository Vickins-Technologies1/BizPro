export type BranchScope = {
  role?: string | null;
  branchId?: string | null;
  requestedBranchId?: string | null;
};

export function resolveReadBranchId(scope: BranchScope, requestedBranchId?: string | null) {
  if (scope.role === "owner") {
    return requestedBranchId?.trim() ? requestedBranchId.trim() : null;
  }
  return scope.branchId?.trim() ? scope.branchId.trim() : null;
}

export function resolveWriteBranchId(scope: BranchScope, requestedBranchId?: string | null) {
  if (scope.role === "owner") {
    return requestedBranchId?.trim() ? requestedBranchId.trim() : scope.branchId?.trim() ? scope.branchId.trim() : null;
  }
  return scope.branchId?.trim() ? scope.branchId.trim() : null;
}

export function buildBranchMatch(branchId?: string | null) {
  if (!branchId) {
    return {};
  }
  return {
    $or: [{ branchId }, { branchId: null }]
  };
}
