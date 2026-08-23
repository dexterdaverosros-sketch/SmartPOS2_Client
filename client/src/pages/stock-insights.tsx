import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Calendar, ChevronDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';

export default function StockInsights() {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedPreset, setSelectedPreset] = useState<string>('Today');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const [inventoryPrice, setInventoryPrice] = useState<number>(0);
  const [inventoryCost, setInventoryCost] = useState<number>(0);
  const [potentialMargin, setPotentialMargin] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; qty: number; unitPrice: number; cost: number; margin: number }>>([]);

  const sDate = useMemo(() => new Date(startDate), [startDate]);
  const eDate = useMemo(() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; }, [endDate]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const reloadReportData = async () => {
    // 1. Calculate Inventory Metrics (Current State)
    const products = await db.products.toArray();
    
    // We need average cost for products. 
    // Ideally this comes from products directly if tracked, or averaged from purchases.
    // For now we will try to get it from purchases or fallback to product.cost
    const purchases = await db.purchases.toArray();
    const avgCostByName: Record<string, number> = {};
    const countsByName: Record<string, number> = {};
    
    for (const p of purchases) {
      const name = p.productName;
      avgCostByName[name] = (avgCostByName[name] || 0) + (p.cost || 0);
      countsByName[name] = (countsByName[name] || 0) + 1;
    }
    for (const name of Object.keys(avgCostByName)) {
      avgCostByName[name] = avgCostByName[name] / (countsByName[name] || 1);
    }

    const invPrice = products.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 0), 0);
    const invCost = products.reduce((sum, p) => {
      // Use average cost from purchases if available, otherwise product.cost, otherwise 0
      const cost = avgCostByName[p.name] || p.cost || 0;
      return sum + cost * (p.quantity || 0);
    }, 0);
    
    setInventoryPrice(invPrice);
    setInventoryCost(invCost);
    setPotentialMargin(invPrice - invCost);

    // 2. Calculate Top Selling Products (Based on Sales in Date Range)
    const sales = await db.sales
      .filter(s => {
        const d = new Date(s.createdAt as any);
        return d >= sDate && d <= eDate;
      })
      .toArray();
    const saleIds = new Set(sales.map(s => s.id));
    const items = await db.saleItems
      .filter(si => saleIds.has(si.saleId))
      .toArray();

    const productNameById: Record<string, string> = {};
    for (const p of products) productNameById[p.id] = p.name;

    const perProduct: Record<string, { name: string; qty: number; unitPriceSum: number; unitPriceCount: number; costSum: number; margin: number }> = {};
    
    for (const it of items) {
      const name = productNameById[it.productId] || it.productId; // Fallback to ID if name not found
      const unitPrice = it.price || 0;
      // Cost for this item
      const itemCost = avgCostByName[name] || products.find(p => p.id === it.productId)?.cost || 0;
      const totalCost = itemCost * (it.quantity || 0);
      const lineMargin = (unitPrice * (it.quantity || 0)) - totalCost;

      if (!perProduct[name]) perProduct[name] = { name, qty: 0, unitPriceSum: 0, unitPriceCount: 0, costSum: 0, margin: 0 };
      perProduct[name].qty += it.quantity || 0;
      perProduct[name].unitPriceSum += unitPrice;
      perProduct[name].unitPriceCount += 1;
      perProduct[name].costSum += totalCost;
      perProduct[name].margin += lineMargin;
    }

    const rows = Object.values(perProduct)
      .map(r => ({
        name: r.name,
        qty: r.qty,
        unitPrice: r.unitPriceCount ? r.unitPriceSum / r.unitPriceCount : 0,
        cost: r.costSum, // Total cost for the sold quantity
        margin: r.margin,
      }))
      .sort((a,b) => b.qty - a.qty)
      .slice(0, 50); // Show top 50
      
    setTopProducts(rows);
  };

  useEffect(() => { reloadReportData(); }, [startDate, endDate]);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setDropdownOpen(false);
    const today = new Date();

    switch (preset) {
      case 'Today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'Last day':
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'This week':
        setStartDate(format(startOfWeek(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today), 'yyyy-MM-dd'));
        break;
      case 'Last week':
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
      case 'Single Day':
        // Just keeps current selection or defaults to today, user picks specific day
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'Using Date Range':
        // User manually picks dates
        break;
    }
  };

  return (
    <Layout showNavigation={false}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Modern Header */}
        <div className="bg-slate-900 pt-8 pb-10 px-6 rounded-b-[3rem] relative overflow-hidden flex-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 blur-2xl" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation('/admin/reports')}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.3em]">Analytics</p>
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Stock & Inventory Insights</h1>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/5 backdrop-blur-md p-3 rounded-[2rem] border border-white/10">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                {[
                  { label: 'Today', key: 'Today' },
                  { label: 'This Week', key: 'This week' },
                  { label: 'This Month', key: 'This Month' },
                  { label: 'Custom Range', key: 'Using Date Range' }
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handlePresetChange(preset.key)}
                    className={cn(
                      "h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                      selectedPreset === preset.key ? "bg-[#BF953F] text-white shadow-lg shadow-[#BF953F]/20" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-2xl border border-white/10 w-full md:w-auto">
                <Calendar className="w-4 h-4 text-[#BF953F] flex-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('Using Date Range'); }}
                  className="bg-transparent text-[11px] font-black text-white focus:outline-none cursor-pointer uppercase tracking-tighter"
                />
                <span className="text-white/30 font-bold mx-0.5">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('Using Date Range'); }}
                  className="bg-transparent text-[11px] font-black text-white focus:outline-none cursor-pointer uppercase tracking-tighter"
                />
              </div>
            </div>
          </div>
        </div>
        {/* Main Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 overflow-y-auto custom-scrollbar">
          {/* Inventory Price & Cost & Margin Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Price</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(inventoryPrice)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <span className="text-xl font-black text-blue-500">₱</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Cost</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(inventoryCost)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <span className="text-xl font-black text-amber-500">₱</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Potential Sales Margin</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(potentialMargin)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <span className="text-xl font-black text-emerald-500">%</span>
              </div>
            </div>
          </div>

        {/* Top Selling Products Header */}
        <div className="text-center pt-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Top Selling Products</h2>
        </div>

        {/* Grid Table */}
        <Card className="overflow-hidden border-none shadow-md">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <th className="px-4 py-3 text-left font-semibold">Product</th>
                            <th className="px-4 py-3 text-center font-semibold">Qty</th>
                            <th className="px-4 py-3 text-right font-semibold">Price</th>
                            <th className="px-4 py-3 text-right font-semibold">Cost</th>
                            <th className="px-4 py-3 text-right font-semibold">Margin</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                        {topProducts.map((p, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{p.qty}</td>
                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(p.unitPrice)}</td>
                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(p.cost)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.margin)}</td>
                            </tr>
                        ))}
                        {topProducts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    No sales data found for the selected period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
