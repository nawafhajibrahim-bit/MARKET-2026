/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

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

    try {
        // 1. List action
        if (action === 'list') {
            const keys = await kv.keys('license:*');
            const licenses: Record<string, any> = {};
            
            for (const key of keys) {
                const licenseKey = key.replace('license:', '');
                const data = await kv.get(key);
                if (data) {
                    licenses[licenseKey] = data;
                }
            }
            return res.status(200).json({ success: true, licenses });
        }

        // 2. Clear devices action
        if (action === 'clear-devices') {
            if (!license_key) {
                return res.status(400).json({ error: 'Missing license key' });
            }
            
            const existingRecord: any = await kv.get(`license:${license_key}`);
            if (!existingRecord) {
                return res.status(404).json({ error: 'License key not found' });
            }
            
            const updated = {
                ...existingRecord,
                activated_devices: []
            };
            
            await kv.set(`license:${license_key}`, updated);
            return res.status(200).json({ success: true, message: 'Active devices cleared successfully' });
        }

        // 3. Save action
        if (action === 'save') {
            if (!license_key || !expiry_date || !status) {
                return res.status(400).json({ error: 'Missing required fields (license_key, expiry_date, status)' });
            }

            const existingRecord: any = (await kv.get(`license:${license_key}`)) || {};
            const updatedRecord = {
                merchant_name: merchant_name || existingRecord.merchant_name || '',
                expiry_date: expiry_date,
                status: status,
                max_devices: typeof max_devices === 'number' ? max_devices : (existingRecord.max_devices || 1),
                activated_devices: existingRecord.activated_devices || []
            };

            await kv.set(`license:${license_key}`, updatedRecord);
            return res.status(200).json({ success: true, message: 'License updated successfully' });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (err) {
        console.error('Manage license server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
