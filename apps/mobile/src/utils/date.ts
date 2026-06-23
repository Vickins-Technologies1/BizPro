import { format, parseISO } from "date-fns";

export const nowIso = () => new Date().toISOString();
export const formatDate = (value: string | Date, pattern = "MMM d, yyyy") =>
  format(typeof value === "string" ? parseISO(value) : value, pattern);
export const formatTime = (value: string | Date) =>
  format(typeof value === "string" ? parseISO(value) : value, "h:mm a");
export const dateKey = (value = new Date()) => format(value, "yyyy-MM-dd");
