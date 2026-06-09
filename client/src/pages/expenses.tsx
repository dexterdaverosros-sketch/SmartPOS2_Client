import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  FileText, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Receipt,
  TrendingDown,
  Filter,
  Search,
  MoreVertical,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { db, ExpenseService } from "@/lib/db";
import { Expense } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDevices } from "@/contexts/DeviceContext";
import { useToast } from "@/hooks/use-toast";

export default function ExpensesPage() {
  const [, setLocation] = useLocation();
  const { deviceMode } = useDevices();
  const { toast } = useToast();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaryData, setSummaryData] = useState<{name: string, amount: number}[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Add Expense State
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newExpenseDetails, setNewExpenseDetails] = useState("");

  // Details State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const isDesktop = deviceMode === 'pc' || deviceMode === 'tablet';

  const formatDateSafely = (date: any, formatStr: string) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "Invalid Date";
      return format(d, formatStr);
    } catch (e) {
      return "Invalid Date";
    }
  };

  const loadData = async () => {
    try {
      const all = await db.expenses.toArray();
      
      // FIX: Use local time for date filtering to resolve display bug
      const [year, month, day] = filterDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);

      const filtered = all.filter(e => {
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d >= start && d <= end;
      });

      setExpenses(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      // Group for summary
      const groups: Record<string, number> = {};
      filtered.forEach(e => {
        const name = e.category || e.description || "Uncategorized";
        groups[name] = (groups[name] || 0) + (Number(e.amount) || 0);
      });
      
      const summary = Object.entries(groups).map(([name, amount]) => ({ name, amount }));
      setSummaryData(summary);
      setTotalExpenses(filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    } catch (err) {
      console.error("Failed to load expenses:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDate]);

  const handleSaveExpense = async () => {
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid expense amount", variant: "destructive" });
      return;
    }
    if (!newExpenseCategory) {
      toast({ title: "Category Required", description: "Please enter what the expense is for", variant: "destructive" });
      return;
    }

    try {
      await ExpenseService.addExpense({
        amount,
        category: newExpenseCategory,
        description: newExpenseDetails,
        date: new Date()
      });
      
      setAddExpenseOpen(false);
      setNewExpenseAmount("");
      setNewExpenseCategory("");
      setNewExpenseDetails("");
      loadData();
      toast({ title: "Expense Saved", description: "Your expense has been recorded successfully" });
    } catch (error) {
      console.error("Failed to save expense:", error);
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;
    try {
      await db.expenses.delete(selectedExpense.id);
      setDetailsOpen(false);
      setSelectedExpense(null);
      loadData();
      toast({ title: "Expense Deleted", description: "The expense record has been removed" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    }
  };

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const categories = ["Rent", "Utilities", "Supplies", "Salary", "Marketing", "Others"];

  return (
    <Layout showNavigation={false}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Modern Header */}
        <div className="bg-slate-900 pt-8 pb-12 px-6 rounded-b-[3rem] relative overflow-hidden flex-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 blur-2xl" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation('/admin-main')}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.3em]">Financials</p>
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Expense Tracker</h1>
                </div>
              </div>
              <Button 
                onClick={() => setSummaryOpen(true)}
                className="bg-[#BF953F] hover:bg-[#B38728] text-white rounded-2xl px-6 h-12 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#BF953F]/20 transition-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                Summary
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Today's Entries</p>
                  <p className="text-xl font-black text-white">{expenses.length}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-[#FF8882]/20 rounded-2xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-[#FF8882]" />
                </div>
                <div>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Total Expenses</p>
                  <p className="text-xl font-black text-[#FF8882]">{formatCurrency(totalExpenses)}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-white/20 transition-all" onClick={() => setLocation('/expense-report')}>
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Reporting</p>
                  <p className="text-sm font-black text-white uppercase tracking-tight">Full Report <ChevronRight className="w-3 h-3 inline ml-1" /></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col min-h-0">
          <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Left Column: Filters & Actions */}
            <div className={cn(
              "flex-none flex flex-col gap-4",
              isDesktop ? "w-80" : "w-full"
            )}>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Filter Data
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Date</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        type="date" 
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-[#BF953F]/20"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => setAddExpenseOpen(true)}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    New Expense
                  </Button>
                </div>
              </div>

              {isDesktop && summaryData.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-3 h-3" />
                    Distribution
                  </h2>
                  <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
                    {summaryData.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                          <span className="text-slate-600">{item.name}</span>
                          <span className="text-slate-900">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.amount / totalExpenses) * 100}%` }}
                            className="h-full bg-[#BF953F]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Expense List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-none">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                    Expense List <span className="text-slate-400 ml-2">({expenses.length})</span>
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400"><Search className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400"><MoreVertical className="w-4 h-4" /></Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {expenses.map((expense) => (
                      <motion.div 
                        key={expense.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setSelectedExpense(expense);
                          setDetailsOpen(true);
                        }}
                        className="bg-slate-50/50 hover:bg-white p-5 rounded-3xl border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-[#BF953F]/30 transition-colors">
                            <Receipt className="w-5 h-5 text-slate-400 group-hover:text-[#BF953F] transition-colors" />
                          </div>
                          <span className="text-[9px] font-black text-[#FF8882] bg-[#FF8882]/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                            {formatCurrency(expense.amount)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-black text-xs uppercase tracking-tight text-slate-900 mb-1">{expense.category}</h3>
                          <p className="text-[10px] font-bold text-slate-400 line-clamp-1">{expense.description || "No details provided"}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {formatDateSafely(expense.date, 'hh:mm a')}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#BF953F] group-hover:translate-x-1 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                    
                    {expenses.length === 0 && (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-4 border border-slate-100">
                          <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Expenses Found</p>
                        <p className="text-[8px] font-bold uppercase mt-1">Try selecting a different date</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Add Button for Mobile */}
        {!isDesktop && (
          <Button
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center z-50 group"
            onClick={() => setAddExpenseOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
          </Button>
        )}

        {/* Add Expense Modal */}
        <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-slate-900 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#BF953F]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="flex justify-between items-center relative z-10">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase mb-1">New Expense</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Record business spending</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-[#BF953F]" />
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-white space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Expense Amount (₱)</label>
                <Input 
                  type="number" 
                  placeholder="0.00"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl font-black text-xl px-6 focus:ring-2 focus:ring-[#BF953F]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setNewExpenseCategory(cat)}
                      className={cn(
                        "py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border",
                        newExpenseCategory === cat 
                          ? "bg-slate-900 text-white border-slate-900" 
                          : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <Input 
                  placeholder="Or enter custom category"
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  className="mt-2 h-12 bg-slate-50 border-none rounded-2xl font-bold text-xs px-6"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Details (Optional)</label>
                <Input 
                  placeholder="What was this for?"
                  value={newExpenseDetails}
                  onChange={(e) => setNewExpenseDetails(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-xs px-6"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setAddExpenseOpen(false)} className="flex-1 h-14 rounded-2xl border-slate-100 font-black uppercase tracking-widest text-slate-400">Cancel</Button>
                <Button onClick={handleSaveExpense} className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20">Save Record</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expense Details Modal */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            {selectedExpense && (
              <>
                <div className="bg-slate-900 p-8 text-white relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#BF953F]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter uppercase mb-1">{selectedExpense.category}</h2>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        {formatDateSafely(selectedExpense.date, 'MMMM dd, yyyy • hh:mm a')}
                      </p>
                    </div>
                    <button onClick={() => setDetailsOpen(false)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><X className="w-5 h-5 text-white" /></button>
                  </div>
                </div>
                
                <div className="p-8 bg-white space-y-8">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Transaction Amount</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Expense Description</label>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm font-bold text-slate-700 leading-relaxed">
                      {selectedExpense.description || "No detailed description provided for this expense record."}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteExpense}
                      className="w-full h-14 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none font-black uppercase tracking-widest transition-all"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Delete Entry
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Summary Modal */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-slate-900 p-8 text-white relative text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-[#BF953F]/10 to-transparent" />
              <h2 className="text-2xl font-black tracking-tighter uppercase mb-1 relative z-10">Financial Summary</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">Period Distribution</p>
            </div>
            
            <div className="p-8 bg-white space-y-6">
              <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                {summaryData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                    <span className="text-[11px] font-black uppercase tracking-tight text-slate-600">{item.name}</span>
                    <span className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {summaryData.length === 0 && (
                  <div className="text-center py-10 opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-widest">No data to summarize</p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Net Expenses</span>
                  <span className="text-2xl font-black text-[#FF8882] tracking-tighter">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>

              <Button onClick={() => setSummaryOpen(false)} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">Close Summary</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
