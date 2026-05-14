import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { LogOut, DollarSign, Package, Plus, Eye, Calendar, CreditCard, Receipt, User, FileText, Lock, FileSpreadsheet, BarChart3, Bell, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import Layout from '@/components/Layout';
import FloatingActionButton from '@/components/FloatingActionButton';
import { useAuth } from '@/contexts/AuthContext';
import {
    SalesService, ProductService, ExpenseService, PurchaseService, CreditorService, NotificationService, RemittanceService, db
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Notification, Remittance } from '@shared/schema';

// Schemas for expenses and purchases
const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
});

const purchaseSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  cost: z.number().min(0.01, 'Cost must be greater than 0'),
  supplier: z.string().min(1, 'Supplier is required'),
  date: z.string().min(1, 'Date is required'),
});

const creditorSchema = z.object({
  name: z.string().min(1, 'Creditor name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  reminderDate: z.string().min(1, 'Reminder date is required'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;
type PurchaseFormData = z.infer<typeof purchaseSchema>;
type CreditorFormData = z.infer<typeof creditorSchema>;

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface Purchase {
  id: string;
  productName: string;
  quantity: number;
  cost: number;
  supplier: string | null;
  date: string;
}

interface Creditor {
  id: string;
  name: string;
  amount: number;
  description: string;
  dueDate: string;
  reminderDate: string;
  isPaid: boolean;
}

const AdminMain: React.FC = () => {
  const { user, logout, socket } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    totalIncome: 0,
    revenueTrend: '+0.0%',
    expenseTrend: '+0.0%',
    profitTrend: '+0.0%',
  });

  // State for expenses, purchases, and creditors
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddCreditorOpen, setIsAddCreditorOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Notification & Remittance State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedRemittance, setSelectedRemittance] = useState<Remittance | null>(null);
  const [isConfirmingRemit, setIsConfirmingRemit] = useState(false);

  // Form hooks
  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const purchaseForm = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      productName: '',
      quantity: 1,
      cost: 0,
      supplier: '',
      date: new Date().toISOString().split('T')[0],
    },
  });
  
  const creditorForm = useForm<CreditorFormData>({
    resolver: zodResolver(creditorSchema),
    defaultValues: {
      name: '',
      amount: 0,
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      reminderDate: new Date().toISOString().split('T')[0],
    },
  });

  const handleTutorialClick = () => {
    // Tutorial functionality - can be expanded later
    console.log('Tutorial started');
  };

  const handleAddExpense = async (data: ExpenseFormData) => {
    try {
      await ExpenseService.addExpense({
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
      });
      setIsAddExpenseOpen(false);
      expenseForm.reset();
      toast({
        title: 'Expense Added',
        description: `${data.description} has been added`,
      });
      loadFinancialData(); // Refresh data
      loadStats(); // Refresh stats for trends
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add expense',
        variant: 'destructive',
      });
    }
  };

  const handleAddPurchase = async (data: PurchaseFormData) => {
    try {
      await PurchaseService.addPurchase({
        productName: data.productName,
        quantity: data.quantity,
        cost: data.cost,
        supplier: data.supplier || null,
        date: new Date(data.date),
        description: null,
        details: null,
        expirationDate: null,
      });
      setIsAddPurchaseOpen(false);
      purchaseForm.reset();
      toast({
        title: 'Purchase Added',
        description: `${data.productName} has been added`,
      });
      loadFinancialData(); // Refresh data
      loadStats(); // Refresh stats for trends
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add purchase',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddCreditor = async (data: CreditorFormData) => {
    try {
      await CreditorService.addCreditor({
        name: data.name,
        amount: data.amount,
        description: data.description,
        dueDate: new Date(data.dueDate),
        reminderDate: new Date(data.reminderDate),
        isPaid: false,
      });
      setIsAddCreditorOpen(false);
      creditorForm.reset();
      toast({
        title: 'Creditor Added',
        description: `${data.name} has been added to the ledger`,
      });
      loadFinancialData(); // Refresh data
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add creditor',
        variant: 'destructive',
      });
    }
  };

  const getFilteredExpenses = () => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === selectedMonth && expenseDate.getFullYear() === selectedYear;
    });
  };

  const getFilteredPurchases = () => {
    return purchases.filter(purchase => {
      const purchaseDate = new Date(purchase.date);
      return purchaseDate.getMonth() === selectedMonth && purchaseDate.getFullYear() === selectedYear;
    });
  };
  
  const getFilteredCreditors = () => {
    return creditors.filter(creditor => {
      const dueDate = new Date(creditor.dueDate);
      return dueDate.getMonth() === selectedMonth && dueDate.getFullYear() === selectedYear;
    });
  };
  
  const getUpcomingPayments = () => {
    const today = new Date();
    return creditors.filter(creditor => {
      if (creditor.isPaid) return false;
      const dueDate = new Date(creditor.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7; // Due within a week
    });
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  };

  const formatDateSafely = (date: any) => {
    try {
      const d = date instanceof Date ? date : new Date(date ?? Date.now());
      if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
      return d.toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  const loadFinancialData = async () => {
    try {
      const [expensesData, purchasesData, creditorsData] = await Promise.all([
        ExpenseService.getAllExpenses(),
        PurchaseService.getAllPurchases(),
        CreditorService.getAllCreditors(),
      ]);
      setExpenses(expensesData.map(e => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount) || 0,
        category: e.category,
        date: formatDateSafely(e.date),
      })));
      setPurchases(purchasesData.map(p => ({
        id: p.id,
        productName: p.productName,
        quantity: Number(p.quantity) || 0,
        cost: Number(p.cost) || 0,
        supplier: p.supplier ?? null,
        date: formatDateSafely(p.date),
      })));
      setCreditors(creditorsData.map(c => ({
        id: c.id,
        name: c.name,
        amount: Number(c.amount) || 0,
        description: c.description ?? '',
        dueDate: formatDateSafely(c.dueDate),
        reminderDate: formatDateSafely(c.reminderDate),
        isPaid: !!c.isPaid,
      })));
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load financial data',
        variant: 'destructive',
      });
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '+0.0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const loadStats = async () => {
    try {
      const products = await ProductService.getAllProducts();
      const todaysSales = await SalesService.getTodaysSales();
      const todaysTotal = Array.isArray(todaysSales)
        ? todaysSales.reduce((sum, sale) => sum + (sale.total || 0), 0)
        : 0;
      const totalIncome = await SalesService.getTotalSales();

      // Calculate trends (Current week vs Previous week)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const allSales = await db.sales.toArray();
      const allExpenses = await db.expenses.toArray();

      const currentWeekSales = allSales
        .filter(s => {
          const d = new Date(s.createdAt as any);
          return !isNaN(d.getTime()) && d >= oneWeekAgo;
        })
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const previousWeekSales = allSales
        .filter(s => {
          const d = new Date(s.createdAt as any);
          return !isNaN(d.getTime()) && d >= twoWeeksAgo && d < oneWeekAgo;
        })
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

      const currentWeekExpenses = allExpenses
        .filter(e => {
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d >= oneWeekAgo;
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const previousWeekExpenses = allExpenses
        .filter(e => {
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d >= twoWeeksAgo && d < oneWeekAgo;
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const currentProfit = currentWeekSales - currentWeekExpenses;
      const previousProfit = previousWeekSales - previousWeekExpenses;

      setStats({
        todaySales: todaysTotal,
        totalProducts: products.length,
        totalIncome,
        revenueTrend: calculateTrend(currentWeekSales, previousWeekSales),
        expenseTrend: calculateTrend(currentWeekExpenses, previousWeekExpenses),
        profitTrend: calculateTrend(currentProfit, previousProfit),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard stats',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadStats();
    loadFinancialData();
    loadChartData();
    loadNotifications();

    if (socket) {
      socket.on('notification-received', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        toast({
          title: "New Notification",
          description: notification.message,
        });
      });

      socket.on('remittance-sent', (remittance: Remittance) => {
        loadNotifications();
        loadStats();
        loadFinancialData();
      });
    }

    // Update date and time every second
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('notification-received');
        socket.off('remittance-sent');
      }
    };
  }, [socket]);

  const loadNotifications = async () => {
    try {
      const list = await NotificationService.list();
      setNotifications(list);
      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await NotificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (notification.type === 'remittance' && notification.data) {
      try {
        const data = JSON.parse(notification.data);
        if (data.remittanceId) {
          fetchAndShowRemittance(data.remittanceId);
        }
      } catch (e) {
        console.error('Failed to parse notification data', e);
      }
    }
  };

  const fetchAndShowRemittance = async (id: string) => {
    try {
      const pending = await RemittanceService.listPending();
      const found = pending.find((r: Remittance) => r.id === id);
      if (found) {
        setSelectedRemittance(found);
      } else {
        toast({
          title: "Remittance Not Found",
          description: "This remittance may have already been processed.",
        });
      }
    } catch (error) {
      console.error('Failed to fetch remittance', error);
    }
  };

  const handleConfirmRemittance = async () => {
    if (!selectedRemittance) return;
    setIsConfirmingRemit(true);
    try {
      const res = await RemittanceService.confirm(selectedRemittance.id);
      if (res.success) {
        toast({
          title: "Remittance Confirmed",
          description: `Confirmed receipt of ₱${selectedRemittance.amount.toLocaleString()} from ${selectedRemittance.staffName}.`,
        });
        setSelectedRemittance(null);
        loadStats(); // Refresh income
      }
    } catch (error) {
      console.error('Failed to confirm remittance', error);
      toast({
        title: "Error",
        description: "Failed to confirm remittance. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConfirmingRemit(false);
    }
  };

  // Derived KPI values (Income, Expenses, Profit)
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profit = stats.totalIncome - totalExpenses;

  const [chartData, setChartData] = useState<Array<{ date: string; income: number; expenses: number }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);

  const loadChartData = async () => {
    try {
      const sales = await db.sales.toArray();
      const allExpenses = await db.expenses.toArray();
      const allSaleItems = await db.saleItems.toArray();
      const allProducts = await db.products.toArray();
      const allStaff = await db.staff.toArray();

      // Chart Data (Last 7 Days)
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const data = days.map(d => {
        const next = new Date(d);
        next.setHours(23, 59, 59, 999);

        const income = sales
          .filter(s => {
            const c = new Date(s.createdAt as any);
            return !isNaN(c.getTime()) && c >= d && c <= next && (s.paymentType as any) !== 'credits';
          })
          .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        const exp = allExpenses
          .filter(e => {
            const c = new Date(e.date);
            return !isNaN(c.getTime()) && c >= d && c <= next;
          })
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income, expenses: exp };
      });

      setChartData(data);

      // Recent Transactions
      const staffMap = new Map(allStaff.map(s => [s.id, s.name]));
      const recent = sales
        .sort((a, b) => {
          const da = new Date(a.createdAt as any).getTime();
          const db = new Date(b.createdAt as any).getTime();
          return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        })
        .slice(0, 5)
        .map(s => ({
          ...s,
          total: Number(s.total) || 0,
          staffName: s.staffId ? staffMap.get(s.staffId) : 'Owner'
        }));
      setRecentTransactions(recent);

      // Top Selling Products
      const productSales = new Map();
      allSaleItems.forEach(item => {
        const current = productSales.get(item.productId) || 0;
        productSales.set(item.productId, current + item.quantity);
      });

      const top = allProducts
        .map(p => ({
          name: p.name,
          sales: productSales.get(p.id) || 0,
          price: p.price
        }))
        .filter(p => p.sales > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      setTopProducts(top);

      // Staff Performance
      const staffSales = new Map();
      sales.forEach(s => {
        const sid = s.staffId || 'owner';
        const current = staffSales.get(sid) || 0;
        staffSales.set(sid, current + (s.total || 0));
      });

      const perf = [
        { name: 'Owner', sales: staffSales.get('owner') || 0 },
        ...allStaff.map(s => ({
          name: s.name,
          sales: staffSales.get(s.id) || 0
        }))
      ]
      .filter(p => p.sales > 0)
      .sort((a, b) => b.sales - a.sales);
      setStaffPerformance(perf);

    } catch (error) {
      console.error('Failed to load chart data', error);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['Report Date', currentDateTime.toLocaleString()],
      ['Today Sales', stats.todaySales.toFixed(2)],
      ['Total Income', stats.totalIncome.toFixed(2)],
      ['Total Expenses', totalExpenses.toFixed(2)],
      ['Net Profit', profit.toFixed(2)],
      ['Total Products', stats.totalProducts],
      [],
      ['Recent Transactions'],
      ['ID', 'Staff', 'Type', 'Total', 'Date'],
      ...recentTransactions.map(tx => [
        tx.id,
        tx.staffName,
        tx.paymentType,
        tx.total.toFixed(2),
        new Date(tx.createdAt).toLocaleString()
      ])
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SmartPOS_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Report Exported",
      description: "Business summary has been downloaded as CSV",
    });
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background"
      >
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between p-6">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter gold-gradient-text uppercase">SmartPOS+</h1>
              <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 mt-1 uppercase">
                {currentDateTime.toLocaleDateString('en-US', {month: 'long', day: '2-digit', year: 'numeric'})} • {currentDateTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm relative group"
                  onClick={() => setShowNotifications(true)}
                >
                  <Bell className="w-5 h-5 text-gray-400 group-hover:text-[#BF953F] transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 bg-white p-1.5 pr-4 rounded-full border border-gray-100 shadow-sm hover:shadow-md transition-all focus:outline-none group">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#BF953F] to-[#B38728] rounded-full flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Administrator</span>
                    <span className="text-[10px] text-gray-400 font-medium">Control Center</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={10} className="w-56 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 p-2">
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      setLocation('/role-selection');
                    }}
                    className="h-12 px-4 rounded-xl text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer flex items-center transition-colors group"
                  >
                    <LogOut className="w-4 h-4 mr-3 text-gray-400 group-hover:text-red-500 transition-colors" />
                    <span>Terminate Session</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6 space-y-8 pb-32">
          {/* Welcome Header Section */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative overflow-hidden bg-white p-10 rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)]"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#BF953F]/10 to-transparent rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#BF953F]/5 to-transparent rounded-full -ml-20 -mb-20 blur-3xl"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#BF953F]/10 border border-[#BF953F]/20 mb-4"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#BF953F] animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BF953F]">Active Dashboard</span>
                </motion.div>
                <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-[0.9]">
                  Welcome back, <br />
                  <span className="gold-gradient-text">{user?.ownerName || user?.username || 'Commander'}</span>
                </h1>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="flex gap-3 mb-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLocation('/admin/reports')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 text-[#BF953F]" />
                    Summary
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#BF953F]" />
                    Export
                  </motion.button>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Total Gross Income</div>
                <div className="text-6xl font-black tracking-tighter text-gray-900 leading-none">
                  ₱{stats.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="modern-card p-8 group cursor-pointer"
              onClick={() => setLocation('/transaction-history')}
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors duration-500">
                <DollarSign className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span data-testid="text-today-sales">₱{stats.todaySales.toFixed(2)}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Daily Sales Revenue</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="modern-card p-8 group cursor-pointer"
              onClick={() => setLocation('/inventory')}
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 transition-colors duration-500">
                <Package className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span data-testid="text-total-products">{stats.totalProducts}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Inventory Count</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="modern-card p-8 group cursor-pointer"
              onClick={() => setLocation('/ledger')}
            >
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#BF953F] transition-colors duration-500">
                <CreditCard className="w-6 h-6 text-[#BF953F] group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span>{getFilteredCreditors().length}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pending Receivables</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="modern-card p-8 group cursor-pointer"
            >
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-colors duration-500">
                <Receipt className="w-6 h-6 text-purple-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span>₱{totalExpenses.toFixed(2)}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly Operating Costs</div>
            </motion.div>
          </div>

          {/* Business Tools Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-widest text-gray-900">Executive Tools</h2>
              <div className="h-[2px] flex-1 mx-8 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Inventory', desc: 'Stock control', icon: Package, path: '/inventory', color: 'pink' },
                { title: 'Non-Inventory', desc: 'Service items', icon: Package, path: '/inventory?tab=non-inventory', color: 'orange' },
                { title: 'Financials', desc: 'Ledger management', icon: CreditCard, path: '/ledger', color: 'indigo' },
                { title: 'Expenses', desc: 'Cost analysis', icon: DollarSign, path: '/expenses', color: 'emerald' },
                { title: 'Security Questions', desc: 'Manage account security', icon: Lock, path: '/security-questions', color: 'purple' },
              ].map((tool, i) => (
                <motion.button
                  key={tool.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  onClick={() => setLocation(tool.path)}
                  className="modern-card p-6 flex flex-col items-start text-left group"
                >
                  <div className={`p-4 bg-${tool.color}-50 rounded-2xl mb-4 group-hover:bg-${tool.color}-500 transition-colors`}>
                    <tool.icon className={`w-6 h-6 text-${tool.color}-500 group-hover:text-white transition-colors`} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{tool.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">{tool.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Stunning Analytics Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="lg:col-span-2 bg-white rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] p-10"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Performance Matrix</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">7-Day Financial Trajectory</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#BF953F]"></div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Gross Income</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Expenses</span>
                  </div>
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BF953F" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#BF953F" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CBD5E1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#CBD5E1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(v) => `₱${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '20px',
                        border: 'none',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        padding: '16px',
                        backgroundColor: 'white'
                      }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                      labelStyle={{ marginBottom: '8px', color: '#94A3B8', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#BF953F"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#CBD5E1"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#expensesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="space-y-6"
            >
              {[
                { label: 'Total Revenue', value: stats.totalIncome, color: '#BF953F', trend: stats.revenueTrend },
                { label: 'Operational Cost', value: totalExpenses, color: '#94A3B8', trend: stats.expenseTrend },
                { label: 'Net Profit Margin', value: profit, color: profit >= 0 ? '#10B981' : '#EF4444', trend: stats.profitTrend },
              ].map((kpi, i) => (
                <div key={kpi.label} className="modern-card p-8 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{kpi.label}</span>
                    <span className={`text-[10px] font-black p-1 px-2 rounded-full ${kpi.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                      {kpi.trend}
                    </span>
                  </div>
                  <div className={`text-4xl font-black tracking-tighter mb-2 ${kpi.label === 'Total Revenue' ? 'gold-gradient-text' : 'text-gray-900'}`}>
                    ₱{kpi.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '70%' }}
                      transition={{ delay: 1.5 + i * 0.2, duration: 1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: kpi.color }}
                    ></motion.div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* New Sections: Top Products & Recent Transactions & Staff Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Selling Products */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="modern-card p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-gray-900 tracking-tighter">Top Products</h2>
                <div className="text-[10px] font-black text-[#BF953F] uppercase tracking-widest">Quantity</div>
              </div>
              <div className="space-y-6">
                {topProducts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm italic">No product sales data available</div>
                ) : (
                  topProducts.map((product, i) => (
                    <div key={product.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-800">{product.name}</span>
                        <span className="text-xs font-black text-[#BF953F]">{product.sales} sold</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (product.sales / (topProducts[0]?.sales || 1)) * 100)}%` }}
                          transition={{ delay: 1.5 + i * 0.1, duration: 1 }}
                          className="h-full bg-gradient-to-r from-[#BF953F] to-[#B38728] rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="lg:col-span-2 modern-card p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-gray-900 tracking-tighter">Recent Transactions</h2>
                <button 
                  onClick={() => setLocation('/transaction-history')}
                  className="text-[10px] font-black text-[#BF953F] uppercase tracking-widest hover:underline"
                >
                  View All Transactions
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Processed By</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Payment</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-gray-400 text-sm italic">No recent transactions</td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 text-xs font-bold text-gray-900">#{String(tx.id).substring(0, 8)}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#BF953F]/10 flex items-center justify-center">
                                <User className="w-3 h-3 text-[#BF953F]" />
                              </div>
                              <span className="text-xs font-bold text-gray-700">{tx.staffName}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${
                              tx.paymentType === 'cash' ? 'bg-emerald-50 text-emerald-600' :
                              tx.paymentType === 'ewallet' ? 'bg-blue-50 text-blue-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {tx.paymentType}
                            </span>
                          </td>
                          <td className="py-4 text-right text-xs font-black text-gray-900">₱{tx.total.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Staff Performance Section */}
          {staffPerformance.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="modern-card p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-gray-900 tracking-tighter">Team Performance</h2>
                <div className="text-[10px] font-black text-[#BF953F] uppercase tracking-widest">Contribution by Sales</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {staffPerformance.map((staff, i) => (
                  <div key={staff.name} className="relative p-6 bg-gray-50 rounded-2xl border border-transparent hover:border-[#BF953F]/20 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-[#BF953F]" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tighter text-gray-900">{staff.name}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Member</div>
                      </div>
                    </div>
                    <div className="text-2xl font-black text-gray-900 tracking-tighter mb-1">₱{staff.sales.toLocaleString()}</div>
                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total Sales Generated</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Floating Action Button */}
        <FloatingActionButton onTutorialClick={handleTutorialClick} />

        {/* Add Expense Dialog */}
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Expense</DialogTitle>
            </DialogHeader>
            
            <Form {...expenseForm}>
              <form onSubmit={expenseForm.handleSubmit(handleAddExpense)} className="space-y-4">
                <FormField
                  control={expenseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Description</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Rent, Utilities, Supplies"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Amount (₱)</FormLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Category</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                          <option value="">Select category</option>
                          <option value="Rent">Rent</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Supplies">Supplies</option>
                          <option value="Equipment">Equipment</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Other">Other</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Date</FormLabel>
                      <FormControl>
                        <input
                          type="date"
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Expense
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Purchase Dialog */}
        <Dialog open={isAddPurchaseOpen} onOpenChange={setIsAddPurchaseOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Purchase</DialogTitle>
            </DialogHeader>
            
            <Form {...purchaseForm}>
              <form onSubmit={purchaseForm.handleSubmit(handleAddPurchase)} className="space-y-4">
                <FormField
                  control={purchaseForm.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Product Name</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Coca Cola, Bread"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={purchaseForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Quantity</FormLabel>
                        <FormControl>
                          <input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={purchaseForm.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Cost (₱)</FormLabel>
                        <FormControl>
                          <input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={purchaseForm.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Supplier</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Coca Cola Company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={purchaseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Date</FormLabel>
                      <FormControl>
                        <input
                          type="date"
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddPurchaseOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Purchase
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Creditor Dialog */}
        <Dialog open={isAddCreditorOpen} onOpenChange={setIsAddCreditorOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Creditor</DialogTitle>
            </DialogHeader>
            
            <Form {...creditorForm}>
              <form onSubmit={creditorForm.handleSubmit(handleAddCreditor)} className="space-y-4">
                <FormField
                  control={creditorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Creditor Name</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Supplier Company, Bank"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={creditorForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Amount (₱)</FormLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={creditorForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Description</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Inventory loan, Equipment financing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={creditorForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Due Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={creditorForm.control}
                    name="reminderDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Reminder Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddCreditorOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Creditor
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Notifications Dialog */}
        <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
          <DialogContent className="max-w-md h-[70vh] flex flex-col p-0 overflow-hidden outline-none rounded-[2rem]">
            <DialogHeader className="p-6 border-b bg-white flex-none">
              <DialogTitle className="text-xl font-black tracking-tighter gold-gradient-text uppercase">Notifications</DialogTitle>
              <DialogDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                System Alerts & Staff Remittances
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">All clear!</h3>
                  <p className="text-sm text-gray-400">You have no new notifications at the moment.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                      n.isRead 
                        ? 'bg-white border-gray-100 opacity-60' 
                        : 'bg-white border-[#BF953F]/20 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                        n.type === 'remittance' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {n.type === 'remittance' ? <DollarSign className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                            {n.type === 'remittance' ? 'Staff Remittance' : 'System Update'}
                          </span>
                          <span className="text-[9px] font-bold text-gray-300">
                            {new Date(n.createdAt as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-sm leading-tight ${n.isRead ? 'text-gray-500' : 'text-gray-900 font-bold'}`}>
                          {n.message}
                        </p>
                        {!n.isRead && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-[#BF953F] pt-1">
                            <span>View Details</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            <div className="p-4 border-t bg-white text-center flex-none">
              <Button 
                variant="ghost" 
                className="text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest"
                onClick={() => setShowNotifications(false)}
              >
                Close Panel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remittance Confirmation Dialog */}
        <Dialog open={!!selectedRemittance} onOpenChange={(open) => !open && setSelectedRemittance(null)}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-8">
            <DialogHeader className="text-center space-y-4">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-2">
                <DollarSign className="w-10 h-10 text-[#BF953F]" />
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter text-gray-900 leading-tight">
                Confirm Staff <br /> Remittance?
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-medium">
                The staff member <span className="font-bold text-gray-900">{selectedRemittance?.staffName}</span> is remitting their accumulated revenue.
              </DialogDescription>
            </DialogHeader>

            <div className="my-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Amount</span>
                <span className="text-2xl font-black text-gray-900">₱{selectedRemittance?.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-gray-200 w-full"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transactions</span>
                <span className="text-lg font-black text-gray-900">{selectedRemittance?.transactionCount} Orders</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Timestamp</span>
                <span className="text-xs font-bold text-gray-600">{selectedRemittance?.createdAt ? new Date(selectedRemittance.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-none" />
                <p className="text-[11px] text-blue-700 font-medium leading-tight">
                  By confirming, you acknowledge that you have physically received the cash from the staff member. This will update the system revenue.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRemittance(null)}
                  className="flex-1 py-7 rounded-2xl border-gray-200 text-gray-500 font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  NOT YET
                </Button>
                <Button 
                  onClick={handleConfirmRemittance}
                  disabled={isConfirmingRemit}
                  className="flex-1 py-7 rounded-2xl bg-[#BF953F] hover:bg-[#A67C27] text-white font-bold uppercase tracking-widest shadow-xl shadow-amber-200 transition-all"
                >
                  {isConfirmingRemit ? "PROCESSING..." : "CONFIRM"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </motion.div>
    </Layout>
  );
};

export default AdminMain;
