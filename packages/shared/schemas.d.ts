import { z } from "zod";
export declare const businessSetupSchema: z.ZodObject<{
    ownerName: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
    businessName: z.ZodString;
    industryKey: z.ZodOptional<z.ZodEnum<["retail", "food_beverage", "beauty", "hospitality", "healthcare", "agriculture", "automotive", "services", "professional_services"]>>;
    businessType: z.ZodEnum<["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant", "cafe", "bakery", "bar", "salon", "spa", "hotel", "lodge", "clinic", "pharmacy", "dental_clinic", "farm", "feed_store", "garage", "auto_parts", "service_center", "tyre_business", "body_shop", "general_service", "consultancy", "agency", "law_firm", "accounting_firm"]>;
    planTier: z.ZodEnum<["command", "pro", "elite", "enterprise"]>;
    currency: z.ZodDefault<z.ZodString>;
    branchName: z.ZodString;
    cashierPin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant" | "cafe" | "bakery" | "bar" | "salon" | "spa" | "hotel" | "lodge" | "clinic" | "pharmacy" | "dental_clinic" | "farm" | "feed_store" | "garage" | "auto_parts" | "service_center" | "tyre_business" | "body_shop" | "general_service" | "consultancy" | "agency" | "law_firm" | "accounting_firm";
    planTier: "command" | "pro" | "elite" | "enterprise";
    branchName: string;
    industryKey?: "retail" | "food_beverage" | "beauty" | "hospitality" | "healthcare" | "agriculture" | "automotive" | "services" | "professional_services" | undefined;
    cashierPin?: string | undefined;
}, {
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant" | "cafe" | "bakery" | "bar" | "salon" | "spa" | "hotel" | "lodge" | "clinic" | "pharmacy" | "dental_clinic" | "farm" | "feed_store" | "garage" | "auto_parts" | "service_center" | "tyre_business" | "body_shop" | "general_service" | "consultancy" | "agency" | "law_firm" | "accounting_firm";
    planTier: "command" | "pro" | "elite" | "enterprise";
    branchName: string;
    currency?: string | undefined;
    industryKey?: "retail" | "food_beverage" | "beauty" | "hospitality" | "healthcare" | "agriculture" | "automotive" | "services" | "professional_services" | undefined;
    cashierPin?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    identifier: z.ZodString;
    passwordOrPin: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["owner", "manager", "supervisor", "cashier", "waiter", "receptionist", "stylist", "mechanic", "pharmacist"]>>;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "receptionist" | "stylist" | "mechanic" | "pharmacist" | undefined;
}, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "receptionist" | "stylist" | "mechanic" | "pharmacist" | undefined;
}>;
export declare const branchCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>;
    managerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    code: string;
    businessId: string;
    name: string;
    isDefault: boolean;
    phone?: string | null | undefined;
    location?: string | null | undefined;
    email?: string | null | undefined;
    managerId?: string | null | undefined;
    description?: string | null | undefined;
}, {
    code: string;
    businessId: string;
    name: string;
    phone?: string | null | undefined;
    status?: "active" | "inactive" | undefined;
    location?: string | null | undefined;
    email?: string | null | undefined;
    managerId?: string | null | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const branchUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>>;
    managerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["active", "inactive"]>>>;
    isDefault: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
} & {
    businessId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    phone?: string | null | undefined;
    status?: "active" | "inactive" | undefined;
    code?: string | undefined;
    name?: string | undefined;
    location?: string | null | undefined;
    email?: string | null | undefined;
    managerId?: string | null | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
}, {
    businessId: string;
    phone?: string | null | undefined;
    status?: "active" | "inactive" | undefined;
    code?: string | undefined;
    name?: string | undefined;
    location?: string | null | undefined;
    email?: string | null | undefined;
    managerId?: string | null | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const saleItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    costPrice: z.ZodDefault<z.ZodNumber>;
    discount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    unitPrice: number;
    discount: number;
    productId: string;
    costPrice: number;
}, {
    quantity: number;
    unitPrice: number;
    productId: string;
    discount?: number | undefined;
    costPrice?: number | undefined;
}>;
export declare const saleCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cashierId: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodEnum<["cash", "mpesa", "bank", "card", "cheque", "other", "credit"]>;
    paymentStatus: z.ZodEnum<["paid", "partial", "pending_confirmation", "credit", "unpaid", "reconciled", "manual_mpesa"]>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        costPrice: z.ZodDefault<z.ZodNumber>;
        discount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        unitPrice: number;
        discount: number;
        productId: string;
        costPrice: number;
    }, {
        quantity: number;
        unitPrice: number;
        productId: string;
        discount?: number | undefined;
        costPrice?: number | undefined;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
    discountTotal: z.ZodDefault<z.ZodNumber>;
    taxTotal: z.ZodDefault<z.ZodNumber>;
    amountPaid: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    amountPaid: number;
    businessId: string;
    paymentMethod: "cash" | "mpesa" | "bank" | "card" | "cheque" | "other" | "credit";
    paymentStatus: "credit" | "paid" | "partial" | "pending_confirmation" | "unpaid" | "reconciled" | "manual_mpesa";
    items: {
        quantity: number;
        unitPrice: number;
        discount: number;
        productId: string;
        costPrice: number;
    }[];
    discountTotal: number;
    taxTotal: number;
    branchId?: string | undefined;
    customerId?: string | null | undefined;
    cashierId?: string | undefined;
    notes?: string | undefined;
}, {
    businessId: string;
    paymentMethod: "cash" | "mpesa" | "bank" | "card" | "cheque" | "other" | "credit";
    paymentStatus: "credit" | "paid" | "partial" | "pending_confirmation" | "unpaid" | "reconciled" | "manual_mpesa";
    items: {
        quantity: number;
        unitPrice: number;
        productId: string;
        discount?: number | undefined;
        costPrice?: number | undefined;
    }[];
    amountPaid?: number | undefined;
    branchId?: string | undefined;
    customerId?: string | null | undefined;
    cashierId?: string | undefined;
    notes?: string | undefined;
    discountTotal?: number | undefined;
    taxTotal?: number | undefined;
}>;
export declare const expenseCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodNumber;
    note: z.ZodString;
    expenseDate: z.ZodString;
    recordedById: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    note: string;
    expenseDate: string;
    categoryId?: string | null | undefined;
    recordedById?: string | undefined;
}, {
    businessId: string;
    amount: number;
    note: string;
    expenseDate: string;
    categoryId?: string | null | undefined;
    recordedById?: string | undefined;
}>;
export declare const bankAccountCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    bankName: z.ZodString;
    accountName: z.ZodString;
    accountNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodString;
    openingBalance: z.ZodDefault<z.ZodNumber>;
    currentBalance: z.ZodDefault<z.ZodNumber>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    businessId: string;
    bankName: string;
    accountName: string;
    openingBalance: number;
    currentBalance: number;
    isPrimary: boolean;
    notes?: string | null | undefined;
    accountNumber?: string | null | undefined;
}, {
    currency: string;
    businessId: string;
    bankName: string;
    accountName: string;
    notes?: string | null | undefined;
    accountNumber?: string | null | undefined;
    openingBalance?: number | undefined;
    currentBalance?: number | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const pettyCashEntryCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    label: z.ZodString;
    amount: z.ZodNumber;
    direction: z.ZodEnum<["in", "out"]>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    recordedById: z.ZodOptional<z.ZodString>;
    entryDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    label: string;
    direction: "in" | "out";
    entryDate: string;
    note?: string | null | undefined;
    recordedById?: string | undefined;
    category?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    label: string;
    direction: "in" | "out";
    entryDate: string;
    note?: string | null | undefined;
    recordedById?: string | undefined;
    category?: string | null | undefined;
}>;
export declare const creditNoteCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    reference: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodString;
    invoiceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relatedSaleId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditDate: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "issued", "void"]>>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "void" | "issued";
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    creditDate: string;
    customerId?: string | null | undefined;
    note?: string | null | undefined;
    invoiceId?: string | null | undefined;
    relatedSaleId?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    creditDate: string;
    status?: "draft" | "void" | "issued" | undefined;
    customerId?: string | null | undefined;
    note?: string | null | undefined;
    invoiceId?: string | null | undefined;
    relatedSaleId?: string | null | undefined;
}>;
export declare const invoiceLineItemSchema: z.ZodObject<{
    productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    productName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    unitPrice: z.ZodNumber;
    discountType: z.ZodDefault<z.ZodEnum<["percentage", "fixed"]>>;
    discountValue: z.ZodDefault<z.ZodNumber>;
    taxCategory: z.ZodDefault<z.ZodEnum<["vat", "zero_rated", "exempt", "non_taxable", "custom"]>>;
    taxCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    taxRate: z.ZodDefault<z.ZodNumber>;
    taxInclusive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    quantity: number;
    taxRate: number;
    unitPrice: number;
    description: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    taxCategory: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
    taxInclusive: boolean;
    productId?: string | null | undefined;
    productName?: string | null | undefined;
    taxCode?: string | null | undefined;
}, {
    unit: string;
    quantity: number;
    unitPrice: number;
    description: string;
    taxRate?: number | undefined;
    productId?: string | null | undefined;
    productName?: string | null | undefined;
    discountType?: "percentage" | "fixed" | undefined;
    discountValue?: number | undefined;
    taxCategory?: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom" | undefined;
    taxCode?: string | null | undefined;
    taxInclusive?: boolean | undefined;
}>;
export declare const invoiceCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    branchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerBusinessName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerTaxPin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    invoiceNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    issueDate: z.ZodString;
    dueDate: z.ZodString;
    paymentTerms: z.ZodString;
    currency: z.ZodString;
    referenceNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    purchaseOrderNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    termsAndConditions: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void", "refunded", "archived"]>>;
    lineItems: z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        productName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodString;
        unitPrice: z.ZodNumber;
        discountType: z.ZodDefault<z.ZodEnum<["percentage", "fixed"]>>;
        discountValue: z.ZodDefault<z.ZodNumber>;
        taxCategory: z.ZodDefault<z.ZodEnum<["vat", "zero_rated", "exempt", "non_taxable", "custom"]>>;
        taxCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taxRate: z.ZodDefault<z.ZodNumber>;
        taxInclusive: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        unit: string;
        quantity: number;
        taxRate: number;
        unitPrice: number;
        description: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        taxCategory: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
        taxInclusive: boolean;
        productId?: string | null | undefined;
        productName?: string | null | undefined;
        taxCode?: string | null | undefined;
    }, {
        unit: string;
        quantity: number;
        unitPrice: number;
        description: string;
        taxRate?: number | undefined;
        productId?: string | null | undefined;
        productName?: string | null | undefined;
        discountType?: "percentage" | "fixed" | undefined;
        discountValue?: number | undefined;
        taxCategory?: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom" | undefined;
        taxCode?: string | null | undefined;
        taxInclusive?: boolean | undefined;
    }>, "many">;
    amountPaid: z.ZodDefault<z.ZodNumber>;
    discountTotal: z.ZodDefault<z.ZodNumber>;
    taxTotal: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    amountPaid: number;
    status: "paid" | "draft" | "cancelled" | "sent" | "viewed" | "partially_paid" | "overdue" | "void" | "refunded" | "archived";
    businessId: string;
    discountTotal: number;
    taxTotal: number;
    issueDate: string;
    dueDate: string;
    paymentTerms: string;
    lineItems: {
        unit: string;
        quantity: number;
        taxRate: number;
        unitPrice: number;
        description: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        taxCategory: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
        taxInclusive: boolean;
        productId?: string | null | undefined;
        productName?: string | null | undefined;
        taxCode?: string | null | undefined;
    }[];
    branchId?: string | null | undefined;
    customerId?: string | null | undefined;
    notes?: string | null | undefined;
    customerName?: string | null | undefined;
    customerBusinessName?: string | null | undefined;
    customerEmail?: string | null | undefined;
    customerPhone?: string | null | undefined;
    customerAddress?: string | null | undefined;
    customerTaxPin?: string | null | undefined;
    invoiceNumber?: string | null | undefined;
    referenceNumber?: string | null | undefined;
    purchaseOrderNumber?: string | null | undefined;
    termsAndConditions?: string | null | undefined;
}, {
    currency: string;
    businessId: string;
    issueDate: string;
    dueDate: string;
    paymentTerms: string;
    lineItems: {
        unit: string;
        quantity: number;
        unitPrice: number;
        description: string;
        taxRate?: number | undefined;
        productId?: string | null | undefined;
        productName?: string | null | undefined;
        discountType?: "percentage" | "fixed" | undefined;
        discountValue?: number | undefined;
        taxCategory?: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom" | undefined;
        taxCode?: string | null | undefined;
        taxInclusive?: boolean | undefined;
    }[];
    amountPaid?: number | undefined;
    status?: "paid" | "draft" | "cancelled" | "sent" | "viewed" | "partially_paid" | "overdue" | "void" | "refunded" | "archived" | undefined;
    branchId?: string | null | undefined;
    customerId?: string | null | undefined;
    notes?: string | null | undefined;
    discountTotal?: number | undefined;
    taxTotal?: number | undefined;
    customerName?: string | null | undefined;
    customerBusinessName?: string | null | undefined;
    customerEmail?: string | null | undefined;
    customerPhone?: string | null | undefined;
    customerAddress?: string | null | undefined;
    customerTaxPin?: string | null | undefined;
    invoiceNumber?: string | null | undefined;
    referenceNumber?: string | null | undefined;
    purchaseOrderNumber?: string | null | undefined;
    termsAndConditions?: string | null | undefined;
}>;
export declare const debitNoteCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    invoiceId: z.ZodString;
    reference: z.ZodString;
    reason: z.ZodString;
    amount: z.ZodNumber;
    taxAdjustment: z.ZodDefault<z.ZodNumber>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    issuedAt: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "issued", "void"]>>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "void" | "issued";
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    invoiceId: string;
    taxAdjustment: number;
    issuedAt: string;
    note?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    invoiceId: string;
    issuedAt: string;
    status?: "draft" | "void" | "issued" | undefined;
    note?: string | null | undefined;
    taxAdjustment?: number | undefined;
}>;
export declare const productCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    brandId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    supplierId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    name: z.ZodString;
    description: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    variants: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    addOns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recipeIngredients: z.ZodDefault<z.ZodArray<z.ZodObject<{
        ingredientId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        ingredientId: string;
    }, {
        quantity: number;
        ingredientId: string;
    }>, "many">>;
    serviceDurationMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    assignedStaffId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    commissionRate: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    compatibility: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    pricingModel: z.ZodOptional<z.ZodNullable<z.ZodEnum<["fixed", "hourly", "quantity", "recurring", "milestone", "custom"]>>>;
    hourlyPrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    quantityUnit: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    sku: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    barcode: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    batchNumber: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    expiryDate: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    serialNumber: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    unit: z.ZodString;
    buyingPrice: z.ZodNumber;
    sellingPrice: z.ZodNumber;
    stockOnHand: z.ZodDefault<z.ZodNumber>;
    lowStockThreshold: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    businessId: string;
    name: string;
    variants: string[];
    addOns: string[];
    recipeIngredients: {
        quantity: number;
        ingredientId: string;
    }[];
    buyingPrice: number;
    sellingPrice: number;
    stockOnHand: number;
    lowStockThreshold: number;
    isActive: boolean;
    barcode?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    sku?: string | null | undefined;
    description?: string | null | undefined;
    categoryId?: string | null | undefined;
    brandId?: string | null | undefined;
    supplierId?: string | null | undefined;
    serviceDurationMinutes?: number | null | undefined;
    assignedStaffId?: string | null | undefined;
    commissionRate?: number | null | undefined;
    compatibility?: string | null | undefined;
    pricingModel?: "custom" | "fixed" | "hourly" | "quantity" | "recurring" | "milestone" | null | undefined;
    hourlyPrice?: number | null | undefined;
    quantityUnit?: string | null | undefined;
    serialNumber?: string | null | undefined;
}, {
    unit: string;
    businessId: string;
    name: string;
    buyingPrice: number;
    sellingPrice: number;
    barcode?: unknown;
    batchNumber?: unknown;
    expiryDate?: unknown;
    sku?: unknown;
    description?: unknown;
    categoryId?: unknown;
    brandId?: unknown;
    supplierId?: unknown;
    variants?: string[] | undefined;
    addOns?: string[] | undefined;
    recipeIngredients?: {
        quantity: number;
        ingredientId: string;
    }[] | undefined;
    serviceDurationMinutes?: number | null | undefined;
    assignedStaffId?: unknown;
    commissionRate?: number | null | undefined;
    compatibility?: unknown;
    pricingModel?: "custom" | "fixed" | "hourly" | "quantity" | "recurring" | "milestone" | null | undefined;
    hourlyPrice?: number | null | undefined;
    quantityUnit?: unknown;
    serialNumber?: unknown;
    stockOnHand?: number | undefined;
    lowStockThreshold?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const brandCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    description?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    description?: string | null | undefined;
}>;
export declare const supplierCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>;
    contactName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    phone?: string | null | undefined;
    code?: string | null | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
    categoryId?: string | null | undefined;
    contactName?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    phone?: string | null | undefined;
    code?: string | null | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
    categoryId?: string | null | undefined;
    contactName?: string | null | undefined;
}>;
export declare const supplierCategoryCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
    description?: string | null | undefined;
    color?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    description?: string | null | undefined;
    isActive?: boolean | undefined;
    color?: string | null | undefined;
    sortOrder?: number | undefined;
}>;
export declare const supplierContactCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    name: z.ZodString;
    role: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    isPrimary: boolean;
    supplierId: string;
    phone?: string | null | undefined;
    role?: string | null | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    supplierId: string;
    phone?: string | null | undefined;
    role?: string | null | undefined;
    email?: string | null | undefined;
    notes?: string | null | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const supplierDocumentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    fileName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    documentType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    uploadedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    supplierId: string;
    title: string;
    url: string;
    note?: string | null | undefined;
    fileName?: string | null | undefined;
    documentType?: string | null | undefined;
    uploadedById?: string | null | undefined;
}, {
    businessId: string;
    supplierId: string;
    title: string;
    url: string;
    note?: string | null | undefined;
    fileName?: string | null | undefined;
    documentType?: string | null | undefined;
    uploadedById?: string | null | undefined;
}>;
export declare const supplierPaymentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    purchaseOrderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodNumber;
    method: z.ZodEnum<["cash", "mpesa", "bank", "card", "cheque", "other", "credit"]>;
    reference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentDate: z.ZodString;
    recordedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    supplierId: string;
    method: "cash" | "mpesa" | "bank" | "card" | "cheque" | "other" | "credit";
    paymentDate: string;
    note?: string | null | undefined;
    recordedById?: string | null | undefined;
    reference?: string | null | undefined;
    purchaseOrderId?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    supplierId: string;
    method: "cash" | "mpesa" | "bank" | "card" | "cheque" | "other" | "credit";
    paymentDate: string;
    note?: string | null | undefined;
    recordedById?: string | null | undefined;
    reference?: string | null | undefined;
    purchaseOrderId?: string | null | undefined;
}>;
export declare const purchaseOrderLineSchema: z.ZodObject<{
    productId: z.ZodString;
    productName: z.ZodString;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    unitCost: number;
    productId: string;
    productName: string;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
}, {
    quantity: number;
    unitCost: number;
    productId: string;
    productName: string;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
}>;
export declare const purchaseOrderCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orderNumber: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "ordered", "partially_received", "received", "cancelled"]>>;
    orderDate: z.ZodString;
    expectedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    receivedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    subtotal: z.ZodDefault<z.ZodNumber>;
    taxTotal: z.ZodDefault<z.ZodNumber>;
    total: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitCost: z.ZodNumber;
        batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        unitCost: number;
        productId: string;
        productName: string;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }, {
        quantity: number;
        unitCost: number;
        productId: string;
        productName: string;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    total: number;
    status: "draft" | "cancelled" | "ordered" | "partially_received" | "received";
    businessId: string;
    items: {
        quantity: number;
        unitCost: number;
        productId: string;
        productName: string;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }[];
    taxTotal: number;
    orderNumber: string;
    orderDate: string;
    subtotal: number;
    notes?: string | null | undefined;
    supplierId?: string | null | undefined;
    expectedDate?: string | null | undefined;
    receivedAt?: string | null | undefined;
}, {
    businessId: string;
    orderNumber: string;
    orderDate: string;
    total?: number | undefined;
    status?: "draft" | "cancelled" | "ordered" | "partially_received" | "received" | undefined;
    items?: {
        quantity: number;
        unitCost: number;
        productId: string;
        productName: string;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }[] | undefined;
    notes?: string | null | undefined;
    taxTotal?: number | undefined;
    supplierId?: string | null | undefined;
    expectedDate?: string | null | undefined;
    receivedAt?: string | null | undefined;
    subtotal?: number | undefined;
}>;
export declare const stockTransferLineSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    unitCost: z.ZodDefault<z.ZodNumber>;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serialNumbers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    unitCost: number;
    productId: string;
    serialNumbers: string[];
    batchNumber?: string | null | undefined;
}, {
    quantity: number;
    productId: string;
    batchNumber?: string | null | undefined;
    unitCost?: number | undefined;
    serialNumbers?: string[] | undefined;
}>;
export declare const stockTransferCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    fromBranchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    toBranchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    transferNumber: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "in_transit", "received", "cancelled"]>>;
    transferDate: z.ZodString;
    receivedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        unitCost: z.ZodDefault<z.ZodNumber>;
        batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        serialNumbers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        unitCost: number;
        productId: string;
        serialNumbers: string[];
        batchNumber?: string | null | undefined;
    }, {
        quantity: number;
        productId: string;
        batchNumber?: string | null | undefined;
        unitCost?: number | undefined;
        serialNumbers?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "cancelled" | "received" | "in_transit";
    businessId: string;
    items: {
        quantity: number;
        unitCost: number;
        productId: string;
        serialNumbers: string[];
        batchNumber?: string | null | undefined;
    }[];
    transferNumber: string;
    transferDate: string;
    note?: string | null | undefined;
    receivedAt?: string | null | undefined;
    fromBranchId?: string | null | undefined;
    toBranchId?: string | null | undefined;
}, {
    businessId: string;
    transferNumber: string;
    transferDate: string;
    status?: "draft" | "cancelled" | "received" | "in_transit" | undefined;
    items?: {
        quantity: number;
        productId: string;
        batchNumber?: string | null | undefined;
        unitCost?: number | undefined;
        serialNumbers?: string[] | undefined;
    }[] | undefined;
    note?: string | null | undefined;
    receivedAt?: string | null | undefined;
    fromBranchId?: string | null | undefined;
    toBranchId?: string | null | undefined;
}>;
export declare const stockAdjustmentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    productId: z.ZodString;
    adjustmentNumber: z.ZodString;
    quantityDelta: z.ZodNumber;
    unitCost: z.ZodDefault<z.ZodNumber>;
    reason: z.ZodString;
    referenceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    unitCost: number;
    businessId: string;
    productId: string;
    reason: string;
    adjustmentNumber: string;
    quantityDelta: number;
    note?: string | null | undefined;
    referenceId?: string | null | undefined;
}, {
    businessId: string;
    productId: string;
    reason: string;
    adjustmentNumber: string;
    quantityDelta: number;
    unitCost?: number | undefined;
    note?: string | null | undefined;
    referenceId?: string | null | undefined;
}>;
export declare const syncEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    businessId: z.ZodString;
    deviceId: z.ZodString;
    entityType: z.ZodString;
    entityId: z.ZodString;
    action: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodAny>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    eventId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, any>;
    createdAt: string;
}, {
    businessId: string;
    eventId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, any>;
    createdAt: string;
}>;
