import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { ArrowLeft, Calendar, ChevronDown, Search, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { 
  LineChart, Line, 
  BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, 
  ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/db';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';

export default function SalesSummary() {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDuration, setSelectedDuration] = useState<string>('This Month');
  const [durationDropdownOpen, setDurationDropdownOpen] = useState<boolean>(false);
  
  const [searchText, setSearchText] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('Date');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);

  const [rows, setRows] = useState<Array<{ date: string; dateObj: Date; totalSales: number; totalProfit: number }>>([]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const sDate = useMemo(() => new Date(startDate), [startDate]);
  const eDate = useMemo(() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; }, [endDate]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const handleDurationChange = (preset: string) => {
    setSelectedDuration(preset);
    setDurationDropdownOpen(false);
    const today = new Date();

    switch (preset) {
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
      case 'This Year':
        setStartDate(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
        setEndDate(format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd'));
        break;
      case 'Date Range':
        // User manually selects
        break;
    }
  };

  const reloadData = async () => {
    // 1. Fetch all data in range
    const sales = await db.sales
      .filter(s => { const d = new Date(s.createdAt as any); return d >= sDate && d <= eDate; })
      .toArray();
    
    const saleIds = new Set(sales.map(s => s.id));
    const items = await db.saleItems
      .filter(si => saleIds.has(si.saleId))
      .toArray();
      
    const products = await db.products.toArray();
    const productNameById: Record<string, string> = {};
    const productCatById: Record<string, string> = {}; // Assuming category exists or we mock it
    for (const p of products) {
        productNameById[p.id] = p.name;
        // productCatById[p.id] = p.category; // If category exists
    }

    // 2. Filter data based on Search
    let filteredSales = sales;
    let filteredItems = items;

    if (searchText.trim()) {
        const lowerSearch = searchText.toLowerCase();
        
        if (filterType === 'Date') {
            filteredSales = sales.filter(s => {
                const d = new Date(s.createdAt as any);
                return format(d, 'yyyy-MM-dd').includes(lowerSearch) || format(d, 'dd MMMM').toLowerCase().includes(lowerSearch);
            });
            const filteredSaleIds = new Set(filteredSales.map(s => s.id));
            filteredItems = items.filter(si => filteredSaleIds.has(si.saleId));
        } else if (filterType === 'Customer Name') {
             // Assuming customerName is on sale object or we need to join with customers
             // For now, check sale.customerName if it exists (it might not be in schema yet, but user asked for it)
             // Check schema... schema has `customerName` in `sales`? 
             // Let's assume `customerName` might be added or we fallback.
             filteredSales = sales.filter(s => (s as any).customerName?.toLowerCase().includes(lowerSearch));
             const filteredSaleIds = new Set(filteredSales.map(s => s.id));
             filteredItems = items.filter(si => filteredSaleIds.has(si.saleId));
        } else if (filterType === 'Product Name') {
            const matchingProductIds = products.filter(p => p.name.toLowerCase().includes(lowerSearch)).map(p => p.id);
            const matchingProductIdsSet = new Set(matchingProductIds);
            
            // Items that match product name
            filteredItems = items.filter(si => matchingProductIdsSet.has(si.productId));
            const saleIdsWithProduct = new Set(filteredItems.map(si => si.saleId));
            
            // Only sales containing those items
            filteredSales = sales.filter(s => saleIdsWithProduct.has(s.id));
        } else if (filterType === 'Product category') {
             // Similar to Product Name but checking category
             // Assuming category is on product
             const matchingProductIds = products.filter(p => (p as any).category?.toLowerCase().includes(lowerSearch)).map(p => p.id);
             const matchingProductIdsSet = new Set(matchingProductIds);
             
             filteredItems = items.filter(si => matchingProductIdsSet.has(si.productId));
             const saleIdsWithProduct = new Set(filteredItems.map(si => si.saleId));
             filteredSales = sales.filter(s => saleIdsWithProduct.has(s.id));
        }
    }

    // 3. Calculate Daily Aggregates
    // We need Cost for Profit. 
    // Cost strategy: Average cost from purchases or product cost.
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

    const aggregated: Record<string, { sales: number; profit: number; dateObj: Date }> = {};

    // Map filtered items to sales to get dates
    const saleDateById: Record<string, Date> = {};
    for (const s of filteredSales) {
        saleDateById[s.id] = new Date(s.createdAt as any);
    }

    // Iterate over filtered items to calculate sales and cost
    // Note: If we filtered by Product Name, `filteredItems` only has those products.
    // If we filtered by Date/Customer, `filteredItems` has all items for those sales.
    
    // However, `sales.total` includes all items. If we are filtering by product, 
    // we should probably recalculate total sales from just the matching items?
    // User request: "Search bar... filter the search bar". 
    // If I search "Apple", showing Total Sales of the *entire receipt* that contains Apple might be misleading if I only want Apple sales.
    // I will sum up `filteredItems` price for Sales, and `filteredItems` margin for Profit.
    
    for (const item of filteredItems) {
        const saleDate = saleDateById[item.saleId];
        if (!saleDate) continue; // Should not happen if logic is correct
        
        const dateKey = format(saleDate, 'yyyy-MM-dd');
        
        if (!aggregated[dateKey]) {
            aggregated[dateKey] = { sales: 0, profit: 0, dateObj: saleDate };
        }

        const name = productNameById[item.productId] || item.productId;
        const unitPrice = item.price || 0;
        const quantity = item.quantity || 0;
        const itemTotal = unitPrice * quantity;
        
        const unitCost = avgCostByName[name] || products.find(p => p.id === item.productId)?.cost || 0;
        const totalCost = unitCost * quantity;
        const itemProfit = itemTotal - totalCost;

        aggregated[dateKey].sales += itemTotal;
        aggregated[dateKey].profit += itemProfit;
    }

    const resultRows = Object.values(aggregated).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).map(r => ({
        date: format(r.dateObj, 'dd EEEE'), // "01 Monday" format
        dateObj: r.dateObj,
        totalSales: r.sales,
        totalProfit: r.profit
    }));

    setRows(resultRows);
  };

  useEffect(() => { reloadData(); }, [startDate, endDate, searchText, filterType]);

  const totalSalesSum = rows.reduce((sum, r) => sum + r.totalSales, 0);
  const totalProfitSum = rows.reduce((sum, r) => sum + r.totalProfit, 0);

  return (
    <Layout>
      <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Back Button */}
        <div className="flex items-center mb-4">
             <Button 
               variant="ghost" 
               className="mr-2 px-2"
               onClick={() => setLocation('/admin/reports')}
             >
               <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
             </Button>
             <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Sales Summary</h1>
         </div>

        {/* Duration Dropdown */}
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Select report Duration</div>
            <div className="relative w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-[200px] justify-between bg-white dark:bg-gray-700 dark:text-gray-200"
                onClick={() => setDurationDropdownOpen(!durationDropdownOpen)}
              >
                <span>{selectedDuration}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
              {durationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
                  {["This Month", "Last Month", "This Year", "Date Range"].map((opt) => (
                    <button
                        key={opt}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => handleDurationChange(opt)}
                    >
                        {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Date Selectors */}
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label htmlFor="start-date" className="text-sm text-gray-600 dark:text-gray-400 ml-1">Start Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        id="start-date"
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label htmlFor="end-date" className="text-sm text-gray-600 dark:text-gray-400 ml-1">End Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        id="end-date"
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
        </div>

        {/* Search Bar & Filter Dropdown */}
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                    placeholder={`Search by ${filterType}...`}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-800"
                />
            </div>
            <div className="relative w-full sm:w-auto">
                <Button
                    variant="outline"
                    className="w-full sm:w-[200px] justify-between bg-white dark:bg-gray-700 dark:text-gray-200"
                    onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                >
                    <span>{filterType}</span>
                    <ChevronDown className="w-4 h-4" />
                </Button>
                {filterDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-full sm:w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
                        {["Date", "Customer Name", "Product Name", "Product category"].map((opt) => (
                            <button
                                key={opt}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={() => { setFilterType(opt); setFilterDropdownOpen(false); }}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Chart Type Toggle */}
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sales Trends</h3>
            <div className="flex gap-2">
              <Button 
                variant={chartType === 'line' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setChartType('line')}
                className="flex items-center gap-2"
              >
                <LineChartIcon className="w-4 h-4" />
                Line
              </Button>
              <Button 
                variant={chartType === 'bar' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setChartType('bar')}
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Bar
              </Button>
            </div>
          </div>
          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    stroke="#6b7280" 
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="#6b7280" 
                    tickFormatter={(value) => `₱${value.toLocaleString()}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => `₱${value.toLocaleString()}`}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalSales" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Sales"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalProfit" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Profit"
                  />
                </LineChart>
              ) : (
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    stroke="#6b7280" 
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="#6b7280" 
                    tickFormatter={(value) => `₱${value.toLocaleString()}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => `₱${value.toLocaleString()}`}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Bar 
                    dataKey="totalSales" 
                    fill="#8b5cf6" 
                    name="Total Sales" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="totalProfit" 
                    fill="#10b981" 
                    name="Total Profit" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 3-Grid View Table */}
        <Card className="overflow-hidden border-none shadow-md">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <th className="px-4 py-3 text-left font-semibold">DATE</th>
                <th className="px-4 py-3 text-right font-semibold">TOTAL SALES</th>
                <th className="px-4 py-3 text-right font-semibold">TOTAL PROFIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.date}</td>
                  <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400 font-medium">{formatCurrency(r.totalSales)}</td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(r.totalProfit)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">TOTAL</td>
                <td className="px-4 py-3 text-right font-bold text-purple-700 dark:text-purple-400">{formatCurrency(totalSalesSum)}</td>
                <td className="px-4 py-3 text-right font-bold text-green-700 dark:text-green-400">{formatCurrency(totalProfitSum)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </Layout>
  );
}
