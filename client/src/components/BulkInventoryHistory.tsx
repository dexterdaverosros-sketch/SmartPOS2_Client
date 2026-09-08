import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  Search, 
  Calendar, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  Package, 
  FileText, 
  User, 
  Clock, 
  ArrowUpDown,
  Filter,
  RefreshCw,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BulkInventoryService } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BulkInventoryHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkInventoryHistory: React.FC<BulkInventoryHistoryProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();

  // Filter States
  const [reference, setReference] = useState('');
  const [supplier, setSupplier] = useState('');
  const [productName, setProductName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination & Data States
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Detail View State
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    transaction: any;
    items: any[];
    createdByName?: string;
    summary?: any;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const loadHistory = async (targetPage = page) => {
    setIsLoading(true);
    try {
      const res = await BulkInventoryService.getBulkInventoryHistory({
        page: targetPage,
        size: pageSize,
        reference: reference.trim() || undefined,
        supplier: supplier.trim() || undefined,
        productName: productName.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });

      setRows(res.rows || []);
      setTotalRecords(res.total || 0);
      setPage(res.page || targetPage);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load bulk inventory history:', err);
      toast({
        title: "Load Failed",
        description: "Failed to fetch bulk inventory history records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory(1);
    }
  }, [isOpen]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadHistory(1);
  };

  const handleClearFilters = () => {
    setReference('');
    setSupplier('');
    setProductName('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setTimeout(() => {
      BulkInventoryService.getBulkInventoryHistory({ page: 1, size: pageSize }).then(res => {
        setRows(res.rows || []);
        setTotalRecords(res.total || 0);
        setPage(1);
        setTotalPages(res.totalPages || 1);
      });
    }, 50);
  };

  const handleOpenDetail = async (id: string) => {
    setSelectedTxId(id);
    setIsLoadingDetail(true);
    try {
      const data = await BulkInventoryService.getBulkInventoryById(id);
      setDetailData(data);
    } catch (err) {
      console.error('Failed to load detail:', err);
      toast({
        title: "Error",
        description: "Could not load transaction details",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-slate-900 text-white">
        {/* Header */}
        <DialogHeader className="p-6 sm:p-8 bg-slate-950 border-b border-white/10 flex-none relative">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BF953F]/10 border border-[#BF953F]/20 flex items-center justify-center text-[#BF953F]">
                <History className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  Bulk Inventory History
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                    AUDIT LOG
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-400 font-medium">Historical audit records of all bulk receiving deliveries</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar */}
          <form onSubmit={handleApplyFilter} className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-4 border-t border-white/5">
            <div>
              <Input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Search Reference (BI-...)"
                className="h-10 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:border-[#BF953F]"
              />
            </div>
            <div>
              <Input
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Filter by Supplier"
                className="h-10 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:border-[#BF953F]"
              />
            </div>
            <div>
              <Input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="Filter by Product Name"
                className="h-10 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:border-[#BF953F]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-10 bg-white/5 border-white/10 rounded-xl text-[11px] font-bold text-white focus:border-[#BF953F] px-2"
                title="From Date"
              />
              <span className="text-xs text-slate-500">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-10 bg-white/5 border-white/10 rounded-xl text-[11px] font-bold text-white focus:border-[#BF953F] px-2"
                title="To Date"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="submit"
                className="flex-1 h-10 bg-[#BF953F] text-black font-black uppercase text-[11px] rounded-xl hover:bg-[#AA771C] transition-all"
              >
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="h-10 px-3 border-white/15 bg-white/5 text-slate-400 hover:text-white rounded-xl text-xs"
                title="Clear Filters"
              >
                Clear
              </Button>
            </div>
          </form>
        </DialogHeader>

        {/* History Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-950/40">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <RefreshCw className="w-8 h-8 text-[#BF953F] animate-spin mb-3" />
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Loading History Records...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/10 rounded-3xl">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 text-slate-500">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-slate-200">No History Records Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Deliveries entered through the Bulk Inventory workspace will automatically be recorded here with complete item snapshots.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((tx) => {
                const refNum = tx.reference_number || tx.referenceNumber || tx.id;
                const supp = tx.supplier_company || tx.supplierCompany || 'Unspecified Supplier';
                const itemsCount = tx.total_items || tx.totalItems || 0;
                const unitsCount = tx.total_units || tx.totalUnits || 0;
                const costTotal = Number(tx.total_cost || tx.totalCost || 0);
                const creator = tx.createdByName || tx.created_by || tx.createdBy || 'Admin';
                const dateStr = tx.createdAt || tx.created_at || new Date().toISOString();

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleOpenDetail(tx.id)}
                    className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#BF953F]/40 hover:bg-white/10 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#BF953F]/10 border border-[#BF953F]/20 flex items-center justify-center text-[#BF953F] group-hover:scale-105 transition-transform flex-none">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-white">{refNum}</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {tx.status || 'COMPLETED'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="font-bold text-slate-200">{supp}</span>
                          <span>•</span>
                          <span>{format(new Date(dateStr), 'MMM dd, yyyy · hh:mm a')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Items / Units</span>
                        <span className="text-xs font-black text-slate-200">{itemsCount} items ({unitsCount} units)</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Cost</span>
                        <span className="text-sm font-black text-emerald-400">₱{costTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="text-right hidden sm:block">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Received By</span>
                        <span className="text-xs font-bold text-slate-300">{creator}</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-slate-400 group-hover:text-white group-hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="p-4 sm:p-6 bg-slate-950 border-t border-white/10 flex-none flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Showing <strong className="text-white">{rows.length}</strong> of <strong className="text-white">{totalRecords}</strong> total sessions
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => loadHistory(page - 1)}
              className="h-9 px-3 rounded-xl border-white/15 bg-white/5 text-slate-300 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Prev</span>
            </Button>
            <span className="text-xs font-bold text-slate-400 px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => loadHistory(page + 1)}
              className="h-9 px-3 rounded-xl border-white/15 bg-white/5 text-slate-300 disabled:opacity-30"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Detail View Modal */}
        <Dialog open={selectedTxId !== null} onOpenChange={(open) => { if (!open) { setSelectedTxId(null); setDetailData(null); } }}>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-slate-900 text-white">
            <DialogHeader className="p-6 sm:p-8 bg-slate-950 border-b border-white/10 flex-none relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-black text-[#BF953F] px-2.5 py-0.5 rounded-lg bg-[#BF953F]/10 border border-[#BF953F]/20">
                      {detailData?.transaction?.reference_number || detailData?.transaction?.referenceNumber || selectedTxId}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {detailData?.transaction?.status || 'COMPLETED'}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
                    Bulk Delivery Session Details
                  </DialogTitle>
                </div>
                <button
                  onClick={() => { setSelectedTxId(null); setDetailData(null); }}
                  className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Transaction Meta Card */}
              {detailData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Supplier</span>
                    <span className="font-bold text-slate-200">{detailData.transaction.supplier_company || detailData.transaction.supplierCompany || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Received At</span>
                    <span className="font-bold text-slate-200">
                      {format(new Date(detailData.transaction.createdAt || detailData.transaction.created_at || new Date()), 'MMM dd, yyyy · hh:mm a')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Units</span>
                    <span className="font-black text-[#BF953F]">{detailData.summary?.totalUnits || 0} units ({detailData.summary?.totalItems || 0} items)</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Cost</span>
                    <span className="font-black text-emerald-400">₱{Number(detailData.summary?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* Item Details List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2.5 custom-scrollbar bg-slate-950/40">
              {isLoadingDetail ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <RefreshCw className="w-8 h-8 text-[#BF953F] animate-spin mb-3" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Loading item snapshot...</p>
                </div>
              ) : !detailData || !detailData.items || detailData.items.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  No line items found for this transaction.
                </div>
              ) : (
                detailData.items.map((item, idx) => {
                  const lineCostSubtotal = Number(item.quantity || 0) * Number(item.cost_snapshot || item.costSnapshot || 0);

                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-mono text-slate-400">Barcode: {item.barcode}</span>
                          {item.supplier_company_override && (
                            <span className="text-[9px] font-bold text-slate-300">({item.supplier_company_override})</span>
                          )}
                        </div>
                        <h5 className="font-black text-white uppercase text-sm truncate">
                          {item.product_name_snapshot || item.productNameSnapshot || 'Product'}
                        </h5>
                      </div>

                      <div className="flex items-center gap-6 justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Quantity</span>
                          <span className="font-black text-[#BF953F]">+{item.quantity}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Unit Cost</span>
                          <span className="font-bold text-slate-200">₱{Number(item.cost_snapshot || item.costSnapshot || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Selling Price</span>
                          <span className="font-bold text-slate-200">₱{Number(item.selling_price_snapshot || item.sellingPriceSnapshot || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Subtotal</span>
                          <span className="font-black text-emerald-400">₱{lineCostSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="p-4 bg-slate-950 border-t border-white/10 flex-none">
              <Button
                type="button"
                onClick={() => { setSelectedTxId(null); setDetailData(null); }}
                className="w-full h-12 rounded-xl bg-white/10 text-white hover:bg-white/20 font-black uppercase text-xs"
              >
                Close Details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
