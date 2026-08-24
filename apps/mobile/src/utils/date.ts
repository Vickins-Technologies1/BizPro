import { format, isValid, parseISO } from "date-fns";

export const nowIso = () => new Date().toISOString();
function resolveDate(value: string | Date | null | undefined) {
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }
  return null;
}

export const formatDate = (value: string | Date, pattern = "MMM d, yyyy") => {
  const date = resolveDate(value);
  return date ? format(date, pattern) : "—";
};

export const formatTime = (value: string | Date) => {
  const date = resolveDate(value);
  return date ? format(date, "h:mm a") : "—";
};
export const dateKey = (value = new Date()) => format(value, "yyyy-MM-dd");
