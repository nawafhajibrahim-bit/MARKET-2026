import React, { useEffect, useRef } from 'react';
import { useDb } from '../database/Provider';
import { saveLocalBackup } from '../services/backupStorageService';
import { saveBackupToFolder, isFolderBackupEnabled } from '../services/folderBackupService';
import { zipSync, strToU8 } from 'fflate';

// eslint-disable-next-line react-refresh/only-export-components
export const runAutoBackup = async (db: import('rxdb').RxDatabase) => {
    const isEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
    if (!isEnabled) return;

    const backupLocal = localStorage.getItem('auto_backup_local') !== 'false'; // default true
    const downloadFile = localStorage.getItem('auto_backup_download_file') === 'true'; // default false
    const folderEnabled = isFolderBackupEnabled();

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `smartmarket_backup_auto_${timestampStr}.zip`;

    try {
        // Export JSON and Zip it
        const dump = await db.exportJSON();
        const uint8 = strToU8(JSON.stringify(dump));
        const backupData = zipSync({
            'smartmarket_backup.json': uint8
        });

        // Target 1: IndexedDB (inside browser)
        if (backupLocal && backupData) {
            await saveLocalBackup(filename, backupData);
        }

        // Target 2: Auto-download ZIP file
        if (downloadFile && backupData) {
            const blob = new Blob([backupData as BlobPart], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        // Target 3: Save to user-selected folder on device (Google Drive, Desktop, etc.)
        if (folderEnabled && backupData) {
            // autoPrompt=true: if permission was lost after page reload, re-prompt the user
            await saveBackupToFolder(backupData, filename, true);
        }

        // Update the last run timestamp
        localStorage.setItem('auto_backup_last_time', new Date().toISOString());
        window.dispatchEvent(new Event('auto_backup_completed'));
        console.log('Auto-backup completed successfully!');
    } catch (err) {
        console.error('Auto-backup failed:', err);
    }
};

export const AutoBackupRunner: React.FC = () => {
    const db = useDb();
    const lastCheckRef = useRef<number>(0);

    useEffect(() => {
        if (!db) return;

        // Initialize last backup time if it doesn't exist
        if (!localStorage.getItem('auto_backup_last_time')) {
            localStorage.setItem('auto_backup_last_time', new Date().toISOString());
        }

        // Timer to check every 30 seconds
        const intervalId = setInterval(async () => {
            const isEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
            if (!isEnabled) return;

            const lastBackupTime = localStorage.getItem('auto_backup_last_time');
            if (!lastBackupTime) return;

            // Interval in minutes (default 60 minutes = 1 hour)
            const intervalMins = parseInt(localStorage.getItem('auto_backup_interval') || '60', 10);
            const timePassedMs = Date.now() - new Date(lastBackupTime).getTime();

            if (timePassedMs >= intervalMins * 60 * 1000) {
                // Throttle check to avoid double runs
                if (Date.now() - lastCheckRef.current < 5000) return;
                lastCheckRef.current = Date.now();

                await runAutoBackup(db);
            }
        }, 30000); // Check every 30 seconds

        // Run backup on tab/window visibility hide (e.g. closing or minimizing app)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                const isEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
                if (!isEnabled) return;
                
                // Only run on exit if "backup on exit" setting is enabled
                const backupOnExit = localStorage.getItem('auto_backup_on_exit') !== 'false'; // default true
                if (backupOnExit) {
                    await runAutoBackup(db);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [db]);

    return null;
};
