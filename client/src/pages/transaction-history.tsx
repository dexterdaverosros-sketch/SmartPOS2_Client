import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Calendar, Filter } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesService, db } from '@/lib/db';
import api from '@/lib/api'; // Import the api utility
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
}

const TransactionHistory: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch transactions on component mount
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/sales-history');
        const salesHistory = response.data;

        const formattedTransactions = salesHistory.map((sale: any) => {
          const date = new Date(sale.createdAt);
          return {
            id: sale.id,
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            items: sale.items.length, // Assuming items array is included
            amount: sale.total,
            paymentMethod: (sale.paymentType === 'ewallet' ? 'ewallet' : sale.paymentType === 'credits' ? 'credits' : 'cash') as 'cash' | 'ewallet' | 'credits',
            createdAt: date,
            staffName: sale.staffName || 'Owner'
          };
        });

        setTransactions(formattedTransactions.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()));
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast({
          title: 'Error',
          description: 'Failed to load transaction history from server',
          variant: 'destructive',
        });
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [toast]);
  
  // Filter transactions by month and year
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
  
  // Get month name
  const getMonthName = (month: number) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  };
  
  // Handle month navigation
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
                      <div>
                        <div className="font-semibold text-green-600 dark:text-green-400">
                          ₱{transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                          Cash Payment
                        </div>
                        <Button size="sm" variant="outline" className="mt-1">
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
                      <div>
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          ₱{transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                          E-Wallet Payment
                        </div>
                        <Button size="sm" variant="outline" className="mt-1">
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
                    <div>
                      <div className="font-semibold text-purple-600 dark:text-purple-400">
                        ₱{transaction.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        Credits (Utang)
                      </div>
                      <Button size="sm" variant="outline" className="mt-1">
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
      </motion.div>
    </Layout>
  );
};

export default TransactionHistory;
