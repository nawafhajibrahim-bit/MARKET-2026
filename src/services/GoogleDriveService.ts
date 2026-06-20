import { zipSync, strToU8 } from 'fflate';
import type { RxDatabase } from 'rxdb';

export class GoogleDriveService {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    // Export DB to JSON, compress with fflate, and return as Blob
    private async exportAndCompressDb(db: RxDatabase): Promise<Blob> {
        // Use RxDB's exportJSON to dump all collections
        const dump = await db.exportJSON();
        const jsonString = JSON.stringify(dump);
        const uint8Data = strToU8(jsonString);

        // Compress to ZIP format
        const zipped = zipSync({
            'smartmarket_backup.json': uint8Data
        });

        return new Blob([zipped], { type: 'application/zip' });
    }

    // Find the backup file ID if it exists in the Drive root (to overwrite instead of duplicate)
    private async findExistingBackupId(): Promise<string | null> {
        const query = encodeURIComponent("name = 'smartmarket_backup.zip' and trashed = false");
        const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to query Google Drive');

        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }
        return null;
    }

    // Upload the compressed DB to Google Drive
    public async backupDatabase(db: RxDatabase): Promise<boolean> {
        try {
            const blob = await this.exportAndCompressDb(db);
            const existingId = await this.findExistingBackupId();

            const metadata = {
                name: 'smartmarket_backup.zip',
                mimeType: 'application/zip'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            // If file exists, update it instead of creating a new one
            if (existingId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                },
                body: form
            });

            if (!response.ok) {
                console.error('Upload failed:', await response.text());
                return false;
            }

            return true;
        } catch (error) {
            console.error('Backup error:', error);
            return false;
        }
    }
}
