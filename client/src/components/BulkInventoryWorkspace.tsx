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
  AlertCircle,
  ScanLine,
  Minus,
  FileText
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
  const [isNewlyScannedPlaceholder, setIsNewlyScannedPlaceholder] = useState(false);
  
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
            title: "Product Added",
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
        // Brand new product scan - require name entry before next scan
        const newLine: BulkLineInput = {
          productId: null,
          variantId: null,
          barcode: barcodeTrimmed,
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
        setEditingIndex(0);
        setEditLine(newLine);
        setIsNewlyScannedPlaceholder(true);
        toast({
          title: "New Product",
          description: `Enter name for barcode ${barcodeTrimmed} to proceed.`,
        });
      }
    } catch (err) {
      console.error('Scan handling error:', err);
    } finally {
      setScanValue('');
      if (editingIndex === null) {
        setTimeout(() => scanInputRef.current?.focus(), 50);
      }
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
    setEditingIndex(0);
    setEditLine(newLine);
  };

  // Line Actions
  const handleRemoveLine = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdjustQuantity = (index: number, delta: number) => {
    setItems(prev => {
      const next = [...prev];
      const newQty = Math.max(1, next[index].quantity + delta);
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    setEditLine({ ...items[index] });
    setIsNewlyScannedPlaceholder(false);
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
    setIsNewlyScannedPlaceholder(false);
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    if (isNewlyScannedPlaceholder && editingIndex !== null) {
      setItems(prev => prev.filter((_, i) => i !== editingIndex));
      toast({
        title: "Item Removed",
        description: "New product was removed since no name was entered.",
      });
    }
    setEditingIndex(null);
    setEditLine(null);
    setIsNewlyScannedPlaceholder(false);
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

      await BulkInventoryService.submitBulkInventory(payload);

      toast({
        title: "Inventory Updated",
        description: `Successfully received ${items.length} product(s) (${totalUnits} total units).`,
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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <DialogHeader className="p-5 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex-none">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Bulk Inventory Intake
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Continuous Intake
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Scan barcodes or add items manually to update stock levels</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (items.length > 0) setShowCancelConfirm(true);
                else onClose();
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Supplier & Delivery Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={supplierCompany}
                onChange={e => setSupplierCompany(e.target.value)}
                placeholder="Supplier Name / Distributor (Optional)"
                className="pl-9 h-9 bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#FF8882]"
              />
            </div>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Invoice No. / PO Reference / Remarks (Optional)"
                className="pl-9 h-9 bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#FF8882]"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Scanner Bar */}
        <div className="p-3.5 sm:px-6 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <form onSubmit={handleScanSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <ScanLine className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400",
                editingIndex === null && "text-[#FF8882]"
              )} />
              <Input
                ref={scanInputRef}
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                disabled={editingIndex !== null}
                placeholder={editingIndex !== null ? "Complete product details below first..." : "Scan or type barcode, then press Enter..."}
                className={cn(
                  "h-10 pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#FF8882] focus:ring-1 focus:ring-[#FF8882]",
                  editingIndex !== null && "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
                )}
              />
            </div>
            <Button
              type="submit"
              disabled={editingIndex !== null || !scanValue.trim()}
              className="h-10 px-4 rounded-xl bg-[#FF8882] hover:bg-[#ff7770] text-white font-medium text-xs shadow-sm transition-all"
            >
              Add Item
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddManualLine}
            disabled={editingIndex !== null}
            className="h-10 px-3 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Line</span>
          </Button>
        </div>

        {/* Continuous Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/30">
          {items.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/60 dark:bg-slate-900/40">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                <Barcode className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No items scanned yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Scan barcodes with a hardware scanner or click <strong>Manual Line</strong> to begin adding items to this intake session.
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
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          #{lineNumber}
                        </span>
                        {item.isNewProduct ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                            New Product
                          </span>
                        ) : item.isVariant ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                            Variant
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Existing
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {item.barcode}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {item.productName || 'Untitled Item'}
                      </h4>

                      {item.supplierCompanyOverride && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Supplier: <span className="font-medium text-slate-700 dark:text-slate-300">{item.supplierCompanyOverride}</span>
                        </p>
                      )}
                    </div>

                    {/* Numeric Controls & Values */}
                    <div className="flex items-center gap-4 sm:gap-6 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-700/60">
                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(idx, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-900 dark:text-white min-w-[24px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(idx, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Unit Cost */}
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-slate-400 block">Cost</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">₱{Number(item.cost).toFixed(2)}</span>
                      </div>

                      {/* Selling Price */}
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-slate-400 block">Price</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">₱{Number(item.sellingPrice).toFixed(2)}</span>
                      </div>

                      {/* Subtotal */}
                      <div className="text-right min-w-[64px]">
                        <span className="text-[10px] font-medium text-slate-400 block">Subtotal</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">₱{lineTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 pl-1 border-l border-slate-200/80 dark:border-slate-700/60">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(idx)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLine(idx)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex-none flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-around sm:justify-start">
            <div>
              <span className="text-[10px] font-medium text-slate-400 block">Total Items</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{totalItemsCount}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-[10px] font-medium text-slate-400 block">Total Units</span>
              <span className="text-sm font-bold text-[#FF8882]">{totalUnits}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-[10px] font-medium text-slate-400 block">Batch Value</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (items.length > 0) setShowCancelConfirm(true);
                else onClose();
              }}
              className="flex-1 sm:flex-none h-10 px-4 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium"
            >
              Clear Session
            </Button>
            <Button
              type="button"
              disabled={items.length === 0 || isSubmitting}
              onClick={() => setShowSubmitConfirm(true)}
              className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-[#FF8882] hover:bg-[#ff7770] text-white font-medium text-xs shadow-sm transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Save to Inventory'}
            </Button>
          </div>
        </div>

        {/* Edit Line Dialog */}
        <Dialog open={editingIndex !== null} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
          <DialogContent className="rounded-2xl p-6 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl">
            <DialogHeader className="mb-3">
              <DialogTitle className="text-base font-semibold">
                {isNewlyScannedPlaceholder ? "Enter Product Name" : "Edit Item Details"}
              </DialogTitle>
            </DialogHeader>

            {editLine && (
              <div className="space-y-3.5">
                {isNewlyScannedPlaceholder && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      Barcode <strong>{editLine.barcode}</strong> is not yet in the catalog. Enter the name below to register it.
                    </p>
                  </div>
                )}
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Product Name {isNewlyScannedPlaceholder && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    value={editLine.productName}
                    onChange={e => setEditLine({ ...editLine, productName: e.target.value })}
                    autoFocus={isNewlyScannedPlaceholder}
                    className={cn(
                      "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs",
                      isNewlyScannedPlaceholder && "border-amber-400 focus:ring-amber-400"
                    )}
                    placeholder="e.g. Puregold Detergent 500g"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Barcode</Label>
                    <Input
                      value={editLine.barcode}
                      onChange={e => setEditLine({ ...editLine, barcode: e.target.value })}
                      className="h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Quantity Added</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editLine.quantity}
                      onChange={e => setEditLine({ ...editLine, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-[#FF8882]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Cost Price (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editLine.cost}
                      onChange={e => setEditLine({ ...editLine, cost: parseFloat(e.target.value) || 0 })}
                      className="h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Selling Price (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editLine.sellingPrice}
                      onChange={e => setEditLine({ ...editLine, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Supplier Override (Optional)</Label>
                  <Input
                    value={editLine.supplierCompanyOverride || ''}
                    onChange={e => setEditLine({ ...editLine, supplierCompanyOverride: e.target.value })}
                    placeholder="Defaults to session supplier"
                    className="h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updatePriceCostCheck"
                    checked={editLine.updateProductPriceCost}
                    onChange={e => setEditLine({ ...editLine, updateProductPriceCost: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-[#FF8882] focus:ring-0"
                  />
                  <label htmlFor="updatePriceCostCheck" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    Update master catalog price and cost with these values
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1 h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                {isNewlyScannedPlaceholder ? "Discard Item" : "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 h-9 rounded-xl bg-[#FF8882] hover:bg-[#ff7770] text-white text-xs font-medium"
              >
                {isNewlyScannedPlaceholder ? "Save & Continue" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Discard Confirmation Dialog */}
        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent className="rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">Discard Bulk Inventory Session?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                You have {items.length} pending items in this session. Discarding will clear the list without making changes to the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex gap-2">
              <AlertDialogCancel className="flex-1 h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-medium">
                Keep Editing
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setItems([]);
                  setShowCancelConfirm(false);
                  onClose();
                }}
                className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
              >
                Discard Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Submit Confirmation Dialog */}
        <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <AlertDialogContent className="rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl">
            <AlertDialogHeader>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 mx-auto">
                <PackageCheck className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base font-semibold text-center">
                Confirm Inventory Update
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Are you ready to commit <strong className="text-slate-800 dark:text-slate-200">{totalItemsCount} product(s)</strong> ({totalUnits} units) totaling <strong className="text-slate-900 dark:text-white">₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> to your inventory?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex gap-2">
              <AlertDialogCancel className="flex-1 h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-medium">
                Review Items
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 h-9 rounded-xl bg-[#FF8882] hover:bg-[#ff7770] text-white text-xs font-medium"
              >
                {isSubmitting ? 'Saving...' : 'Confirm & Commit'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
