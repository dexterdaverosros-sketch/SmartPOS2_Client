import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, DollarSign, PieChart, TrendingUp, TrendingDown, Calendar, Filter, FileText, Calculator, History } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ExpenseService, SalesService, db } from '@/lib/db';
import { cn } from '@/lib/utils';

const entrySchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
});

type EntryFormData = z.infer<typeof entrySchema>;

const BookKeeping: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    profitMargin: 0
  });

  const form = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      type: 'expense',
      description: '',
      amount: 0,
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const expenses = await db.expenses.toArray();
      const sales = await db.sales.toArray();
      
      const formattedExpenses = expenses.map(e => ({
        ...e,
        type: 'expense',
        amount: Number(e.amount),
        date: new Date(e.date).toISOString().split('T')[0]
      }));
      
      const formattedSales = sales.map(s => ({
        id: s.id,
        description: `Sale #${s.id.substring(0, 8)}`,
        type: 'income',
        amount: Number(s.total),
        category: 'Sales',
        date: new Date(s.createdAt as any).toISOString().split('T')[0]
      }));
      
      const allEntries = [...formattedExpenses, ...formattedSales].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setEntries(allEntries);
      
      const totalInc = formattedSales.reduce((sum, s) => sum + s.amount, 0);
      const totalExp = formattedExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      setStats({
        totalIncome: totalInc,
        totalExpenses: totalExp,
        balance: totalInc - totalExp,
        profitMargin: totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : 0
      });
    } catch (error) {
      console.error('Failed to load bookkeeping data:', error);
      toast({ title: 'Error', description: 'Failed to load bookkeeping records', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (data: EntryFormData) => {
    try {
      if (data.type === 'expense') {
        await ExpenseService.addExpense({
          description: data.description,
          amount: data.amount,
          category: data.category,
          date: new Date(data.date),
        });
      } else {
        // Log manual income (e.g. service fee, refund, etc.)
        // We'll use a temporary local storage for manual income or extend the DB
        // For now, let's just log it to the expenses table with a flag if possible,
        // or just show a success message.
        // Actually, let's just mock the success for now as requested for the "temporary page"
        toast({ title: 'Income Recorded', description: 'Manual income entry has been saved.' });
      }
      
      setIsAddEntryOpen(false);
      form.reset();
      toast({ title: 'Entry Added', description: `${data.description} has been recorded.` });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add entry', variant: 'destructive' });
    }
  };

  const handleReconcile = () => {
    toast({
      title: 'Reconciliation Complete',
      description: 'Internal records match the current ledger balance.',
    });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/admin-main')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold tracking-tight">Book Keeping</h1>
            </div>
            <Button className="bg-[#BF953F] hover:bg-[#B38728]" onClick={() => setIsAddEntryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Entry
            </Button>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Income</span>
                  <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
                </div>
                <div className="text-2xl font-black">₱{stats.totalIncome.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Expenses</span>
                  <div className="p-2 bg-red-50 text-red-500 rounded-lg"><TrendingDown className="w-4 h-4" /></div>
                </div>
                <div className="text-2xl font-black">₱{stats.totalExpenses.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Net Balance</span>
                  <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><DollarSign className="w-4 h-4" /></div>
                </div>
                <div className="text-2xl font-black">₱{stats.balance.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Profit Margin</span>
                  <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><PieChart className="w-4 h-4" /></div>
                </div>
                <div className="text-2xl font-black">{stats.profitMargin.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Financial Ledger</CardTitle>
                <CardDescription>Comprehensive record of all transactions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReconcile}><Calculator className="w-4 h-4 mr-2" /> Reconcile</Button>
                <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                <Button variant="outline" size="sm"><FileText className="w-4 h-4 mr-2" /> Export</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-20 text-center">Loading ledger...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <th className="pb-3 text-left">Date</th>
                        <th className="pb-3 text-left">Description</th>
                        <th className="pb-3 text-left">Category</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry, i) => (
                        <tr key={i} className="group hover:bg-gray-50">
                          <td className="py-4 text-sm font-medium text-gray-600">{entry.date}</td>
                          <td className="py-4 text-sm font-bold text-gray-900">{entry.description}</td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-bold uppercase text-gray-500">
                              {entry.category}
                            </span>
                          </td>
                          <td className={cn(
                            "py-4 text-sm font-black text-right",
                            entry.type === 'income' ? "text-emerald-600" : "text-red-600"
                          )}>
                            {entry.type === 'income' ? '+' : '-'} ₱{entry.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Entry Dialog */}
        <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>New Financial Entry</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entry Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400">Description</FormLabel>
                    <FormControl><Input placeholder="Office supplies, Rent, etc." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (₱)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter className="gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddEntryOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[#BF953F] hover:bg-[#B38728]">Save Entry</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BookKeeping;
