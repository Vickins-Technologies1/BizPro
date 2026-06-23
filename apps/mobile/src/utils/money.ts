export const formatMoney = (amount: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);

export const clampCurrency = (value: string) =>
  Number(value.replace(/[^0-9.]/g, "")) || 0;
