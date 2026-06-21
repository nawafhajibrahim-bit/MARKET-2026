import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Send, BrainCircuit, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../../database/Provider';

export default function AIEngine() {
  const { t } = useTranslation();
  const db = useDb();
  const [query, setQuery] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGroq = useCallback(async (prompt: string) => {
    const customKey = localStorage.getItem('custom_groq_key') || '';
    let selectedModel = localStorage.getItem('ai_model') || 'llama-3.1-8b-instant';
    if (selectedModel === 'llama3-8b-8192') {
      selectedModel = 'llama-3.1-8b-instant';
      localStorage.setItem('ai_model', selectedModel);
    } else if (selectedModel === 'llama3-70b-8192') {
      selectedModel = 'llama-3.3-70b-versatile';
      localStorage.setItem('ai_model', selectedModel);
    }

    try {
      if (customKey) {
        // VIP Business Route: Direct call to Groq
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${customKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return errData.error?.message || t('ai_error_connect');
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || t('ai_no_response');
      } else {
        // Call our Vercel serverless proxy with the local license key
        let licenseKey = '';
        try {
          const configDoc = await db.system_config.findOne('config').exec();
          if (configDoc) {
            licenseKey = configDoc.get('license_key') || '';
          }
        } catch (dbErr) {
          console.error('Error fetching license key from DB:', dbErr);
        }

        if (!licenseKey) {
          return t('license_required') || 'A valid license key is required to use AI features.';
        }

        const res = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            model: selectedModel,
            licenseKey
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return errData.error || t('ai_error_connect');
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || t('ai_no_response');
      }
    } catch (e) {
      console.error(e);
      return t('ai_error_connect');
    }
  }, [t, db]);

  const getDatabaseContext = useCallback(async () => {
    try {
      const [productDocs, invoiceDocs, debtDocs] = await Promise.all([
        db.products.find().exec(),
        db.invoices.find().exec(),
        db.debts.find().exec(),
      ]);

      const products = productDocs.map(d => d.toJSON());
      const invoices = invoiceDocs.map(d => d.toJSON());
      const debts = debtDocs.map(d => d.toJSON());

      const productsSummary = products.map(p => 
        `- ${p.name_ar} (${p.name_en || ''}): كود=${p.barcode}، سعر البيع=${p.sale_price}، التكلفة=${p.cost_price}، الكمية المتبقية=${p.stock_quantity}، الحد الأدنى=${p.min_safety_stock}`
      ).join('\n');

      const invoicesSummary = invoices.map(inv => {
        const itemDetails = (inv.items || []).map((item: { product_id: string; unit_used: string; quantity: number; price: number }) => {
          const prod = products.find(p => p.id === item.product_id);
          const name = prod ? prod.name_ar : item.product_id;
          return `${item.quantity}x ${name} (${item.unit_used}) بسعر ${item.price}`;
        }).join(', ');
        return `- فاتورة ${inv.invoice_id} في ${new Date(inv.timestamp).toLocaleDateString()}: المجموع=${inv.total_amount}، الربح=${inv.actual_profit || 0}، طريقة الدفع=${inv.payment_type}، المواد=[${itemDetails}]`;
      }).join('\n');

      const debtsSummary = debts.map(d => 
        `- دين لـ ${d.client_supplier_name}: المبلغ=${d.amount}، المدفوع=${d.paid_amount || 0}، المتبقي=${d.amount - (d.paid_amount || 0)}، الحالة=${d.status}`
      ).join('\n');

      return `
قائمة المواد المتاحة وأسعارها ومخزونها:
${productsSummary}

سجلات عمليات البيع (الفواتير):
${invoicesSummary}

سجلات الديون المستحقة:
${debtsSummary}
`;
    } catch (err) {
      console.error('Failed to build database context', err);
      return '';
    }
  }, [db]);

  const generateStockInsight = useCallback(async () => {
    setLoading(true);
    const dbContext = await getDatabaseContext();
    if (!dbContext) {
      setInsight(t('no_insights'));
      setLoading(false);
      return;
    }

    const prompt = `قم بدور مستشار المبيعات والمخازن الذكي لمحل تجاري محلي. بناءً على بيانات المحل الحالية التالية:
${dbContext}

أعطني توصية استراتيجية ذكية واحدة للمخزون أو المبيعات (مثال: ما الذي يجب طلبه، أي المواد راكدة، أو فرصة لزيادة المبيعات).
اجعل الإجابة احترافية، باللغة العربية الفصحى، وموجزة جداً (أقل من 3 جمل).`;
    
    const response = await fetchGroq(prompt);
    setInsight(response);
    setLoading(false);
  }, [fetchGroq, getDatabaseContext, t]);

  useEffect(() => {
    generateStockInsight();
  }, [generateStockInsight]);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    const dbContext = await getDatabaseContext();
    const prompt = `أنت مساعد ذكي لإدارة المخازن والمبيعات في محل تجاري. 
بيانات المحل الحالية هي:
${dbContext}

أجب عن استفسار المستخدم التالي بناءً على البيانات أعلاه فقط بدقة ومصداقية. إذا سألك عن أرباح مادة معينة، قم بحسابها من حاصل (سعر البيع - سعر التكلفة) مضروباً في الكمية المباعة من الفواتير.
استفسار المستخدم: "${query}"

اجعل الإجابة موجزة، واضحة، وباللغة العربية الفصحى.`;
    
    const response = await fetchGroq(prompt);
    setInsight(response);
    setQuery('');
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 dark:border-purple-400/20 rounded-xl p-6 shadow-sm mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[var(--color-primary)] text-white rounded-lg shadow-lg shadow-purple-500/30">
          <BrainCircuit size={24} />
        </div>
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
          {t('ai_engine_title')}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Natural Language Query Engine */}
        <div className="space-y-4 bg-white/60 dark:bg-[#16171d]/60 p-4 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-sm">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            {t('db_search_title')}
          </h4>
          <form onSubmit={handleQuery} className="relative">
            <input 
              type="text" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('db_search_placeholder')} 
              className="w-full pl-4 pr-12 py-3 rounded-lg bg-white dark:bg-[#1f2028] shadow-sm border border-transparent focus:border-blue-500 outline-none transition-all"
            />
            <button 
              type="submit" 
              disabled={loading || !query}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send size={18} />
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            {t('db_search_desc')}
          </p>
        </div>

        {/* AI Smart Stock Advisor */}
        <div className="space-y-4 bg-white/60 dark:bg-[#16171d]/60 p-4 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-sm flex flex-col">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertCircle size={18} className="text-orange-500" />
            {t('stock_insights_title')}
          </h4>
          <div className="flex-1 p-4 rounded-lg bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-inner min-h-[100px] flex items-center">
            {loading ? (
              <div className="w-full flex justify-center">
                <div className="animate-pulse flex gap-1">
                   <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                   <div className="w-2 h-2 bg-orange-500 rounded-full delay-75"></div>
                   <div className="w-2 h-2 bg-orange-500 rounded-full delay-150"></div>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-line">{insight || t('no_insights')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
