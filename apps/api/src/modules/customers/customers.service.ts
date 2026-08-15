import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model } from "mongoose";
import { Customer, CustomerDocument, CustomerGroup, CustomerGroupDocument, Payment, PaymentDocument } from "../schemas";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";

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
  phone?: string | null;
  email?: string | null;
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
    @InjectConnection() private readonly connection: Connection
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
      phone: input.phone ?? null,
      email: input.email ?? null,
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
    if (patch.phone !== undefined) customer.phone = patch.phone ?? null;
    if (patch.email !== undefined) customer.email = patch.email ?? null;
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
    externalId?: string | null;
    amount: number;
    method: Payment["method"];
    reference?: string | null;
    note?: string | null;
    recordedById?: string | null;
  }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, scope.branchId ?? null);
    if (input.externalId) {
      const existingPayment = await this.paymentModel.findOne({ businessId: input.businessId, externalId: input.externalId }).lean();
      if (existingPayment) {
        return existingPayment;
      }
    }
    return runInTransaction(this.connection, async (session) => {
      const customer = await this.findCustomerById(input.businessId, input.customerId, branchId, session);
      if (!customer) throw new NotFoundException("Customer not found");
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
              status: "paid",
              amount: input.amount,
              reference: input.reference ?? null,
              note: input.note ?? null,
              provider: input.method === "mpesa" ? "tuma" : null,
              reconciledAt: input.method === "mpesa" ? new Date() : null
            }
          ],
          { session }
        )
      )[0]!;
      customer.balance = Math.max(0, Number(customer.balance ?? 0) - Math.abs(input.amount));
      await customer.save({ session });
      return payment.toObject();
    });
  }

  async analytics(businessId: string, scope: BranchScope = {}) {
    const [customers, groups] = await Promise.all([this.list(businessId, scope), this.listGroups(businessId)]);
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
      current.outstanding += Math.max(0, Number(customer.balance ?? 0));
      current.loyaltyPoints += Number(customer.loyaltyPoints ?? 0);
      grouped.set(groupId, current);
    }

    const sortedCustomers = [...customers]
      .sort((left, right) => Number(right.balance ?? 0) - Number(left.balance ?? 0))
      .slice(0, 8)
      .map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        balance: Math.max(0, Number(customer.balance ?? 0)),
        creditLimit: Number(customer.creditLimit ?? 0),
        loyaltyPoints: Number(customer.loyaltyPoints ?? 0)
      }));

    return {
      totalCustomers: customers.length,
      totalOutstanding: customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.balance ?? 0)), 0),
      totalCreditLimit: customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.creditLimit ?? 0)), 0),
      totalLoyaltyPoints: customers.reduce((sum, customer) => sum + Number(customer.loyaltyPoints ?? 0), 0),
      owingCustomers: customers.filter((customer) => Math.max(0, Number(customer.balance ?? 0)) > 0).length,
      grouped: [...grouped.values()].sort((left, right) => right.customerCount - left.customerCount),
      topBalances: sortedCustomers
    };
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
      phone: customer.phone ?? null,
      email: customer.email ?? null,
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
      addedAt: attachment.addedAt ? new Date(attachment.addedAt).toISOString() : new Date().toISOString()
    }));
  }
}
