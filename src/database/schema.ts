import { toTypedRxJsonSchema } from 'rxdb';
import type { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';

export const productSchemaLiteral = {
    title: 'product schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        barcode: { type: 'string' },
        sku_serial: { type: 'string' },
        name_ar: { type: 'string' },
        name_en: { type: 'string' },
        category: { type: 'string' },
        cost_price: { type: 'number' },
        sale_price: { type: 'number' },
        stock_quantity: { type: 'number' },
        min_safety_stock: { type: 'number' },
        expiry_date: { type: 'string' },
    },
    required: ['id', 'name_ar', 'cost_price', 'sale_price', 'stock_quantity'],
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
        product_id: { type: 'string' },
        unit_name: { type: 'string' },
        conversion_factor: { type: 'number' },
        price_per_unit: { type: 'number' },
    },
    required: ['unit_id', 'product_id', 'unit_name', 'conversion_factor', 'price_per_unit'],
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
        timestamp: { type: 'string' },
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
        status: { type: 'string' }, // 'Pending' or 'Paid'
    },
    required: ['debt_id', 'client_supplier_name', 'type', 'amount', 'status'],
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
