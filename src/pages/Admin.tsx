import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  PlusCircle, 
  RefreshCw, 
  Laptop, 
  Copy, 
  Edit2, 
  Share2, 
  Smartphone, 
  CheckCircle, 
  X, 
  Users,
  Ban,
  UserCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const Admin = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');

  const [isAuthenticatedOwner, setIsAuthenticatedOwner] = useState(() => localStorage.getItem('sm_owner_auth') === 'true');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem('sm_developer_secret') || '');
  const [merchantName, setMerchantName] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [maxDevices, setMaxDevices] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [licensesList, setLicensesList] = useState<Record<string, any>>({});
  
  // Tabs & Requests State
  const [activeTab, setActiveTab] = useState<'licenses' | 'requests'>('licenses');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newlyCreatedLicense, setNewlyCreatedLicense] = useState<any>(null);

  // Editing License State
  const [editingLicenseKey, setEditingLicenseKey] = useState<string | null>(null);
  const [editMerchantName, setEditMerchantName] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editMaxDevices, setEditMaxDevices] = useState(1);
  const [editExpiryDate, setEditExpiryDate] = useState('');

  // Automatically load licenses on mount if secret is already saved
  useEffect(() => {
    if (adminSecret && isAuthenticatedOwner) {
      fetchLicensesList();
      fetchRequestsList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticatedOwner]);

  const generateLicense = () => {
    return 'SM-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const licenseKey = generateLicense();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + Number(durationMonths));

    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_secret: adminSecret,
          timestamp: new Date().toISOString(),
          license_key: licenseKey,
          expiry_date: expiryDate.toISOString(),
          status: 'active',
          merchant_name: merchantName,
          max_devices: Number(maxDevices)
        })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('sm_developer_secret', adminSecret);
        
        // Save for Success Modal
        setNewlyCreatedLicense({
          key: licenseKey,
          merchantName: merchantName,
          expiryDate: expiryDate,
          maxDevices: Number(maxDevices)
        });
        
        // Reset states
        setMerchantName('');
        setShowAddModal(false);
        setShowSuccessModal(true);
        
        // Refresh list
        fetchLicensesList();
      } else {
        alert(data.error || 'Failed to create license');
      }
    } catch {
      alert('Network error, license was not saved');
    } finally {
      setLoading(false);
    }
  };

  async function fetchLicensesList() {
    if (!adminSecret) {
      alert(isAr ? 'يرجى إدخال رمز الأدمن أولاً لجلب التراخيص' : 'Please enter admin secret first');
      return;
    }
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'list',
          timestamp: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLicensesList(data.licenses || {});
        localStorage.setItem('sm_developer_secret', adminSecret);
      } else {
        alert(data.error || 'Failed to fetch licenses');
      }
    } catch (err) {
      console.error(err);
      alert('Network error fetching licenses');
    } finally {
      setListLoading(false);
    }
  }

  async function fetchRequestsList() {
    if (!adminSecret) return;
    try {
      const res = await fetch('/api/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'list'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleApproveRequest = async (request: any) => {
    try {
      // 1. Mark request as approved
      await fetch('/api/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'approve',
          request_id: request.id
        })
      });
      
      // 2. Pre-fill modal
      setMerchantName(request.merchant_name);
      setDurationMonths(request.duration_months);
      setMaxDevices(1);
      
      // Refresh requests
      fetchRequestsList();
      
      // Open modal
      setShowAddModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this request?')) return;
    try {
      const res = await fetch('/api/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'delete',
          request_id: requestId
        })
      });
      if (res.ok) {
        fetchRequestsList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (key: string, license: any) => {
    setEditingLicenseKey(key);
    setEditMerchantName(license.merchant_name || '');
    setEditStatus(license.status || 'active');
    setEditMaxDevices(license.max_devices || 1);
    
    // Format date for <input type="date" />
    if (license.expiry_date) {
      const dateObj = new Date(license.expiry_date);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      setEditExpiryDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setEditExpiryDate('');
    }
  };

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicenseKey) return;
    setLoading(true);

    try {
      const expiryIso = new Date(editExpiryDate).toISOString();
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'save',
          license_key: editingLicenseKey,
          expiry_date: expiryIso,
          status: editStatus,
          merchant_name: editMerchantName,
          max_devices: Number(editMaxDevices),
          timestamp: new Date().toISOString()
        })
      });

      if (res.ok) {
        setEditingLicenseKey(null);
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update license');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendExpiry = (months: number) => {
    if (!editExpiryDate) return;
    const dateObj = new Date(editExpiryDate);
    dateObj.setMonth(dateObj.getMonth() + months);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setEditExpiryDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleClearDevices = async (key: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح جميع الأجهزة المسجلة لهذا الترخيص؟ سيتمكن العميل من تفعيل اشتراكه على جهاز جديد.' : 'Are you sure you want to clear all devices? The customer can activate on a new device.')) return;
    setListLoading(true);
    try {
      const res = await fetch('/api/manage-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_secret: adminSecret,
          action: 'clear-devices',
          license_key: key,
          timestamp: new Date().toISOString()
        })
      });
      if (res.ok) {
        await fetchLicensesList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset devices');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setListLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sm_developer_secret');
    setAdminSecret('');
    setLicensesList({});
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(isAr ? 'تم نسخ كود التفعيل إلى الحافظة!' : 'License Key copied to clipboard!');
  };

  const shareViaWhatsApp = (license: any) => {
    const messageText = isAr 
      ? `أهلاً بك يا ${license.merchantName} 🌹\n\n` +
        `تم تفعيل اشتراكك في برنامج *Smart Market* بنجاح! 🎉\n\n` +
        `🔑 *كود الترخيص الخاص بك هو:*\n\`${license.key}\`\n\n` +
        `📅 *تاريخ الانتهاء:* ${new Date(license.expiryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
        `💻 *أقصى عدد للأجهزة:* ${license.maxDevices === 0 ? 'مفتوح (غير محدود)' : license.maxDevices}\n\n` +
        `شكراً لثقتكم بنا وتمنياتنا لكم بالتوفيق والنجاح!`
      : `Hello ${license.merchantName},\n\n` +
        `Your *Smart Market* license has been activated successfully! 🎉\n\n` +
        `🔑 *License Key:*\n\`${license.key}\`\n\n` +
        `📅 *Expiry Date:* ${new Date(license.expiryDate).toLocaleDateString()}\n` +
        `💻 *Max Devices:* ${license.maxDevices === 0 ? 'Unlimited' : license.maxDevices}\n\n` +
        `Thank you for choosing us!`;
        
    const encodedText = encodeURIComponent(messageText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Filtered List calculation
  const filteredLicenses = Object.entries(licensesList).filter(([key, value]) => {
    const matchSearch = 
      key.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (value.merchant_name && value.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const isExpired = new Date() > new Date(value.expiry_date);
    
    if (statusFilter === 'all') return matchSearch;
    if (statusFilter === 'active') return matchSearch && value.status === 'active' && !isExpired;
    if (statusFilter === 'expired') return matchSearch && isExpired;
    if (statusFilter === 'suspended') return matchSearch && value.status === 'suspended';
    if (statusFilter === 'disabled') return matchSearch && value.status === 'disabled';
    return matchSearch;
  });

  // Stats Calculation
  const totalSubscribers = Object.keys(licensesList).length;
  const activeSubscribers = Object.values(licensesList).filter(
    (l) => l.status === 'active' && new Date() <= new Date(l.expiry_date)
  ).length;
  const expiredSubscribers = Object.values(licensesList).filter(
    (l) => new Date() > new Date(l.expiry_date)
  ).length;
  const activatedDevices = Object.values(licensesList).reduce(
    (acc, curr) => acc + (curr.activated_devices ? curr.activated_devices.length : 0), 0
  );

  // Render Login state
  if (!isAuthenticatedOwner) {
    const handleOwnerLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Hardcoded owner credentials (Layer 1)
      if (ownerUsername === 'developer' && ownerPassword === 'dev123') {
        setIsAuthenticatedOwner(true);
        localStorage.setItem('sm_owner_auth', 'true');
      } else {
        alert(isAr ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password');
      }
    };

    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="bg-white dark:bg-[#1f2028] p-8 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 w-full max-w-md space-y-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-16 h-16 bg-purple-500/10 flex items-center justify-center rounded-full text-[var(--color-primary)]">
            <UserCheck size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {isAr ? 'تسجيل دخول المالك' : 'Owner Login'}
            </h2>
            <p className="text-sm opacity-60">
              {isAr ? 'الرجاء إدخال بيانات الدخول الخاصة بالمالك (الطبقة الأولى).' : 'Please enter owner credentials (Layer 1).'}
            </p>
          </div>
          
          <form onSubmit={handleOwnerLogin} className="space-y-4">
            <div className="relative">
              <input 
                type="text"
                required
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] focus:bg-transparent outline-none transition-all text-center font-bold tracking-wider"
                placeholder={isAr ? 'اسم المستخدم (developer)' : 'Username (developer)'}
              />
              <Users className="absolute left-3.5 top-3.5 opacity-40" size={18} />
            </div>
            <div className="relative">
              <input 
                type="password"
                required
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] focus:bg-transparent outline-none transition-all text-center font-bold tracking-wider"
                placeholder={isAr ? 'كلمة المرور (dev123)' : 'Password (dev123)'}
              />
              <KeyRound className="absolute left-3.5 top-3.5 opacity-40" size={18} />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white rounded-xl active:scale-95 transition-all font-bold cursor-pointer shadow-md shadow-purple-500/20"
            >
              {isAr ? 'تسجيل الدخول' : 'Login'}
            </button>
          </form>
          <div className="pt-4 border-t border-black/5 dark:border-white/5 mt-4">
            <Link to="/" className="text-xs text-[var(--color-primary)] font-bold hover:underline inline-flex items-center gap-1">
              {isAr ? 'العودة للبرنامج الرئيسي ↩️' : 'Go back to POS App ↩️'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!adminSecret) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="bg-white dark:bg-[#1f2028] p-8 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 w-full max-w-md space-y-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-16 h-16 bg-purple-500/10 flex items-center justify-center rounded-full text-[var(--color-primary)]">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {isAr ? 'بوابة التحكم الآمنة' : 'Secure Admin Portal'}
            </h2>
            <p className="text-sm opacity-60">
              {isAr ? 'الطبقة الثانية: الرجاء إدخال رمز المطور السري لإدارة المشتركين والاشتراكات سحابياً.' : 'Layer 2: Enter developer secret to manage subscribers and licenses.'}
            </p>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); fetchLicensesList(); }} className="space-y-4">
            <div className="relative">
              <input 
                type="password"
                required
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] focus:bg-transparent outline-none transition-all text-center font-mono font-bold tracking-wider"
                placeholder={isAr ? 'أدخل الرمز السري' : 'Enter Admin Secret'}
              />
              <KeyRound className="absolute left-3.5 top-3.5 opacity-40" size={18} />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white rounded-xl active:scale-95 transition-all font-bold cursor-pointer shadow-md shadow-purple-500/20"
            >
              {isAr ? '🔑 دخول سحابي آمن' : '🔑 Secure Cloud Login'}
            </button>
          </form>
          <div className="pt-4 border-t border-black/5 dark:border-white/5 mt-4">
            <Link to="/" className="text-xs text-[var(--color-primary)] font-bold hover:underline inline-flex items-center gap-1">
              {isAr ? 'العودة للبرنامج الرئيسي ↩️' : 'Go back to POS App ↩️'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="text-[var(--color-primary)]" size={32} />
            <h2 className="text-2xl font-black tracking-tight">{isAr ? 'نظام إدارة المشتركين والاشتراكات' : 'Subscription & License Dashboard'}</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-500 flex items-center gap-1 border border-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              {isAr ? 'سحابي' : 'Cloud'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{isAr ? 'تحكم بالاشتراكات السحابية، وقم بتمديد الصلاحية ومسح أجهزة المشتركين مباشرة.' : 'Manage cloud licenses, extend subscriptions, and clear active device fingerprints.'}</p>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={fetchLicensesList}
            disabled={listLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
            {isAr ? 'تحديث البيانات' : 'Refresh Cloud'}
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl active:scale-95 transition-all text-sm font-bold cursor-pointer shadow-md shadow-emerald-500/20"
          >
            <PlusCircle size={16} />
            {isAr ? 'إضافة مشترك جديد' : 'New Subscriber'}
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2.5 text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/15 rounded-xl active:scale-95 transition-all cursor-pointer border border-red-500/10"
          >
            {isAr ? 'تسجيل الخروج' : 'Logout'}
          </button>

          <Link
            to="/"
            className="px-4 py-2.5 text-xs font-bold bg-purple-500/10 text-[var(--color-primary)] hover:bg-purple-500/15 rounded-xl active:scale-95 transition-all cursor-pointer border border-purple-500/10 flex items-center justify-center gap-1"
          >
            {isAr ? 'العودة للبرنامج ↩️' : 'Back to POS ↩️'}
          </Link>
        </div>
      </div>

      {/* Tabs UI */}
      <div className="flex border-b border-black/10 dark:border-white/10 mb-4">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'licenses'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isAr ? 'التراخيص النشطة' : 'Active Licenses'}
        </button>
        <button
          onClick={() => { setActiveTab('requests'); fetchRequestsList(); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors relative ${
            activeTab === 'requests'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isAr ? 'طلبات التفعيل' : 'Activation Requests'}
          {pendingRequests.length > 0 && (
            <span className="absolute top-1.5 left-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'licenses' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-[#1f2028] p-5 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-4 transition-all hover:-translate-y-0.5 duration-200">
              <div className="p-3 bg-purple-500/10 text-[var(--color-primary)] rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{isAr ? 'إجمالي المشتركين' : 'Total Subscribers'}</p>
                <h4 className="text-2xl font-extrabold mt-0.5">{totalSubscribers}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2028] p-5 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-4 transition-all hover:-translate-y-0.5 duration-200">
              <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
                <UserCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{isAr ? 'المشتركين النشطين' : 'Active Licenses'}</p>
                <h4 className="text-2xl font-extrabold mt-0.5">{activeSubscribers}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2028] p-5 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-4 transition-all hover:-translate-y-0.5 duration-200">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <Ban size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{isAr ? 'الاشتراكات المنتهية' : 'Expired Licenses'}</p>
                <h4 className="text-2xl font-extrabold mt-0.5">{expiredSubscribers}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2028] p-5 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-4 transition-all hover:-translate-y-0.5 duration-200">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Laptop size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{isAr ? 'الأجهزة المفعلة' : 'Activated Devices'}</p>
                <h4 className="text-2xl font-extrabold mt-0.5">{activatedDevices}</h4>
              </div>
            </div>
          </div>

          {/* Control Bar - Search & Filter */}
          <div className="bg-white dark:bg-[#1f2028] p-4 rounded-2xl shadow-sm border border-black/10 dark:border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between mb-6">
            <div className="relative w-full sm:w-80">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] focus:bg-transparent outline-none transition-all text-sm"
                placeholder={isAr ? '🔍 ابحث باسم التاجر أو كود التفعيل...' : '🔍 Search by merchant or license key...'}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs opacity-60 hidden sm:inline">{isAr ? 'تصفية الحالة:' : 'Filter Status:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-sm cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="active">{isAr ? 'نشط فقط' : 'Active Only'}</option>
                <option value="expired">{isAr ? 'منتهي الصلاحية فقط' : 'Expired Only'}</option>
                <option value="suspended">{isAr ? 'موقوف مؤقتاً' : 'Suspended'}</option>
                <option value="disabled">{isAr ? 'ملغى' : 'Disabled'}</option>
              </select>
            </div>
          </div>

          {/* List of existing licenses */}
          <div className="bg-white dark:bg-[#1f2028] p-6 rounded-2xl shadow-sm border border-black/10 dark:border-white/10">
            {filteredLicenses.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-black/10 dark:border-white/10 rounded-2xl space-y-4">
                <Laptop className="mx-auto text-gray-300 dark:text-gray-600 animate-pulse animate-duration-1000" size={60} />
                <div className="max-w-xs mx-auto">
                  <p className="text-sm font-semibold opacity-70">
                    {isAr ? 'لم يتم العثور على أي مشتركين' : 'No Subscribers Found'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isAr ? 'اضغط على زر تحديث البيانات لجلب المشتركين السحابيين أو قم بإضافة مشترك جديد.' : 'Try refreshing the data or add a new merchant license.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right dir-auto">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-gray-500 font-bold">
                      <th className="px-4 py-3 pb-4 text-right">{isAr ? 'التاجر / المحل' : 'Merchant'}</th>
                      <th className="px-4 py-3 pb-4 text-right">{isAr ? 'كود التفعيل' : 'License Key'}</th>
                      <th className="px-4 py-3 pb-4 text-right">{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                      <th className="px-4 py-3 pb-4 text-right">{isAr ? 'الأجهزة' : 'Devices'}</th>
                      <th className="px-4 py-3 pb-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                      <th className="px-4 py-3 pb-4 text-center">{isAr ? 'إجراءات التحكم' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredLicenses.map(([key, value]: [string, any]) => {
                      const expiry = new Date(value.expiry_date);
                      const isExpired = new Date() > expiry;
                      const activeCount = value.activated_devices ? value.activated_devices.length : 0;
                      const maxDev = value.max_devices || 1;

                      return (
                        <tr key={key} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                          <td className="px-4 py-4.5 font-bold text-base text-[var(--color-primary)]">
                            {value.merchant_name || '---'}
                          </td>
                          
                          <td className="px-4 py-4.5">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300 font-semibold border border-black/5 dark:border-white/5 select-all">
                                {key}
                              </span>
                              <button
                                onClick={() => copyToClipboard(key)}
                                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg active:scale-95 transition-all text-gray-500 cursor-pointer"
                                title={isAr ? 'نسخ الكود' : 'Copy Key'}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-4.5">
                            <div className="flex flex-col">
                              <span className={`font-semibold ${isExpired ? 'text-red-500 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                {expiry.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                              {isExpired && (
                                <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                  {isAr ? '🚨 منتهي الصلاحية' : '🚨 Expired'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4.5">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-xs font-semibold">
                                <Smartphone size={14} className="opacity-60" />
                                <span>{activeCount} / {maxDev === 0 ? '∞' : maxDev} أجهزة</span>
                              </div>
                              {activeCount > 0 && (
                                <button
                                  onClick={() => handleClearDevices(key)}
                                  className="text-[11px] text-red-500 font-medium hover:underline text-right cursor-pointer"
                                >
                                  ♻️ مسح الأجهزة
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4.5 text-center">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                              value.status === 'active' && !isExpired
                                ? 'bg-green-500/10 text-green-600 border-green-500/10' 
                                : value.status === 'suspended'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/10'
                                : 'bg-red-500/10 text-red-600 border-red-500/10'
                            }`}>
                              {value.status === 'active' && !isExpired && (isAr ? 'نشط' : 'Active')}
                              {value.status === 'active' && isExpired && (isAr ? 'منتهي' : 'Expired')}
                              {value.status === 'suspended' && (isAr ? 'موقوف مؤقتاً' : 'Suspended')}
                              {value.status === 'disabled' && (isAr ? 'ملغى' : 'Disabled')}
                            </span>
                          </td>

                          <td className="px-4 py-4.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(key, value)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-sm"
                              >
                                <Edit2 size={12} />
                                {isAr ? 'تعديل وتمديد' : 'Edit / Extend'}
                              </button>

                              <button
                                onClick={() => shareViaWhatsApp({
                                  key: key,
                                  merchantName: value.merchant_name,
                                  expiryDate: value.expiry_date,
                                  maxDevices: value.max_devices
                                })}
                                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-95 transition-all cursor-pointer"
                                title={isAr ? 'إرسال ترخيص عبر الواتساب' : 'Share via WhatsApp'}
                              >
                                <Share2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-[#1f2028] p-6 rounded-2xl shadow-sm border border-black/10 dark:border-white/10">
          <h3 className="text-lg font-bold mb-4">{isAr ? 'طلبات التفعيل والتمديد' : 'Activation Requests'}</h3>
          
          {pendingRequests.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-black/10 dark:border-white/10 rounded-2xl space-y-4">
              <ShieldCheck className="mx-auto text-gray-300 dark:text-gray-600" size={60} />
              <p className="text-sm font-semibold opacity-70">
                {isAr ? 'لا توجد طلبات معلقة حالياً' : 'No pending requests'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingRequests.map(req => (
                <div key={req.id} className="p-4 rounded-xl border border-black/10 dark:border-white/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[var(--color-primary)] text-lg mb-1">{req.merchant_name}</h4>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-4 mt-1">
                      <span>{isAr ? 'المدة المطلوبة:' : 'Requested Duration:'} <strong className="text-gray-700 dark:text-gray-300">{req.duration_months} {isAr ? 'أشهر' : 'months'}</strong></span>
                      {req.phone && <span>{isAr ? 'الهاتف:' : 'Phone:'} <strong className="text-gray-700 dark:text-gray-300" dir="ltr">{req.phone}</strong></span>}
                      <span>{isAr ? 'تاريخ الطلب:' : 'Date:'} {new Date(req.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-400 mt-2">
                      ID: {req.hardware_fingerprint}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {req.status === 'approved' ? (
                      <span className="px-4 py-2 bg-green-500/10 text-green-600 rounded-xl font-bold text-sm">
                        {isAr ? 'تمت الموافقة ✓' : 'Approved ✓'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-sm font-bold cursor-pointer"
                        >
                          {isAr ? 'رفض الطلب' : 'Reject'}
                        </button>
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                        >
                          <CheckCircle size={16} />
                          {isAr ? 'موافقة وتوليد مفتاح' : 'Approve & Generate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD SUBSCRIBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2028] p-6 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="text-emerald-500" size={20} />
                {isAr ? 'إضافة مشترك جديد وتوليد ترخيص' : 'Add New Subscriber'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLicense} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'اسم التاجر / المحل' : 'Merchant / Shop Name'}</label>
                <input 
                  type="text"
                  required
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all"
                  placeholder={isAr ? 'مثال: سوبرماركت الهلال' : 'e.g. Al-Hilal Market'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'مدة صلاحية التفعيل' : 'License Duration'}</label>
                <select 
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
                >
                  <option value={1}>{isAr ? 'شهر واحد (تجربة)' : '1 Month (Trial)'}</option>
                  <option value={3}>{isAr ? '3 أشهر' : '3 Months'}</option>
                  <option value={6}>{isAr ? '6 أشهر' : '6 Months'}</option>
                  <option value={12}>{isAr ? 'سنة واحدة' : '1 Year'}</option>
                  <option value={24}>{isAr ? 'سنتين' : '2 Years'}</option>
                  <option value={60}>{isAr ? '5 سنوات' : '5 Years'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'الحد الأقصى للأجهزة' : 'Max Allowed Devices'}</label>
                <select 
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
                >
                  <option value={1}>{isAr ? 'جهاز واحد فقط' : '1 Device Only'}</option>
                  <option value={2}>{isAr ? 'جهازين' : '2 Devices'}</option>
                  <option value={3}>{isAr ? '3 أجهزة' : '3 Devices'}</option>
                  <option value={5}>{isAr ? '5 أجهزة' : '5 Devices'}</option>
                  <option value={10}>{isAr ? '10 أجهزة' : '10 Devices'}</option>
                  <option value={0}>{isAr ? 'أجهزة مفتوحة (غير محدود)' : 'Unlimited Devices'}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-sm cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm cursor-pointer active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                >
                  {loading ? (isAr ? 'جاري التوليد...' : 'Generating...') : (isAr ? 'تنشيط وحفظ الترخيص' : 'Activate & Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / EXTEND SUBSCRIBER */}
      {editingLicenseKey && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2028] p-6 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit2 className="text-[var(--color-primary)]" size={20} />
                {isAr ? 'تعديل بيانات المشترك' : 'Edit Subscriber'}
              </h3>
              <button 
                onClick={() => setEditingLicenseKey(null)}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateLicense} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'كود الترخيص (لا يمكن تعديله)' : 'License Key (Read-only)'}</label>
                <input 
                  type="text"
                  disabled
                  value={editingLicenseKey}
                  className="w-full px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl font-mono text-xs text-gray-500 outline-none select-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'اسم التاجر / المحل' : 'Merchant Name'}</label>
                <input 
                  type="text"
                  required
                  value={editMerchantName}
                  onChange={(e) => setEditMerchantName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'حالة الاشتراك' : 'Subscription Status'}</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-sm cursor-pointer"
                >
                  <option value="active">🟢 {isAr ? 'نشط' : 'Active'}</option>
                  <option value="suspended">🟡 {isAr ? 'موقوف مؤقتاً' : 'Suspended'}</option>
                  <option value="disabled">🔴 {isAr ? 'ملغى' : 'Disabled'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'الحد الأقصى للأجهزة' : 'Max Devices Limit'}</label>
                <select
                  value={editMaxDevices}
                  onChange={(e) => setEditMaxDevices(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-sm cursor-pointer"
                >
                  <option value={1}>{isAr ? 'جهاز واحد فقط' : '1 Device'}</option>
                  <option value={2}>{isAr ? 'جهازين' : '2 Devices'}</option>
                  <option value={3}>{isAr ? '3 أجهزة' : '3 Devices'}</option>
                  <option value={5}>{isAr ? '5 أجهزة' : '5 Devices'}</option>
                  <option value={10}>{isAr ? '10 أجهزة' : '10 Devices'}</option>
                  <option value={0}>{isAr ? 'أجهزة مفتوحة (غير محدود)' : 'Unlimited'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{isAr ? 'تاريخ انتهاء الاشتراك' : 'Subscription Expiry'}</label>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    required
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-sm cursor-pointer"
                  />
                </div>
                
                {/* Quick Expiry Extenders */}
                <div className="mt-2.5 space-y-1.5">
                  <span className="text-[11px] opacity-60 block">{isAr ? '⚡ تمديد اشتراك سريع:' : '⚡ Quick subscription extension:'}</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExtendExpiry(1)}
                      className="py-1 px-2 bg-purple-500/10 text-[var(--color-primary)] text-xs font-semibold rounded-lg hover:bg-purple-500/20 transition-colors cursor-pointer"
                    >
                      + شهر
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExtendExpiry(3)}
                      className="py-1 px-2 bg-purple-500/10 text-[var(--color-primary)] text-xs font-semibold rounded-lg hover:bg-purple-500/20 transition-colors cursor-pointer"
                    >
                      + 3 أشهر
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExtendExpiry(6)}
                      className="py-1 px-2 bg-purple-500/10 text-[var(--color-primary)] text-xs font-semibold rounded-lg hover:bg-purple-500/20 transition-colors cursor-pointer"
                    >
                      + 6 أشهر
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExtendExpiry(12)}
                      className="py-1 px-2 bg-purple-500/10 text-[var(--color-primary)] text-xs font-semibold rounded-lg hover:bg-purple-500/20 transition-colors cursor-pointer"
                    >
                      + سنة
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingLicenseKey(null)}
                  className="flex-1 py-2.5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-sm cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[var(--color-primary)] hover:brightness-110 text-white rounded-xl font-bold text-sm cursor-pointer active:scale-95 transition-all shadow-md shadow-purple-500/10"
                >
                  {loading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LICENSE GENERATION SUCCESS */}
      {showSuccessModal && newlyCreatedLicense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2028] p-7 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 text-center space-y-5">
            <div className="mx-auto w-14 h-14 bg-green-500/10 text-green-500 flex items-center justify-center rounded-full">
              <CheckCircle size={32} />
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
                {isAr ? 'تم إنشاء وتنشيط الترخيص بنجاح!' : 'License Activated Successfully!'}
              </h3>
              <p className="text-xs opacity-60 mt-1">
                {isAr ? 'الترخيص نشط الآن سحابياً وجاهز للربط على أجهزة التاجر.' : 'The license is now active in the cloud and ready to link.'}
              </p>
            </div>

            {/* License Key Card */}
            <div className="p-4 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">{isAr ? 'مفتاح الترخيص' : 'LICENSE KEY'}</span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-lg font-bold select-all text-[var(--color-primary)]">
                  {newlyCreatedLicense.key}
                </span>
                <button
                  onClick={() => copyToClipboard(newlyCreatedLicense.key)}
                  className="p-1.5 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer text-[var(--color-primary)]"
                  title={isAr ? 'نسخ الترخيص' : 'Copy Key'}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Info details */}
            <div className="text-right text-xs space-y-2 border-b border-black/5 dark:border-white/5 pb-4 dir-auto">
              <div className="flex justify-between">
                <span className="opacity-60">{isAr ? 'اسم التاجر / المحل:' : 'Merchant:'}</span>
                <span className="font-bold">{newlyCreatedLicense.merchantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{isAr ? 'تاريخ الانتهاء:' : 'Expiry Date:'}</span>
                <span className="font-bold">{new Date(newlyCreatedLicense.expiryDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">{isAr ? 'الحد الأقصى للأجهزة:' : 'Max Devices:'}</span>
                <span className="font-bold">{newlyCreatedLicense.maxDevices === 0 ? (isAr ? 'مفتوح (غير محدود)' : 'Unlimited') : `${newlyCreatedLicense.maxDevices} أجهزة`}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                onClick={() => shareViaWhatsApp(newlyCreatedLicense)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-emerald-500/15"
              >
                <Share2 size={16} />
                {isAr ? 'مشاركة الكود عبر الواتساب' : 'Share via WhatsApp'}
              </button>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-sm cursor-pointer text-gray-500 dark:text-gray-400"
              >
                {isAr ? 'إغلاق نافذة النجاح' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
