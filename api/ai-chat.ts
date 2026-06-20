// Vercel Serverless Function to handle proxying AI requests to Groq with rate limiting
// Limited to 30 requests per minute (RPM) to respect free Groq API tiers.

let requestTimestamps: number[] = [];

type ApiRequest = {
    method?: string;
    body: {
        prompt?: string;
        model?: string;
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

    const { prompt, model } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    const targetModel = model || 'llama3-8b-8192';

    // 1. Rate Limiting check
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter(t => now - t < 60000); // keep only last 60s

    if (requestTimestamps.length >= 30) {
        return res.status(429).json({ 
            error: 'AI Server rate limit exceeded (Max 30 requests/minute). Please wait or enter your custom key in Settings.' 
        });
    }

    requestTimestamps.push(now);

    // 2. Fetch Developer master API key
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Developer AI configuration is missing on server.' });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
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
