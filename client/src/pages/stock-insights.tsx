import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Calendar, ChevronDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/db';
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
    <Layout>
      <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Back Button */}
        <div className="flex items-center mb-4">
            <Button 
              variant="ghost" 
              className="mr-2 px-2"
              onClick={() => setLocation('/admin-main')}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Stock Insights</h1>
        </div>

        {/* Inventory Price & Cost Containers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
                <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">Inventory Price</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(inventoryPrice)}</p>
            </Card>
            <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
                <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">Inventory Cost</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(inventoryCost)}</p>
            </Card>
        </div>

        {/* Potential Sales Margin Container */}
        <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
            <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-2">Potential Sales Margin</h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(potentialMargin)}</p>
        </Card>

        {/* Calendar Selectors */}
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 ml-1">Start Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 ml-1">End Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
        </div>

        {/* Preset Dropdown Container */}
        <div className="flex justify-end">
            <div className="relative">
                <Button 
                    variant="outline" 
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 min-w-[150px] justify-between"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                    <span>{selectedPreset}</span>
                    <ChevronDown className="w-4 h-4" />
                </Button>
                
                {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
                        {["Today", "Last day", "This week", "Last week", "This Month", "Last Month", "Single Day", "Using Date Range"].map((option) => (
                            <button
                                key={option}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={() => handlePresetChange(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
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
    </Layout>
  );
}
