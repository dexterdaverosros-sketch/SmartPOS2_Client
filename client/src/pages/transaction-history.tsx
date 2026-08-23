import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Calendar, Filter, RefreshCw, Receipt, User, ShoppingBag } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SalesService, db } from '@/lib/db';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'ewallet' | 'credits';
  date: string;
  time: string;
  items: number;
  createdAt: Date;
  staffName?: string;
  rawSale?: any;
}

const TransactionHistory: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Details Modal state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const fetchTransactions = async (fromCloud = false) => {
    if (fromCloud) setSyncing(true);
    else setLoading(true);
    
    try {
      let salesHistory: any[] = [];
      if (fromCloud) {
        const response = await api.get('/api/cloud/transactions');
        salesHistory = Array.isArray(response) ? response : (response.data || []);
      } else {
        try {
          const response = await api.get('/api/sales-history');
          salesHistory = Array.isArray(response) ? response : (response.data || []);
        } catch (serverError) {
          console.warn('Failed to fetch from server, using local DB', serverError);
          salesHistory = await SalesService.getAllSales();
        }
      }
      
      if (!Array.isArray(salesHistory)) {
        throw new Error('Invalid response format from server');
      }

      const formattedTransactions = salesHistory.map((sale: any) => {
        const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
        return {
          id: sale.id,
          date: date.toLocaleDateString(),
          time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: Array.isArray(sale.items) ? sale.items.length : (sale.itemCount || 0),
          amount: Number(sale.total || 0),
          paymentMethod: (sale.paymentType === 'ewallet' ? 'ewallet' : sale.paymentType === 'credits' ? 'credits' : 'cash') as 'cash' | 'ewallet' | 'credits', 
          createdAt: date,
          staffName: sale.staffName || 'Owner',
          rawSale: sale
        };
      });

      setTransactions(formattedTransactions.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()));
      
      if (fromCloud) {
        toast({ title: 'Cloud Sync Complete', description: `Successfully retrieved ${formattedTransactions.length} transactions from Supabase.` });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: fromCloud ? 'Failed to sync with Supabase' : 'Failed to load transaction history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [toast]);
  
  const handleViewDetails = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsOpen(true);
    setLoadingDetails(true);

    try {
      if (transaction.rawSale && Array.isArray(transaction.rawSale.items) && transaction.rawSale.items.length > 0) {
        setDetailItems(transaction.rawSale.items);
      } else {
        const localItems = await db.saleItems.where('saleId').equals(transaction.id).toArray();
        if (localItems && localItems.length > 0) {
          setDetailItems(localItems);
        } else {
          setDetailItems([]);
        }
      }
    } catch (err) {
      console.error('Error fetching sale details:', err);
      setDetailItems([]);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const getFilteredTransactions = (paymentMethod?: 'cash' | 'ewallet' | 'credits') => {
    return transactions.filter(transaction => {
      const transactionDate = transaction.createdAt;

      const matchesMonthYear =
        transactionDate.getMonth() === selectedMonth &&
        transactionDate.getFullYear() === selectedYear;

      const matchesPaymentMethod =
        !paymentMethod || transaction.paymentMethod === paymentMethod;

      const matchesSearch =
        !searchQuery ||
        transaction.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.amount?.toString().includes(searchQuery) ||
        transaction.staffName?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesMonthYear && matchesPaymentMethod && matchesSearch;
    });
  };
  
  const getMonthName = (month: number) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  };
  
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };
  
  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full bg-gray-50 dark:bg-gray-900"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setLocation('/admin-main')}
                className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Transaction History
              </h1>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchTransactions(true)} 
              disabled={syncing}
              className="border-[#BF953F] text-[#BF953F] hover:bg-[#BF953F]/10"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
              {syncing ? 'Syncing...' : 'Sync Cloud'}
            </Button>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-auto">
          {/* Search and Filter */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Month Selector */}
          <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
            <button onClick={handlePrevMonth} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-500" />
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
            </div>
            <button onClick={handleNextMonth} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ArrowLeft className="w-5 h-5 transform rotate-180" />
            </button>
          </div>
          
          {/* Tabs */}
          <Tabs defaultValue="cash" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="ewallet">E-Wallet</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>
            
            {/* Cash Transactions Tab */}
            <TabsContent value="cash" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 dark:border-gray-200 mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading transactions...</p>
                </div>
              ) : getFilteredTransactions('cash').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">No cash transactions found for this period.</p>
                </div>
              ) : (
                getFilteredTransactions('cash').map(transaction => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          Transaction #{transaction.id ? transaction.id.substring(0, 8) : 'Unknown'}
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                          Processed by: {transaction.staffName || 'Owner'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.date} • {transaction.time}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.items} {transaction.items === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600 dark:text-green-400">
                          ₱{transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Cash Payment
                        </div>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => handleViewDetails(transaction)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </TabsContent>
            
          {/* E-Wallet Transactions Tab */}
          <TabsContent value="ewallet" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 dark:border-gray-200 mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading transactions...</p>
                </div>
              ) : getFilteredTransactions('ewallet').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">No e-wallet transactions found for this period.</p>
                </div>
              ) : (
                getFilteredTransactions('ewallet').map(transaction => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          Transaction #{transaction.id ? transaction.id.substring(0, 8) : 'Unknown'}
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                          Processed by: {transaction.staffName || 'Owner'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.date} • {transaction.time}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.items} {transaction.items === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          ₱{transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          E-Wallet Payment
                        </div>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => handleViewDetails(transaction)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
            )}
          </TabsContent>

          {/* Credits Transactions Tab */}
          <TabsContent value="credits" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 dark:border-gray-200 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading transactions...</p>
              </div>
            ) : getFilteredTransactions('credits').length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">No credits transactions found for this period.</p>
              </div>
            ) : (
              getFilteredTransactions('credits').map(transaction => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        Transaction #{transaction.id ? transaction.id.substring(0, 8) : 'Unknown'}
                      </div>
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                        Processed by: {transaction.staffName || 'Owner'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {transaction.date} • {transaction.time}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {transaction.items} {transaction.items === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-600 dark:text-purple-400">
                        ₱{transaction.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Credits (Utang)
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => handleViewDetails(transaction)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>
          </Tabs>
        </div>

        {/* Transaction Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                <Receipt className="w-5 h-5 text-[#BF953F]" />
                Transaction Receipt Details
              </DialogTitle>
            </DialogHeader>

            {selectedTransaction && (
              <div className="space-y-4 mt-2">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold uppercase tracking-wider">Transaction Ref</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">#{selectedTransaction.id}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold uppercase tracking-wider">Date & Time</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{selectedTransaction.date} {selectedTransaction.time}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold uppercase tracking-wider">Processed By</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{selectedTransaction.staffName || 'Owner'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold uppercase tracking-wider">Payment Mode</span>
                    <span className="font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{selectedTransaction.paymentMethod}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#BF953F]" />
                    Purchased Items ({detailItems.length})
                  </div>

                  {loadingDetails ? (
                    <div className="text-center py-6 text-sm text-gray-400">Loading order items...</div>
                  ) : detailItems.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400 italic">No individual item records found for this sale.</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                      {detailItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{item.productName || item.name || 'Item'}</div>
                            <div className="text-[10px] text-gray-400 font-medium">
                              {item.quantity} {item.unit || 'pcs'} × ₱{Number(item.price || item.unitPrice || 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="font-black text-gray-900 dark:text-white">
                            ₱{Number(item.subtotal || (item.quantity * (item.price || 0)) || 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Grand Total</span>
                  <span className="text-xl font-black text-[#BF953F]">₱{selectedTransaction.amount.toFixed(2)}</span>
                </div>

                <Button onClick={() => setIsDetailsOpen(false)} className="w-full h-12 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest">
                  Close Receipt
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </Layout>
  );
};

export default TransactionHistory;
