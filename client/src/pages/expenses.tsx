import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, Calendar as CalendarIcon, ChevronRight, Plus, Save, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { db, ExpenseService } from "@/lib/db";
import { Expense } from "@shared/schema";
import { format } from "date-fns";

export default function ExpensesPage() {
  const [, setLocation] = useLocation();
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
      const all = await db.expenses.toArray();
      
      // Filter by date
      const start = new Date(filterDate);
      if (isNaN(start.getTime())) start.setTime(Date.now());
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(filterDate);
      if (isNaN(end.getTime())) end.setTime(Date.now());
      end.setHours(23, 59, 59, 999);

      const filtered = all.filter(e => {
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d >= start && d <= end;
      });

      setExpenses(filtered);

      // Group for summary
      const groups: Record<string, number> = {};
      filtered.forEach(e => {
          const name = e.category || e.description || "Uncategorized";
          groups[name] = (groups[name] || 0) + (Number(e.amount) || 0);
      });
      
      const summary = Object.entries(groups).map(([name, amount]) => ({ name, amount }));
      setSummaryData(summary);
      setTotalExpenses(filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  };

  useEffect(() => {
    loadData();
  }, [filterDate]);

  const handleSaveExpense = async () => {
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
    }
    if (!newExpenseCategory) {
        alert("Please enter what the expense is for");
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
    } catch (error) {
        console.error("Failed to save expense:", error);
        alert("Failed to save expense");
    }
  };

  const handleDeleteExpense = async () => {
      if (!selectedExpense) return;
      if (confirm('Are you sure you want to delete this expense?')) {
          await db.expenses.delete(selectedExpense.id);
          setDetailsOpen(false);
          setSelectedExpense(null);
          loadData();
      }
  };

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 min-h-screen relative pb-20">
        {/* Header Container */}
        <div className="bg-white dark:bg-gray-800 p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
                <button
                onClick={() => setLocation('/admin-main')}
                className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Expenses
                </h1>
            </div>
            
            <Button 
                variant="outline" 
                className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900"
                onClick={() => setSummaryOpen(true)}
            >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Expense Summary</span>
            </Button>
          </div>
        </div>

        {/* Sub-Header: Date Filter & Report Button */}
        <div className="px-4 mb-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-800 w-full sm:w-auto"
                />
            </div>

            <Button 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setLocation('/expense-report')}
            >
                <span>View Expense Report</span>
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>

        {/* Entry / Total Summary Container */}
        <div className="mx-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ENTRY</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{expenses.length}</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalExpenses)}</span>
            </div>
        </div>

        {/* Expense List */}
        <div className="flex-1 px-4 overflow-y-auto">
             <div className="space-y-3">
                {expenses.map((expense) => (
                    <div 
                        key={expense.id}
                        onClick={() => {
                            setSelectedExpense(expense);
                            setDetailsOpen(true);
                        }}
                        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                        <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{expense.category}</span>
                            <span className="text-sm text-gray-500">{formatDateSafely(expense.date, 'hh:mm a')}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(expense.amount)}</span>
                    </div>
                ))}
                {expenses.length === 0 && (
                    <div className="text-center text-gray-500 py-10">
                        No expenses for this date.
                    </div>
                )}
             </div>
        </div>

        {/* Add Expense FAB */}
        <Button
            className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center z-50"
            onClick={() => setAddExpenseOpen(true)}
        >
            <Plus className="h-6 w-6" />
        </Button>

        {/* Add Expense Modal */}
        <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                <DialogHeader className="flex flex-row items-center gap-2 border-b pb-2">
                    <Button variant="ghost" size="icon" onClick={() => setAddExpenseOpen(false)} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <DialogTitle>Expense Entry</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Total Expense</label>
                        <Input 
                            type="number" 
                            placeholder="0.00"
                            value={newExpenseAmount}
                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Expense for</label>
                        <Input 
                            placeholder="e.g. Supplies"
                            value={newExpenseCategory}
                            onChange={(e) => setNewExpenseCategory(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Details</label>
                        <Input 
                            placeholder="Product details..."
                            value={newExpenseDetails}
                            onChange={(e) => setNewExpenseDetails(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setAddExpenseOpen(false)} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSaveExpense} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Expense Details Modal (Pop up) */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                <DialogHeader className="flex flex-row items-center gap-2 border-b pb-2">
                    <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(false)} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <DialogTitle>Expense Details</DialogTitle>
                </DialogHeader>
                
                {selectedExpense && (
                    <div className="py-4 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="text-sm text-gray-500">
                                {formatDateSafely(selectedExpense.date, 'hh:mma dd MMMM- yyyy')}
                            </div>
                            <div className="font-bold text-2xl text-gray-900 dark:text-gray-100">
                                {formatCurrency(selectedExpense.amount)}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div>
                                <label className="text-xs text-gray-500 uppercase">Name</label>
                                <div className="font-medium text-lg text-gray-800 dark:text-gray-200">{selectedExpense.category}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase">Details</label>
                                <div className="text-gray-600 dark:text-gray-400">{selectedExpense.description || "No details provided"}</div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                            {/* Reusing Edit logic would require moving edit state up or duplicating it. 
                                For now, I'll stick to Delete as explicitly requested for 'Expense Details' in previous turn, 
                                but user just said "pop up the expense details" this time. 
                                I'll add Delete button as it's standard.
                            */}
                            <Button 
                                variant="destructive" 
                                className="w-full gap-2"
                                onClick={handleDeleteExpense}
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Expense
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>

        {/* Expense Summary Modal (Existing) */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl font-bold border-b pb-2">Summary</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {summaryData.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-200 dark:border-gray-700 pb-2 last:border-0">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{item.name}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-bold">{formatCurrency(item.amount)}</span>
                        </div>
                    ))}
                    {summaryData.length === 0 && (
                        <div className="text-center text-gray-500">No expenses found.</div>
                    )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">Net Expenses</span>
                        <span className="text-xl font-extrabold text-red-600">{formatCurrency(totalExpenses)}</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
