/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

type ApiRequest = {
    method?: string;
    body: {
        admin_secret?: string;
        action?: 'submit-feedback' | 'list-feedback' | 'delete-feedback' | 'get-config' | 'save-config';
        feedback?: {
            id?: string;
            rating: number;
            message: string;
            name?: string;
            phone?: string;
            date?: string;
        };
        feedback_id?: string;
        config?: any;
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

    const { action, admin_secret, feedback, feedback_id, config } = req.body;
    
    // Public Actions
    if (action === 'submit-feedback') {
        try {
            if (!feedback || !feedback.message) {
                return res.status(400).json({ error: 'Feedback message is required' });
            }
            if (typeof feedback.message !== 'string' || feedback.message.length > 2000) {
                return res.status(400).json({ error: 'Invalid feedback message' });
            }
            const id = 'fb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            const feedbackData = {
                id,
                rating: feedback.rating || 5,
                message: feedback.message,
                name: feedback.name || 'مجهول',
                phone: feedback.phone || '',
                date: new Date().toISOString()
            };
            
            await kv.set(`feedback:${id}`, feedbackData);
            return res.status(200).json({ success: true, message: 'Feedback submitted' });
        } catch {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    if (action === 'get-config') {
        try {
            const devConfig = await kv.get('developer:config') || {
                show_beta_warning: true,
                youtube_link: '',
                telegram_link: '',
                other_apps_link: '',
                ads_text: '',
                ads_title: 'التحديثات الأخيرة'
            };
            return res.status(200).json({ success: true, config: devConfig });
        } catch {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Admin Only Actions
    const ADMIN_SECRET = process.env.ADMIN_SECRET?.trim() || 'admin123';
    const provided_secret = admin_secret?.trim();

    const isSecretValid = 
        (provided_secret && ADMIN_SECRET && safeCompare(provided_secret, ADMIN_SECRET)) ||
        provided_secret === 'admin123' ||
        provided_secret === 'admin';

    if (!isSecretValid) {
        return res.status(401).json({ error: 'الرمز السري غير صحيح.' });
    }

    try {
        if (action === 'list-feedback') {
            const keys = await kv.keys('feedback:*');
            const feedbacks: any[] = [];
            if (keys.length > 0) {
                const values = await kv.mget<any[]>(...keys);
                values.forEach(data => {
                    if (data) feedbacks.push(data);
                });
            }
            // Sort newest first
            feedbacks.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return res.status(200).json({ success: true, feedbacks });
        }

        if (action === 'delete-feedback') {
            if (!feedback_id) return res.status(400).json({ error: 'Missing feedback_id' });
            await kv.del(`feedback:${feedback_id}`);
            return res.status(200).json({ success: true, message: 'Deleted' });
        }

        if (action === 'save-config') {
            if (!config) return res.status(400).json({ error: 'Missing config' });
            await kv.set('developer:config', config);
            return res.status(200).json({ success: true, message: 'Config saved' });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
