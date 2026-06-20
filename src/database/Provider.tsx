import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDB } from './db';
import type { RxDatabase } from 'rxdb';

const DbContext = createContext<RxDatabase | null>(null);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [db, setDb] = useState<RxDatabase | null>(null);

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
            }
        };
        init();
        return () => {
            isMounted = false;
        };
    }, []);

    if (!db) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                <span className="ml-4 text-lg">Initializing Database...</span>
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
