import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HandCoins, CheckCircle, Clock, AlertTriangle, Phone, User, Plus, X, TrendingDown } from 'lucide-react';
import { useDb } from '../database/Provider';
import type { DebtDocType } from '../database/schema';
import { formatCurrency } from '../utils/currency';

type DebtFilter = 'all' | 'Pending' | 'Paid';

export const Debts = () => {
  const { t, i18n } = useTranslation();
  const db = useDb();

  const [debts, setDebts] = useState<DebtDocType[]>([]);
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);

  // New debt form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<'Customer Debt' | 'Supplier Credit'>('Customer Debt');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [recordPaymentId, setRecordPaymentId] = useState<string | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<number>(0);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Notification Toast State
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const triggerNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordPaymentId) return;
    
    if (Number(paymentInstallment) <= 0) {
      triggerNotification(
        isRtl ? 'مبلغ الدفعة يجب أن يكون أكبر من صفر!' : 'Payment amount must be greater than zero.',
        'error'
      );
      return;
    }

    setPaymentSaving(true);
    try {
      const doc = await db.debts.findOne(recordPaymentId).exec();
      if (doc) {
        const d = doc.toJSON();
        const currentPaid = d.paid_amount || 0;
        const newPaid = currentPaid + Number(paymentInstallment);
        const isFullyPaid = newPaid >= d.amount;
        await doc.incrementalPatch({
          paid_amount: isFullyPaid ? d.amount : newPaid,
          status: isFullyPaid ? 'Paid' : 'Pending'
        });
        setRecordPaymentId(null);
        setPaymentInstallment(0);

        triggerNotification(
          isRtl ? 'تم تسجيل الدفعة بنجاح!' : 'Payment recorded successfully!',
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to record payment installment:', err);
      triggerNotification(
        isRtl ? 'فشل تسجيل الدفعة!' : 'Failed to record payment!',
        'error'
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    const sub = db.debts.find().$.subscribe((docs) => {
      setDebts(docs.map(d => d.toJSON()));
    });
    return () => sub.unsubscribe();
  }, [db]);

  const isRtl = i18n.language === 'ar';

  const filteredDebts = debts.filter(d => filter === 'all' || d.status === filter);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const totalPages = Math.ceil(filteredDebts.length / itemsPerPage) || 1;
  const paginatedDebts = filteredDebts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPending = debts
    .filter(d => d.status === 'Pending' && d.type === 'Customer Debt')
    .reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0);

  const totalPaid = debts
    .filter(d => d.type === 'Customer Debt')
    .reduce((sum, d) => sum + (d.status === 'Paid' ? d.amount : (d.paid_amount || 0)), 0);

  const totalSupplierCredit = debts
    .filter(d => d.status === 'Pending' && d.type === 'Supplier Credit')
    .reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0);

  const handleMarkAsPaid = async (debtId: string) => {
    try {
      const doc = await db.debts.findOne(debtId).exec();
      if (doc) {
        await doc.incrementalPatch({
          status: 'Paid',
          paid_amount: doc.toJSON().amount
        });
        triggerNotification(
          isRtl ? 'تم تحصيل الدين بنجاح!' : 'Debt marked as paid successfully!',
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to update debt:', err);
      triggerNotification(
        isRtl ? 'فشل تحصيل الدين!' : 'Failed to mark debt as paid!',
        'error'
      );
    } finally {
      setConfirmPayId(null);
    }
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newName.trim()) {
      triggerNotification(
        isRtl ? 'اسم المدين / الدائن مطلوب!' : 'Name is required.',
        'error'
      );
      return;
    }

    if (Number(newAmount) <= 0) {
      triggerNotification(
        isRtl ? 'قيمة الدين يجب أن تكون أكبر من صفر!' : 'Amount must be greater than zero.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const debtId = 'debt-' + crypto.randomUUID();
      await db.debts.insert({
        debt_id: debtId,
        client_supplier_name: newName,
        phone: newPhone || '',
        type: newType,
        amount: Number(newAmount),
        paid_amount: 0,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Pending',
      });
      setNewName('');
      setNewPhone('');
      setNewAmount(0);
      setNewDueDate('');
      setShowAddModal(false);
      
      triggerNotification(
        isRtl ? 'تم تسجيل الدين بنجاح!' : 'Debt added successfully!',
        'success'
      );
    } catch (err) {
      console.error('Failed to add debt:', err);
      triggerNotification(
        isRtl ? 'فشل إضافة الدين!' : 'Failed to add debt!',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const isOverdue = (dueDateStr?: string) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date();
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString(isRtl ? 'ar-IQ' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('debts_title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('debts_subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:brightness-110 active:scale-95 transition-all font-medium cursor-pointer"
        >
          <Plus size={18} />
          {t('add_debt')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingDown size={20} className="text-red-500" />
            </div>
            <span className="text-sm text-gray-500">{t('debts_pending_total')}</span>
          </div>
          <p className="text-2xl font-bold text-red-500" dir="ltr">{formatCurrency(totalPending)}</p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle size={20} className="text-green-500" />
            </div>
            <span className="text-sm text-gray-500">{t('debts_collected_total')}</span>
          </div>
          <p className="text-2xl font-bold text-green-500" dir="ltr">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <HandCoins size={20} className="text-blue-500" />
            </div>
            <span className="text-sm text-gray-500">{t('debts_supplier_total')}</span>
          </div>
          <p className="text-2xl font-bold text-blue-500" dir="ltr">{formatCurrency(totalSupplierCredit)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 bg-white dark:bg-[#1f2028] p-1.5 rounded-xl border border-black/5 dark:border-white/5 w-fit shadow-sm">
        {(['all', 'Pending', 'Paid'] as DebtFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              filter === f
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {f === 'all' ? t('all') : f === 'Pending' ? t('debt_pending') : t('debt_paid')}
          </button>
        ))}
      </div>

      {/* Debts Table */}
      <div className="bg-white dark:bg-[#1f2028] rounded-xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
          <thead>
            <tr className="bg-black/5 dark:bg-white/5 text-sm uppercase tracking-wider text-gray-500">
              <th className="p-4 font-medium">{t('client_name')}</th>
              <th className="p-4 font-medium">{t('debt_type')}</th>
              <th className="p-4 font-medium">{t('total_amount_label')}</th>
              <th className="p-4 font-medium">{t('paid_amount_label')}</th>
              <th className="p-4 font-medium">{t('remaining_amount_label')}</th>
              <th className="p-4 font-medium">{t('due_date')}</th>
              <th className="p-4 font-medium text-center">{t('status')}</th>
              <th className="p-4 font-medium text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filteredDebts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <HandCoins size={40} className="opacity-30" />
                    <p>{t('no_debts_found')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedDebts.map((debt) => {
                const overdue = debt.status === 'Pending' && isOverdue(debt.due_date);
                return (
                  <tr key={debt.debt_id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-[var(--color-primary)]" />
                        </div>
                        <div>
                          <p className="font-semibold">{debt.client_supplier_name}</p>
                          {debt.phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={11} /> {debt.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        debt.type === 'Customer Debt'
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {debt.type === 'Customer Debt' ? t('customer_debt') : t('supplier_credit')}
                      </span>
                    </td>
                    <td className="p-4 font-semibold font-mono" dir="ltr">
                      {formatCurrency(debt.amount)}
                    </td>
                    <td className="p-4 font-medium text-green-600 dark:text-green-400 font-mono" dir="ltr">
                      {formatCurrency(debt.paid_amount || 0)}
                    </td>
                    <td className="p-4 font-bold text-red-500 font-mono" dir="ltr">
                      {formatCurrency(debt.amount - (debt.paid_amount || 0))}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {overdue && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                        <span className={overdue ? 'text-red-500 font-medium' : 'text-gray-500'}>
                          {formatDate(debt.due_date)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {debt.status === 'Pending' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-full font-medium">
                          <Clock size={11} />
                          {t('debt_pending')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle size={11} />
                          {t('debt_paid')}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {debt.status === 'Pending' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setRecordPaymentId(debt.debt_id);
                              setPaymentInstallment(debt.amount - (debt.paid_amount || 0));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all active:scale-95 cursor-pointer"
                          >
                            <HandCoins size={13} />
                            {t('record_payment')}
                          </button>
                          <button
                            onClick={() => setConfirmPayId(debt.debt_id)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all active:scale-95 cursor-pointer"
                          >
                            <CheckCircle size={13} />
                            {t('mark_as_paid')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 p-4 bg-white dark:bg-[#1f2028] rounded-xl shadow-sm border border-black/5 dark:border-white/5 select-none">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {i18n.language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <span className="text-sm font-medium text-gray-500">
            {i18n.language === 'ar' 
              ? `الصفحة ${currentPage} من ${totalPages}` 
              : `Page ${currentPage} of ${totalPages}`
            }
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {i18n.language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {/* Confirm Pay Modal */}
      {confirmPayId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-green-500/10 rounded-xl">
                <CheckCircle className="text-green-500" size={24} />
              </div>
              <h3 className="text-lg font-bold">{t('confirm_payment_title')}</h3>
            </div>
            <p className="text-gray-500 mb-6">{t('confirm_payment_desc')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmPayId(null)}
                className="px-5 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleMarkAsPaid(confirmPayId)}
                className="px-5 py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 active:scale-95 transition-all cursor-pointer"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-lg shadow-2xl border border-black/10 dark:border-white/10 p-6">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-bold">{t('add_debt')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('client_name')}</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('client_name_placeholder')}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('phone_optional')}</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('debt_type')}</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'Customer Debt' | 'Supplier Credit')}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none cursor-pointer"
                  >
                    <option value="Customer Debt">{t('customer_debt')}</option>
                    <option value="Supplier Credit">{t('supplier_credit')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('amount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount || ''}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    dir="ltr"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">{t('due_date')}</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-95 transition-all font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving ? t('processing') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordPaymentId && (() => {
        const debt = debts.find(d => d.debt_id === recordPaymentId);
        if (!debt) return null;
        const remaining = debt.amount - (debt.paid_amount || 0);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1f2028] text-[var(--text)] rounded-2xl w-full max-w-md shadow-2xl border border-black/10 dark:border-white/10 p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                <h3 className="text-xl font-bold">{t('record_payment_title')}</h3>
                <button
                  onClick={() => setRecordPaymentId(null)}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t('client_name')}: <span className="font-semibold text-[var(--text)]">{debt.client_supplier_name}</span></p>
                  <p className="text-sm text-gray-500 mb-1">{t('total_amount_label')}: <span className="font-semibold text-[var(--text)]">{formatCurrency(debt.amount)}</span></p>
                  <p className="text-sm text-gray-500">{t('remaining_amount_label')}: <span className="font-bold text-red-500">{formatCurrency(remaining)}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('payment_amount_input')}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    max={remaining}
                    value={paymentInstallment || ''}
                    onChange={(e) => setPaymentInstallment(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none"
                    dir="ltr"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setRecordPaymentId(null)}
                    className="px-6 py-2.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSaving || paymentInstallment <= 0 || paymentInstallment > remaining}
                    className="px-6 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 active:scale-95 transition-all font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {paymentSaving ? t('processing') : t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {/* Toast Notification */}
      {message && (
        <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:w-96 text-white p-4 rounded-xl shadow-lg z-[300] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${
          messageType === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          <span>{messageType === 'success' ? '✅' : '⚠️'}</span>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};
