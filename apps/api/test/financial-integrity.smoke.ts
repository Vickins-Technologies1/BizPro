import assert from "node:assert/strict";
import { calculateGrossProfit, calculateNetProfit, calculateSale, calculateTax, roundMoney } from "@vbo/shared";
import { calculateBankBalance, calculatePettyCashBalance, reconcileCachedBalance } from "../src/modules/finance/reconciliation";
import { calculateCustomerOutstanding, reconcileCustomerBalance } from "../src/modules/customers/customer-balance";
import { calculateOutstanding } from "@vbo/shared";

function main() {
  const sale = calculateSale([{ quantity: 1, unitPrice: 800, unitCost: 500 }], 800);
  assert.equal(sale.subtotal, 800);
  assert.equal(sale.grandTotal, 800);
  assert.equal(sale.balanceDue, 0);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);

  const discounted = calculateSale([{ quantity: 2, unitPrice: 100, unitCost: 40, discount: 10, tax: 5 }], 100);
  assert.equal(discounted.subtotal, 200);
  assert.equal(discounted.discountTotal, 10);
  assert.equal(discounted.taxTotal, 5);
  assert.equal(discounted.grandTotal, 195);
  assert.equal(discounted.balanceDue, 95);

  assert.throws(() => calculateSale([{ quantity: 0, unitPrice: 100, unitCost: 50 }], 0), /greater than zero/);
  assert.throws(() => calculateSale([{ quantity: -1, unitPrice: 100, unitCost: 50 }], 0), /greater than zero/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 50 }], 101), /at most/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 50, discount: 101 }], 0), /at most/);

  assert.equal(calculateGrossProfit(800, 500), 300);
  assert.equal(calculateNetProfit(300, 75), 225);
  assert.equal(calculateTax(100, 16), 16);
  assert.equal(calculateTax(100, 16, true), 13.79);
  assert.equal(calculateBankBalance(1000, [{ amount: 250, direction: "in" }, { amount: 100, direction: "out" }]), 1150);
  assert.equal(calculatePettyCashBalance(500, [{ amount: 50, direction: "in" }, { amount: 20, direction: "out" }]), 530);
  assert.equal(reconcileCachedBalance(1150, 1150).isMatch, true);
  assert.equal(calculateCustomerOutstanding({ sales: [{ balanceDue: 100 }], invoices: [{ balanceDue: 50 }], standalonePayments: [{ amount: 25 }] }), 125);
  assert.equal(reconcileCustomerBalance(125, 125).isMatch, true);
  assert.equal(calculateOutstanding([{ id: "sale-1", source: "sale", balanceDue: 1000, linkedReceivableId: "sale-1" }, { id: "invoice-1", source: "invoice", balanceDue: 1000, linkedReceivableId: "sale-1" }]), 1000);
  assert.equal(calculateOutstanding([{ id: "sale-2", source: "sale", balanceDue: 1000, linkedReceivableId: "sale-2" }]), 1000);
  assert.equal(calculateCustomerOutstanding({ sales: [{ id: "sale-3", balanceDue: 600 }], invoices: [{ id: "invoice-3", saleId: "sale-3", balanceDue: 600 }] }), 600);
  assert.equal(calculateCustomerOutstanding({ invoices: [{ id: "invoice-4", balanceDue: 800 }] }), 800);
  assert.equal(calculateCustomerOutstanding({ sales: [{ id: "sale-5", balanceDue: 1000 }], standalonePayments: [{ amount: 400 }] }), 600);
  assert.equal(calculateOutstanding([{ id: "sale-deleted", source: "sale", balanceDue: 1000, active: false }]), 0);
  assert.equal(calculateCustomerOutstanding({ invoices: [{ id: "invoice-paid", balanceDue: 0 }], standalonePayments: [] }), 0);

  console.log("Financial integrity smoke tests passed");
}

main();
