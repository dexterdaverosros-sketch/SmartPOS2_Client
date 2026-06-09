import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { 
  Calendar, 
  ChevronDown, 
  BarChart3, 
  LineChart, 
  ArrowLeft, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  ArrowUpRight,
  Download,
  Filter,
  PieChart,
  LayoutDashboard
} from 'lucide-react';
import { db } from '@/lib/db';
import { getUnitMultiplier, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useDevices } from '@/contexts/DeviceContext';

export default function AdminReports() {
  const [, setLocation] = useLocation();
  const { deviceMode } = useDevices();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [durationOpen, setDurationOpen] = useState<boolean>(false);
  
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [netSales, setNetSales] = useState<number>(0);
  const [avgBasketSize, setAvgBasketSize] = useState<number>(0);
  const [cogs, setCogs] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [profit, setProfit] = useState<number>(0);
  
  const [inventoryPrice, setInventoryPrice] = useState<number>(0);
  const [inventoryCost, setInventoryCost] = useState<number>(0);
  const [potentialMargin, setPotentialMargin] = useState<number>(0);
  
  const [topProducts, setTopProducts] = useState<Array<{ name: string; qty: number; unitPrice: number; discount: number; cost: number; margin: number }>>([]);
  const [grossMargin, setGrossMargin] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [netMargin, setNetMargin] = useState<number>(0);

  const isDesktop = deviceMode === 'pc' || deviceMode === 'tablet';

  const sDate = useMemo(() => {
    const [y, m, d] = startDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }, [startDate]);

  const eDate = useMemo(() => {
    const [y, m, d] = endDate.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }, [endDate]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const reloadReportData = async () => {
    try {
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
      const purchases = await db.purchases
        .filter(p => {
          const d = new Date(p.date as any);
          return d <= eDate;
        })
        .toArray();
      const products = await db.products.toArray();
      const expensesRows = await db.expenses
        .filter(ex => {
          const d = new Date(ex.date as any);
          return d >= sDate && d <= eDate;
        })
        .toArray();

      const txCount = sales.length;
      const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);

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

      const productNameById: Record<string, string> = {};
      for (const p of products) productNameById[p.id] = p.name;

      const totalQtyCost = items.reduce((sum, it) => {
        const pname = productNameById[it.productId] || '';
        const cost = avgCostByName[pname] || 0;
        const multiplier = getUnitMultiplier((it as any).unit || 'pieces');
        return sum + cost * (it.quantity || 0) * multiplier;
      }, 0);

      const totalExpenses = expensesRows.reduce((sum, ex) => sum + (ex.amount || 0), 0);
      const margin = totalSales - totalQtyCost;
      const totalProfit = margin - totalExpenses;

      setTransactionCount(txCount);
      setNetSales(totalSales);
      setAvgBasketSize(txCount > 0 ? totalSales / txCount : 0);
      setCogs(totalQtyCost);
      setExpenses(totalExpenses);
      setProfit(totalProfit);

      const invPrice = products.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 0), 0);
      const invCost = products.reduce((sum, p) => {
        const cost = avgCostByName[p.name] || 0;
        return sum + cost * (p.quantity || 0);
      }, 0);
      setInventoryPrice(invPrice);
      setInventoryCost(invCost);
      setPotentialMargin(invPrice - invCost);

      const perProduct: Record<string, { name: string; qty: number; unitPriceSum: number; unitPriceCount: number; discount: number; costSum: number; margin: number }> = {};
      for (const it of items) {
        const name = productNameById[it.productId] || '';
        const unitPrice = it.price || 0;
        const multiplier = getUnitMultiplier((it as any).unit || 'pieces');
        const actualQty = (it.quantity || 0) * multiplier;

        const fullPrice = products.find(p => p.id === it.productId)?.price || unitPrice;
        const discount = Math.max(0, fullPrice - unitPrice) * actualQty;
        const cost = (avgCostByName[name] || 0) * actualQty;
        const lineMargin = (unitPrice - (avgCostByName[name] || 0)) * actualQty;

        if (!perProduct[name]) perProduct[name] = { name, qty: 0, unitPriceSum: 0, unitPriceCount: 0, discount: 0, costSum: 0, margin: 0 };
        perProduct[name].qty += actualQty;
        perProduct[name].unitPriceSum += unitPrice;
        perProduct[name].unitPriceCount += 1;
        perProduct[name].discount += discount;
        perProduct[name].costSum += cost;
        perProduct[name].margin += lineMargin;
      }
      const rows = Object.values(perProduct)
        .map(r => ({
          name: r.name,
          qty: r.qty,
          unitPrice: r.unitPriceCount ? r.unitPriceSum / r.unitPriceCount : 0,
          discount: r.discount,
          cost: r.costSum,
          margin: r.margin,
        }))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 20);
      setTopProducts(rows);
      const gMargin = rows.reduce((sum, r) => sum + r.margin, 0);
      const dTotal = rows.reduce((sum, r) => sum + r.discount, 0);
      setGrossMargin(gMargin);
      setDiscountTotal(dTotal);
      const nMargin = gMargin - serviceFee - deliveryFee - dTotal;
      setNetMargin(nMargin);
    } catch (err) {
      console.error("Failed to load report data:", err);
    }
  };

  useEffect(() => { reloadReportData(); }, [startDate, endDate]);

  const setDurationPreset = (preset: 'today'|'week'|'month'|'custom') => {
    setDuration(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = new Date().toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'week') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now); monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Report Period', `${startDate} to ${endDate}`],
      ['Generated At', new Date().toLocaleString()],
      ['', ''],
      ['KPI Metrics', 'Value'],
      ['Transaction Count', String(transactionCount)],
      ['Avg Basket Size', String(avgBasketSize.toFixed(2))],
      ['Net Sales', String(netSales.toFixed(2))],
      ['COGS', String(cogs.toFixed(2))],
      ['Gross Margin', String((netSales - cogs).toFixed(2))],
      ['Total Expenses', String(expenses.toFixed(2))],
      ['Net Profit', String(profit.toFixed(2))],
      ['', ''],
      ['Top Products', 'Quantity', 'Sales Value', 'Margin'],
      ...topProducts.map(p => [p.name, p.qty, (p.qty * p.unitPrice).toFixed(2), p.margin.toFixed(2)])
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `SmartPOS_Business_Report_${startDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout showNavigation={false}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Modern Header */}
        <div className="bg-slate-900 pt-8 pb-12 px-6 rounded-b-[3rem] relative overflow-hidden flex-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 blur-2xl" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="flex items-center justify-between mb-8">
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
                  <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.3em]">Analytics</p>
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Business Insights</h1>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="bg-white/10 border-white/10 text-white hover:bg-white/20 h-11 px-4 rounded-xl hidden md:flex items-center gap-2"
                  onClick={() => setLocation('/stock-insights')}
                >
                  <BarChart3 className="w-4 h-4" />
                  Stock
                </Button>
                <Button 
                  variant="outline" 
                  className="bg-white/10 border-white/10 text-white hover:bg-white/20 h-11 px-4 rounded-xl hidden md:flex items-center gap-2"
                  onClick={() => setLocation('/sales-summary')}
                >
                  <LineChart className="w-4 h-4" />
                  Trends
                </Button>
                <Button 
                  onClick={exportCSV}
                  className="bg-[#BF953F] hover:bg-[#B38728] text-white rounded-xl px-5 h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#BF953F]/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-white/5 backdrop-blur-md p-2 rounded-[2rem] border border-white/10">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                {['today', 'week', 'month', 'custom'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setDurationPreset(p as any)}
                    className={cn(
                      "h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                      duration === p ? "bg-[#BF953F] text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-2xl border border-white/5 w-full md:w-auto">
                <Calendar className="w-4 h-4 text-[#BF953F]" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">{startDate}</span>
                <span className="text-white/20 mx-1">→</span>
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">{endDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* KPI Cards */}
            {[
              { label: 'Transactions', value: transactionCount, icon: ShoppingCart, color: 'blue', desc: 'Total sales count' },
              { label: 'Avg. Basket', value: formatCurrency(avgBasketSize), icon: LayoutDashboard, color: 'purple', desc: 'Sales per order' },
              { label: 'Net Sales', value: formatCurrency(netSales), icon: TrendingUp, color: 'emerald', desc: 'Total revenue' },
              { label: 'Net Profit', value: formatCurrency(profit), icon: DollarSign, color: 'amber', desc: 'Revenue - Costs' }
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col group hover:shadow-xl hover:shadow-slate-200/50 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", `bg-${kpi.color}-50`)}>
                    <kpi.icon className={cn("w-6 h-6", `text-${kpi.color}-500`)} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{kpi.value}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-auto">{kpi.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            {/* Detailed Financial Breakdown */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-6 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#BF953F]" />
                  Profit & Loss Statement
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Revenue</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(netSales)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">Incoming</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                          <Package className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">COGS (Direct Costs)</span>
                      </div>
                      <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(cogs)}</p>
                      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(cogs / netSales) * 100}%` }}
                          className="h-full bg-amber-500"
                        />
                      </div>
                    </div>

                    <div className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Operating Expenses</span>
                      </div>
                      <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(expenses)}</p>
                      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(expenses / netSales) * 100}%` }}
                          className="h-full bg-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#BF953F]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="relative z-10">
                      <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.2em] mb-2">Net Bottom Line</p>
                      <h3 className="text-3xl font-black tracking-tighter">Net Profit: {formatCurrency(profit)}</h3>
                    </div>
                    <div className="relative z-10 text-right">
                      <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Margin Percentage</div>
                      <div className="text-xl font-black text-[#BF953F]">{netSales > 0 ? ((profit / netSales) * 100).toFixed(1) : 0}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Products Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-6 flex items-center gap-2 flex-none">
                  <TrendingUp className="w-4 h-4 text-[#BF953F]" />
                  Product Velocity
                </h2>
                
                <div className="space-y-4 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                  {topProducts.map((product, i) => (
                    <div key={product.name} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold text-slate-800 line-clamp-1 flex-1 pr-2">{product.name}</span>
                        <span className="text-[10px] font-black text-[#BF953F]">{product.qty} units</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Revenue: {formatCurrency(product.qty * product.unitPrice)}</span>
                        <span className="text-emerald-500">+{((product.margin / (product.qty * product.unitPrice)) * 100).toFixed(0)}% Margin</span>
                      </div>
                    </div>
                  ))}
                  {topProducts.length === 0 && (
                    <div className="text-center py-20 opacity-40">
                      <p className="text-[10px] font-black uppercase tracking-widest">No Sales Data</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white overflow-hidden relative group cursor-pointer" onClick={() => setLocation('/stock-insights')}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#BF953F]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BF953F] mb-4">Inventory Value</h3>
                <div className="space-y-1 mb-4 relative z-10">
                  <p className="text-2xl font-black tracking-tighter">{formatCurrency(inventoryPrice)}</p>
                  <p className="text-[9px] font-bold text-white/40 uppercase">Potential Retail Value</p>
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(potentialMargin)}</p>
                    <p className="text-[8px] font-black text-white/20 uppercase">Est. Margin</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#BF953F] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
