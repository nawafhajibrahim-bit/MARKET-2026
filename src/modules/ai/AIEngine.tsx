import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Sparkles, Send, BrainCircuit, AlertCircle, X, Mic, MicOff, Trash2, ChevronDown, ChevronUp, TrendingUp, Package, DollarSign, Truck, Lightbulb, Bot, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDb } from '../../database/Provider';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface QuestionCategory {
  icon: React.ReactNode;
  labelAr: string;
  labelEn: string;
  color: string;
  questions: { ar: string; en: string }[];
}

// Preferred Groq models in priority order — auto-detection picks the first one available
const PREFERRED_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

// Models to skip — they have very low rate limits or are not suitable for general chat
const BLOCKED_MODELS = [
  'allam-2-7b',
  'allam-2-7b-instruct',
  'qwen-2.5-32b',
  'qwen-2.5-coder-32b',
  'qwen/qwen3.6-27b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'distil-whisper-large-v3-en',
  'playai-tts',
  'playai-tts-arabic',
];

export default function AIEngine() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const db = useDb();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAiWarning, setShowAiWarning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const questionCategories: QuestionCategory[] = [
    {
      icon: <TrendingUp size={14} />,
      labelAr: '📊 المبيعات والفواتير',
      labelEn: '📊 Sales & Invoices',
      color: 'blue',
      questions: [
        { ar: 'ما هي أعلى فاتورة مبيعاً وكم قيمتها؟', en: 'What is the highest invoice and its value?' },
        { ar: 'ما هو متوسط قيمة الفاتورة؟', en: 'What is the average invoice value?' },
        { ar: 'ما هي نسبة الربح الإجمالية؟', en: 'What is the overall profit margin?' },
        { ar: 'ما هو أفضل يوم مبيعاً هذا الشهر؟', en: 'What was the best sales day this month?' },
        { ar: 'أعطني ملخص المبيعات لهذا الأسبوع', en: 'Give me this week\'s sales summary' },
      ]
    },
    {
      icon: <Package size={14} />,
      labelAr: '📦 المخزون والمنتجات',
      labelEn: '📦 Inventory & Products',
      color: 'emerald',
      questions: [
        { ar: 'ما هي المنتجات التي ستنفد قريباً؟', en: 'Which products are running low?' },
        { ar: 'ما هي المنتجات التي لم تُباع أبداً؟', en: 'Which products have never been sold?' },
        { ar: 'ما هو المنتج الأعلى ربحاً؟', en: 'Which product has the highest profit?' },
        { ar: 'ما هي المنتجات القريبة من انتهاء الصلاحية؟', en: 'Which products are near expiry?' },
        { ar: 'ما هي أكثر الفئات مبيعاً؟', en: 'What are the best-selling categories?' },
      ]
    },
    {
      icon: <DollarSign size={14} />,
      labelAr: '💰 الديون والعملاء',
      labelEn: '💰 Debts & Customers',
      color: 'amber',
      questions: [
        { ar: 'من هو أكثر زبون عليه ديون؟', en: 'Who is the customer with the most debt?' },
        { ar: 'ما هو إجمالي الديون المعلقة؟', en: 'What is the total outstanding debt?' },
        { ar: 'كم عدد العملاء المديونين؟', en: 'How many customers have debts?' },
        { ar: 'ما هي الديون المتأخرة عن موعدها؟', en: 'Which debts are past due?' },
      ]
    },
    {
      icon: <Truck size={14} />,
      labelAr: '🚚 الموردين والمشتريات',
      labelEn: '🚚 Suppliers & Purchases',
      color: 'violet',
      questions: [
        { ar: 'من هو أفضل مورد لدينا؟', en: 'Who is our best supplier?' },
        { ar: 'ما هو إجمالي المشتريات هذا الشهر؟', en: 'What are total purchases this month?' },
        { ar: 'كم المبالغ غير المدفوعة للموردين؟', en: 'How much is owed to suppliers?' },
      ]
    },
    {
      icon: <Lightbulb size={14} />,
      labelAr: '💡 استشارات واقتراحات',
      labelEn: '💡 Advice & Suggestions',
      color: 'rose',
      questions: [
        { ar: 'كيف يمكنني زيادة المبيعات؟', en: 'How can I increase sales?' },
        { ar: 'كيف أحسن إدارة المخزون؟', en: 'How can I improve inventory management?' },
        { ar: 'أعطني تقريراً سريعاً عن حالة المحل', en: 'Give me a quick store status report' },
        { ar: 'ما هي نقاط الضعف في أداء المحل؟', en: 'What are the weaknesses in store performance?' },
        { ar: 'ما هي المنتجات التي يجب التركيز عليها؟', en: 'Which products should I focus on?' },
      ]
    }
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-700 dark:text-blue-300', hover: 'hover:bg-blue-500/20' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', hover: 'hover:bg-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-700 dark:text-amber-300', hover: 'hover:bg-amber-500/20' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-700 dark:text-violet-300', hover: 'hover:bg-violet-500/20' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-700 dark:text-rose-300', hover: 'hover:bg-rose-500/20' },
  };

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(isAr ? 'متصفحك لا يدعم ميزة التحدث بالصوت.' : 'Your browser does not support speech recognition.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = isAr ? 'ar-SA' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setQuery(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsRecording(false);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    const hasKey = !!localStorage.getItem('custom_groq_key');
    setShowAiWarning(!hasKey);
  }, []);

  const handleDismissAiWarning = () => {
    setShowAiWarning(false);
    localStorage.setItem('dismiss_ai_warning', 'true');
  };

  const getWorkingModel = useCallback(async (apiKey: string): Promise<string> => {
    // Try to fetch available models from Groq
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        const availableIds: string[] = (data.data || [])
          .map((m: { id: string }) => m.id)
          .filter((id: string) => !BLOCKED_MODELS.includes(id));
        // Return ONLY preferred models. Never fallback to random unknown models
        // because they often have tiny rate limits (e.g. qwen, allam).
        const found = PREFERRED_MODELS.find(m => availableIds.includes(m));
        if (found) return found;
      }
    } catch { /* ignore, fall through */ }
    // Last resort: return the most stable free tier model
    return 'llama-3.3-70b-versatile';
  }, []);

  const fetchGroq = useCallback(async (apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => {
    const customKey = localStorage.getItem('custom_groq_key') || '';

    try {
      if (!customKey) {
        return t('custom_key_required') || 'Please enter your Groq API Key in Settings to use the AI features.';
      }

      // Determine model: use saved if set and not blocked, otherwise auto-detect
      let selectedModel = localStorage.getItem('ai_model') || '';
      if (!selectedModel || BLOCKED_MODELS.includes(selectedModel)) {
        // Clear bad model and auto-detect
        localStorage.removeItem('ai_model');
        selectedModel = '';
      }
      
      // VIP Business Route: Direct call to Groq
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${customKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel || 'llama-3.3-70b-versatile',
          messages: apiMessages,
          temperature: 0.3
        })
      });

      // If model not found or not accessible, auto-detect and retry once
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg: string = errData.error?.message || '';
        if (errMsg.includes('does not exist') || errMsg.includes('not have access') || res.status === 404) {
          // Auto-detect a working model
          const workingModel = await getWorkingModel(customKey);
          localStorage.setItem('ai_model', workingModel);
          
          const retry = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${customKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: workingModel,
              messages: apiMessages,
              temperature: 0.3
            })
          });
          if (!retry.ok) {
            const retryErr = await retry.json().catch(() => ({}));
            return retryErr.error?.message || t('ai_error_connect');
          }
          const retryData = await retry.json();
          const rawContent = retryData.choices?.[0]?.message?.content || t('ai_no_response');
          return rawContent.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
        }
        return errMsg || t('ai_error_connect');
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content || t('ai_no_response');
      return rawContent.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
      
    } catch (e) {
      console.error(e);
      return t('ai_error_connect');
    }
  }, [t, getWorkingModel]);

  const getDatabaseContext = useCallback(async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

      const [productDocs, invoiceDocs, debtDocs, purchaseDocs] = await Promise.all([
        db.products.find().exec(),
        db.invoices.find({
          selector: { timestamp: { $gte: thirtyDaysAgoISO } }
        }).exec(),
        db.debts.find({
          selector: { status: { $ne: 'Paid' } }
        }).exec(),
        db.purchases.find().exec(),
      ]);

      const products = productDocs.map(d => d.toJSON());
      const invoices = invoiceDocs.map(d => d.toJSON());
      const debts = debtDocs.map(d => d.toJSON());
      const purchases = purchaseDocs.map(d => d.toJSON());

      // Pre-calculate sales data
      const productSalesMap: Record<string, { qty: number; profit: number }> = {};
      invoices.forEach(inv => {
        (inv.items || []).forEach((item: any) => {
          const prod = products.find(p => p.id === item.product_id);
          const pId = prod ? prod.id : item.product_id;
          if (!pId) return;
          if (!productSalesMap[pId]) productSalesMap[pId] = { qty: 0, profit: 0 };
          const q = Number(item.quantity) || 0;
          const p = Number(item.price) || 0;
          const c = prod ? (Number(prod.cost_price) || 0) : 0;
          productSalesMap[pId].qty += q;
          productSalesMap[pId].profit += q * (p - c);
        });
      });

      const analytics = products.map(p => ({
        ...p,
        totalQty: productSalesMap[p.id]?.qty || 0,
        totalProfit: productSalesMap[p.id]?.profit || 0
      }));

      const topByQty = [...analytics].sort((a, b) => b.totalQty - a.totalQty).filter(p => p.totalQty > 0);
      const topByProfit = [...analytics].sort((a, b) => b.totalProfit - a.totalProfit).filter(p => p.totalProfit > 0);
      const lowStock = analytics.filter(p => p.stock_quantity <= (p.min_safety_stock || 0));

      const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
      const totalProfit = invoices.reduce((sum, inv) => sum + (Number(inv.actual_profit) || 0), 0);
      const avgInvoiceValue = invoices.length > 0 ? Math.round(totalRevenue / invoices.length) : 0;
      const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
      
      const debtAmount = debts.reduce((sum, d) => sum + ((Number(d.amount) || 0) - (Number(d.paid_amount) || 0)), 0);

      // Weekly comparison
      const thisWeekInvoices = invoices.filter(inv => inv.timestamp >= sevenDaysAgoISO);
      const lastWeekInvoices = invoices.filter(inv => inv.timestamp >= fourteenDaysAgoISO && inv.timestamp < sevenDaysAgoISO);
      const thisWeekRevenue = thisWeekInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
      const lastWeekRevenue = lastWeekInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
      const weeklyTrend = lastWeekRevenue > 0 ? (((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100).toFixed(1) : 'N/A';

      // Best sales day
      const dailySales: Record<string, number> = {};
      invoices.forEach(inv => {
        const day = inv.timestamp?.substring(0, 10) || '';
        if (day) dailySales[day] = (dailySales[day] || 0) + (Number(inv.total_amount) || 0);
      });
      const bestDay = Object.entries(dailySales).sort((a, b) => b[1] - a[1])[0];

      // Category analysis
      const categorySales: Record<string, { qty: number; revenue: number }> = {};
      invoices.forEach(inv => {
        (inv.items || []).forEach((item: any) => {
          const prod = products.find(p => p.id === item.product_id);
          const cat = prod?.category || 'غير مصنف';
          if (!categorySales[cat]) categorySales[cat] = { qty: 0, revenue: 0 };
          categorySales[cat].qty += Number(item.quantity) || 0;
          categorySales[cat].revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
        });
      });
      const topCategories = Object.entries(categorySales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

      // Expiry alerts (within 30 days)
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + 30);
      const nearExpiry = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= expiryThreshold && new Date(p.expiry_date) >= now);

      // Top 10 and bottom 10 products
      const topProducts = analytics
        .filter(p => p.totalQty > 0)
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 10);
      const bottomProducts = analytics
        .filter(p => p.totalQty === 0 && p.stock_quantity > 0)
        .slice(0, 10);

      // Top Debtors
      const customerDebts = debts
        .filter(d => d.type === 'Customer Debt' || !d.type)
        .map(d => ({ ...d, netDebt: (Number(d.amount) || 0) - (Number(d.paid_amount) || 0) }))
        .sort((a, b) => b.netDebt - a.netDebt);
      const topDebtorsCompact = customerDebts.slice(0, 5).map(d => `${d.client_supplier_name}(${d.netDebt})`).join(' | ');
      const overdueDebts = debts.filter(d => d.due_date && new Date(d.due_date) < now && d.status !== 'Paid');

      // Top Suppliers
      const supplierMap: Record<string, { total: number; count: number; unpaid: number }> = {};
      purchases.forEach(p => {
        const sName = p.supplier_name || 'غير معروف';
        if (!supplierMap[sName]) supplierMap[sName] = { total: 0, count: 0, unpaid: 0 };
        supplierMap[sName].total += Number(p.total_amount) || 0;
        supplierMap[sName].count += 1;
        supplierMap[sName].unpaid += Number(p.remaining_amount) || 0;
      });
      const topSuppliersCompact = Object.entries(supplierMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([name, data]) => `${name}(${data.total})`).join(' | ');

      const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
      const unpaidPurchases = purchases.reduce((sum, p) => sum + (Number(p.remaining_amount) || 0), 0);

      return `[بيانات المحل — آخر 30 يوم — ${invoices.length} فاتورة — ${products.length} منتج]

📊 المالية: إيرادات=${totalRevenue} | أرباح=${totalProfit} | هامش=${profitMargin}% | متوسط فاتورة=${avgInvoiceValue}
📈 أسبوعي: هذا الأسبوع=${thisWeekRevenue} | الأسبوع الماضي=${lastWeekRevenue} | اتجاه=${weeklyTrend === 'N/A' ? 'غير محدد' : (Number(weeklyTrend) >= 0 ? `↑${weeklyTrend}%` : `↓${weeklyTrend}%`)}
🗓️ أفضل يوم: ${bestDay ? `${bestDay[0]}=${bestDay[1]}` : 'لا يوجد'}

🏆 أكثر 5 مبيعاً: ${topByQty.slice(0, 5).map((p, i) => `${i + 1}.${p.name_ar}(${p.totalQty}وحدة،ربح=${p.totalProfit})`).join(' | ') || 'لا يوجد'}
💰 أكثر 5 ربحاً: ${topByProfit.slice(0, 5).map((p, i) => `${i + 1}.${p.name_ar}(ربح=${p.totalProfit})`).join(' | ') || 'لا يوجد'}
📦 مخزون منخفض (${lowStock.length}): ${lowStock.slice(0, 5).map(p => `${p.name_ar}(${p.stock_quantity})`).join(' | ') || 'لا يوجد'}
⚠️ قريبة انتهاء (${nearExpiry.length}): ${nearExpiry.slice(0, 5).map(p => `${p.name_ar}(${p.expiry_date})`).join(' | ') || 'لا يوجد'}
📁 أهم الفئات: ${topCategories.slice(0, 5).map(([cat, d], i) => `${i + 1}.${cat}(${d.revenue})`).join(' | ') || 'لا يوجد'}

👤 أكبر المديونين (إجمالي=${debtAmount}): ${topDebtorsCompact || 'لا ديون'}${overdueDebts.length > 0 ? ` | متأخر: ${overdueDebts.length}` : ''}
🧾 أعلى 5 فواتير: ${[...invoices].sort((a, b) => Number(b.total_amount) - Number(a.total_amount)).slice(0, 5).map(inv => `${inv.total_amount}(${inv.timestamp?.substring(0, 10)})`).join(' | ') || 'لا يوجد'}
🚚 الموردون (${Object.keys(supplierMap).length}): ${topSuppliersCompact || 'لا يوجد'} | مشتريات=${totalPurchases} | غير مدفوع=${unpaidPurchases}`;
    } catch (err) {
      console.error('Failed to build db context', err);
      return '';
    }
  }, [db]);

  const generateStockInsight = useCallback(async () => {
    setInsightLoading(true);
    const dbContext = await getDatabaseContext();
    if (!dbContext) {
      setInsight(t('no_insights'));
      setInsightLoading(false);
      return;
    }

    const systemPrompt = `أنت مستشار مبيعات ومخازن ذكي لمحل تجاري.
البيانات والإحصائيات:
${dbContext}

قدم توصية استراتيجية واحدة فقط ذكية وموجزة جداً (أقل من 3 جمل) لتحسين المبيعات أو المخزون. ابدأ بإيموجي مناسب.`;
    
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: "أعطني توصية استراتيجية للمحل الآن." }
    ];

    const response = await fetchGroq(apiMessages);
    setInsight(response);
    setInsightLoading(false);
  }, [fetchGroq, getDatabaseContext, t]);

  useEffect(() => {
    generateStockInsight();
  }, [generateStockInsight]);

  const submitQuery = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    // Stop speech recognition if still active
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: queryText.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    const dbContext = await getDatabaseContext();
    const systemInstruction = `أنت مساعد ذكي لمحل تجاري اسمك "مساعد MARKET".
بيانات المحل: ${dbContext}

قواعد: أجب بدقة بناءً على البيانات. اذكر الأرقام المحددة. عند الأسئلة الاستشارية قدّم 3 نصائح مرقمة. أضف إيموجي. الإجابة بالعربية. لا تخترع بيانات غير موجودة.`;

    // Build conversation history for API (last 4 messages max to save tokens)
    const recentMessages = [...messages, userMsg].slice(-4);
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemInstruction },
      ...recentMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const response = await fetchGroq(apiMessages);
    
    const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);
    setLoading(false);
  }, [messages, isRecording, getDatabaseContext, fetchGroq]);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await submitQuery(query);
  };

  const handleSuggestedQuestion = async (questionAr: string, questionEn: string) => {
    const q = isAr ? questionAr : questionEn;
    setExpandedCategory(null);
    await submitQuery(q);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 dark:border-purple-400/20 rounded-xl p-6 shadow-sm mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-primary)] text-white rounded-lg shadow-lg shadow-purple-500/30">
            <BrainCircuit size={24} />
          </div>
          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
            {t('ai_engine_title')}
          </h3>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
            title={isAr ? 'مسح المحادثة' : 'Clear chat'}
          >
            <Trash2 size={14} />
            {isAr ? 'مسح المحادثة' : 'Clear chat'}
          </button>
        )}
      </div>

      {showAiWarning && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start justify-between gap-3 text-orange-800 dark:text-orange-300 text-sm animate-in fade-in slide-in-from-top duration-200">
          <div className="flex-grow flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="leading-relaxed font-bold">
                {isAr 
                  ? 'مفتاح الذكاء الاصطناعي مفقود!' 
                  : 'AI Key is missing!'}
              </p>
              <p className="leading-relaxed text-xs opacity-90">
                {isAr 
                  ? 'لكي تتمكن من استخدام ميزة الذكاء الاصطناعي، يرجى الانتقال إلى الإعدادات وإضافة مفتاح Groq مجاناً بخطوات بسيطة مشروحة هناك.' 
                  : 'To use the AI feature, please go to Settings and add a free Groq key using the simple steps provided there.'}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                <Link 
                  to="/settings" 
                  className="inline-flex items-center gap-1 font-bold text-[var(--color-primary)] hover:underline bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-lg w-fit"
                >
                  {isAr ? 'انتقل للإعدادات لتفعيل المفتاح 👈' : 'Go to Settings 👈'}
                </Link>
                <span className="text-xs opacity-80 mt-1 sm:mt-0 font-medium bg-black/5 dark:bg-white/5 px-2 py-1.5 rounded-lg">
                  {isAr 
                    ? 'أو تواصل معنا للمساعدة عبر الواتساب/تليجرام: 009647510171376' 
                    : 'Or contact us via WhatsApp/Telegram: 009647510171376'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleDismissAiWarning}
            className="p-1 hover:bg-orange-500/20 rounded-lg transition-colors cursor-pointer text-orange-500 flex-shrink-0"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Smart Insight Card */}
      <div className="mb-4 bg-white/60 dark:bg-[#16171d]/60 p-4 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-sm">
        <h4 className="font-semibold flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-orange-500" />
          {t('stock_insights_title')}
        </h4>
        <div className="p-3 rounded-lg bg-white dark:bg-[#1f2028] border border-black/5 dark:border-white/5 shadow-inner min-h-[48px] flex items-center">
          {insightLoading ? (
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

      {/* Chat Interface */}
      <div className="bg-white/60 dark:bg-[#16171d]/60 rounded-xl border border-black/5 dark:border-white/5 backdrop-blur-sm overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h4 className="font-semibold text-sm">
            {isAr ? 'الدردشة مع المساعد الذكي' : 'Chat with AI Assistant'}
          </h4>
        </div>

        {/* Messages Area */}
        <div ref={chatContainerRef} className="p-4 space-y-3 max-h-[400px] overflow-y-auto min-h-[120px]" style={{ scrollBehavior: 'smooth' }}>
          {messages.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <Bot size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">
                {isAr ? 'مرحباً! أنا مساعد MARKET الذكي 👋' : 'Hello! I\'m MARKET AI Assistant 👋'}
              </p>
              <p className="text-xs mt-1 opacity-75">
                {isAr ? 'اسألني أي سؤال عن محلك، أو اختر من الأسئلة المقترحة بالأسفل' : 'Ask me anything about your store, or pick from the suggested questions below'}
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mt-1">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-[#1f2028] border border-black/5 dark:border-white/5 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mt-1">
                  <User size={14} className="text-gray-600 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mt-1">
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-[#1f2028] border border-black/5 dark:border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-black/5 dark:border-white/5">
          <form onSubmit={handleQuery} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input 
                ref={inputRef}
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={isRecording ? (isAr ? 'جاري الاستماع...' : 'Listening...') : (isAr ? 'اكتب سؤالك هنا...' : 'Type your question here...')} 
                disabled={showAiWarning || loading}
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-gray-50 dark:bg-[#1a1b22] shadow-sm border border-transparent focus:border-purple-500 outline-none transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={toggleRecording}
                disabled={showAiWarning || loading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-500/10'}`}
                title={isAr ? 'تحدث بالصوت' : 'Speak'}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <button 
              type="submit" 
              disabled={loading || !query.trim() || showAiWarning}
              className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-purple-500/20 active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Suggested Questions - Categorized */}
      <div className="mt-4 space-y-2">
        <p className="text-xs text-gray-500 font-medium px-1">
          {isAr ? '💡 أسئلة مقترحة — اضغط على الفئة لعرض الأسئلة:' : '💡 Suggested questions — click a category to expand:'}
        </p>
        <div className="space-y-1.5">
          {questionCategories.map((cat, catIdx) => {
            const colors = colorMap[cat.color];
            const isExpanded = expandedCategory === catIdx;
            return (
              <div key={catIdx} className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}>
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : catIdx)}
                  disabled={loading || showAiWarning}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium ${colors.bg} ${colors.text} ${colors.hover} transition-colors cursor-pointer disabled:opacity-50`}
                >
                  <span className="flex items-center gap-2">
                    {cat.icon}
                    {isAr ? cat.labelAr : cat.labelEn}
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isExpanded && (
                  <div className="p-2 flex flex-wrap gap-1.5 bg-white/50 dark:bg-[#16171d]/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {cat.questions.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        type="button"
                        disabled={loading || showAiWarning}
                        onClick={() => handleSuggestedQuestion(q.ar, q.en)}
                        className={`text-xs ${colors.bg} ${colors.hover} ${colors.text} px-3 py-1.5 rounded-full transition-colors cursor-pointer border ${colors.border} disabled:opacity-50`}
                      >
                        {isAr ? q.ar : q.en}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
