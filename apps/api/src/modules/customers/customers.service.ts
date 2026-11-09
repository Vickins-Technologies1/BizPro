import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model } from "mongoose";
import { AuditLog, AuditLogDocument, Business, BusinessDocument, Customer, CustomerDocument, CustomerGroup, CustomerGroupDocument, Invoice, InvoiceDocument, Payment, PaymentDocument, Sale, SaleDocument } from "../schemas";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import { toSafeIsoString } from "../../common/date-normalizer";
import { calculateCustomerCredit, calculateCustomerOutstanding, reconcileCustomerBalance } from "./customer-balance";
import { assertSubsequentPayment, PAYMENT_METHODS } from "@vbo/shared";
import { assertPaymentRequestMatches, buildPaymentRequestFingerprint, isDuplicateKeyError } from "../../common/payment-integrity";
import { buildBusinessLookup } from "../../common/business-lookup";
import { eligiblePaymentMatch } from "../../common/payment-integrity";

type CustomerAttachmentInput = {
  id?: string;
  label?: string;
  url?: string;
  note?: string | null;
  addedAt?: string | Date | null;
};

type CustomerPatchInput = {
  branchId?: string | null;
  groupId?: string | null;
  name?: string;
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxPin?: string | null;
  notes?: string | null;
  creditLimit?: number;
  loyaltyPoints?: number;
  attachments?: CustomerAttachmentInput[];
  externalId?: string | null;
};

type CustomerGroupPatchInput = {
  name?: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
  externalId?: string | null;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(CustomerGroup.name) private readonly customerGroupModel: Model<CustomerGroupDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Optional() @InjectModel(Sale.name) private readonly saleModel?: Model<SaleDocument>,
    @Optional() @InjectModel(Invoice.name) private readonly invoiceModel?: Model<InvoiceDocument>,
    @Optional() @InjectModel(AuditLog.name) private readonly auditLogModel?: Model<AuditLogDocument>,
    @Optional() @InjectModel(Business.name) private readonly businessModel?: Model<BusinessDocument>
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.customerModel
      .find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) })
      .sort({ createdAt: -1 })
      .lean()
      .then((rows) => rows.map((row) => this.normalizeCustomer(row)));
  }

  listGroups(businessId: string) {
    return this.customerGroupModel
      .find({ businessId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean()
      .then((rows) => rows.map((row) => this.normalizeCustomerGroup(row)));
  }

  async createGroup(input: Partial<CustomerGroup> & { businessId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.customerGroupModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return this.normalizeCustomerGroup(existing);
      }
    }
    const created = await this.customerGroupModel.create({
      businessId: input.businessId,
      externalId: input.externalId ?? null,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      isActive: input.isActive ?? true,
      deletedAt: null
    });
    return this.normalizeCustomerGroup(created.toObject());
  }

  async updateGroup(businessId: string, id: string, patch: CustomerGroupPatchInput) {
    const group = await this.findGroupById(businessId, id);
    if (!group) throw new NotFoundException("Customer group not found");
    if (patch.name !== undefined) group.name = patch.name;
    if (patch.description !== undefined) group.description = patch.description;
    if (patch.color !== undefined) group.color = patch.color;
    if (patch.isActive !== undefined) group.isActive = patch.isActive;
    if (patch.externalId !== undefined) group.externalId = patch.externalId;
    await group.save();
    return this.normalizeCustomerGroup(group.toObject());
  }

  async archiveGroup(businessId: string, id: string) {
    const group = await this.findGroupById(businessId, id);
    if (!group) throw new NotFoundException("Customer group not found");
    group.isActive = false;
    group.deletedAt = new Date();
    await group.save();
    return this.normalizeCustomerGroup(group.toObject());
  }

  async create(input: Partial<Customer> & { businessId: string; name: string }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (!input.externalId?.trim()) throw new BadRequestException("A stable payment idempotency key is required");
    if (input.externalId) {
      const existing = await this.customerModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return this.normalizeCustomer(existing);
      }
    }
    const created = await this.customerModel.create({
      businessId: input.businessId,
      branchId,
      externalId: input.externalId ?? null,
      groupId: input.groupId ?? null,
      name: input.name,
      businessName: input.businessName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      taxPin: input.taxPin ?? null,
      notes: input.notes ?? null,
      creditLimit: input.creditLimit ?? 0,
      loyaltyPoints: input.loyaltyPoints ?? 0,
      balance: input.balance ?? 0,
      attachments: this.normalizeAttachments(input.attachments),
      deletedAt: null
    });
    return this.normalizeCustomer(created.toObject());
  }

  async update(businessId: string, id: string, patch: CustomerPatchInput, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    const customer = await this.findCustomerById(businessId, id, branchId);
    if (!customer) throw new NotFoundException("Customer not found");
    if (patch.externalId !== undefined) customer.externalId = patch.externalId ?? null;
    if (patch.groupId !== undefined) customer.groupId = patch.groupId ?? null;
    if (patch.name !== undefined) customer.name = patch.name;
    if (patch.businessName !== undefined) customer.businessName = patch.businessName ?? null;
    if (patch.phone !== undefined) customer.phone = patch.phone ?? null;
    if (patch.email !== undefined) customer.email = patch.email ?? null;
    if (patch.address !== undefined) customer.address = patch.address ?? null;
    if (patch.taxPin !== undefined) customer.taxPin = patch.taxPin ?? null;
    if (patch.notes !== undefined) customer.notes = patch.notes ?? null;
    if (patch.creditLimit !== undefined) customer.creditLimit = Number(patch.creditLimit ?? 0);
    if (patch.loyaltyPoints !== undefined) customer.loyaltyPoints = Number(patch.loyaltyPoints ?? 0);
    if (patch.attachments !== undefined) customer.attachments = this.normalizeAttachments(patch.attachments);
    if (patch.branchId !== undefined && scope.role === "owner") customer.branchId = patch.branchId ?? null;
    await customer.save();
    return this.normalizeCustomer(customer.toObject());
  }

  async addBalance(businessId: string, id: string, delta: number, session?: ClientSession | null, scope: BranchScope = {}) {
    const customer = await this.findCustomerById(businessId, id, resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null), session);
    if (!customer) throw new NotFoundException("Customer not found");
    customer.balance = Math.max(0, Number(customer.balance ?? 0) + delta);
    await customer.save(session ? { session } : undefined);
    return this.normalizeCustomer(customer.toObject());
  }

  payments(businessId: string, customerId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.findCustomerKeys(businessId, customerId, branchId).then((keys) =>
      this.paymentModel
        .find({ businessId, customerId: { $in: keys }, ...buildBranchMatch(branchId) })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    );
  }

  async recordPayment(input: {
    businessId: string;
    customerId: string;
    branchId?: string | null;
    externalId?: string | null;
    amount: number;
    method: Payment["method"];
    reference?: string | null;
    note?: string | null;
    recordedById?: string | null;
  }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
      if (!input.externalId?.trim()) throw new BadRequestException("A stable payment idempotency key is required");
    let amount: number;
    try {
      amount = assertSubsequentPayment(input.amount);
      if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new Error("Payment method is not supported");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid payment");
    }
      let requestFingerprint: string | null = null;
      try { return await runInTransaction(this.connection, async (session) => {
      const customer = await this.findCustomerById(input.businessId, input.customerId, branchId, session);
      if (!customer) throw new NotFoundException("Customer not found");
      const business = this.businessModel
        ? await this.businessModel.findOne({ ...buildBusinessLookup(input.businessId), deletedAt: null }).session(session).lean()
        : { currency: "KES" };
      if (!business) throw new NotFoundException("Business not found");
      const currency = String((business as { currency?: string }).currency ?? "KES").toUpperCase();
      const customerId = customer.externalId ?? customer._id.toString();
        const fingerprint = buildPaymentRequestFingerprint({ operation: "customer_payment", businessId: input.businessId, targetId: customer._id.toString(), customerId, branchId, amount, currency, method: input.method, reference: input.reference });
        requestFingerprint = fingerprint;
      const existingPayment = await this.paymentModel.findOne({ businessId: input.businessId, externalId: input.externalId }).session(session).lean();
      if (existingPayment) {
        try { assertPaymentRequestMatches(existingPayment, fingerprint); }
        catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Payment idempotency conflict"); }
        return existingPayment;
      }
      const pendingProvider = input.method === "mpesa";
        if (input.method === "credit") throw new BadRequestException("Credit is a settlement state, not a payment method");
      const payment = (
        await this.paymentModel.create(
          [
            {
              businessId: input.businessId,
              branchId,
              customerId: input.customerId,
              externalId: input.externalId ?? null,
              saleId: null,
              debtPaymentId: `${input.customerId}-${Date.now()}`,
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
            }
          ],
          { session }
        )
      )[0]!;
      return payment.toObject();
      }); } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const existing = await this.paymentModel.findOne({ businessId: input.businessId, externalId: input.externalId }).lean();
        if (!existing || !requestFingerprint) throw error;
        try { assertPaymentRequestMatches(existing, requestFingerprint); } catch (conflict) { throw new BadRequestException(conflict instanceof Error ? conflict.message : "Payment idempotency conflict"); }
        return existing;
      }
  }

  async analytics(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const [customers, groups] = await Promise.all([this.list(businessId, scope), this.listGroups(businessId)]);
    const [sales, invoices, payments] = this.saleModel && this.invoiceModel
      ? await Promise.all([
          this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).select({ _id: 1, customerId: 1, externalId: 1, balanceDue: 1, currency: 1 }).lean(),
          this.invoiceModel.find({ businessId, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] }, ...buildBranchMatch(branchId) }).select({ customerId: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).lean(),
          this.paymentModel.find({ businessId, customerId: { $ne: null }, saleId: null, invoiceId: null, deletedAt: null, $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] }).select({ customerId: 1, amount: 1 }).lean()
        ])
      : [[], [], []];
    const canonicalBalances = new Map<string, number>();
    const canonicalCredits = new Map<string, number>();
    for (const customer of customers) {
      const customerKey = String(customer.id ?? "");
      const keys = [customerKey, String((customer as { _id?: unknown })._id ?? "")].filter(Boolean);
      canonicalBalances.set(customerKey, calculateCustomerOutstanding({
        sales: sales.filter((sale) => keys.includes(String(sale.customerId))).map((sale) => ({ _id: sale._id, id: String(sale.externalId ?? sale._id), externalId: sale.externalId ?? null, balanceDue: Number(sale.balanceDue ?? 0), currency: sale.currency ?? null })),
        invoices: invoices.filter((invoice) => keys.includes(String(invoice.customerId))).map((invoice) => ({ id: String(invoice.externalId ?? invoice._id), saleId: invoice.saleId ?? null, balanceDue: Number(invoice.balanceDue ?? 0), currency: invoice.currency ?? null })),
        standalonePayments: payments.filter((payment) => keys.includes(String(payment.customerId)))
      }));
      canonicalCredits.set(customerKey, calculateCustomerCredit(payments.filter((payment) => keys.includes(String(payment.customerId)))));
    }
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const grouped = new Map<string | null, { groupId: string | null; groupName: string; customerCount: number; outstanding: number; loyaltyPoints: number }>();

    for (const customer of customers) {
      const groupId = customer.groupId ?? null;
      const group = groupId ? groupById.get(groupId) ?? groups.find((candidate) => candidate.externalId === groupId) : null;
      const current = grouped.get(groupId) ?? {
        groupId,
        groupName: group?.name ?? (groupId ? "Archived group" : "Ungrouped"),
        customerCount: 0,
        outstanding: 0,
        loyaltyPoints: 0
      };
      current.customerCount += 1;
      current.outstanding += Math.max(0, Number(canonicalBalances.get(String(customer.id ?? "")) ?? 0));
      current.loyaltyPoints += Number(customer.loyaltyPoints ?? 0);
      grouped.set(groupId, current);
    }

    const sortedCustomers = [...customers]
      .sort((left, right) => Number(canonicalBalances.get(String(right.id ?? "")) ?? 0) - Number(canonicalBalances.get(String(left.id ?? "")) ?? 0))
      .slice(0, 8)
      .map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        balance: Math.max(0, Number(canonicalBalances.get(String(customer.id ?? "")) ?? 0)),
        customerCredit: Number(canonicalCredits.get(String(customer.id ?? "")) ?? 0),
        creditLimit: Number(customer.creditLimit ?? 0),
        loyaltyPoints: Number(customer.loyaltyPoints ?? 0)
      }));

    return {
      totalCustomers: customers.length,
      totalOutstanding: customers.reduce((sum, customer) => sum + Math.max(0, Number(canonicalBalances.get(String(customer.id ?? "")) ?? 0)), 0),
      totalCustomerCredit: customers.reduce((sum, customer) => sum + Number(canonicalCredits.get(String(customer.id ?? "")) ?? 0), 0),
      customerCredits: customers.map((customer) => ({ customerId: String(customer.id ?? ""), amount: Number(canonicalCredits.get(String(customer.id ?? "")) ?? 0) })),
      totalCreditLimit: customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.creditLimit ?? 0)), 0),
      totalLoyaltyPoints: customers.reduce((sum, customer) => sum + Number(customer.loyaltyPoints ?? 0), 0),
      owingCustomers: customers.filter((customer) => Math.max(0, Number(canonicalBalances.get(String(customer.id ?? "")) ?? 0)) > 0).length,
      grouped: [...grouped.values()].sort((left, right) => right.customerCount - left.customerCount),
      topBalances: sortedCustomers
    };
  }

  async reconcileBalance(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const customer = await this.findCustomerById(businessId, id, branchId);
    if (!customer) throw new NotFoundException("Customer not found");
    const keys = [customer._id.toString(), customer.externalId].filter(Boolean) as string[];
    const [sales, invoices, payments] = await Promise.all([
      this.saleModel!.find({ businessId, customerId: { $in: keys }, deletedAt: null, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.invoiceModel!.find({ businessId, customerId: { $in: keys }, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] }, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.paymentModel.find({ businessId, customerId: { $in: keys }, saleId: null, invoiceId: null, deletedAt: null, $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] }).select({ amount: 1 }).lean()
    ]);
    const calculatedBalance = calculateCustomerOutstanding({ sales, invoices, standalonePayments: payments });
    return { customerId: customer.externalId ?? customer._id.toString(), name: customer.name, customerCredit: calculateCustomerCredit(payments), ...reconcileCustomerBalance(customer.balance, calculatedBalance), status: customer.balance < 0 ? "INVALID" : calculatedBalance === customer.balance ? "MATCH" : "MISMATCH" };
  }

  async repairBalance(businessId: string, id: string, actorId: string, reason: string, operationId: string, scope: BranchScope = {}) {
    if (!reason?.trim()) throw new NotFoundException("A repair reason is required");
    if (!operationId?.trim()) throw new NotFoundException("An operation ID is required");
    return runInTransaction(this.connection, async (session) => {
      const prior = await this.auditLogModel!.findOne({ businessId, entityType: "customer", action: "balance_repaired", "payload.operationId": operationId }).session(session).lean();
      if (prior) return prior.payload;
      const customer = await this.findCustomerById(businessId, id, resolveWriteBranchId(scope, scope.branchId ?? null), session);
      if (!customer) throw new NotFoundException("Customer not found");
      const before = await this.reconcileBalance(businessId, customer._id.toString(), scope);
      const oldValue = Number(customer.balance ?? 0);
      customer.balance = before.calculatedBalance;
      await customer.save({ session });
      const result = { ...before, oldValue, newValue: before.calculatedBalance, repaired: true, operationId };
      await this.auditLogModel!.create([{ businessId, entityType: "customer", entityId: customer._id.toString(), action: "balance_repaired", actorId, payload: result }], { session });
      return result;
    });
  }

  private async findCustomerById(businessId: string, id: string, branchId?: string | null, session?: ClientSession | null) {
    const query: Record<string, unknown> = {
      businessId,
      deletedAt: null,
      $or: [{ _id: id }, { externalId: id }]
    };
    if (branchId) {
      query.$and = [buildBranchMatch(branchId)];
    }
    return this.customerModel.findOne(query).session(session ?? null);
  }

  private async findCustomerKeys(businessId: string, id: string, branchId?: string | null) {
    const customer = await this.findCustomerById(businessId, id, branchId);
    const keys = [id];
    if (customer?._id) {
      keys.push(customer._id.toString());
    }
    if (customer?.externalId) {
      keys.push(customer.externalId);
    }
    return [...new Set(keys.filter(Boolean))];
  }

  private async findGroupById(businessId: string, id: string) {
    return this.customerGroupModel.findOne({
      businessId,
      deletedAt: null,
      $or: [{ _id: id }, { externalId: id }]
    });
  }

  private normalizeCustomer(customer: Partial<Customer> & { _id?: unknown }) {
    const resolvedId = (customer.externalId ?? (customer._id ? customer._id.toString() : undefined)) as string | undefined;
    return {
      ...customer,
      id: resolvedId,
      groupId: customer.groupId ?? null,
      businessName: customer.businessName ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      address: customer.address ?? null,
      taxPin: customer.taxPin ?? null,
      notes: customer.notes ?? null,
      creditLimit: Number(customer.creditLimit ?? 0),
      loyaltyPoints: Number(customer.loyaltyPoints ?? 0),
      balance: Number(customer.balance ?? 0),
      attachments: this.normalizeAttachments(customer.attachments),
      deletedAt: customer.deletedAt ?? null
    };
  }

  private normalizeCustomerGroup(group: Partial<CustomerGroup> & { _id?: unknown }) {
    const resolvedId = (group.externalId ?? (group._id ? group._id.toString() : undefined)) as string | undefined;
    return {
      ...group,
      id: resolvedId,
      description: group.description ?? null,
      color: group.color ?? null,
      isActive: group.isActive ?? true,
      deletedAt: group.deletedAt ?? null
    };
  }

  private normalizeAttachments(input?: CustomerAttachmentInput[] | null) {
    if (!Array.isArray(input)) {
      return [];
    }
    return input.map((attachment, index) => ({
      id: attachment.id ?? `${Date.now()}-${index}`,
      label: attachment.label ?? "Attachment",
      url: attachment.url ?? "",
      note: attachment.note ?? null,
      addedAt: toSafeIsoString(attachment.addedAt ?? null)
    }));
  }
}
