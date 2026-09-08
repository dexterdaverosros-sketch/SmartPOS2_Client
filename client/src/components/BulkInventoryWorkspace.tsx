import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Barcode, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  Building2, 
  PackageCheck, 
  Boxes, 
  Sparkles, 
  AlertCircle,
  ScanLine,
  ArrowRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db, BulkInventoryService } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { BulkLineInput, Product, Variant } from '@shared/schema';

interface BulkInventoryWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkInventoryWorkspace: React.FC<BulkInventoryWorkspaceProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Session Header State
  const [supplierCompany, setSupplierCompany] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  
  // Scanned Lines
  const [items, setItems] = useState<BulkLineInput[]>([]);
  
  // Scanner Input State
  const [scanValue, setScanValue] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // Editing Modal State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editLine, setEditLine] = useState<BulkLineInput | null>(null);
  
  // Confirmations
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-focus scanner on mount / dialog open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Handle Barcode Scan / Enter
  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const barcodeTrimmed = scanValue.trim();
    if (!barcodeTrimmed) return;

    try {
      // 1. Check local Dexie for existing product or variant
      const matchingProd = await db.products.where('barcode').equals(barcodeTrimmed).first();
      let matchingVar: Variant | undefined;
      
      if (!matchingProd) {
        matchingVar = await db.variants.where('barcode').equals(barcodeTrimmed).first();
      }

      if (matchingProd) {
        // Check if already in current list
        const existingIdx = items.findIndex(i => i.productId === matchingProd.id && !i.isVariant);
        if (existingIdx >= 0) {
          // Increment quantity of existing line
          setItems(prev => {
            const next = [...prev];
            next[existingIdx] = {
              ...next[existingIdx],
              quantity: next[existingIdx].quantity + 1
            };
            return next;
          });
          toast({
            title: "Stock Incremented",
            description: `Increased quantity for ${matchingProd.name} (+1)`,
          });
        } else {
          // Add new line for existing product
          const newLine: BulkLineInput = {
            productId: matchingProd.id,
            variantId: null,
            barcode: matchingProd.barcode || barcodeTrimmed,
            productName: matchingProd.name,
            description: matchingProd.description || null,
            sellingPrice: matchingProd.price,
            cost: (matchingProd as any).cost ?? 0,
            quantity: 1,
            supplierCompanyOverride: supplierCompany.trim() || null,
            notes: null,
            isVariant: false,
            isNewProduct: false,
            updateProductPriceCost: false
          };
          setItems(prev => [newLine, ...prev]);
          toast({
            title: "Existing Product Added",
            description: `${matchingProd.name} (Current Stock: ${matchingProd.quantity})`,
          });
        }
      } else if (matchingVar) {
        const existingIdx = items.findIndex(i => i.variantId === matchingVar!.id);
        if (existingIdx >= 0) {
          setItems(prev => {
            const next = [...prev];
            next[existingIdx] = {
              ...next[existingIdx],
              quantity: next[existingIdx].quantity + 1
            };
            return next;
          });
        } else {
          const parentProd = await db.products.get(matchingVar.productId);
          const newLine: BulkLineInput = {
            productId: matchingVar.productId,
            variantId: matchingVar.id,
            barcode: matchingVar.barcode || barcodeTrimmed,
            productName: `${parentProd?.name || 'Product'} (${matchingVar.name})`,
            description: null,
            sellingPrice: matchingVar.price,
            cost: matchingVar.cost,
            quantity: 1,
            supplierCompanyOverride: supplierCompany.trim() || null,
            notes: null,
            isVariant: true,
            isNewProduct: false,
            updateProductPriceCost: false
          };
          setItems(prev => [newLine, ...prev]);
        }
      } else {
        // Brand new product scan
        const newLine: BulkLineInput = {
          productId: null,
          variantId: null,
          barcode: barcodeTrimmed,
          productName: `New Item (${barcodeTrimmed})`,
          description: null,
          sellingPrice: 0,
          cost: 0,
          quantity: 1,
          supplierCompanyOverride: supplierCompany.trim() || null,
          notes: null,
          isVariant: false,
          isNewProduct: true,
          updateProductPriceCost: true
        };
        setItems(prev => [newLine, ...prev]);
        toast({
          title: "New Product Scanned",
          description: `Barcode ${barcodeTrimmed} not found in catalog. Created new entry card.`,
        });
      }
    } catch (err) {
      console.error('Scan handling error:', err);
    } finally {
      setScanValue('');
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  // Add Manual Blank Line
  const handleAddManualLine = () => {
    const defaultBarcode = `GEN-${Date.now().toString().slice(-6)}`;
    const newLine: BulkLineInput = {
      productId: null,
      variantId: null,
      barcode: defaultBarcode,
      productName: '',
      description: null,
      sellingPrice: 0,
      cost: 0,
      quantity: 1,
      supplierCompanyOverride: supplierCompany.trim() || null,
      notes: null,
      isVariant: false,
      isNewProduct: true,
      updateProductPriceCost: true
    };
    setItems(prev => [newLine, ...prev]);
    // Immediately open editor for manual entry
    setEditingIndex(0);
    setEditLine(newLine);
  };

  // Line Actions
  const handleRemoveLine = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    setEditLine({ ...items[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editLine) return;
    if (!editLine.productName.trim()) {
      toast({ title: "Name Required", description: "Product name cannot be empty", variant: "destructive" });
      return;
    }
    if (editLine.quantity <= 0) {
      toast({ title: "Invalid Quantity", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }

    setItems(prev => {
      const next = [...prev];
      next[editingIndex] = editLine;
      return next;
    });
    setEditingIndex(null);
    setEditLine(null);
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Final Commit
  const handleConfirmSubmit = async () => {
    if (items.length === 0) {
      toast({ title: "Empty Batch", description: "Please scan or add at least one item", variant: "destructive" });
      return;
    }

    // Validation check across all items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productName.trim()) {
        toast({ title: "Missing Name", description: `Item #${items.length - i} is missing a product name`, variant: "destructive" });
        return;
      }
      if (it.quantity <= 0) {
        toast({ title: "Invalid Quantity", description: `Item #${items.length - i} quantity must be > 0`, variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`;
      const payload = {
        idempotencyKey,
        tenantId: user?.tenantId || '',
        supplierCompany: supplierCompany.trim() || undefined,
        notes: sessionNotes.trim() || undefined,
        items
      };

      const result = await BulkInventoryService.submitBulkInventory(payload);

      toast({
        title: "Bulk Inventory Added!",
        description: `Successfully processed ${items.length} items (${totalUnits} total units).`,
      });

      // Reset and close
      setItems([]);
      setSupplierCompany('');
      setSessionNotes('');
      setShowSubmitConfirm(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Bulk submission error:', err);
      toast({
        title: "Submission Failed",
        description: err?.message || "Failed to commit bulk inventory",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Totals Calculation
  const totalItemsCount = items.length;
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalCost = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost || 0)), 0);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        if (items.length > 0) setShowCancelConfirm(true);
        else onClose();
      }
    }}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-slate-900 text-white">
        {/* Top Header */}
        <DialogHeader className="p-6 sm:p-8 bg-slate-950 border-b border-white/10 flex-none relative">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BF953F]/10 border border-[#BF953F]/20 flex items-center justify-center text-[#BF953F]">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  Continuous Bulk Inventory
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#BF953F] text-black">RAPID SCAN</span>
                </DialogTitle>
                <p className="text-xs text-slate-400 font-medium">Scan delivery items continuously or enter details line-by-line</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (items.length > 0) setShowCancelConfirm(true);
                else onClose();
              }}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Supplier & Delivery Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/5">
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={supplierCompany}
                onChange={e => setSupplierCompany(e.target.value)}
                placeholder="Session Supplier Company (e.g. ABC Distro)"
                className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:border-[#BF953F]"
              />
            </div>
            <div>
              <Input
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Session Notes / PO / Invoice Ref (Optional)"
                className="h-11 bg-white/5 border-white/10 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:border-[#BF953F]"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Scanner Bar */}
        <div className="p-4 sm:px-8 bg-slate-900/90 border-b border-white/10 flex items-center gap-3">
          <form onSubmit={handleScanSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#BF953F] animate-pulse" />
              <Input
                ref={scanInputRef}
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                placeholder="Scan Barcode with hardware scanner or press Enter..."
                className="h-13 pl-12 bg-white/5 border-white/15 rounded-2xl text-sm font-black text-white tracking-wider placeholder:text-slate-500 focus:border-[#BF953F] focus:ring-2 focus:ring-[#BF953F]/20"
              />
            </div>
            <Button
              type="submit"
              className="h-13 px-6 rounded-2xl bg-gradient-to-r from-[#BF953F] to-[#AA771C] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#BF953F]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Add Item
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddManualLine}
            className="h-13 px-4 rounded-2xl border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Line</span>
          </Button>
        </div>

        {/* Continuous Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-3 custom-scrollbar bg-slate-950/50">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/10 rounded-3xl">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 text-slate-500">
                <Barcode className="w-8 h-8 text-[#BF953F]" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-slate-200">No Items Scanned Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Scan product barcodes using your external USB/Bluetooth barcode scanner or click <strong>Manual Line</strong> to begin receiving inventory.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {items.map((item, idx) => {
                const lineNumber = items.length - idx;
                const lineTotalCost = Number(item.quantity || 0) * Number(item.cost || 0);

                return (
                  <motion.div
                    key={`${item.barcode}-${idx}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Item Identity & Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#BF953F] text-black uppercase">
                          Item #{lineNumber}
                        </span>
                        {item.isNewProduct ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            NEW PRODUCT
                          </span>
                        ) : item.isVariant ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            VARIANT
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            EXISTING PRODUCT
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          Barcode: {item.barcode}
                        </span>
                      </div>

                      <h4 className="font-black text-sm uppercase text-white tracking-tight line-clamp-1">
                        {item.productName || 'Untitled Product'}
                      </h4>

                      {item.supplierCompanyOverride && (
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                          Supplier: <span className="text-slate-200">{item.supplierCompanyOverride}</span>
                        </p>
                      )}
                    </div>

                    {/* Numeric Matrix */}
                    <div className="flex items-center gap-6 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Qty Added</span>
                        <span className="text-base font-black text-[#BF953F]">+{item.quantity}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Unit Cost</span>
                        <span className="text-xs font-bold text-slate-200">₱{Number(item.cost).toFixed(2)}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Selling Price</span>
                        <span className="text-xs font-bold text-slate-200">₱{Number(item.sellingPrice).toFixed(2)}</span>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Subtotal</span>
                        <span className="text-sm font-black text-emerald-400">₱{lineTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      {/* Line Buttons */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(idx)}
                          className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLine(idx)}
                          className="h-9 w-9 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Bottom Summary Bar & Commit Action */}
        <div className="p-6 bg-slate-950 border-t border-white/10 flex-none flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 w-full sm:w-auto justify-around sm:justify-start">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Items</span>
              <span className="text-xl font-black text-white">{totalItemsCount}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Units</span>
              <span className="text-xl font-black text-[#BF953F]">{totalUnits}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Batch Cost</span>
              <span className="text-xl font-black text-emerald-400">₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (items.length > 0) setShowCancelConfirm(true);
                else onClose();
              }}
              className="flex-1 sm:flex-none h-14 px-6 rounded-2xl border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={items.length === 0 || isSubmitting}
              onClick={() => setShowSubmitConfirm(true)}
              className="flex-1 sm:flex-none h-14 px-8 rounded-2xl bg-gradient-to-r from-[#BF953F] to-[#AA771C] text-black font-black uppercase tracking-widest text-xs shadow-xl shadow-[#BF953F]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isSubmitting ? 'Adding...' : 'Add to Inventory'}
            </Button>
          </div>
        </div>

        {/* Edit Line Dialog */}
        <Dialog open={editingIndex !== null} onOpenChange={(open) => { if (!open) setEditingIndex(null); }}>
          <DialogContent className="rounded-[2.5rem] p-8 max-w-md bg-slate-900 border border-white/15 text-white">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Item Details</DialogTitle>
            </DialogHeader>

            {editLine && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Name</Label>
                  <Input
                    value={editLine.productName}
                    onChange={e => setEditLine({ ...editLine, productName: e.target.value })}
                    className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Barcode</Label>
                    <Input
                      value={editLine.barcode}
                      onChange={e => setEditLine({ ...editLine, barcode: e.target.value })}
                      className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quantity (+Units)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editLine.quantity}
                      onChange={e => setEditLine({ ...editLine, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-11 bg-white/5 border-white/10 rounded-xl text-[#BF953F] font-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cost (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editLine.cost}
                      onChange={e => setEditLine({ ...editLine, cost: parseFloat(e.target.value) || 0 })}
                      className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selling Price (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editLine.sellingPrice}
                      onChange={e => setEditLine({ ...editLine, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Supplier Override (Optional)</Label>
                  <Input
                    value={editLine.supplierCompanyOverride || ''}
                    onChange={e => setEditLine({ ...editLine, supplierCompanyOverride: e.target.value })}
                    placeholder="Defaults to session supplier"
                    className="h-11 bg-white/5 border-white/10 rounded-xl text-white font-bold text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updatePriceCostCheck"
                    checked={editLine.updateProductPriceCost}
                    onChange={e => setEditLine({ ...editLine, updateProductPriceCost: e.target.checked })}
                    className="w-4 h-4 rounded text-[#BF953F] focus:ring-0 bg-white/10 border-white/20"
                  />
                  <label htmlFor="updatePriceCostCheck" className="text-xs font-medium text-slate-300 cursor-pointer">
                    Update master product selling price & cost in catalog
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingIndex(null)}
                className="flex-1 h-12 rounded-xl border-white/15 bg-white/5 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 h-12 rounded-xl bg-[#BF953F] text-black font-black uppercase text-xs"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Discard Confirmation Dialog */}
        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent className="rounded-[2.5rem] p-8 border-none bg-slate-900 text-white shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Discard Bulk Inventory?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 font-medium">
                You have {items.length} pending items in this bulk inventory session. Discarding will not modify your database inventory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex gap-3">
              <AlertDialogCancel className="flex-1 h-12 rounded-xl border-white/15 bg-white/5 text-slate-300 font-black uppercase text-xs">
                Keep Editing
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setItems([]);
                  setShowCancelConfirm(false);
                  onClose();
                }}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs"
              >
                Discard Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Submit Confirmation Dialog */}
        <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <AlertDialogContent className="rounded-[2.5rem] p-8 border-none bg-slate-900 text-white shadow-2xl">
            <AlertDialogHeader>
              <div className="w-14 h-14 rounded-2xl bg-[#BF953F]/10 border border-[#BF953F]/20 flex items-center justify-center text-[#BF953F] mb-3 mx-auto">
                <PackageCheck className="w-7 h-7" />
              </div>
              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight text-center">
                Confirm Bulk Inventory Addition
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-center font-medium">
                Are you ready to add <strong className="text-white">{totalItemsCount} inventory items</strong> ({totalUnits} total units) for a total cost of <strong className="text-emerald-400">₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex gap-3">
              <AlertDialogCancel className="flex-1 h-12 rounded-xl border-white/15 bg-white/5 text-slate-300 font-black uppercase text-xs">
                Review Items
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#BF953F] to-[#AA771C] text-black font-black uppercase text-xs shadow-lg shadow-[#BF953F]/20"
              >
                {isSubmitting ? 'Committing...' : 'Yes, Add to Inventory'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
