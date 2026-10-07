import { roundMoney } from "@vbo/shared";

export type LedgerMovement = { amount: number; direction?: "in" | "out" | "credit" | "debit" };

export function calculateBankBalance(openingBalance: number, movements: LedgerMovement[]) {
  return roundMoney(Number(openingBalance || 0) + movements.reduce((total, movement) => {
    const sign = movement.direction === "out" || movement.direction === "debit" ? -1 : 1;
    return total + sign * Number(movement.amount || 0);
  }, 0));
}

export function calculatePettyCashBalance(openingBalance: number, entries: LedgerMovement[]) {
  return calculateBankBalance(openingBalance, entries);
}

export function reconcileCachedBalance(cachedBalance: number, calculatedBalance: number) {
  const difference = roundMoney(Number(cachedBalance || 0) - Number(calculatedBalance || 0));
  return { cachedBalance: roundMoney(cachedBalance), calculatedBalance: roundMoney(calculatedBalance), difference, isMatch: difference === 0 };
}
