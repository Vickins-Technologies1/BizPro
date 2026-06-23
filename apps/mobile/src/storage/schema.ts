export const schemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT,
    deviceId TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    lastSyncAt TEXT,
    themeMode TEXT NOT NULL DEFAULT 'dark',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    businessType TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    planTier TEXT NOT NULL,
    billingStatus TEXT NOT NULL DEFAULT 'trial',
    graceEndsAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    branchId TEXT,
    fullName TEXT NOT NULL,
    phone TEXT,
    passwordHash TEXT,
    pinHash TEXT,
    role TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    deviceName TEXT NOT NULL,
    platform TEXT NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 0,
    lastSeenAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    categoryId TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    unit TEXT NOT NULL,
    buyingPrice REAL NOT NULL DEFAULT 0,
    sellingPrice REAL NOT NULL DEFAULT 0,
    stockOnHand REAL NOT NULL DEFAULT 0,
    lowStockThreshold REAL NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    balance REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    supplierId TEXT,
    invoiceNumber TEXT,
    totalAmount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    purchaseDate TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY NOT NULL,
    purchaseId TEXT NOT NULL,
    productId TEXT NOT NULL,
    productName TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitCost REAL NOT NULL,
    lineTotal REAL NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    branchId TEXT,
    customerId TEXT,
    receiptNumber TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discountTotal REAL NOT NULL DEFAULT 0,
    taxTotal REAL NOT NULL DEFAULT 0,
    grandTotal REAL NOT NULL DEFAULT 0,
    amountPaid REAL NOT NULL DEFAULT 0,
    balanceDue REAL NOT NULL DEFAULT 0,
    paymentStatus TEXT NOT NULL,
    paymentMethod TEXT NOT NULL,
    cashierId TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY NOT NULL,
    saleId TEXT NOT NULL,
    productId TEXT NOT NULL,
    productName TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    costPrice REAL NOT NULL,
    lineDiscount REAL NOT NULL DEFAULT 0,
    lineTotal REAL NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    customerId TEXT,
    saleId TEXT,
    debtPaymentId TEXT,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT,
    note TEXT,
    provider TEXT,
    reconciledAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    categoryId TEXT,
    amount REAL NOT NULL,
    note TEXT NOT NULL,
    expenseDate TEXT NOT NULL,
    recordedById TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    productId TEXT NOT NULL,
    referenceType TEXT NOT NULL,
    referenceId TEXT NOT NULL,
    quantityDelta REAL NOT NULL,
    unitCost REAL NOT NULL,
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS sync_events (
    id TEXT PRIMARY KEY NOT NULL,
    eventId TEXT NOT NULL UNIQUE,
    businessId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastError TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    lastPulledAt TEXT,
    lastPushedAt TEXT,
    serverCursor TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,
  `
  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    branchId TEXT,
    openedById TEXT NOT NULL,
    closedById TEXT,
    openingFloat REAL NOT NULL DEFAULT 0,
    closingCash REAL,
    salesTotal REAL NOT NULL DEFAULT 0,
    expensesTotal REAL NOT NULL DEFAULT 0,
    openedAt TEXT NOT NULL,
    closedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );`,
  `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    businessId TEXT NOT NULL,
    actorId TEXT,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );`
];

export const schemaIndexes = [
  "CREATE INDEX IF NOT EXISTS idx_products_business ON products(businessId);",
  "CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);",
  "CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(businessId);",
  "CREATE INDEX IF NOT EXISTS idx_sales_business_created ON sales(businessId, createdAt);",
  "CREATE INDEX IF NOT EXISTS idx_expenses_business_created ON expenses(businessId, createdAt);",
  "CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);",
  "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(productId, createdAt);"
];
