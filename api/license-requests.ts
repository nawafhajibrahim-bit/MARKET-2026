/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

type ApiRequest = {
    method?: string;
    body: {
        action?: 'create' | 'list' | 'delete' | 'approve';
        admin_secret?: string;
        request_id?: string;
        merchant_name?: string;
        phone?: string;
        duration_months?: number;
        hardware_fingerprint?: string;
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
        action = 'create', 
        admin_secret, 
        request_id,
        merchant_name,
        phone,
        duration_months,
        hardware_fingerprint 
    } = req.body;

    try {
        // 1. Create action (Public - Used by client app to request a license)
        if (action === 'create') {
            if (!merchant_name || !duration_months || !hardware_fingerprint) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const newRequestId = 'req:' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            
            const requestData = {
                id: newRequestId,
                merchant_name,
                phone: phone || '',
                duration_months,
                hardware_fingerprint,
                status: 'pending',
                timestamp: new Date().toISOString()
            };

            await kv.set(newRequestId, requestData);
            return res.status(200).json({ success: true, message: 'Request submitted successfully', request_id: newRequestId });
        }

        // --- ADMIN ONLY ACTIONS BELOW ---
        const ADMIN_SECRET = process.env.ADMIN_SECRET;
        if (!ADMIN_SECRET || !admin_secret || !safeCompare(admin_secret, ADMIN_SECRET)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 2. List action (Admin - list all pending requests)
        if (action === 'list') {
            const keys = await kv.keys('req:*');
            const requests: any[] = [];
            
            for (const key of keys) {
                const data = await kv.get(key);
                if (data) {
                    requests.push(data);
                }
            }
            
            // Sort newest first
            requests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            return res.status(200).json({ success: true, requests });
        }

        // 3. Delete action (Admin - remove a request)
        if (action === 'delete') {
            if (!request_id) return res.status(400).json({ error: 'Missing request_id' });
            await kv.del(request_id);
            return res.status(200).json({ success: true, message: 'Request deleted' });
        }

        // 4. Approve action (Admin - marks as approved but license generation is handled in Admin.tsx)
        if (action === 'approve') {
            if (!request_id) return res.status(400).json({ error: 'Missing request_id' });
            const data: any = await kv.get(request_id);
            if (data) {
                data.status = 'approved';
                await kv.set(request_id, data);
            }
            return res.status(200).json({ success: true, message: 'Request approved' });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (err) {
        console.error('License requests server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
