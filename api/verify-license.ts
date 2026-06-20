type LicenseRecord = {
    expiry_date: string;
    status: string;
};

type ApiRequest = {
    method?: string;
    body: {
        license_key?: string;
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

    const { license_key } = req.body;
    if (!license_key) {
        return res.status(400).json({ error: 'Missing license key' });
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
        
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${GITHUB_PAT}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            return res.status(500).json({ error: 'Failed to fetch licenses from GitHub' });
        }

        const data = await response.json();
        // GitHub API returns content as base64
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const licenses = JSON.parse(content) as Record<string, LicenseRecord>;

        const licenseInfo = licenses[license_key];
        
        if (!licenseInfo) {
            return res.status(404).json({ active: false, error: 'License key not found' });
        }

        const expiryDate = new Date(licenseInfo.expiry_date);
        const now = new Date();

        if (now > expiryDate) {
            return res.status(403).json({ active: false, error: 'License expired' });
        }

        if (licenseInfo.status !== 'active') {
            return res.status(403).json({ active: false, error: 'License disabled by admin' });
        }

        return res.status(200).json({ active: true, expiry_date: licenseInfo.expiry_date });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
