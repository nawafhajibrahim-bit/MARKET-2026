/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRxDatabase, addRxPlugin, removeRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';

import {
    productSchema,
    unitSchema,
    invoiceSchema,
    debtSchema,
    systemConfigSchema
} from './schema';

if (import.meta.env.DEV) {
    const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
    addRxPlugin(RxDBDevModePlugin);
}

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBJsonDumpPlugin);

export const initDB = async () => {
    const dbName = 'smartmarketdb_v3';
    const storage = wrappedValidateAjvStorage({
        storage: getRxStorageDexie()
    });

    try {
        // Create the database
        const db = await createRxDatabase({
            name: dbName,
            storage,
            ignoreDuplicate: import.meta.env.DEV // Allowed in dev-mode for React Strict Mode, disabled in production
        });

        // Add collections
        await db.addCollections({
            products: {
                schema: productSchema
            },
            units: {
                schema: unitSchema
            },
            invoices: {
                schema: invoiceSchema
            },
            debts: {
                schema: debtSchema
            },
            system_config: {
                schema: systemConfigSchema
            }
        });

        await seedDemoData(db);
        return db;
    } catch (err) {
        console.warn('Database initialization failed (likely schema mismatch). Recreating database...', err);
        try {
            await removeRxDatabase(dbName, storage);
        } catch (removeErr) {
            console.error('Failed to remove database', removeErr);
        }

        // Retry creation from scratch
        const db = await createRxDatabase({
            name: dbName,
            storage,
            ignoreDuplicate: import.meta.env.DEV
        });

        await db.addCollections({
            products: {
                schema: productSchema
            },
            units: {
                schema: unitSchema
            },
            invoices: {
                schema: invoiceSchema
            },
            debts: {
                schema: debtSchema
            },
            system_config: {
                schema: systemConfigSchema
            }
        });

        await seedDemoData(db);
        return db;
    }
};

const seedDemoData = async (db: any) => {
    try {
        const count = await db.products.find().exec().then((docs: any[]) => docs.length);
        if (count === 0) {
            const demoProducts = [
                {
                    id: "demo-prod-1",
                    barcode: "6281000000011",
                    sku_serial: "SKU-MILK-01",
                    name_ar: "حليب كامل الدسم 1 لتر",
                    name_en: "Whole Milk 1L",
                    category: "المواد الغذائية",
                    cost_price: 1000,
                    sale_price: 1500,
                    stock_quantity: 50,
                    min_safety_stock: 5,
                    expiry_date: "2026-12-31"
                },
                {
                    id: "demo-prod-2",
                    barcode: "6281000000028",
                    sku_serial: "SKU-RICE-02",
                    name_ar: "أرز بسمتي 5 كجم",
                    name_en: "Basmati Rice 5kg",
                    category: "المواد الغذائية",
                    cost_price: 8000,
                    sale_price: 11000,
                    stock_quantity: 20,
                    min_safety_stock: 3,
                    expiry_date: "2027-06-30"
                },
                {
                    id: "demo-prod-3",
                    barcode: "6281000000035",
                    sku_serial: "SKU-OIL-03",
                    name_ar: "زيت طهي 1.5 لتر",
                    name_en: "Cooking Oil 1.5L",
                    category: "المواد الغذائية",
                    cost_price: 3500,
                    sale_price: 4500,
                    stock_quantity: 30,
                    min_safety_stock: 5,
                    expiry_date: "2026-10-15"
                },
                {
                    id: "demo-prod-4",
                    barcode: "6281000000042",
                    sku_serial: "SKU-SHAMP-04",
                    name_ar: "شامبو الشعر 400 مل",
                    name_en: "Shampoo 400ml",
                    category: "العناية الشخصية",
                    cost_price: 2500,
                    sale_price: 3750,
                    stock_quantity: 15,
                    min_safety_stock: 2,
                    expiry_date: "2028-05-20"
                },
                {
                    id: "demo-prod-5",
                    barcode: "6281000000059",
                    sku_serial: "SKU-SOAP-05",
                    name_ar: "صابون سائل لليدين",
                    name_en: "Liquid Hand Soap",
                    category: "العناية الشخصية",
                    cost_price: 1200,
                    sale_price: 1800,
                    stock_quantity: 40,
                    min_safety_stock: 4,
                    expiry_date: "2028-01-01"
                }
            ];

            for (const prod of demoProducts) {
                const existing = await db.products.findOne(prod.id).exec();
                if (!existing) {
                    await db.products.insert(prod).catch(() => {});
                }
            }

            const existingUnit = await db.units.findOne("demo-unit-1").exec();
            if (!existingUnit) {
                await db.units.insert({
                    unit_id: "demo-unit-1",
                    product_id: "demo-prod-1",
                    unit_name: "كرتونة (12 علبة)",
                    conversion_factor: 12,
                    price_per_unit: 16000
                }).catch(() => {});
            }

            console.log('Demo products and units seeded successfully!');
        }
    } catch (seedErr) {
        console.error('Failed to seed demo data', seedErr);
    }
};


