import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model } from "mongoose";
import { Business, BusinessDocument, Customer, CustomerDocument, Invoice, InvoiceDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument, SaleItem, StockMovement, StockMovementDocument } from "../schemas";
import { assertCurrencyAmount, assertPaymentMethod, assertSubsequentPayment, calculateSale, FINANCIAL_CALCULATION_VERSION, PAYMENT_METHODS, resolveBusinessTypeConfig, roundMoney } from "@vbo/shared";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import {
  buildProductLookupQuery,
  invalidProductIdException,
  isMongoObjectId,
  productNotFoundException
} from "../products/product-identity";
import { NotificationsService } from "../notifications/notifications.service";
import { buildBusinessLookup } from "../../common/business-lookup";
import { buildOperationFingerprint, buildPaymentRequestFingerprint, assertPaymentRequestMatches, isDuplicateKeyError } from "../../common/payment-integrity";

export interface CreateSaleInput {
  businessId: string;
  externalId?: string | null;
  branchId?: string | null;
  customerId?: string | null;
  cashierId?: string | null;
  receiptNumber: string;
  amountPaid: number;
  orderDiscount?: number;
  expectedGrandTotal?: number;
  paymentStatus: Sale["paymentStatus"];
  paymentMethod: Sale["paymentMethod"];
  paymentLines?: Array<{ method: Sale["paymentMethod"]; amount: number; reference?: string | null; note?: string | null }>;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number; discount?: number; expectedUnitPrice?: number }>;
}

export interface RecordSalePaymentInput {
  businessId: string;
  saleId: string;
  externalId: string;
  amount: number;
  method: Payment["method"];
  reference?: string | null;
  note?: string | null;
  recordedById?: string | null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Business.name) private readonly businessModel?: Model<BusinessDocument>,
    private readonly notifications?: NotificationsService,
    @InjectModel(Invoice.name) private readonly invoiceModel?: Model<InvoiceDocument>
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: CreateSaleInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (!input.externalId?.trim()) throw new BadRequestException("A stable sale idempotency key is required");
    const createFingerprint = buildOperationFingerprint({
      businessId: input.businessId,
      branchId,
      customerId: input.customerId ?? null,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
      paymentLines: input.paymentLines ?? null,
      orderDiscount: input.orderDiscount ?? 0,
      expectedGrandTotal: input.expectedGrandTotal ?? null,
      receiptNumber: input.receiptNumber,
      items: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discount: item.discount ?? 0, expectedUnitPrice: item.expectedUnitPrice ?? null }))
    });
    let declaredAmount: number;
    let paymentLines: NonNullable<CreateSaleInput["paymentLines"]>;
    try {
      declaredAmount = assertCurrencyAmount(input.amountPaid, "amountPaid", { min: 0 });
      assertPaymentMethod(input.paymentMethod, PAYMENT_METHODS);
      paymentLines = input.paymentLines?.length ? input.paymentLines : [{ method: input.paymentMethod, amount: declaredAmount }];
      for (const line of paymentLines) {
        assertPaymentMethod(line.method, PAYMENT_METHODS);
        assertCurrencyAmount(line.amount, "Payment amount", { min: 0 });
      }
      const tenderMinor = paymentLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
      if (!Number.isSafeInteger(tenderMinor) || tenderMinor !== Math.round(declaredAmount * 100)) throw new Error("Payment lines must add up exactly to the amount paid");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid sale payment values");
    }
    const lowStockAlerts = new Map<string, { productId: string; productName: string; stockOnHand: number; threshold: number }>();
    if (input.externalId) {
      const existing = await this.saleModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        if (existing.createFingerprint && existing.createFingerprint !== createFingerprint) throw new ConflictException("Sale idempotency key was already used for a different checkout");
        return existing;
      }
    }
    const sale = await runInTransaction(this.connection, async (session) => {
      const resolvedItems: Array<{ item: SaleItem; product: ProductDocument; productId: string }> = [];
      const business = this.businessModel
        ? await this.businessModel.findOne({ ...buildBusinessLookup(input.businessId), deletedAt: null }).session(session).lean()
        : { currency: "KES" };
      if (!business) throw new NotFoundException("Business not found");
      // A configured API always resolves this from the authenticated business. The
      // no-business-model branch is retained for isolated service tests and legacy
      // callers so it does not silently turn inventory sales into service sales.
      const tracksInventory = this.businessModel
        ? resolveBusinessTypeConfig({ businessType: (business as { businessType?: string }).businessType, industryKey: (business as { industryKey?: string }).industryKey }).capabilities.inventory
        : true;
      const taxSettings = (business as { taxSettings?: { defaultTaxCategory?: string; defaultTaxRate?: number; defaultTaxInclusive?: boolean } }).taxSettings;
      const taxCategory = taxSettings?.defaultTaxCategory ?? "vat";
      const serverTaxRate = ["zero_rated", "exempt", "non_taxable"].includes(taxCategory) ? 0 : Number(taxSettings?.defaultTaxRate ?? 0);
      const businessCurrency = String((business as { currency?: string }).currency ?? "KES").toUpperCase();
      for (const item of input.items) {
        const product = await this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: item.productId, branchId })).session(session);
        if (!product) {
          throw isMongoObjectId(item.productId) ? productNotFoundException() : invalidProductIdException();
        }
        if (item.expectedUnitPrice !== undefined) {
          try {
            const expected = assertCurrencyAmount(item.expectedUnitPrice, "Catalog price", { min: 0 });
            if (expected !== assertCurrencyAmount(product.sellingPrice, "Catalog price", { min: 0 })) throw new ConflictException({ code: "STALE_CHECKOUT", message: "A catalog price changed. Review the updated checkout before recording the sale." });
          } catch (error) {
            if (error instanceof ConflictException) throw error;
            throw new BadRequestException(error instanceof Error ? error.message : "Invalid catalog price");
          }
        }
        resolvedItems.push({
          item: {
            productId: product.externalId ?? String(product._id),
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.sellingPrice,
            costPrice: product.buyingPrice,
            lineDiscount: item.discount ?? 0,
            lineTotal: 0
          },
          product,
          productId: product.externalId ?? String(product._id)
        });
      }
      let calculation;
      try {
        const postedAmount = roundMoney(paymentLines.reduce((sum, line) => sum + (line.method === "mpesa" || line.method === "credit" ? 0 : line.amount), 0));
        calculation = calculateSale(
          resolvedItems.map(({ item }) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.costPrice,
            discount: item.lineDiscount
          })),
          postedAmount,
          { orderDiscount: input.orderDiscount ?? 0, taxRate: serverTaxRate, taxInclusive: taxSettings?.defaultTaxInclusive ?? false }
        );
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Invalid sale financial values");
      }
      if (roundMoney(paymentLines.reduce((sum, line) => sum + line.amount, 0)) > calculation.grandTotal) throw new BadRequestException("Submitted tenders cannot exceed the sale total");
      if (input.expectedGrandTotal !== undefined) {
        let expected: number;
        try { expected = assertCurrencyAmount(input.expectedGrandTotal, "Expected checkout total", { min: 0 }); }
        catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid expected checkout total"); }
        if (expected !== calculation.grandTotal) throw new ConflictException({ code: "STALE_CHECKOUT", message: "Tax settings or discounts changed. Review the updated checkout before recording the sale." });
      }
      resolvedItems.forEach(({ item }, index) => {
        item.unitPrice = calculation.lines[index]!.unitPrice;
        item.costPrice = calculation.lines[index]!.unitCost;
        item.lineDiscount = roundMoney(calculation.lines[index]!.lineDiscount + calculation.lines[index]!.orderDiscountAllocation);
        item.lineTax = calculation.lines[index]!.lineTax;
        item.lineTotal = calculation.lines[index]!.lineTotal;
        item.calculationVersion = FINANCIAL_CALCULATION_VERSION;
      });
      let customer: CustomerDocument | null = null;
      if (input.customerId) {
        const customerIdentifiers: Array<Record<string, string>> = [{ externalId: input.customerId }];
        if (isMongoObjectId(input.customerId)) customerIdentifiers.unshift({ _id: input.customerId });
        customer = await this.customerModel.findOne({
          businessId: input.businessId,
          deletedAt: null,
          $and: [{ $or: customerIdentifiers }, buildBranchMatch(branchId)]
        }).session(session);
        if (!customer) throw new NotFoundException({ success: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
        if (calculation.balanceDue > 0) {
          customer.balance += calculation.balanceDue;
          await customer.save({ session });
        }
      }
      const sale = (await this.saleModel.create(
        [
          {
            ...input,
            createFingerprint,
            customerId: customer ? (customer.externalId ?? customer._id.toString()) : null,
            subtotal: calculation.subtotal,
            discountTotal: calculation.discountTotal,
            taxTotal: calculation.taxTotal,
            grandTotal: calculation.grandTotal,
            amountPaid: calculation.amountPaid,
            balanceDue: calculation.balanceDue,
            paymentStatus: calculation.balanceDue === 0 ? "paid" : calculation.amountPaid > 0 ? "partial" : "credit",
            currency: business.currency ?? "KES",
            items: resolvedItems.map(({ item, productId }) => ({
              ...item,
              productId,
              currency: business.currency ?? "KES"
            })),
            branchId,
            deletedAt: null
          }
        ],
        { session }
      ))[0]!;
      for (const { item, product, productId } of resolvedItems) {
        if (!tracksInventory) continue;
        const updatedProduct = await this.productModel.findOneAndUpdate(
          { _id: product._id, businessId: input.businessId, ...buildBranchMatch(branchId), $expr: { $gte: [{ $ifNull: ["$stockOnHand", 0] }, item.quantity] } } as never,
          { $inc: { stockOnHand: -item.quantity } },
          { new: true, session }
        ).lean();
        if (!updatedProduct) throw new NotFoundException("Insufficient stock");
        const freshStock = updatedProduct.stockOnHand;
        if (freshStock <= product.lowStockThreshold) {
          lowStockAlerts.set(String(productId), {
            productId: String(productId),
            productName: product.name,
            stockOnHand: freshStock,
            threshold: product.lowStockThreshold
          });
        }
        await this.movementModel.create(
          [
            {
              businessId: input.businessId,
              branchId,
              productId,
              referenceType: "sale",
              referenceId: sale._id.toString(),
              quantityDelta: -item.quantity,
              unitCost: item.costPrice,
              note: `Sale ${input.receiptNumber}`
            }
          ],
          { session }
        );
        for (const recipeIngredient of product.recipeIngredients ?? []) {
          const ingredientQuantity = Number(recipeIngredient.quantity ?? 0) * item.quantity;
          if (!recipeIngredient.ingredientId || ingredientQuantity <= 0) continue;
          const ingredient = await this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: recipeIngredient.ingredientId, branchId })).session(session);
          if (!ingredient) throw new NotFoundException(`Recipe ingredient ${recipeIngredient.ingredientId} not found`);
          const updatedIngredient = await this.productModel.findOneAndUpdate(
            { _id: ingredient._id, businessId: input.businessId, ...buildBranchMatch(branchId), $expr: { $gte: [{ $ifNull: ["$stockOnHand", 0] }, ingredientQuantity] } } as never,
            { $inc: { stockOnHand: -ingredientQuantity } },
            { new: true, session }
          ).lean();
          if (!updatedIngredient) throw new NotFoundException(`Insufficient ingredient stock for ${ingredient.name}`);
          await this.movementModel.create(
            [{ businessId: input.businessId, branchId, productId: ingredient.externalId ?? ingredient._id.toString(), referenceType: "recipe", referenceId: sale._id.toString(), quantityDelta: -ingredientQuantity, unitCost: ingredient.buyingPrice, note: `Recipe consumption for ${product.name}` }],
            { session }
          );
        }
      }
      const recordedPayments = paymentLines.filter((line) => line.amount > 0 && line.method !== "credit");
      if (recordedPayments.length) await this.paymentModel.create(
        recordedPayments.map((line, index) => ({
          businessId: input.businessId,
          branchId,
          customerId: customer ? (customer.externalId ?? customer._id.toString()) : null,
          saleId: sale._id.toString(),
          debtPaymentId: null,
          externalId: recordedPayments.length === 1 ? input.externalId : `${input.externalId}:payment:${index}`,
          method: line.method,
          status: line.method === "mpesa" ? "pending_confirmation" : calculation.balanceDue === 0 ? "paid" : "partial",
          paymentState: line.method === "mpesa" ? "reconciliation_pending" : "posted",
          amount: line.amount,
          currency: businessCurrency,
          recordedById: input.cashierId ?? null,
          requestFingerprint: buildPaymentRequestFingerprint({ operation: "sale_initial_payment", businessId: input.businessId, targetId: sale._id.toString(), customerId: customer ? (customer.externalId ?? customer._id.toString()) : null, branchId, amount: line.amount, currency: businessCurrency, method: line.method, reference: line.reference }),
          reference: line.reference ?? null,
          note: [line.note, input.notes].filter(Boolean).join(" · ") || null,
          provider: null,
          reconciledAt: null
        })),
        { session }
      );
      return sale.toObject();
    }).catch(async (error) => {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.saleModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (!existing) throw error;
      if (existing.createFingerprint !== createFingerprint) throw new ConflictException("Sale idempotency key was already used for a different checkout");
      return existing;
    });
    for (const alert of lowStockAlerts.values()) {
      void this.notifications?.createLowStockNotification({
          businessId: input.businessId,
          productId: alert.productId,
          productName: alert.productName,
          stockOnHand: alert.stockOnHand,
          threshold: alert.threshold,
          routeParams: { productId: alert.productId }
        })
        .catch(() => undefined);
    }
    return sale;
  }

  async recordPayment(input: RecordSalePaymentInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    if (!input.externalId?.trim()) throw new BadRequestException("A stable payment idempotency key is required");
    let amount: number;
    try {
      amount = assertSubsequentPayment(input.amount);
      assertPaymentMethod(input.method, PAYMENT_METHODS);
      if (input.method === "credit") throw new Error("Credit is a settlement state, not a payment method");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid payment");
    }

    let requestFingerprint: string | null = null;
    try { return await runInTransaction(this.connection, async (session) => {
      const sale = await this.findSaleForPayment(input.businessId, input.saleId, branchId, session);
      if (!sale) throw new NotFoundException("Sale not found");
      const currency = String(sale.currency ?? "KES").toUpperCase();
      const fingerprint = buildPaymentRequestFingerprint({ operation: "sale_payment", businessId: input.businessId, targetId: sale._id.toString(), customerId: sale.customerId ?? null, branchId, amount, currency, method: input.method, reference: input.reference });
      requestFingerprint = fingerprint;
      const existing = await this.paymentModel.findOne({ businessId: input.businessId, externalId: input.externalId }).session(session).lean();
      if (existing) {
        try { assertPaymentRequestMatches(existing, fingerprint); }
        catch (error) { throw new ConflictException(error instanceof Error ? error.message : "Payment idempotency conflict"); }
        return { sale: sale.toObject(), payment: existing };
      }
      if (this.invoiceModel) {
        const activeInvoice = await this.invoiceModel.findOne({
          businessId: input.businessId,
          deletedAt: null,
          status: { $in: ["sent", "viewed", "partially_paid", "paid", "overdue"] },
          $and: [{ $or: [{ saleId: String(sale._id) }, ...(sale.externalId ? [{ saleId: String(sale.externalId) }] : [])] }, buildBranchMatch(branchId)]
        }).session(session).lean();
        if (activeInvoice) throw new BadRequestException("Record payments against the active invoice linked to this sale");
      }
      const currentBalance = roundMoney(Math.max(0, Number(sale.balanceDue ?? Number(sale.grandTotal ?? 0) - Number(sale.amountPaid ?? 0))));
      if (currentBalance <= 0) throw new BadRequestException("Sale is already fully paid");
      if (amount > currentBalance) throw new BadRequestException("Payment amount cannot exceed the outstanding balance");

      const pendingProvider = input.method === "mpesa";
      if (!pendingProvider) {
        sale.amountPaid = roundMoney(Number(sale.amountPaid ?? 0) + amount);
        sale.balanceDue = roundMoney(Math.max(0, Number(sale.grandTotal ?? 0) - sale.amountPaid));
        sale.paymentStatus = sale.balanceDue <= 0 ? "paid" : "partial";
        await sale.save({ session });
      }

      const payment = (await this.paymentModel.create([{
        businessId: input.businessId,
        branchId,
        customerId: sale.customerId ?? null,
        saleId: sale._id.toString(),
        externalId: input.externalId,
        debtPaymentId: null,
        method: input.method,
        status: pendingProvider ? "pending_confirmation" : "paid",
        paymentState: pendingProvider ? "reconciliation_pending" : "posted",
        amount,
        currency,
        recordedById: input.recordedById ?? null,
        requestFingerprint: fingerprint,
        reference: input.reference ?? null,
        note: input.note ?? null,
        provider: null,
        reconciledAt: null
      }], { session }))[0]!;

      if (sale.customerId && !pendingProvider) {
        const customerKeys: Array<Record<string, string>> = [{ externalId: sale.customerId }];
        if (isMongoObjectId(sale.customerId)) customerKeys.unshift({ _id: sale.customerId });
        const customer = await this.customerModel.findOne({
          businessId: input.businessId,
          deletedAt: null,
          $and: [{ $or: customerKeys }, buildBranchMatch(branchId)]
        }).session(session);
        if (customer) {
          customer.balance = Math.max(0, roundMoney(Number(customer.balance ?? 0) - amount));
          await customer.save({ session });
        }
      }

      return { sale: sale.toObject(), payment: payment.toObject() };
    }); } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.paymentModel.findOne({ businessId: input.businessId, externalId: input.externalId }).lean();
      if (!existing || !requestFingerprint) throw error;
      try { assertPaymentRequestMatches(existing, requestFingerprint); } catch (conflict) { throw new ConflictException(conflict instanceof Error ? conflict.message : "Payment idempotency conflict"); }
      const sale = await this.saleModel.findOne({ businessId: input.businessId, deletedAt: null, $and: [{ $or: [{ _id: existing.saleId }, { externalId: existing.saleId }] }, buildBranchMatch(branchId)] }).lean();
      if (!sale) throw error;
      return { sale, payment: existing };
    }
  }

  private findSaleForPayment(businessId: string, saleId: string, branchId: string | null, session: ClientSession) {
    const identifiers: Array<Record<string, string>> = [{ externalId: saleId }];
    if (isMongoObjectId(saleId)) identifiers.unshift({ _id: saleId });
    return this.saleModel.findOne({ businessId, deletedAt: null, $and: [{ $or: identifiers }, buildBranchMatch(branchId)] }).session(session);
  }
}
