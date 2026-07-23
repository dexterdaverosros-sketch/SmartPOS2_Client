import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Language = 'en' | 'tl';

const LANGUAGE_STORAGE_KEY = 'smartpos_language';

const translations = {
  en: {
    admin: 'Admin',
    pushToCloud: 'Push to Cloud',
    terminateSession: 'Terminate Session',
    language: 'Language',
    english: 'English',
    tagalog: 'Tagalog',
    offlineMode: 'Offline Mode',
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    staff: 'Staff',
    profile: 'Profile',
    active: 'Active',
    reports: 'Reports',
    export: 'Export',
    syncingToCloud: 'Syncing to Cloud',
    pushingAllData: 'Pushing all data to Supabase...',
    success: 'Success!',
    allDataBackedUp: 'All data backed up to the cloud',
    syncFailed: 'Sync Failed',
    somethingWentWrong: 'Something went wrong',
    expenseAdded: 'Expense Added',
    purchaseAdded: 'Purchase Added',
    creditorAdded: 'Creditor Added',
    error: 'Error',
    failedToAddExpense: 'Failed to add expense',
    failedToAddPurchase: 'Failed to add purchase',
    failedToAddCreditor: 'Failed to add creditor',
    executiveTools: 'Executive Tools',
    financials: 'Financials',
    expenses: 'Expenses',
    bookkeeping: 'Book Keeping',
    history: 'History',
    analytics: 'Analytics',
    income: 'Income',
    costs: 'Costs',
    topSellers: 'Top Sellers',
    recentActivity: 'Recent Activity',
    viewAll: 'View All',
    order: 'Order',
    total: 'Total',
    addExpense: 'Add Expense',
    description: 'Description',
    amount: 'Amount (₱)',
    category: 'Category',
    selectCategory: 'Select category',
    rent: 'Rent',
    utilities: 'Utilities',
    supplies: 'Supplies',
    other: 'Other',
    date: 'Date',
    cancel: 'Cancel',
    add: 'Add',
    notifications: 'Notifications',
    confirmRemittance: 'Confirm Remittance',
    orders: 'Orders',
  },
  tl: {
    admin: 'Admin',
    pushToCloud: 'Ipadala sa Cloud',
    terminateSession: 'Tapusin ang Sesyon',
    language: 'Wika',
    english: 'Ingles',
    tagalog: 'Tagalog',
    offlineMode: 'Offline na Mode',
    dashboard: 'Dashboard',
    inventory: 'Imbentaryo',
    staff: 'Mga Tauhan',
    profile: 'Profile',
    active: 'Aktibo',
    reports: 'Mga Ulat',
    export: 'I-export',
    syncingToCloud: 'Sini-sync sa Cloud',
    pushingAllData: 'Ipinapadala ang lahat ng datos sa Supabase...',
    success: 'Tagumpay!',
    allDataBackedUp: 'Na-backup na sa cloud ang lahat ng datos',
    syncFailed: 'Hindi Na-sync',
    somethingWentWrong: 'May nangyaring problema',
    expenseAdded: 'Nadagdag ang Gastos',
    purchaseAdded: 'Nadagdag ang Bili',
    creditorAdded: 'Nadagdag ang Pinagkakautangan',
    error: 'Error',
    failedToAddExpense: 'Hindi maidagdag ang gastos',
    failedToAddPurchase: 'Hindi maidagdag ang bili',
    failedToAddCreditor: 'Hindi maidagdag ang pinagkakautangan',
    executiveTools: 'Mga Pangunahing Tool',
    financials: 'Pananalapi',
    expenses: 'Mga Gastos',
    bookkeeping: 'Pagpapanatili ng Talaan',
    history: 'Kasaysayan',
    analytics: 'Pagsusuri',
    income: 'Kita',
    costs: 'Mga Gastos',
    topSellers: 'Mga Nangungunang Nabenta',
    recentActivity: 'Kamakailang Aktibidad',
    viewAll: 'Tingnan Lahat',
    order: 'Order',
    total: 'Kabuuan',
    addExpense: 'Magdagdag ng Gastos',
    description: 'Paglalarawan',
    amount: 'Halaga (₱)',
    category: 'Kategorya',
    selectCategory: 'Pumili ng kategorya',
    rent: 'Upa',
    utilities: 'Mga Serbisyo',
    supplies: 'Mga Kagamitan',
    other: 'Iba pa',
    date: 'Petsa',
    cancel: 'Kanselahin',
    add: 'Magdagdag',
    notifications: 'Mga Abiso',
    confirmRemittance: 'Kumpirmahin ang Remittance',
    orders: 'Mga Order',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === 'tl' ? 'tl' : 'en';
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === 'tl' ? 'tl' : 'en';
  }, [language]);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  };

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t: (key) => translations[language][key],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};