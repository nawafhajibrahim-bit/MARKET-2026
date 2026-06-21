import Dexie from 'dexie';

export interface LocalBackup {
    id?: number;
    filename: string;
    timestamp: string;
    size: number;
    data: Uint8Array; // Compressed ZIP binary data
}

class BackupDatabase extends Dexie {
    backups!: Dexie.Table<LocalBackup, number>;

    constructor() {
        super('smartmarket_backups');
        this.version(1).stores({
            backups: '++id, timestamp'
        });
    }
}

export const backupDb = new BackupDatabase();

export const saveLocalBackup = async (filename: string, data: Uint8Array): Promise<void> => {
    try {
        // Retrieve all backups sorted by time
        const all = await backupDb.backups.orderBy('timestamp').toArray();
        // If we have 5 or more, delete the oldest ones to keep only the last 4 (leaving space for the new one)
        if (all.length >= 5) {
            const countToDelete = all.length - 4;
            const toDelete = all.slice(0, countToDelete);
            for (const item of toDelete) {
                if (item.id !== undefined) {
                    await backupDb.backups.delete(item.id);
                }
            }
        }

        // Add the new backup
        await backupDb.backups.add({
            filename,
            timestamp: new Date().toISOString(),
            size: data.byteLength,
            data
        });
    } catch (err) {
        console.error('Failed to save backup in IndexedDB:', err);
    }
};

export const getLocalBackups = async (): Promise<LocalBackup[]> => {
    try {
        return await backupDb.backups.orderBy('timestamp').reverse().toArray();
    } catch (err) {
        console.error('Failed to retrieve backups from IndexedDB:', err);
        return [];
    }
};

export const deleteLocalBackup = async (id: number): Promise<void> => {
    try {
        await backupDb.backups.delete(id);
    } catch (err) {
        console.error(`Failed to delete backup with ID ${id}:`, err);
    }
};
