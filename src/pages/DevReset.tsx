/**
 * DevReset.tsx
 * Hidden developer recovery page — accessible via /dev-reset
 * Not linked anywhere in the app UI. Only the software owner knows this route.
 *
 * Purpose: Allows the developer to reset the admin's password back to "admin"
 * when the admin has forgotten their password. The client calls the developer,
 * the developer provides the master secret, the admin password is reset and
 * ForcePasswordChange will demand a new one immediately on next login.
 */
import React, { useState } from 'react';
import { ShieldAlert, KeyRound, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { useDb } from '../database/Provider';

import { formatLegacyHash } from '../services/passwordService';

// Developer master secret — stored in .env.local, never committed to git
const DEV_MASTER_SECRET = import.meta.env.VITE_DEV_MASTER_SECRET as string | undefined;

type Step = 'verify' | 'confirm' | 'done';

export const DevReset: React.FC = () => {
    const db = useDb();
    const [secretInput, setSecretInput] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [step, setStep] = useState<Step>('verify');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetInfo, setResetInfo] = useState<{ username: string; count: number } | null>(null);

    // Step 1: Verify the developer secret
    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!DEV_MASTER_SECRET) {
            setError('VITE_DEV_MASTER_SECRET is not configured in .env.local');
            return;
        }

        if (secretInput !== DEV_MASTER_SECRET) {
            setError('الرمز السري غير صحيح.');
            return;
        }

        setStep('confirm');
    };

    // Step 2: Find all admin users and show what will be reset
    const handleLoadAdmins = async () => {
        setLoading(true);
        try {
            const admins = await db.users.find({
                selector: { role: { $eq: 'admin' } }
            }).exec();
            setResetInfo({
                username: admins.map(a => a.username).join(', '),
                count: admins.length
            });
        } catch {
            setError('فشل في قراءة قاعدة البيانات.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Perform the actual reset
    const handleReset = async () => {
        setLoading(true);
        setError('');
        try {
            const newHash = await formatLegacyHash('admin');

            const admins = await db.users.find({
                selector: { role: { $eq: 'admin' } }
            }).exec();

            for (const adminDoc of admins) {
                // Reset password hash back to "admin"
                await adminDoc.patch({ password_hash: newHash, password_salt: '' });
                // Remove the "password changed" flag so ForcePasswordChange triggers again
                localStorage.removeItem(`sm_pwd_changed_${adminDoc.user_id}`);
            }

            setStep('done');
        } catch (err) {
            console.error(err);
            setError('حدث خطأ أثناء إعادة التعيين. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
            <div className="w-full max-w-md space-y-6">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-red-500/15 border border-red-500/30 rounded-full flex items-center justify-center">
                        <ShieldAlert size={30} className="text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Developer Recovery Tool</h1>
                    <p className="text-sm text-gray-400">أداة استرداد كلمة المرور — للمطور فقط</p>
                    <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        🔒 هذه الصفحة للمطور فقط — لا تشاركها
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">

                    {/* STEP 1 — Enter developer secret */}
                    {step === 'verify' && (
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    الرمز السري للمطور
                                </label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        value={secretInput}
                                        onChange={(e) => setSecretInput(e.target.value)}
                                        autoFocus
                                        required
                                        placeholder="أدخل الرمز السري..."
                                        className="w-full pl-9 pr-10 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-red-500/50 outline-none transition-all text-sm placeholder:text-gray-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSecret(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-sm"
                            >
                                تحقق من الرمز
                            </button>
                        </form>
                    )}

                    {/* STEP 2 — Confirm reset */}
                    {step === 'confirm' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                                <CheckCircle size={16} />
                                <span>الرمز صحيح — الرجاء تأكيد العملية</span>
                            </div>

                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300 space-y-2">
                                <p className="font-semibold">⚠️ ماذا سيحدث:</p>
                                <ul className="list-disc list-inside space-y-1 text-amber-400/80">
                                    <li>ستتم إعادة كلمة مرور الأدمن إلى <span className="font-mono bg-black/30 px-1 rounded">admin</span></li>
                                    <li>لن تُمس أي بيانات (منتجات، فواتير، مخزون)</li>
                                    <li>سيُجبر الأدمن على تغيير الكلمة عند أول دخول</li>
                                </ul>
                            </div>

                            {!resetInfo && (
                                <button
                                    onClick={handleLoadAdmins}
                                    disabled={loading}
                                    className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? 'جاري التحقق...' : 'عرض حسابات الأدمن المتأثرة'}
                                </button>
                            )}

                            {resetInfo && (
                                <div className="p-3 bg-gray-800 rounded-xl text-sm space-y-1">
                                    <p className="text-gray-400">
                                        الحسابات التي ستُعاد: <span className="text-white font-mono">{resetInfo.username}</span>
                                    </p>
                                    <p className="text-gray-500">العدد: {resetInfo.count} حساب</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setStep('verify'); setSecretInput(''); setResetInfo(null); setError(''); }}
                                    className="flex-1 py-3 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium rounded-xl transition-all cursor-pointer"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> جاري الإعادة...</>
                                    ) : (
                                        <><KeyRound size={16} /> تأكيد إعادة التعيين</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 — Done */}
                    {step === 'done' && (
                        <div className="space-y-4 text-center py-4">
                            <div className="w-16 h-16 mx-auto bg-green-500/15 rounded-full flex items-center justify-center">
                                <CheckCircle size={32} className="text-green-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-green-400 font-semibold text-lg">تمت إعادة التعيين بنجاح!</p>
                                <p className="text-gray-400 text-sm">
                                    يمكن للأدمن الآن الدخول بـ <span className="font-mono text-white bg-black/40 px-2 py-0.5 rounded">admin / admin</span>
                                </p>
                                <p className="text-gray-500 text-xs mt-2">
                                    سيُطلب منه تغيير كلمة المرور فوراً عند الدخول.
                                </p>
                            </div>
                            <a
                                href="/"
                                className="inline-block mt-4 px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-xl transition-all cursor-pointer"
                            >
                                الانتقال لصفحة الدخول
                            </a>
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-700">
                    /dev-reset · Smart Market POS · Developer Tool
                </p>
            </div>
        </div>
    );
};
