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

    const handleEmergencyExport = () => {
        try {
            const dbName = 'smartmarketdb_v4';
            const request = indexedDB.open(dbName);
            request.onsuccess = async (event: any) => {
                const idb = event.target.result;
                const storeNames = Array.from(idb.objectStoreNames) as string[];
                const backupData: any = {};
                
                if (storeNames.length === 0) {
                    alert('No database collections found to export.');
                    idb.close();
                    return;
                }

                try {
                    const transaction = idb.transaction(storeNames, 'readonly');
                    const promises = storeNames.map((storeName) => {
                        return new Promise<void>((resolve, reject) => {
                            const store = transaction.objectStore(storeName);
                            const req = store.getAll();
                            req.onsuccess = (e: any) => {
                                backupData[storeName] = e.target.result;
                                resolve();
                            };
                            req.onerror = () => {
                                reject(req.error);
                            };
                        });
                    });

                    await Promise.all(promises);

                    const prefix = `${dbName}-`;
                    const rxdbDump: any = {
                        name: dbName,
                        collections: []
                    };

                    storeNames.forEach((storeName) => {
                        if (storeName.startsWith(prefix)) {
                            const collectionName = storeName.substring(prefix.length);
                            if (!collectionName.startsWith('_') && !collectionName.includes('-')) {
                                const docs = (backupData[storeName] || []).map((doc: any) => ({ ...doc }));
                                rxdbDump.collections.push({
                                    name: collectionName,
                                    schema: {
                                        title: collectionName,
                                        version: 0,
                                        primaryKey: collectionName === 'products' ? 'id' : 
                                                    collectionName === 'users' ? 'user_id' : 
                                                    collectionName === 'invoices' ? 'invoice_id' :
                                                    collectionName === 'debts' ? 'debt_id' :
                                                    collectionName === 'units' ? 'unit_id' : 'id',
                                        type: 'object',
                                        properties: {}
                                    },
                                    documents: docs
                                });
                            }
                        }
                    });

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
                    alert('Failed to read database stores: ' + String(err));
                } finally {
                    idb.close();
                }
            };
            request.onerror = () => {
                alert('Failed to open database: ' + String(request.error));
            };
        } catch (err) {
            alert('Emergency export failed: ' + String(err));
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
                        <li>امسح بيانات الموقع (Clear site data) من إعدادات المتصفح.</li>
                        <li>أعد تحميل الصفحة واستورد ملف النسخة الاحتياطية.</li>
                    </ol>
                    <p className="text-sm text-gray-500">
                        Failed to initialize the local database. <strong>Your data is safe.</strong> This is likely caused by a schema change after an app update. Please follow these steps:
                    </p>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                        <li>Click "Export Emergency Backup" below to save your data first.</li>
                        <li>Clear site data from your browser settings.</li>
                        <li>Reload the page and import your backup file.</li>
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
                            onClick={() => window.location.reload()} 
                            className="w-full py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm cursor-pointer"
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
