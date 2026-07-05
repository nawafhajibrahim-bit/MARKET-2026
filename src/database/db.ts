/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema';

import {
    productSchema,
    unitSchema,
    invoiceSchema,
    debtSchema,
    systemConfigSchema,
    userSchema,
    branchSchema
} from './schema';

if (import.meta.env.DEV) {
    const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
    addRxPlugin(RxDBDevModePlugin);
}

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationPlugin);

import type { RxDatabase } from 'rxdb';

let dbPromise: Promise<RxDatabase> | null = null;

export const initDB = async (): Promise<RxDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = (async () => {
        const dbName = 'smartmarketdb_v4';
        const storage = wrappedValidateAjvStorage({
            storage: getRxStorageDexie()
        });

        // Request storage persistence to prevent the browser from automatically clearing database.
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then((persisted) => {
                console.log(persisted ? 'RxDB Storage: Persisted.' : 'RxDB Storage: Cache/Not persisted.');
            }).catch(err => {
                console.warn('Storage persistence request failed:', err);
            });
        }

        const db = await createRxDatabase({
            name: dbName,
            storage,
            ignoreDuplicate: import.meta.env.DEV // Allowed in dev-mode for React Strict Mode, disabled in production
        });

        // Add collections with migration strategies ready for future schema changes.
        // IMPORTANT: Never auto-delete the database on any error — user data must be preserved.
        // If a schema mismatch occurs after an app update, the user must export data,
        // clear site data, re-import, and try again. Data loss is unacceptable.
        await db.addCollections({
            products: {
                schema: productSchema,
                migrationStrategies: {
                    1: (oldDoc: any) => ({
                        ...oldDoc,
                        unit: oldDoc.unit || 'piece'
                    })
                }
            },
            units: {
                schema: unitSchema,
                migrationStrategies: {}
            },
            invoices: {
                schema: invoiceSchema,
                migrationStrategies: {}
            },
            debts: {
                schema: debtSchema,
                migrationStrategies: {}
            },
            system_config: {
                schema: systemConfigSchema,
                migrationStrategies: {}
            },
            users: {
                schema: userSchema,
                migrationStrategies: {
                    // v0 → v1: identity (original schema introduction)
                    1: (oldDoc: any) => oldDoc,
                    // v1 → v2: add optional `password_salt` field.
                    // Legacy users keep password_salt undefined (= legacy SHA-256 hash);
                    // they are transparently upgraded to PBKDF2 on next successful login.
                    2: (oldDoc: any) => ({ ...oldDoc, password_salt: oldDoc.password_salt ?? '' })
                }
            },
            branches: {
                schema: branchSchema,
                migrationStrategies: {}
            }
        });

        await seedDemoData(db);
        return db;
    })().catch((err) => {
        dbPromise = null; // Reset promise on total failure to allow subsequent retries
        // CRITICAL: Do NOT auto-delete the database. Preserve user data at all costs.
        console.error('Database initialization failed. DATA HAS NOT BEEN DELETED.', err);
        throw new Error(
            'Database initialization failed — your data is safe. ' +
            'Possible causes: schema mismatch after an app update, or IndexedDB being blocked by the browser. ' +
            'If you just updated the app, please export your data first, then clear site data and re-import. ' +
            'Technical details: ' + (err instanceof Error ? err.message : String(err))
        );
    });

    return dbPromise;
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
                    expiry_date: "2026-12-31",
                    unit: "piece"
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
                    expiry_date: "2027-06-30",
                    unit: "piece"
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
                    expiry_date: "2026-10-15",
                    unit: "piece"
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
                    expiry_date: "2028-05-20",
                    unit: "piece"
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
                    expiry_date: "2028-01-01",
                    unit: "piece"
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


