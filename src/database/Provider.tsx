import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDB } from './db';
import type { RxDatabase } from 'rxdb';

const DbContext = createContext<RxDatabase | null>(null);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [db, setDb] = useState<RxDatabase | null>(null);
    const [error, setError] = useState<any>(null);

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
                    setError(err);
                }
            }
        };
        init();
        return () => {
            isMounted = false;
        };
    }, []);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200" dir="auto">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg border border-red-200 dark:border-red-900/50 space-y-4">
                    <h2 className="text-xl font-bold text-red-600">Database Error / خطأ في قاعدة البيانات</h2>
                    <p className="text-sm text-gray-500">
                        فشل تشغيل قاعدة البيانات المحلية. قد يكون هذا بسبب حظر المتصفح لـ IndexedDB أو تعارض في البيانات. يرجى تجربة إعادة تحميل الصفحة أو مسح بيانات المتصفح للموقع.
                    </p>
                    <p className="text-sm text-gray-500">
                        Failed to initialize the local database. This can be caused by IndexedDB being blocked or database schema conflicts. Please try reloading or clearing site data.
                    </p>
                    <pre className="p-3 bg-red-500/10 rounded text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all">
                        {error.message || String(error)}
                    </pre>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                    >
                        Retry / إعادة المحاولة
                    </button>
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
