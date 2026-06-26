/* eslint-disable @typescript-eslint/no-explicit-any */
// Per-license rate limiting (in-memory, per-instance).
// NOTE: In a serverless environment this resets on cold starts.
// For distributed protection, use Vercel KV or Upstash Redis.
const licenseRateLimits: Record<string, number[]> = {};

type LicenseRecord = {
    expiry_date: string;
    status: string;
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, model, licenseKey, timestamp } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }
    if (!timestamp) {
        return res.status(400).json({ error: 'Missing request timestamp' });
    }

    // Validate timestamp to prevent replay attacks (±2 minutes)
    const now = Date.now();
    const reqTime = new Date(timestamp).getTime();
    if (isNaN(reqTime) || Math.abs(now - reqTime) > 2 * 60 * 1000) {
        return res.status(401).json({ error: 'Request timestamp invalid or expired. Please sync your system clock.' });
    }

    // 1. License validation
    if (!licenseKey) {
        return res.status(401).json({ error: 'License key is required to use AI features.' });
    }

    const isDemoKey = licenseKey === 'TEST-LICENSE' || 
                       licenseKey === 'TEST' || 
                       licenseKey === 'TRIAL' ||
                       licenseKey === '1234' || 
                       licenseKey === '123456' || 
                       licenseKey === '123';
    const isDemoAllowed = process.env.VITE_ENABLE_DEMO_LOGIN === 'true' || process.env.NODE_ENV === 'development';

    if (isDemoKey && isDemoAllowed) {
        // Allow demo license
    } else {
        // Verify license key against GitHub
        const GITHUB_PAT = process.env.GITHUB_PAT;
        const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
        const REPO_NAME = process.env.GITHUB_REPO_NAME;
        const FILE_PATH = 'licenses.json';

        if (!GITHUB_PAT || !REPO_OWNER || !REPO_NAME) {
            return res.status(500).json({ error: 'License validation server configuration missing.' });
        }

        try {
            const githubApiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            const response = await fetch(githubApiUrl, {
                headers: {
                    'Authorization': `token ${GITHUB_PAT}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                return res.status(500).json({ error: 'License validation failed (could not fetch licenses).' });
            }

            const data = (await response.json()) as any;
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const licenses = JSON.parse(content) as Record<string, LicenseRecord>;

            const licenseInfo = licenses[licenseKey];
            if (!licenseInfo) {
                return res.status(401).json({ error: 'License key not found or invalid.' });
            }

            const expiryDate = new Date(licenseInfo.expiry_date);
            if (new Date() > expiryDate) {
                return res.status(403).json({ error: 'License expired. Please renew to use AI features.' });
            }

            if (licenseInfo.status !== 'active') {
                return res.status(403).json({ error: 'License disabled by admin.' });
            }
        } catch (licenseErr) {
            console.error('License validation error:', licenseErr);
            return res.status(500).json({ error: 'Internal license verification error.' });
        }
    }

    // 2. Rate Limiting check (per-license, per-instance)
    const key = licenseKey || 'anonymous';
    if (!licenseRateLimits[key]) {
        licenseRateLimits[key] = [];
    }
    licenseRateLimits[key] = licenseRateLimits[key].filter(t => now - t < 60000);

    if (licenseRateLimits[key].length >= 30) {
        return res.status(429).json({ 
            error: 'AI Server rate limit exceeded (Max 30 requests/minute per license). Please wait or enter your custom key in Settings.' 
        });
    }

    licenseRateLimits[key].push(now);

    // 3. Fetch Developer master API key
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Developer AI configuration is missing on server.' });
    }

    // Enforce prompt safety & length constraint
    const truncatedPrompt = prompt.slice(0, 15000); // Limit to 15k characters

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: truncatedPrompt }],
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as any;
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Failed to connect to Groq AI Service.' 
            });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Groq proxy error:', error);
        return res.status(500).json({ error: 'Internal server error during AI generation' });
    }
}
