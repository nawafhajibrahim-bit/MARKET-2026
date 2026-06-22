/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';

type LicenseRecord = {
    merchant_name?: string;
    expiry_date: string;
    status: string; // 'active' | 'suspended' | 'disabled'
    max_devices?: number;
    activated_devices?: string[];
};

type ApiRequest = {
    method?: string;
    body: {
        admin_secret?: string;
        action?: 'save' | 'list' | 'clear-devices';
        license_key?: string;
        expiry_date?: string;
        status?: string;
        merchant_name?: string;
        max_devices?: number;
        timestamp?: string;
    };
};

type ApiResponse = {
    status: (code: number) => {
        json: (body: unknown) => unknown;
    };
};

function safeCompare(a: string, b: string): boolean {
    const aHash = crypto.createHash('sha256').update(a).digest();
    const bHash = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(aHash, bHash);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { 
        admin_secret, 
        action = 'save', 
        license_key, 
        expiry_date, 
        status, 
        merchant_name, 
        max_devices, 
        timestamp 
    } = req.body;

    const ADMIN_SECRET = process.env.ADMIN_SECRET;

    if (!ADMIN_SECRET || !admin_secret || !safeCompare(admin_secret, ADMIN_SECRET)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate timestamp to prevent replay attacks (±5 minutes)
    if (!timestamp) {
        return res.status(400).json({ error: 'Missing request timestamp' });
    }
    const now = Date.now();
    const reqTime = new Date(timestamp).getTime();
    if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Request timestamp invalid or expired. Please sync your system clock.' });
    }

    const GITHUB_PAT = process.env.GITHUB_PAT;
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
    const REPO_NAME = process.env.GITHUB_REPO_NAME;
    const FILE_PATH = 'licenses.json';

    if (!GITHUB_PAT || !REPO_OWNER || !REPO_NAME) {
        return res.status(500).json({ error: 'Server configuration missing' });
    }

    try {
        const githubApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        
        // 1. Get the current file content and SHA
        const getRes = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${GITHUB_PAT}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        let fileSha = '';
        let licenses: Record<string, LicenseRecord> = {};

        if (getRes.ok) {
            const data = (await getRes.json()) as any;
            fileSha = data.sha;
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            licenses = JSON.parse(content) as Record<string, LicenseRecord>;
        } else if (action !== 'save') {
            return res.status(500).json({ error: 'Failed to fetch licenses from GitHub' });
        }

        // 2. Perform actions
        if (action === 'list') {
            return res.status(200).json({ success: true, licenses });
        }

        if (action === 'clear-devices') {
            if (!license_key) {
                return res.status(400).json({ error: 'Missing license key' });
            }
            if (!licenses[license_key]) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            licenses[license_key] = {
                ...licenses[license_key],
                activated_devices: []
            };

            const newContent = Buffer.from(JSON.stringify(licenses, null, 2)).toString('base64');
            const putRes = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_PAT}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Reset active devices for license ${license_key}`,
                    content: newContent,
                    sha: fileSha
                })
            });

            if (!putRes.ok) {
                return res.status(500).json({ error: 'Failed to reset devices on GitHub' });
            }

            return res.status(200).json({ success: true, message: 'Active devices cleared successfully' });
        }

        if (action === 'save') {
            if (!license_key || !expiry_date || !status) {
                return res.status(400).json({ error: 'Missing required fields (license_key, expiry_date, status)' });
            }

            const existingRecord = licenses[license_key] || {};
            licenses[license_key] = {
                merchant_name: merchant_name || existingRecord.merchant_name || '',
                expiry_date: expiry_date,
                status: status,
                max_devices: typeof max_devices === 'number' ? max_devices : (existingRecord.max_devices || 1),
                activated_devices: existingRecord.activated_devices || []
            };

            const newContent = Buffer.from(JSON.stringify(licenses, null, 2)).toString('base64');
            const putRes = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_PAT}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update license details for ${merchant_name || license_key}`,
                    content: newContent,
                    sha: fileSha || undefined
                })
            });

            if (!putRes.ok) {
                return res.status(500).json({ error: 'Failed to save license to GitHub' });
            }

            return res.status(200).json({ success: true, message: 'License updated successfully' });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (err) {
        console.error('Manage license server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
