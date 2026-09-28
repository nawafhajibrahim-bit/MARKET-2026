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
    branchSchema,
    purchaseSchema,
    orderSchema,
    supplierSchema
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
                    1: (oldDoc: any) => {
                        try {
                            const cleaned: any = {
                                id: String(oldDoc?.id || 'unknown'),
                                barcode: String(oldDoc?.barcode || ''),
                                name_ar: String(oldDoc?.name_ar || 'unknown'),
                                category: String(oldDoc?.category || 'unknown'),
                                cost_price: Number(oldDoc?.cost_price) || 0,
                                sale_price: Number(oldDoc?.sale_price) || 0,
                                stock_quantity: Number(oldDoc?.stock_quantity) || 0,
                                unit: typeof oldDoc?.unit === 'string' && oldDoc.unit.trim() ? oldDoc.unit : 'piece'
                            };

                            if (oldDoc?.sku_serial != null) cleaned.sku_serial = String(oldDoc.sku_serial);
                            if (oldDoc?.name_en != null) cleaned.name_en = String(oldDoc.name_en);
                            if (oldDoc?.min_safety_stock != null) cleaned.min_safety_stock = Number(oldDoc.min_safety_stock) || 0;
                            if (oldDoc?.expiry_date != null) cleaned.expiry_date = String(oldDoc.expiry_date);

                            // Keep internal RxDB fields required for migration
                            if (oldDoc?._deleted != null) cleaned._deleted = oldDoc._deleted;
                            if (oldDoc?._attachments != null) cleaned._attachments = oldDoc._attachments;
                            if (oldDoc?._meta != null) cleaned._meta = oldDoc._meta;
                            if (oldDoc?._rev != null) cleaned._rev = oldDoc._rev;

                            return cleaned;
                        } catch (err) {
                            console.error('Error in products migration strategy 1:', err);
                            return {
                                id: String(oldDoc?.id || 'unknown'),
                                barcode: String(oldDoc?.barcode || ''),
                                name_ar: String(oldDoc?.name_ar || 'unknown'),
                                category: String(oldDoc?.category || 'unknown'),
                                cost_price: Number(oldDoc?.cost_price) || 0,
                                sale_price: Number(oldDoc?.sale_price) || 0,
                                stock_quantity: Number(oldDoc?.stock_quantity) || 0,
                                unit: 'piece',
                                _deleted: oldDoc?._deleted ?? false,
                                _rev: oldDoc?._rev,
                                _meta: oldDoc?._meta,
                                _attachments: oldDoc?._attachments
                            };
                        }
                    },
                    2: (oldDoc: any) => {
                        try {
                            const cleaned: any = { ...oldDoc };
                            cleaned.image = typeof oldDoc?.image === 'string' ? oldDoc.image : '';
                            cleaned.description = typeof oldDoc?.description === 'string' ? oldDoc.description : '';
                            cleaned.is_available = oldDoc?.is_available !== false;
                            cleaned.badge = typeof oldDoc?.badge === 'string' ? oldDoc.badge : '';
                            cleaned.discount_price = Number(oldDoc?.discount_price) || 0;
                            cleaned.supplier_name = typeof oldDoc?.supplier_name === 'string' ? oldDoc.supplier_name : '';
                            cleaned.supplier_id = typeof oldDoc?.supplier_id === 'string' ? oldDoc.supplier_id : '';
                            return cleaned;
                        } catch {
                            return {
                                ...oldDoc,
                                image: '',
                                description: '',
                                is_available: true,
                                badge: '',
                                discount_price: 0,
                                supplier_name: '',
                                supplier_id: ''
                            };
                        }
                    }
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
            },
            purchases: {
                schema: purchaseSchema,
                migrationStrategies: {}
            },
            orders: {
                schema: orderSchema,
                migrationStrategies: {}
            },
            suppliers: {
                schema: supplierSchema,
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
        // Prevent auto-re-seeding if products were intentionally cleared or already seeded once
        if (localStorage.getItem('smartmarket_demo_seeded') === 'true') {
            return;
        }

        const count = await db.products.find().exec().then((docs: any[]) => docs.length);
        if (count === 0) {
            localStorage.setItem('smartmarket_demo_seeded', 'true');
            const demoProducts = [
                {
                    id: "demo-prod-1",
                    barcode: "6281000000011",
                    sku_serial: "SKU-OIL-01",
                    name_ar: "زيت طهي نقي (كرتونة)",
                    name_en: "Pure Cooking Oil (Carton)",
                    description: "كرتونة تحتوي على 12 عبوة سعة 1.5 لتر، جودة ممتازة للقلي والطهي",
                    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80",
                    category: "زيوت ودهون",
                    cost_price: 18,
                    sale_price: 20,
                    discount_price: 0,
                    badge: "سعر مميز",
                    stock_quantity: 100,
                    min_safety_stock: 5,
                    expiry_date: "2027-12-31",
                    unit: "كرتونة",
                    is_available: true,
                    supplier_name: "مخزن البركة للمواد الغذائية",
                    supplier_id: "demo-supp-1"
                },
                {
                    id: "demo-prod-2",
                    barcode: "6281000000028",
                    sku_serial: "SKU-RICE-02",
                    name_ar: "أرز بسمتي درجة أولى (صندوق 4 أكياس)",
                    name_en: "Basmati Rice Box (4 Bags)",
                    description: "صندوق أرز بسمتي هندي عنبر أصلي، 4 أكياس كل كيس 5 كجم",
                    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80",
                    category: "حبوب وأرز",
                    cost_price: 36,
                    sale_price: 42,
                    discount_price: 39,
                    badge: "عرض خاص",
                    stock_quantity: 50,
                    min_safety_stock: 3,
                    expiry_date: "2028-06-30",
                    unit: "صندوق",
                    is_available: true,
                    supplier_name: "مخزن البركة للمواد الغذائية",
                    supplier_id: "demo-supp-1"
                },
                {
                    id: "demo-prod-3",
                    barcode: "6281000000035",
                    sku_serial: "SKU-SUGAR-03",
                    name_ar: "سكر ناعم ممتاز (كرتونة 10 كجم)",
                    name_en: "Pure White Sugar (Carton 10kg)",
                    description: "كرتونة سكر أبيض ناصع معبأ في 10 أكياس كل كيس 1 كجم",
                    image: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&q=80",
                    category: "مواد تموينية",
                    cost_price: 11,
                    sale_price: 13.5,
                    discount_price: 0,
                    badge: "",
                    stock_quantity: 80,
                    min_safety_stock: 5,
                    expiry_date: "2028-10-15",
                    unit: "كرتونة",
                    is_available: true,
                    supplier_name: "مخازن الأمانة للتوزيع",
                    supplier_id: "demo-supp-2"
                },
                {
                    id: "demo-prod-4",
                    barcode: "6281000000042",
                    sku_serial: "SKU-MILK-04",
                    name_ar: "حليب طويل الأجل كامل الدسم (كرتونة)",
                    name_en: "UHT Whole Milk (Carton)",
                    description: "كرتونة حليب 12 عبوة سعة 1 لتر معقم عالي الجودة",
                    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80",
                    category: "ألبان ومشروبات",
                    cost_price: 14,
                    sale_price: 16.5,
                    discount_price: 15.5,
                    badge: "خصم",
                    stock_quantity: 60,
                    min_safety_stock: 5,
                    expiry_date: "2027-04-20",
                    unit: "كرتونة",
                    is_available: true,
                    supplier_name: "مخزن البركة للمواد الغذائية",
                    supplier_id: "demo-supp-1"
                },
                {
                    id: "demo-prod-5",
                    barcode: "6281000000059",
                    sku_serial: "SKU-TEA-05",
                    name_ar: "شاي سيلاني فاخر (باكيت 24 علبة)",
                    name_en: "Ceylon Tea (Packet 24 boxes)",
                    description: "باكيت شاي سيلاني نقي يحتوي على 24 علبة شاي 200 جم",
                    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80",
                    category: "شاي وقهوة",
                    cost_price: 25,
                    sale_price: 30,
                    discount_price: 0,
                    badge: "",
                    stock_quantity: 40,
                    min_safety_stock: 4,
                    expiry_date: "2028-01-01",
                    unit: "باكيت",
                    is_available: true,
                    supplier_name: "مخازن الأمانة للتوزيع",
                    supplier_id: "demo-supp-2"
                }
            ];

            for (const prod of demoProducts) {
                const existing = await db.products.findOne(prod.id).exec();
                if (!existing) {
                    await db.products.insert(prod).catch(() => {});
                }
            }

            // Seed demo suppliers
            const demoSuppliers = [
                {
                    supplier_id: "demo-supp-1",
                    name: "مخزن البركة للمواد الغذائية",
                    phone: "+9647501234567",
                    whatsapp: "+9647501234567",
                    store_name: "البركة للتجارة",
                    notes: "مورد زيوت وأرز وألبان - سرعة في تجهيز الطلبات",
                    created_at: new Date().toISOString()
                },
                {
                    supplier_id: "demo-supp-2",
                    name: "مخازن الأمانة للتوزيع",
                    phone: "+9647507654321",
                    whatsapp: "+9647507654321",
                    store_name: "الأمانة للمواد التموينية",
                    notes: "مورد سكر وشاي ومعلبات - خصم على الكميات الكبيرة",
                    created_at: new Date().toISOString()
                }
            ];

            for (const supp of demoSuppliers) {
                const existing = await db.suppliers.findOne(supp.supplier_id).exec();
                if (!existing) {
                    await db.suppliers.insert(supp).catch(() => {});
                }
            }

            console.log('Demo products and suppliers seeded successfully!');
        }
    } catch (seedErr) {
        console.error('Failed to seed demo data', seedErr);
    }
};


