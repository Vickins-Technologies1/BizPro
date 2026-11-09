import type { InvoiceLifecycleStatus } from "@vbo/shared";

export type InvoiceLifecycleSnapshot = {
  status: InvoiceLifecycleStatus;
  amountPaid: number;
  balanceDue: number;
  dueDate: Date | string;
  sentAt?: Date | string | null | undefined;
  viewedAt?: Date | string | null | undefined;
};

const terminalStatuses: InvoiceLifecycleStatus[] = ["cancelled", "void", "refunded", "archived"];

/** Keep settlement derived from the current due while preserving draft and terminal lifecycle states. */
export function deriveInvoiceLifecycleStatus(invoice: InvoiceLifecycleSnapshot, now = new Date()): InvoiceLifecycleStatus {
  if (terminalStatuses.includes(invoice.status) || invoice.status === "draft") return invoice.status;
  const due = Number(invoice.balanceDue);
  if (!Number.isFinite(due) || due < 0) throw new Error("Invoice balance is invalid");
  if (due === 0) return "paid";
  const dueDate = new Date(invoice.dueDate);
  if (invoice.sentAt && Number.isFinite(dueDate.getTime()) && dueDate < now) return "overdue";
  if (Number(invoice.amountPaid) > 0) return "partially_paid";
  if (invoice.viewedAt) return "viewed";
  return invoice.sentAt ? "sent" : "draft";
}

export function isActiveInvoiceReceivable(status: InvoiceLifecycleStatus) {
  return !["draft", "cancelled", "void", "archived"].includes(status);
}
