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

    const TRIAL_DURATION_DAYS = 365; // Open free trial for 1 full year until owner stops it

    try {
        const trialKey = `trial:${hw_fingerprint}`;
        let existingTrial: any = null;
        try {
            existingTrial = await kv.get(trialKey);
        } catch (kvErr) {
            console.warn('KV read warning in start-trial:', kvErr);
        }

        const now = new Date();
        const promotionalExpiry = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

        if (existingTrial) {
            if (existingTrial.status === 'suspended' || existingTrial.status === 'disabled') {
                return res.status(403).json({ 
                    active: false, 
                    error: 'trial_suspended',
                    message: existingTrial.status === 'suspended' ? 'الفترة التجريبية موقوفة من قبل الإدارة' : 'الفترة التجريبية ملغاة'
                });
            }

            // Auto-extend existing or expired trials to the full 1-year promotional period
            const currentExpiry = new Date(existingTrial.expiry_date);
            if (isNaN(currentExpiry.getTime()) || currentExpiry < promotionalExpiry) {
                existingTrial.expiry_date = promotionalExpiry.toISOString();
                existingTrial.status = 'active';
                try {
                    await kv.set(trialKey, existingTrial);
                } catch {
                    // ignore KV write error
                }
            }

            return res.status(200).json({ 
                active: true, 
                expiry_date: existingTrial.expiry_date 
            });
        }

        // Start a fresh 365-day promotional trial
        const newTrial = {
            start_date: now.toISOString(),
            expiry_date: promotionalExpiry.toISOString(),
            status: 'active'
        };

        try {
            await kv.set(trialKey, newTrial);
        } catch (kvErr) {
            console.warn('KV write warning in start-trial:', kvErr);
        }

        return res.status(200).json({ 
            active: true, 
            expiry_date: newTrial.expiry_date, 
            message: 'trial_started' 
        });

    } catch (err) {
        console.error('Start trial server error, granting promotional fallback:', err);
        const fallbackExpiry = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
        return res.status(200).json({ 
            active: true, 
            expiry_date: fallbackExpiry.toISOString(),
            message: 'trial_started_fallback'
        });
    }
}
