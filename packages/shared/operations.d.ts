import type { BusinessOperationStatus } from "./types";
export declare const BUSINESS_OPERATION_STATUS_FLOW: readonly BusinessOperationStatus[];
export declare function getNextBusinessOperationStatus(status: BusinessOperationStatus): BusinessOperationStatus;
export declare function isBusinessOperationStatusTransitionAllowed(from: BusinessOperationStatus, to: BusinessOperationStatus): boolean;
