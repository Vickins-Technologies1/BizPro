import type { BusinessOperationStatus } from "./types";

export const BUSINESS_OPERATION_STATUS_FLOW: readonly BusinessOperationStatus[] = ["open", "preparing", "ready", "completed"];

export function getNextBusinessOperationStatus(status: BusinessOperationStatus) {
  if (status === "confirmed") return "in_progress" as const;
  const index = BUSINESS_OPERATION_STATUS_FLOW.indexOf(status);
  return BUSINESS_OPERATION_STATUS_FLOW[Math.min(index + 1, BUSINESS_OPERATION_STATUS_FLOW.length - 1)] ?? "completed";
}

export function isBusinessOperationStatusTransitionAllowed(from: BusinessOperationStatus, to: BusinessOperationStatus) {
  if (to === "cancelled" || to === "draft") return true;
  return getNextBusinessOperationStatus(from) === to;
}
