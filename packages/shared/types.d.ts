import { INVENTORY_UNITS, BUSINESS_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PLAN_TIERS, SYNC_ACTIONS, USER_ROLES } from "./constants";
import type { AccessPermission } from "./access";
import type { IndustryKey } from "./industries";
export type { IndustryKey } from "./industries";
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type PlanTier = (typeof PLAN_TIERS)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type SyncAction = (typeof SYNC_ACTIONS)[number];
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export interface BaseEntity {
    id: string;
    businessId: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}
export interface Branch extends BaseEntity {
    name: string;
    code: string;
    isDefault: boolean;
}
export interface Business {
    id: string;
    name: string;
    slug: string;
    industryKey?: IndustryKey | null;
    businessType: BusinessType;
    currency: string;
    planTier: PlanTier;
    billingStatus: "trial" | "active" | "past_due" | "suspended";
    graceEndsAt?: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}
export interface User extends BaseEntity {
    ownerId?: string | null;
    branchId?: string | null;
    fullName: string;
    phone?: string | null;
    pinHash?: string | null;
    role: UserRole;
    roleLabel?: string | null;
    permissions?: AccessPermission[] | null;
    isActive: boolean;
    suspendedAt?: string | null;
    suspensionReason?: string | null;
}
export interface Device extends BaseEntity {
    deviceName: string;
    platform: "android" | "ios" | "web";
    lastSeenAt?: string | null;
    trusted: boolean;
}
export interface Category extends BaseEntity {
    name: string;
    color?: string | null;
    sortOrder: number;
}
export interface Product extends BaseEntity {
    serverId?: string | null;
    branchId?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    supplierId?: string | null;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
    serialNumber?: string | null;
    unit: InventoryUnit | string;
    buyingPrice: number;
    sellingPrice: number;
    stockOnHand: number;
    lowStockThreshold: number;
    isActive: boolean;
}
export interface Brand extends BaseEntity {
    name: string;
    description?: string | null;
    isActive: boolean;
}
export interface Customer extends BaseEntity {
    branchId?: string | null;
    groupId?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    creditLimit: number;
    loyaltyPoints: number;
    notes?: string | null;
    balance: number;
    attachments: CustomerAttachment[];
}
export interface CustomerAttachment {
    id: string;
    label: string;
    url: string;
    note?: string | null;
    addedAt: string;
}
export interface CustomerGroup extends BaseEntity {
    name: string;
    description?: string | null;
    color?: string | null;
    isActive: boolean;
}
export interface CustomerAnalytics {
    totalCustomers: number;
    totalOutstanding: number;
    totalCreditLimit: number;
    totalLoyaltyPoints: number;
    owingCustomers: number;
    grouped: Array<{
        groupId: string | null;
        groupName: string;
        customerCount: number;
        outstanding: number;
        loyaltyPoints: number;
    }>;
    topBalances: Array<{
        customerId: string;
        name: string;
        balance: number;
        creditLimit: number;
        loyaltyPoints: number;
    }>;
}
export interface Supplier extends BaseEntity {
    categoryId?: string | null;
    code?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    notes?: string | null;
    isActive: boolean;
}
export interface SupplierCategory extends BaseEntity {
    name: string;
    description?: string | null;
    color?: string | null;
    sortOrder: number;
    isActive: boolean;
}
export interface SupplierContact extends BaseEntity {
    supplierId: string;
    name: string;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
    isPrimary: boolean;
    notes?: string | null;
}
export interface SupplierDocument extends BaseEntity {
    supplierId: string;
    title: string;
    url: string;
    fileName?: string | null;
    documentType?: string | null;
    note?: string | null;
    uploadedById?: string | null;
}
export interface SupplierPayment extends BaseEntity {
    supplierId: string;
    purchaseOrderId?: string | null;
    amount: number;
    method: PaymentMethod;
    reference?: string | null;
    note?: string | null;
    paymentDate: string;
    recordedById?: string | null;
}
export interface SupplierStatementEntry {
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    kind: "bill" | "payment";
}
export interface SupplierStatement {
    supplierId: string;
    range: {
        from: string;
        to: string;
        label: string;
    };
    openingBalance: number;
    billedTotal: number;
    paidTotal: number;
    outstandingBalance: number;
    entries: SupplierStatementEntry[];
}
export interface SupplierPerformanceReport {
    supplierId: string;
    supplierName: string;
    ordersCount: number;
    billedTotal: number;
    paidTotal: number;
    outstandingBalance: number;
    averageOrderValue: number;
    paymentCoveragePercent: number;
    lastPaymentAt: string | null;
    lastOrderAt: string | null;
}
export interface PurchaseOrderLine {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
}
export interface PurchaseOrder extends BaseEntity {
    branchId?: string | null;
    supplierId?: string | null;
    orderNumber: string;
    status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
    orderDate: string;
    expectedDate?: string | null;
    receivedAt?: string | null;
    subtotal: number;
    taxTotal: number;
    total: number;
    notes?: string | null;
    items: PurchaseOrderLine[];
}
export interface StockTransferLine {
    productId: string;
    quantity: number;
    unitCost: number;
    batchNumber?: string | null;
    serialNumbers?: string[] | null;
}
export interface StockTransfer extends BaseEntity {
    transferNumber: string;
    fromBranchId?: string | null;
    toBranchId?: string | null;
    status: "draft" | "in_transit" | "received" | "cancelled";
    transferDate: string;
    receivedAt?: string | null;
    note?: string | null;
    items: StockTransferLine[];
}
export interface StockAdjustment extends BaseEntity {
    adjustmentNumber: string;
    productId: string;
    quantityDelta: number;
    unitCost: number;
    reason: string;
    referenceId?: string | null;
    note?: string | null;
}
export interface SaleItem {
    id: string;
    saleId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    lineDiscount: number;
    lineTotal: number;
}
export interface Payment {
    id: string;
    businessId: string;
    branchId?: string | null;
    customerId?: string | null;
    saleId?: string | null;
    debtPaymentId?: string | null;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    reference?: string | null;
    note?: string | null;
    provider?: string | null;
    reconciledAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Sale extends BaseEntity {
    branchId?: string | null;
    customerId?: string | null;
    receiptNumber: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    cashierId?: string | null;
    notes?: string | null;
    items: SaleItem[];
}
export interface Expense extends BaseEntity {
    branchId?: string | null;
    categoryId?: string | null;
    amount: number;
    note: string;
    expenseDate: string;
    recordedById?: string | null;
}
export interface BankAccount extends BaseEntity {
    bankName: string;
    accountName: string;
    accountNumber?: string | null;
    currency: string;
    openingBalance: number;
    currentBalance: number;
    isPrimary: boolean;
    notes?: string | null;
}
export interface PettyCashEntry extends BaseEntity {
    label: string;
    amount: number;
    direction: "in" | "out";
    category?: string | null;
    note?: string | null;
    recordedById?: string | null;
    entryDate: string;
}
export interface CreditNote extends BaseEntity {
    branchId?: string | null;
    reference: string;
    relatedSaleId?: string | null;
    customerId?: string | null;
    amount: number;
    reason: string;
    note?: string | null;
    creditDate: string;
    status: "draft" | "issued" | "void";
}
export interface FinanceInvoice {
    id: string;
    receiptNumber: string;
    customerId?: string | null;
    grandTotal: number;
    balanceDue: number;
    paymentStatus: PaymentStatus;
    createdAt: string;
}
export interface FinancePayment {
    id: string;
    businessId: string;
    branchId?: string | null;
    customerId?: string | null;
    saleId?: string | null;
    debtPaymentId?: string | null;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    reference?: string | null;
    note?: string | null;
    provider?: string | null;
    reconciledAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface FinanceOverview {
    incomeTotal: number;
    expensesTotal: number;
    profitLossTotal: number;
    cashFlowTotal: number;
    taxTotal: number;
    invoiceCount: number;
    invoiceTotal: number;
    creditNoteCount: number;
    creditNoteTotal: number;
    paymentTotal: number;
    bankBalanceTotal: number;
    pettyCashBalance: number;
}
export interface AnalyticsRevenuePoint {
    period: string;
    revenue: number;
    salesCount: number;
    expenses: number;
    profit: number;
}
export interface AnalyticsBarPoint {
    label: string;
    value: number;
    secondaryValue?: number;
    tertiaryValue?: number;
}
export interface EnterpriseAnalytics {
    range: {
        from: string;
        to: string;
        label: string;
    };
    summary: {
        revenueTotal: number;
        salesCount: number;
        productCount: number;
        customerCount: number;
        peakHour: string | null;
        peakHourSales: number;
        staffCount: number;
        averageOrderValue: number;
        profitTotal: number;
        monthlyGrowthPercent: number;
        forecastRevenue: number;
        inventoryTurnover: number;
    };
    revenueTrend: AnalyticsRevenuePoint[];
    salesTrend: AnalyticsBarPoint[];
    productPerformance: Array<AnalyticsBarPoint & {
        productId: string;
        revenue: number;
    }>;
    customerPerformance: Array<AnalyticsBarPoint & {
        customerId: string;
        balance: number;
    }>;
    peakHours: AnalyticsBarPoint[];
    staffPerformance: Array<AnalyticsBarPoint & {
        staffId: string;
        averageTicket: number;
    }>;
    inventoryTurnover: Array<AnalyticsBarPoint & {
        productId: string;
        stockOnHand: number;
    }>;
    profitTrends: AnalyticsRevenuePoint[];
    monthlyGrowth: Array<{
        month: string;
        revenue: number;
        growthPercent: number;
    }>;
    forecast: Array<{
        month: string;
        revenue: number;
    }>;
}
export interface StockMovement extends BaseEntity {
    branchId?: string | null;
    productId: string;
    referenceType: "sale" | "purchase" | "adjustment" | "restock" | "refund";
    referenceId: string;
    quantityDelta: number;
    unitCost: number;
    note?: string | null;
}
export interface SyncEventPayload<T = any> {
    eventId: string;
    businessId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: SyncAction;
    payload: T;
    createdAt: string;
}
export interface SyncCheckpoint {
    businessId: string;
    deviceId: string;
    lastPulledAt?: string | null;
    lastPushedAt?: string | null;
    serverCursor?: string | null;
}
export interface DailySummary {
    date: string;
    salesTotal: number;
    expensesTotal: number;
    cogsTotal: number;
    estimatedProfit: number;
    debtTotal: number;
    lowStockCount: number;
}
