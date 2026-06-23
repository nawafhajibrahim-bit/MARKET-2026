/**
 * ForcePasswordChange.tsx
 * Shown after first login when the admin is still using the default password.
 * The user cannot dismiss this screen — they must set a new password to proceed.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Lock, CheckCircle } from 'lucide-react';
import { useDb } from '../database/Provider';
import { useAuth } from '../contexts/AuthContext';

import { hashPassword, generateSalt } from '../services/passwordService';

interface Props {
    onDone: () => void;
}

export const ForcePasswordChange: React.FC<Props> = ({ onDone }) => {
    const { t } = useTranslation();
    const db = useDb();
    const { currentUser } = useAuth();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError(t('password_too_short') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('passwords_dont_match') || 'كلمتا المرور غير متطابقتين');
            return;
        }
        if (newPassword === 'admin') {
            setError(t('password_too_simple') || 'لا يمكن استخدام كلمة المرور الافتراضية. اختر كلمة مرور مختلفة.');
            return;
        }

        setLoading(true);
        try {
            const newSalt = generateSalt();
            const newHash = await hashPassword(newPassword, newSalt);
            const userDoc = await db.users.findOne(currentUser!.user_id).exec();
            if (!userDoc) throw new Error('User not found');
            await userDoc.patch({
                password_hash: newHash,
                password_salt: newSalt
            });

            // Mark password as changed — no longer default
            localStorage.setItem(`sm_pwd_changed_${currentUser!.user_id}`, 'true');

            setDone(true);
            setTimeout(() => onDone(), 1500);
        } catch (err) {
            console.error(err);
            setError(t('change_password_error') || 'حدث خطأ أثناء تغيير كلمة المرور. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-[#1f2028] rounded-2xl shadow-2xl border border-orange-400/30 p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center">
                        <ShieldAlert size={32} className="text-orange-500" />
                    </div>
                    <h2 className="text-xl font-bold">
                        {t('force_change_password_title') || 'تغيير كلمة المرور الافتراضية'}
                    </h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        {t('force_change_password_desc') || 'أنت تستخدم كلمة المرور الافتراضية. يجب تغييرها الآن لحماية النظام قبل المتابعة.'}
                    </p>
                </div>

                {done ? (
                    <div className="flex flex-col items-center gap-3 py-4 text-green-600">
                        <CheckCircle size={40} className="animate-bounce" />
                        <p className="font-semibold text-lg">
                            {t('password_changed_success') || 'تم تغيير كلمة المرور بنجاح!'}
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {t('new_password') || 'كلمة المرور الجديدة'}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                    minLength={6}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-orange-400 outline-none transition-all"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {t('password_min_length') || 'الحد الأدنى 6 أحرف'}
                            </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {t('confirm_password') || 'تأكيد كلمة المرور'}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-orange-400 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Password strength indicator */}
                        {newPassword.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-1 flex-1 rounded-full transition-all ${
                                                newPassword.length >= level * 3
                                                    ? level <= 1 ? 'bg-red-500'
                                                    : level === 2 ? 'bg-orange-400'
                                                    : level === 3 ? 'bg-yellow-400'
                                                    : 'bg-green-500'
                                                : 'bg-black/10 dark:bg-white/10'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400">
                                    {newPassword.length < 4 ? (t('strength_weak') || 'ضعيف')
                                    : newPassword.length < 7 ? (t('strength_medium') || 'متوسط')
                                    : newPassword.length < 10 ? (t('strength_good') || 'جيد')
                                    : (t('strength_strong') || 'قوي ✓')}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {loading
                                ? (t('saving') || 'جاري الحفظ...')
                                : (t('change_password_btn') || 'تغيير كلمة المرور والمتابعة')}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
