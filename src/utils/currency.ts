export interface Currency {
  code: string;
  symbol: string;
  isCustom?: boolean;
}

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$' },
  { code: 'IQD', symbol: 'د.ع' },
  { code: 'SYP', symbol: 'ل.س' },
  { code: 'TRY', symbol: 'ل.ت' },
  { code: 'SAR', symbol: 'ر.س' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'EUR', symbol: '€' }
];

export const getCurrenciesList = (): Currency[] => {
  try {
    const customsJson = localStorage.getItem('custom_currencies');
    const customs: Currency[] = customsJson ? JSON.parse(customsJson) : [];
    return [...DEFAULT_CURRENCIES, ...customs];
  } catch (e) {
    console.error('Failed to parse custom currencies', e);
    return DEFAULT_CURRENCIES;
  }
};

export const addCustomCurrency = (code: string, symbol: string): boolean => {
  if (!code || !symbol) return false;
  const list = getCurrenciesList();
  if (list.some(c => c.code.toUpperCase() === code.toUpperCase())) {
    return false; // Already exists
  }
  try {
    const customsJson = localStorage.getItem('custom_currencies');
    const customs: Currency[] = customsJson ? JSON.parse(customsJson) : [];
    customs.push({ code: code.toUpperCase(), symbol, isCustom: true });
    localStorage.setItem('custom_currencies', JSON.stringify(customs));
    window.dispatchEvent(new Event('storage'));
    return true;
  } catch (e) {
    console.error('Failed to save custom currency', e);
    return false;
  }
};

export const getOfficialCurrency = (): Currency => {
  const code = localStorage.getItem('currency_preference') || 'USD';
  const list = getCurrenciesList();
  return list.find(c => c.code === code) || { code: 'USD', symbol: '$' };
};

export const setOfficialCurrency = (code: string) => {
  localStorage.setItem('currency_preference', code);
  window.dispatchEvent(new Event('storage'));
};

export const getPOSExchangeRate = (): number => {
  const rate = localStorage.getItem('pos_exchange_rate');
  return rate ? Number(rate) : 1500;
};

export const setPOSExchangeRate = (rate: number) => {
  localStorage.setItem('pos_exchange_rate', rate.toString());
  window.dispatchEvent(new Event('storage'));
};

export const getPOSHelperCurrency = (): string => {
  const official = getOfficialCurrency().code;
  const saved = localStorage.getItem('pos_helper_currency');
  if (saved && saved !== official) return saved;
  return official === 'USD' ? 'IQD' : 'USD';
};

export const setPOSHelperCurrency = (code: string) => {
  localStorage.setItem('pos_helper_currency', code);
  window.dispatchEvent(new Event('storage'));
};

export const formatCurrency = (amount: number): string => {
  const curr = getOfficialCurrency();
  const formattedAmount = amount.toLocaleString(undefined, {
    minimumFractionDigits: curr.code === 'USD' || curr.code === 'EUR' ? 2 : 0,
    maximumFractionDigits: curr.code === 'USD' || curr.code === 'EUR' ? 2 : 0,
  });
  
  return `${formattedAmount} ${curr.symbol}`;
};
