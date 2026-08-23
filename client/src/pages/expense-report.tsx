import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Calendar as CalendarIcon, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/db';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval } from 'date-fns';
import Layout from '@/components/Layout';
import { cn } from '@/lib/utils';
import { Expense } from '@shared/schema';

const ExpenseReport: React.FC = () => {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDuration, setSelectedDuration] = useState<string>('Today');
  const [durationDropdownOpen, setDurationDropdownOpen] = useState<boolean>(false);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groupedExpenses, setGroupedExpenses] = useState<any[]>([]);
  
  // Details Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDateExpenses, setSelectedDateExpenses] = useState<{ date: string, items: Expense[], total: number } | null>(null);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editName, setEditName] = useState(''); // category/name
  const [editDetails, setEditDetails] = useState(''); // description

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const handleDurationChange = (preset: string) => {
    setSelectedDuration(preset);
    setDurationDropdownOpen(false);
    const today = new Date();

    switch (preset) {
      case 'Today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'LastDay': 
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'Single Day':
         // Just sets to today initially, user picks date
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'This Week':
        setStartDate(format(startOfWeek(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today), 'yyyy-MM-dd'));
        break;
      case 'Last Week':
        const lastWeekStart = startOfWeek(subWeeks(today, 1));
        const lastWeekEnd = endOfWeek(subWeeks(today, 1));
        setStartDate(format(lastWeekStart, 'yyyy-MM-dd'));
        setEndDate(format(lastWeekEnd, 'yyyy-MM-dd'));
        break;
      case 'This Month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'Last Month':
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));
        setStartDate(format(lastMonthStart, 'yyyy-MM-dd'));
        setEndDate(format(lastMonthEnd, 'yyyy-MM-dd'));
        break;
      case 'Date range':
        // User manually selects
        break;
    }
  };

  const loadExpenses = async () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const allExpenses = await db.expenses.toArray();
    const filtered = allExpenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });

    setExpenses(filtered);

    // Group by Date
    const groups: Record<string, { date: string, count: number, total: number, items: Expense[] }> = {};
    
    filtered.forEach(e => {
        const dateKey = format(new Date(e.date), 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = { date: dateKey, count: 0, total: 0, items: [] };
        }
        groups[dateKey].count += 1;
        groups[dateKey].total += e.amount;
        groups[dateKey].items.push(e);
    });

    setGroupedExpenses(Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate]);

  const handleRowClick = (group: any) => {
    setSelectedDateExpenses(group);
    setDetailsOpen(true);
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount.toString());
    setEditName(expense.category); // Assuming category holds the 'Name'
    setEditDetails(expense.description);
    setEditOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
        await db.expenses.delete(id);
        loadExpenses();
        // Update selected group if open
        if (selectedDateExpenses) {
            const updatedItems = selectedDateExpenses.items.filter(i => i.id !== id);
            if (updatedItems.length === 0) {
                setDetailsOpen(false);
                setSelectedDateExpenses(null);
            } else {
                 const newTotal = updatedItems.reduce((s, i) => s + i.amount, 0);
                 setSelectedDateExpenses({ ...selectedDateExpenses, items: updatedItems, total: newTotal });
            }
        }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) {
        alert("Invalid amount");
        return;
    }

    await db.expenses.update(editingExpense.id, {
        amount,
        category: editName,
        description: editDetails
    });

    setEditOpen(false);
    setEditingExpense(null);
    loadExpenses();
    
    // Refresh details view
    if (selectedDateExpenses) {
         // Re-fetch that specific date's items? Easier to just reload logic or manually update state
         // We will rely on loadExpenses re-running or manually update the local state for immediate feedback
         const updatedItems = selectedDateExpenses.items.map(i => i.id === editingExpense.id ? { ...i, amount, category: editName, description: editDetails } : i);
         const newTotal = updatedItems.reduce((s, i) => s + i.amount, 0);
         setSelectedDateExpenses({ ...selectedDateExpenses, items: updatedItems, total: newTotal });
    }
  };

  const overallEntries = expenses.length;
  const overallTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Layout showNavigation={false}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        <div className="bg-slate-900 pt-8 pb-10 px-6 rounded-b-[3rem] relative overflow-hidden flex-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 blur-2xl" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation('/expenses')}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.3em]">Financials</p>
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Expense Report</h1>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/5 backdrop-blur-md p-3 rounded-[2rem] border border-white/10">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                {[
                  { label: 'Today', key: 'Today' },
                  { label: 'Yesterday', key: 'LastDay' },
                  { label: 'This Week', key: 'This Week' },
                  { label: 'This Month', key: 'This Month' }
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handleDurationChange(preset.key)}
                    className={cn(
                      "h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                      selectedDuration === preset.key ? "bg-[#BF953F] text-white shadow-lg shadow-[#BF953F]/20" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-2xl border border-white/10 w-full md:w-auto">
                <CalendarIcon className="w-4 h-4 text-[#BF953F] flex-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setSelectedDuration('Date range'); }}
                  className="bg-transparent text-[11px] font-black text-white focus:outline-none cursor-pointer uppercase tracking-tighter"
                />
                <span className="text-white/30 font-bold mx-0.5">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSelectedDuration('Date range'); }}
                  className="bg-transparent text-[11px] font-black text-white focus:outline-none cursor-pointer uppercase tracking-tighter"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto w-full p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Expense</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(overallTotal)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <span className="text-xl font-black text-red-500">₱</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Entries</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{overallEntries}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <span className="text-xl font-black text-blue-500">#</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Expense / Group</p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {formatCurrency(groupedExpenses.length > 0 ? overallTotal / groupedExpenses.length : 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <span className="text-xl font-black text-amber-500">~</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                Grouped Expense Records <span className="text-slate-400 ml-2">({groupedExpenses.length})</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</th>
                    <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Entries</th>
                    <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedExpenses.map((group, idx) => (
                    <tr 
                      key={idx}
                      onClick={() => handleRowClick(group)}
                      className="group hover:bg-slate-50/80 transition-all cursor-pointer"
                    >
                      <td className="py-4 px-6 text-xs font-bold text-slate-900">{group.date}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded-full">
                          {group.count} {group.count === 1 ? 'entry' : 'entries'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-xs font-black text-red-500">
                        {formatCurrency(group.total)}
                      </td>
                    </tr>
                  ))}
                  {groupedExpenses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No expense records found for the selected duration.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900 uppercase tracking-tight">
                Expense Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {selectedDateExpenses?.items.map((item) => (
                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {format(new Date(item.date), 'hh:mm a • dd MMM yyyy')}
                      </div>
                      <div className="font-bold text-sm text-slate-900 mt-0.5">{item.category}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                    </div>
                    <div className="font-black text-base text-red-500">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-200/50">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200"
                      onClick={() => handleEditClick(item)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1 text-slate-600" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-9 px-3 rounded-xl text-red-500 border-red-100 hover:bg-red-50"
                      onClick={() => handleDeleteClick(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 uppercase tracking-tight">Edit Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category / Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-2xl font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₱)</label>
                <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-2xl font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                <Input value={editDetails} onChange={e => setEditDetails(e.target.value)} className="h-12 bg-slate-50 border-slate-100 rounded-2xl font-bold text-sm" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest">Cancel</Button>
              <Button onClick={handleSaveEdit} className="flex-1 h-12 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ExpenseReport;
