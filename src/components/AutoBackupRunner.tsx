import React, { useEffect, useRef } from 'react';
import { useDb } from '../database/Provider';
import { saveLocalBackup } from '../services/backupStorageService';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { zipSync, strToU8 } from 'fflate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runAutoBackup = async (db: any) => {
    const isEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
    if (!isEnabled) return;

    const backupLocal = localStorage.getItem('auto_backup_local') !== 'false'; // default true
    const backupCloud = localStorage.getItem('auto_backup_cloud') === 'true'; // default false
    const downloadFile = localStorage.getItem('auto_backup_download_file') === 'true'; // default false

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `smartmarket_backup_auto_${timestampStr}.zip`;

    let backupData: Uint8Array | null = null;

    try {
        // 1. Export JSON and Zip it if local OR download is requested
        if (backupLocal || downloadFile) {
            const dump = await db.exportJSON();
            const uint8 = strToU8(JSON.stringify(dump));
            backupData = zipSync({
                'smartmarket_backup.json': uint8
            });

            if (backupLocal && backupData) {
                await saveLocalBackup(filename, backupData);
            }

            if (downloadFile && backupData) {
                const blob = new Blob([backupData as BlobPart], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        // 2. Perform Cloud Backup if enabled and Google credentials exist
        if (backupCloud) {
            const accessToken = localStorage.getItem('google_access_token');
            const tokenExpiry = localStorage.getItem('google_token_expiry');

            if (accessToken && tokenExpiry && Date.now() < parseInt(tokenExpiry, 10)) {
                // If local data hasn't been zipped/exported yet, do it now
                if (!backupData) {
                    const dump = await db.exportJSON();
                    const uint8 = strToU8(JSON.stringify(dump));
                    backupData = zipSync({
                        'smartmarket_backup.json': uint8
                    });
                }
                const driveService = new GoogleDriveService(accessToken);
                const success = await driveService.backupDatabase(db);
                if (success) {
                    localStorage.setItem('google_backup_last_status', 'success');
                } else {
                    localStorage.setItem('google_backup_last_status', 'failed');
                }
            } else {
                localStorage.setItem('google_backup_last_status', 'expired');
            }
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
