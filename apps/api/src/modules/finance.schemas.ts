import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildFinanceSchemas(input: {
  Expense: SchemaEntry;
  BankAccount: SchemaEntry;
  PettyCashEntry: SchemaEntry;
  CreditNote: SchemaEntry;
  Sale: SchemaEntry;
  Payment: SchemaEntry;
  StockMovement: SchemaEntry;
}) {
  return [input.Expense, input.BankAccount, input.PettyCashEntry, input.CreditNote, input.Sale, input.Payment, input.StockMovement] as const;
}
