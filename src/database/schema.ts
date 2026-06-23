import { toTypedRxJsonSchema } from 'rxdb';
import type { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';

export const productSchemaLiteral = {
    title: 'product schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        barcode: { type: 'string', maxLength: 100 },
        sku_serial: { type: 'string' },
        name_ar: { type: 'string' },
        name_en: { type: 'string' },
        category: { type: 'string', maxLength: 100 },
        cost_price: { type: 'number' },
        sale_price: { type: 'number' },
        stock_quantity: { type: 'number' },
        min_safety_stock: { type: 'number' },
        expiry_date: { type: 'string' },
    },
    required: ['id', 'barcode', 'category', 'name_ar', 'cost_price', 'sale_price', 'stock_quantity'],
    indexes: ['barcode', 'category'],
} as const;
export const schemaTypedProduct = toTypedRxJsonSchema(productSchemaLiteral);
export type ProductDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedProduct>;
export const productSchema: RxJsonSchema<ProductDocType> = productSchemaLiteral;


export const unitSchemaLiteral = {
    title: 'unit schema',
    version: 0,
    primaryKey: 'unit_id',
    type: 'object',
    properties: {
        unit_id: { type: 'string', maxLength: 100 },
        product_id: { type: 'string', maxLength: 100 },
        unit_name: { type: 'string' },
        conversion_factor: { type: 'number' },
        price_per_unit: { type: 'number' },
    },
    required: ['unit_id', 'product_id', 'unit_name', 'conversion_factor', 'price_per_unit'],
    indexes: ['product_id'],
} as const;
export const schemaTypedUnit = toTypedRxJsonSchema(unitSchemaLiteral);
export type UnitDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedUnit>;
export const unitSchema: RxJsonSchema<UnitDocType> = unitSchemaLiteral;


export const invoiceSchemaLiteral = {
    title: 'invoice schema',
    version: 0,
    primaryKey: 'invoice_id',
    type: 'object',
    properties: {
        invoice_id: { type: 'string', maxLength: 100 },
        timestamp: { type: 'string', maxLength: 100 },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    product_id: { type: 'string' },
                    unit_used: { type: 'string' },
                    quantity: { type: 'number' },
                    price: { type: 'number' },
                }
            }
        },
        total_amount: { type: 'number' },
        currency: { type: 'string' },
        exchange_rate_applied: { type: 'number' },
        payment_type: { type: 'string' },
        actual_profit: { type: 'number' },
        discount_amount: { type: 'number' },
    },
    required: ['invoice_id', 'timestamp', 'total_amount', 'currency', 'payment_type'],
    indexes: ['timestamp'],
} as const;
export const schemaTypedInvoice = toTypedRxJsonSchema(invoiceSchemaLiteral);
export type InvoiceDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedInvoice>;
export const invoiceSchema: RxJsonSchema<InvoiceDocType> = invoiceSchemaLiteral;


export const debtSchemaLiteral = {
    title: 'debt schema',
    version: 0,
    primaryKey: 'debt_id',
    type: 'object',
    properties: {
        debt_id: { type: 'string', maxLength: 100 },
        client_supplier_name: { type: 'string' },
        phone: { type: 'string' },
        type: { type: 'string' }, // 'Customer Debt' or 'Supplier Credit'
        amount: { type: 'number' },
        paid_amount: { type: 'number' },
        due_date: { type: 'string' },
        status: { type: 'string', maxLength: 50 }, // 'Pending' or 'Paid'
    },
    required: ['debt_id', 'client_supplier_name', 'type', 'amount', 'status'],
    indexes: ['status'],
} as const;
export const schemaTypedDebt = toTypedRxJsonSchema(debtSchemaLiteral);
export type DebtDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedDebt>;
export const debtSchema: RxJsonSchema<DebtDocType> = debtSchemaLiteral;


export const systemConfigSchemaLiteral = {
    title: 'system config schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 }, // usually just 'config'
        license_key: { type: 'string' },
        activation_status: { type: 'boolean' },
        last_sync_timestamp: { type: 'string' },
        offline_grace_days_left: { type: 'number' },
        hardware_fingerprint: { type: 'string' },
        activation_token: { type: 'string' },
        clock_tamper_detected: { type: 'boolean' },
    },
    required: ['id'],
} as const;
export const schemaTypedSystemConfig = toTypedRxJsonSchema(systemConfigSchemaLiteral);
export type SystemConfigDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedSystemConfig>;
export const systemConfigSchema: RxJsonSchema<SystemConfigDocType> = systemConfigSchemaLiteral;


// ───────────────────────────────────────────────
// User schema (RBAC)
//
// Version history:
//   v1: original schema
//   v2: added `password_salt` for per-user PBKDF2 password hashing.
//       Legacy users (salt = '') still authenticate with the old SHA-256 hash
//       and are transparently upgraded to PBKDF2 on next successful login.
// ───────────────────────────────────────────────
export const userSchemaLiteral = {
    title: 'user schema',
    version: 2,
    primaryKey: 'user_id',
    type: 'object',
    properties: {
        user_id: { type: 'string', maxLength: 100 },
        username: { type: 'string', maxLength: 100 },
        password_hash: { type: 'string', maxLength: 256 }, // PBKDF2 hex (or legacy SHA-256 hex)
        password_salt: { type: 'string', maxLength: 64 }, // per-user random salt (hex). Empty = legacy SHA-256 hash.
        display_name: { type: 'string' },
        role: { type: 'string', maxLength: 50 }, // 'admin' | 'cashier' | 'manager'
        branch_id: { type: 'string', maxLength: 100 }, // nullable for global admins
        created_at: { type: 'string' },
        is_active: { type: 'boolean' },
    },
    required: ['user_id', 'username', 'password_hash', 'role', 'is_active'],
    indexes: ['username', 'role'],
} as const;
export const schemaTypedUser = toTypedRxJsonSchema(userSchemaLiteral);
export type UserDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedUser>;
export const userSchema: RxJsonSchema<UserDocType> = userSchemaLiteral;


// ───────────────────────────────────────────────
// Branch schema (Multi-Branch)
// ───────────────────────────────────────────────
export const branchSchemaLiteral = {
    title: 'branch schema',
    version: 0,
    primaryKey: 'branch_id',
    type: 'object',
    properties: {
        branch_id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        address: { type: 'string' },
        phone: { type: 'string' },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
    },
    required: ['branch_id', 'name', 'is_active'],
    indexes: ['name'],
} as const;
export const schemaTypedBranch = toTypedRxJsonSchema(branchSchemaLiteral);
export type BranchDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTypedBranch>;
export const branchSchema: RxJsonSchema<BranchDocType> = branchSchemaLiteral;
