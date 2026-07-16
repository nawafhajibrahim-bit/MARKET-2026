/* eslint-disable @typescript-eslint/no-explicit-any */
import { kv } from '@vercel/kv';

type ApiRequest = {
    method?: string;
    body: {
        hw_fingerprint?: string;
    };
};

type ApiResponse = {
    status: (code: number) => {
        json: (body: unknown) => unknown;
    };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { hw_fingerprint } = req.body;
    if (!hw_fingerprint) {
        return res.status(400).json({ error: 'Missing hardware fingerprint' });
    }

    try {
        const trialKey = `trial:${hw_fingerprint}`;
        const existingTrial: any = await kv.get(trialKey);

        const now = new Date();

        if (existingTrial) {
            if (existingTrial.status === 'suspended' || existingTrial.status === 'disabled') {
                return res.status(403).json({ 
                    active: false, 
                    error: 'trial_suspended',
                    message: existingTrial.status === 'suspended' ? 'الفترة التجريبية موقوفة' : 'الفترة التجريبية ملغاة'
                });
            }

            const expiryDate = new Date(existingTrial.expiry_date);
            if (now > expiryDate) {
                return res.status(403).json({ 
                    active: false, 
                    error: 'trial_expired', 
                    expiry_date: existingTrial.expiry_date 
                });
            }
            return res.status(200).json({ 
                active: true, 
                expiry_date: existingTrial.expiry_date 
            });
        }

        // Start a fresh 365-day trial
        const expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
        const newTrial = {
            start_date: now.toISOString(),
            expiry_date: expiryDate.toISOString(),
            status: 'active'
        };

        await kv.set(trialKey, newTrial);

        return res.status(200).json({ 
            active: true, 
            expiry_date: newTrial.expiry_date, 
            message: 'trial_started' 
        });

    } catch (err) {
        console.error('Start trial server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
