/**
 * folderBackupService.ts
 * Handles saving and managing backup ZIP files directly to a user-selected
 * folder on the device using the File System Access API.
 *
 * Compatible with: Chrome 86+, Edge 86+
 * Not supported: Firefox, Safari (iOS)
 */

const FOLDER_HANDLE_KEY = 'folder_backup_handle_name';
const FOLDER_MAX_BACKUPS_KEY = 'folder_backup_max_keep';
const FOLDER_BACKUP_ENABLED_KEY = 'folder_backup_enabled';

/** Returns true if the File System Access API (with write support) is available */
export const isFolderBackupSupported = (): boolean => {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

export const isFolderBackupEnabled = (): boolean => {
    return localStorage.getItem(FOLDER_BACKUP_ENABLED_KEY) === 'true';
};

export const setFolderBackupEnabled = (val: boolean): void => {
    localStorage.setItem(FOLDER_BACKUP_ENABLED_KEY, val.toString());
};

export const getSelectedFolderName = (): string | null => {
    return localStorage.getItem(FOLDER_HANDLE_KEY);
};

export const getMaxBackupsToKeep = (): number => {
    return parseInt(localStorage.getItem(FOLDER_MAX_BACKUPS_KEY) || '5', 10);
};

export const setMaxBackupsToKeep = (val: number): void => {
    localStorage.setItem(FOLDER_MAX_BACKUPS_KEY, val.toString());
};

// In-memory handle — lives only for the current browser session.
// Browser security requires re-granting permission after a page reload.
let _dirHandle: FileSystemDirectoryHandle | null = null;

type DirectoryPickerWindow = Window & {
    showDirectoryPicker: (opts?: { mode?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
};

/** Ask the user to pick a folder and store the handle in memory */
export const pickBackupFolder = async (): Promise<string | null> => {
    if (!isFolderBackupSupported()) return null;
    try {
        const handle = await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
        });
        _dirHandle = handle;
        localStorage.setItem(FOLDER_HANDLE_KEY, handle.name);
        return handle.name;
    } catch (err) {
        if ((err as Error).name !== 'AbortError') {
            console.error('Failed to pick folder:', err);
        }
        return null;
    }
};

/**
 * Get the current directory handle.
 * If the handle was lost (page reload), re-prompt the user only if autoPrompt=true.
 */
export const getOrRequestDirHandle = async (
    autoPrompt = false
): Promise<FileSystemDirectoryHandle | null> => {
    if (_dirHandle) return _dirHandle;

    const savedName = getSelectedFolderName();
    if (!savedName) return null;
    if (!autoPrompt) return null;

    try {
        const handle = await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
        });
        _dirHandle = handle;
        localStorage.setItem(FOLDER_HANDLE_KEY, handle.name);
        return handle;
    } catch {
        return null;
    }
};

/** Clear the stored folder selection */
export const clearFolderSelection = (): void => {
    _dirHandle = null;
    localStorage.removeItem(FOLDER_HANDLE_KEY);
    setFolderBackupEnabled(false);
};

/**
 * Save a backup ZIP file directly into the selected folder.
 * Automatically cleans up old backups after saving.
 * Returns true on success.
 */
export const saveBackupToFolder = async (
    data: Uint8Array,
    filename: string,
    autoPrompt = false
): Promise<boolean> => {
    try {
        const handle = await getOrRequestDirHandle(autoPrompt);
        if (!handle) return false;

        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        // Copy to a plain ArrayBuffer to avoid SharedArrayBuffer type mismatch
        const cleanBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(cleanBuffer).set(data);
        await writable.write(cleanBuffer);
        await writable.close();

        await cleanupOldBackups(handle);
        return true;
    } catch (err) {
        console.error('Failed to save backup to folder:', err);
        _dirHandle = null;
        return false;
    }
};

type AsyncIterableDirectory = FileSystemDirectoryHandle & {
    [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemHandle]>;
};

/** List all SmartMarket backup ZIPs in the folder, sorted oldest-first */
export const listFolderBackups = async (): Promise<{ name: string; size: number }[]> => {
    const handle = await getOrRequestDirHandle(false);
    if (!handle) return [];

    try {
        const files: { name: string; size: number }[] = [];
        for await (const [name, entry] of handle as AsyncIterableDirectory) {
            if (
                entry.kind === 'file' &&
                name.startsWith('smartmarket_backup') &&
                name.endsWith('.zip')
            ) {
                const file = await (entry as FileSystemFileHandle).getFile();
                files.push({ name, size: file.size });
            }
        }
        files.sort((a, b) => a.name.localeCompare(b.name));
        return files;
    } catch (err) {
        console.error('Failed to list folder backups:', err);
        return [];
    }
};

/** Delete the oldest backups, keeping only the latest `maxKeep` files */
export const cleanupOldBackups = async (
    handle: FileSystemDirectoryHandle,
    maxKeep?: number
): Promise<void> => {
    const keep = maxKeep ?? getMaxBackupsToKeep();
    try {
        const files: string[] = [];
        for await (const [name, entry] of handle as AsyncIterableDirectory) {
            if (
                entry.kind === 'file' &&
                name.startsWith('smartmarket_backup') &&
                name.endsWith('.zip')
            ) {
                files.push(name);
            }
        }
        files.sort(); // oldest first (timestamp in filename)

        if (files.length > keep) {
            const toDelete = files.slice(0, files.length - keep);
            for (const name of toDelete) {
                await handle.removeEntry(name);
            }
        }
    } catch (err) {
        console.error('Failed to cleanup old folder backups:', err);
    }
};
