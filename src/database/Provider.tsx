import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDB } from './db';
import type { RxDatabase } from 'rxdb';

const DbContext = createContext<RxDatabase | null>(null);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [db, setDb] = useState<RxDatabase | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            try {
                const database = await initDB();
                if (isMounted) {
                    setDb(database);
                }
            } catch (err) {
                console.error('Failed to initialize database', err);
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                }
            }
        };
        init();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleEmergencyExport = async () => {
        try {
            // RxDB+Dexie creates per-collection databases named rxdb-dexie-<dbName>-<collection>
            const allDbs = await indexedDB.databases?.() || [];
            const rxdbPrefix = 'rxdb-dexie-smartmarketdb_v4-';
            const matchingDbs = allDbs.filter(db => db.name?.startsWith(rxdbPrefix));

            if (matchingDbs.length === 0) {
                alert('No RxDB database collections found to export.');
                return;
            }

            const backupData: Record<string, any[]> = {};

            for (const dbInfo of matchingDbs) {
                const dbName = dbInfo.name!;
                const collectionName = dbName.substring(rxdbPrefix.length);
                try {
                    const idb = await new Promise<IDBDatabase>((resolve, reject) => {
                        const req = indexedDB.open(dbName);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });

                    const storeNames = Array.from(idb.objectStoreNames) as string[];
                    for (const storeName of storeNames) {
                        const docs = await new Promise<any[]>((resolve, reject) => {
                            const tx = idb.transaction(storeName, 'readonly');
                            const store = tx.objectStore(storeName);
                            const req = store.getAll();
                            req.onsuccess = () => resolve(req.result);
                            req.onerror = () => reject(req.error);
                        });
                        if (docs.length > 0) {
                            backupData[collectionName] = docs.map(doc => ({ ...doc }));
                        }
                    }
                    idb.close();
                } catch (err) {
                    console.warn(`Failed to read collection ${collectionName}:`, err);
                }
            }

            const primaryKeyMap: Record<string, string> = {
                products: 'id', users: 'user_id', invoices: 'invoice_id',
                debts: 'debt_id', units: 'unit_id', system_config: 'config_id',
                purchases: 'purchase_id', categories: 'category_id',
            };

            const rxdbDump: any = {
                name: 'smartmarketdb_v4',
                collections: Object.entries(backupData)
                    .filter(([name]) => !name.startsWith('_') && !name.includes('-'))
                    .map(([name, documents]) => ({
                        name,
                        schema: {
                            title: name,
                            version: 0,
                            primaryKey: primaryKeyMap[name] || 'id',
                            type: 'object',
                            properties: {}
                        },
                        documents
                    }))
            };

            const jsonStr = JSON.stringify(rxdbDump, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `smartmarket_emergency_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            alert('Emergency backup exported successfully! Please clear site data now, reload, and import this file.');
        } catch (err) {
            console.error(err);
            alert('Emergency export failed: ' + String(err));
        }
    };

    const handleClearAndReset = async () => {
        const confirmReset = window.confirm(
            '⚠️ تحذير: سيتم مسح قاعدة البيانات المحلية وإعادة تشغيل التطبيق.\n' +
            'الرجاء التأكد من تصدير نسخة احتياطية أولاً باستخدام الزر البرتقالي.\n\n' +
            'هل أنت متأكد من المسح وإعادة التشغيل؟'
        );
        if (!confirmReset) return;

        try {
            const allDbs = await indexedDB.databases?.() || [];
            const rxdbDbs = allDbs.filter(db => db.name?.startsWith('rxdb-dexie-smartmarketdb_v4'));

            const deletePromises = rxdbDbs.map(dbInfo => {
                return new Promise<void>((resolve) => {
                    const req = indexedDB.deleteDatabase(dbInfo.name!);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve(); // continue even on error
                    req.onblocked = () => resolve();
                });
            });

            await Promise.all(deletePromises);
            localStorage.clear();
            alert('تم مسح البيانات بنجاح. سيتم إعادة تشغيل التطبيق الآن.');
            window.location.reload();
        } catch {
            localStorage.clear();
            alert('فشل المسح التلقائي بالكامل، سيتم إعادة تشغيل التطبيق. يرجى مسح بيانات المتصفح يدوياً إذا لم تنجح العملية.');
            window.location.reload();
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200" dir="auto">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg border border-red-200 dark:border-red-900/50 space-y-4">
                    <h2 className="text-xl font-bold text-red-600">Database Error / خطأ في قاعدة البيانات</h2>
                    <p className="text-sm text-gray-500">
                        فشل تشغيل قاعدة البيانات المحلية. <strong>بياناتك لم تُحذف.</strong> السبب الأرجح هو تغيير في هيكلية البيانات بعد تحديث التطبيق. الرجاء اتباع الخطوات التالية:
                    </p>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                        <li>صدر بياناتك باستخدام زر "تصدير نسخة طارئة" بالأسفل لحفظ عملك.</li>
                        <li>اضغط على زر "مسح وإعادة تشغيل التطبيق" للتنظيف التلقائي.</li>
                        <li>أعد استيراد النسخة الاحتياطية بعد فتح البرنامج.</li>
                    </ol>
                    <p className="text-sm text-gray-500">
                        Failed to initialize the local database. <strong>Your data is safe.</strong> This is likely caused by a schema change after an app update. Please follow these steps:
                    </p>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                        <li>Click "Export Emergency Backup" below to save your data first.</li>
                        <li>Click "Clear & Reset App" to clean and reset automatically.</li>
                        <li>Import your backup file once the app opens.</li>
                    </ol>
                    <pre className="p-3 bg-red-500/10 rounded text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all">
                        {error.message || String(error)}
                    </pre>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={handleEmergencyExport} 
                            className="w-full py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-750 active:scale-95 transition-all text-sm cursor-pointer"
                        >
                            📥 Export Emergency Backup / تصدير نسخة احتياطية طارئة
                        </button>
                        <button 
                            onClick={handleClearAndReset} 
                            className="w-full py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-lg font-semibold hover:bg-red-600 hover:text-white active:scale-95 transition-all text-sm cursor-pointer"
                        >
                            🗑️ Clear & Reset App / مسح وإعادة تشغيل التطبيق
                        </button>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm cursor-pointer"
                        >
                            Retry / إعادة المحاولة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!db) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                <span className="mx-4 text-lg font-semibold text-gray-600 dark:text-gray-300">Initializing Database... / جاري تهيئة قاعدة البيانات...</span>
            </div>
        );
    }

    return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
};

// DbProvider and useDb intentionally live together so database consumers import from one place.
// eslint-disable-next-line react-refresh/only-export-components
export const useDb = () => {
    const context = useContext(DbContext);
    if (!context) {
        throw new Error('useDb must be used within a DbProvider');
    }
    return context;
};
