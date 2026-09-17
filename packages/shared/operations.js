"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_OPERATION_STATUS_FLOW = void 0;
exports.getNextBusinessOperationStatus = getNextBusinessOperationStatus;
exports.isBusinessOperationStatusTransitionAllowed = isBusinessOperationStatusTransitionAllowed;
exports.BUSINESS_OPERATION_STATUS_FLOW = ["open", "preparing", "ready", "completed"];
function getNextBusinessOperationStatus(status) {
    if (status === "confirmed")
        return "in_progress";
    const index = exports.BUSINESS_OPERATION_STATUS_FLOW.indexOf(status);
    return exports.BUSINESS_OPERATION_STATUS_FLOW[Math.min(index + 1, exports.BUSINESS_OPERATION_STATUS_FLOW.length - 1)] ?? "completed";
}
function isBusinessOperationStatusTransitionAllowed(from, to) {
    if (to === "cancelled" || to === "draft")
        return true;
    return getNextBusinessOperationStatus(from) === to;
}
