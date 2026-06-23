/* eslint-disable @typescript-eslint/no-explicit-any */
import { kv } from '@vercel/kv';

type LicenseRecord = {
    merchant_name?: string;
    expiry_date: string;
    status: string; // 'active' | 'suspended' | 'disabled'
    max_devices?: number; // max allowed devices, defaults to 1
    activated_devices?: string[]; // list of hardware fingerprints
};

type ApiRequest = {
    method?: string;
    body: {
        license_key?: string;
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

    const { license_key, hw_fingerprint } = req.body;
    if (!license_key) {
        return res.status(400).json({ error: 'Missing license key' });
    }

    try {
        const licenseInfo: LicenseRecord | null = await kv.get(`license:${license_key}`);
        
        if (!licenseInfo) {
            return res.status(404).json({ active: false, error: 'license_not_found' });
        }

        const expiryDate = new Date(licenseInfo.expiry_date);
        const now = new Date();

        if (now > expiryDate) {
            return res.status(403).json({ active: false, error: 'license_expired', expiry_date: licenseInfo.expiry_date });
        }

        if (licenseInfo.status === 'suspended') {
            return res.status(403).json({ active: false, error: 'license_suspended' });
        }

        if (licenseInfo.status !== 'active') {
            return res.status(403).json({ active: false, error: 'license_disabled' });
        }

        // Hardware Fingerprint Validation & Device Limit check
        if (hw_fingerprint) {
            const devices = licenseInfo.activated_devices || [];
            const maxDevices = typeof licenseInfo.max_devices === 'number' ? licenseInfo.max_devices : 1;

            if (!devices.includes(hw_fingerprint)) {
                // If it's a new device, check if we have room under max_devices
                if (maxDevices > 0 && devices.length >= maxDevices) {
                    return res.status(403).json({ 
                        active: false, 
                        error: 'device_limit_exceeded',
                        max_devices: maxDevices,
                        activated_count: devices.length
                    });
                }

                // Register the new device fingerprint
                const updatedDevices = [...devices, hw_fingerprint];
                const updatedRecord = {
                    ...licenseInfo,
                    activated_devices: updatedDevices
                };

                await kv.set(`license:${license_key}`, updatedRecord);
            }
        }

        return res.status(200).json({ active: true, expiry_date: licenseInfo.expiry_date });

    } catch (err) {
        console.error('Verify license server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
