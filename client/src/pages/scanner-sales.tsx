import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls, PanInfo, AnimatePresence } from 'framer-motion';
import { Home, Trash2, CreditCard, AlertTriangle, LogOut, Search, ArrowLeft, Edit, Usb, Bluetooth, Send, ShoppingCart, AlertCircle, Package, X, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import Scanner from '@/components/Scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useDevices } from '@/contexts/DeviceContext';
import { useToast } from '@/hooks/use-toast';
import { ProductService, SalesService, AuthService, db, CreditorService, NonInventoryProductService, RemittanceService } from '@/lib/db';
import type { Product, Variant, Sale, CartItem } from '@shared/schema';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// UI-specific product type that combines inventory and non-inventory properties
interface UIProduct extends Omit<Product, 'createdAt' | 'updatedAt'> {
  isNonInventory?: boolean;
  inStock?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

const ScannerSales: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, isAdmin, isStaff, logout, socket } = useAuth();
  const { cart, addToCart, removeFromCart, updateCartItem, clearCart, getCartTotal } = useApp();
  const { deviceMode, connectedDevices, printToThermalPrinter } = useDevices();
  const { toast } = useToast();
  const dragControls = useDragControls();
  
  const [mode, setMode] = useState<'scanner' | 'manual'>('scanner');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<'pieces' | 'dozen' | 'carton'>('pieces');
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<'cash' | 'ewallet' | 'credits'>('cash');
  const [paymentError, setPaymentError] = useState(false);
  const [isCreditorDialogOpen, setIsCreditorDialogOpen] = useState(false);
  const [creditors, setCreditors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCreditor, setSelectedCreditor] = useState<{ id: string; name: string } | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  
  // Non-Inventory State
  const [isNonInventoryOpen, setIsNonInventoryOpen] = useState(false);
  const [nonInvName, setNonInvName] = useState("");
  const [nonInvPrice, setNonInvPrice] = useState("");
  const [nonInvQty, setNonInvQty] = useState("1");
  
  // Manual Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<UIProduct[]>([]);
  const [isVariantSelectionOpen, setIsVariantSelectionOpen] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<UIProduct | null>(null);
  const [productVariants, setProductVariants] = useState<Variant[]>([]);

  // Pop-up state for quantity input
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [tempQuantity, setTempQuantity] = useState<number | ''>(1);
  const [tempUnit, setTempUnit] = useState<'pieces' | 'dozen' | 'carton'>('pieces');

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQuantityStr, setEditQuantityStr] = useState('');

  // Remittance State
  const [isRemitDialogOpen, setIsRemitDialogOpen] = useState(false);
  const [remitAmount, setRemitAmount] = useState(0);
  const [remitTxCount, setRemitTxCount] = useState(0);
  const [remitTransactions, setRemitTransactions] = useState<Sale[]>([]);
  const [isRemitting, setIsRemitting] = useState(false);
  const [todaysTotal, setTodaysTotal] = useState(0);

  const [scannerSettings, setScannerSettings] = useState<{ enabled: boolean; timeout: number }>({
    enabled: true,
    timeout: 150
  });

  const [receiptSettings, setReceiptSettings] = useState<{
    storeName: string;
    storeAddress: string;
    storePhone: string;
    headerNote: string;
    footerNote: string;
    autoPrintOnSale: boolean;
    printerDeviceName: string;
    paperWidth: '58mm' | '80mm';
    showDateTime: boolean;
    showStaffName: boolean;
  }>({
    storeName: 'SmartPOS+ Store',
    storeAddress: '',
    storePhone: '',
    headerNote: 'Thank you for your purchase!',
    footerNote: 'No refunds without receipt.',
    autoPrintOnSale: false,
    printerDeviceName: '',
    paperWidth: '58mm',
    showDateTime: true,
    showStaffName: true,
  });

  const scannerBufRef = useRef<string>('');
  const bufferTimerRef = useRef<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.get('/api/settings');
        if (data.externalScanner) {
          setScannerSettings({
            enabled: data.externalScanner.enabled !== false,
            timeout: data.externalScanner.timeout || 150
          });
        }
        if (data.receipt) {
          setReceiptSettings(prev => ({ ...prev, ...data.receipt }));
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (deviceMode === 'pc') {
      setMode('manual');
    }
  }, [deviceMode]);

  const handleAddNonInventory = () => {
    if (!nonInvName || !nonInvPrice) return;
    const price = parseFloat(nonInvPrice);
    const qty = parseInt(nonInvQty) || 1;
    if (isNaN(price) || price <= 0) return;

    const newItem: CartItem = {
      productId: 'NON_INVENTORY_' + Math.random().toString(36).substr(2, 9),
      name: nonInvName,
      price: price,
      quantity: qty,
      unit: 'pieces',
      subtotal: price * qty,
      isNonInventory: true
    };
    
    addToCart(newItem);
    
    setNonInvName("");
    setNonInvPrice("");
    setNonInvQty("1");
    setIsNonInventoryOpen(false);
  };

  const handleRemitClick = async () => {
    try {
      const allSales = await SalesService.getAllSales();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter sales made by this staff today that haven't been remitted
      const staffSales = allSales.filter((s: Sale) => {
        const saleDate = s.createdAt ? new Date(s.createdAt) : new Date();
        const isToday = saleDate >= today;
        const isUser = s.staffId === user?.id || s.staffId === user?.staffId;
        const isNotRemitted = !s.remitted;
        return isUser && isToday && isNotRemitted;
      });

      const totalAmount = staffSales.reduce((sum: number, s: Sale) => sum + s.total, 0);
      setRemitAmount(totalAmount);
      setRemitTxCount(staffSales.length);
      setRemitTransactions(staffSales);
      setIsRemitDialogOpen(true);
    } catch (err) {
      console.error('Failed to calculate remittance', err);
      toast({
        title: "Error",
        description: "Failed to calculate daily total",
        variant: "destructive"
      });
    }
  };

  const syncRemittedSales = async () => {
    if (!user) return;
    try {
      // Check both ID types
      const userId = user.id || user.staffId;
      const res = await api.get<Array<{ id: string }>>(`/api/sales/remitted/${userId}`);
      if (res && Array.isArray(res)) {
        const remittedIds = res.map(s => s.id);
        if (remittedIds.length > 0) {
          const localSales = await SalesService.getAllSales();
          const toUpdate = localSales.filter(s => remittedIds.includes(s.id) && !s.remitted);
          
          if (toUpdate.length > 0) {
            for (const s of toUpdate) {
              await db.sales.update(s.id, { remitted: true });
            }
            loadTodaysTotal();
          }
        }
      }
    } catch (err) {
      console.warn('Failed to sync remitted sales status', err);
    }
  };

  const loadTodaysTotal = async () => {
    try {
      const allSales = await SalesService.getAllSales();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const total = allSales
        .filter((s: Sale) => {
          const saleDate = s.createdAt ? new Date(s.createdAt) : new Date();
          const isUser = s.staffId === user?.id || s.staffId === user?.staffId;
          const isNotRemitted = !s.remitted;
          return isUser && saleDate >= today && isNotRemitted;
        })
        .reduce((sum: number, s: Sale) => sum + s.total, 0);
      
      setTodaysTotal(total);
    } catch (err) {
      console.warn('Failed to load today\'s total', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodaysTotal();
      syncRemittedSales();
    }
  }, [user, cart]); // Reload when user changes or cart is cleared (after sale)

  useEffect(() => {
    if (socket && user) {
      const handleRemittanceConfirmed = (data: any) => {
        // Check both ID formats for compatibility
        const isTargetStaff = data.staff_id === user.id || data.staff_id === user.staffId || 
                             data.staffId === user.id || data.staffId === user.staffId;
        
        if (isTargetStaff) {
          toast({
            title: "Remittance Confirmed",
            description: "Admin has confirmed your remittance. Your daily total has been reset.",
          });
          syncRemittedSales();
        }
      };

      socket.on('remittance-confirmed', handleRemittanceConfirmed);
      return () => {
        socket.off('remittance-confirmed', handleRemittanceConfirmed);
      };
    }
  }, [socket, user]);

  useEffect(() => {
    if (mode === 'manual') {
      loadProducts();
    }
  }, [mode]);

  const loadProducts = async () => {
    try {
      // Load both inventory and non-inventory products
      const [allInventory, allNonInventory] = await Promise.all([
        ProductService.getAllProducts(),
        NonInventoryProductService.getAllNonInventoryProducts()
      ]);

      const adaptedInventory = (allInventory as unknown as Product[]).map(p => ({ 
        ...p, 
        isNonInventory: false, 
        inStock: (p.quantity ?? 0) > 0 
      }));
      const adaptedNonInventory: UIProduct[] = (allNonInventory as unknown as any[]).map(p => ({
        id: p.id,
        name: p.name,
        barcode: (p.barcode ?? null) as string | null,
        price: p.price,
        quantity: 999999,
        category: p.category || 'Non-Inventory',
        image: p.image,
        isNonInventory: true,
        inStock: true, // Non-inventory items are always "in stock"
        createdAt: p.createdAt || new Date().toISOString(), 
        cost: null,
        description: p.description || null,
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));

      const combined: UIProduct[] = [...adaptedInventory, ...adaptedNonInventory];
      setProducts(combined);
      const cats = Array.from(new Set(combined.map(p => p.category || 'Uncategorized')));
      setCategories(['all', ...cats]);
    } catch (error) {
      console.error('Failed to load products', error);
    }
  };

  useEffect(() => {
    let result = products;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(lower) || (p.barcode && p.barcode.includes(searchTerm)));
    }
    if (selectedCategory !== 'all') {
      result = result.filter(p => (p.category || 'Uncategorized') === selectedCategory);
    }
    // Filter out products with 0 quantity
    result = result.filter(p => p.isNonInventory || (p.quantity ?? 0) > 0);
    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, products]);

  // Handle product click in manual mode
  const handleProductClick = async (product: UIProduct) => {
    try {
      if (product.isNonInventory) {
        setScannedProduct(product);
        setTempQuantity(1);
        setTempUnit('pieces');
        setShowQuantityDialog(true);
        return;
      }

      const variants = (await ProductService.getVariants(product.id)) as Variant[];
      if (variants && variants.length > 0) {
        setSelectedProductForVariant(product);
        setProductVariants(variants);
        setIsVariantSelectionOpen(true);
      } else {
        setScannedProduct(product);
        setTempQuantity(1);
        setTempUnit('pieces');
        setShowQuantityDialog(true);
      }
    } catch (e) {
      console.error("Error fetching variants", e);
      // Fallback to simple add if variant fetch fails
      setScannedProduct(product);
      setTempQuantity(1);
      setTempUnit('pieces');
      setShowQuantityDialog(true);
    }
  };

  const handleVariantSelect = (variant: Variant) => {
    setIsVariantSelectionOpen(false);
    
    // Create a product-like object for the cart
    const variantProduct: UIProduct = {
      id: variant.id, 
      name: `${selectedProductForVariant?.name} (${variant.name})`,
      price: variant.price,
      quantity: variant.quantity ?? 0,
      barcode: (variant.barcode as string | null) ?? null,
      cost: variant.cost,
      category: selectedProductForVariant?.category ?? null,
      image: variant.image ?? null,
      description: selectedProductForVariant?.description ?? null,
      isNonInventory: false,
      inStock: (variant.quantity ?? 0) > 0,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt
    };
    
    setScannedProduct(variantProduct);
    setTempQuantity(1);
    setTempUnit('pieces');
    setShowQuantityDialog(true);
  };

  useEffect(() => {
    if (!scannerSettings.enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        const code = scannerBufRef.current.trim();
        if (code) {
          handleBarcodeScan(code);
          scannerBufRef.current = '';
        }
        return;
      }
      if (e.key.length === 1) {
        scannerBufRef.current += e.key;
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const code = scannerBufRef.current.trim();
          if (code) handleBarcodeScan(code);
          scannerBufRef.current = '';
        }, scannerSettings.timeout);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, [scannerSettings]);

  const getUnitMultiplier = (unit: 'pieces' | 'dozen' | 'carton') => {
    switch (unit) {
      case 'dozen': return 12;
      case 'carton': return 24;
      case 'pieces': return 1;
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      setManualBarcode(barcode);
      if (!barcode || barcode.trim().length === 0) {
        toast({ title: 'Invalid Barcode', description: 'Scanned barcode is empty or invalid', variant: 'destructive' });
        return;
      }

      let product: UIProduct | undefined = (await ProductService.getProductByBarcode(barcode.trim())) as UIProduct | undefined;
      let isNonInventory = false;
      
      if (!product) {
        const niProduct = await NonInventoryProductService.getNonInventoryProductByBarcode(barcode.trim());
        if (niProduct) {
          product = {
            id: niProduct.id,
            name: niProduct.name,
            barcode: (niProduct.barcode as string | null) ?? null,
            price: niProduct.price,
            quantity: 999999,
            category: niProduct.category || null,
            image: niProduct.image,
            createdAt: niProduct.createdAt ? new Date(niProduct.createdAt) : new Date(),
            updatedAt: niProduct.updatedAt ? new Date(niProduct.updatedAt) : new Date(),
            cost: null,
            description: niProduct.description || null,
          };
          isNonInventory = true;
        }
      }
      
      if (!product) {
        toast({ title: 'Product Not Found', description: `No product found with barcode: ${barcode}`, variant: 'destructive' });
        return;
      }

      setScannedProduct({ ...product, isNonInventory });
      setTempQuantity(1);
      setTempUnit('pieces');
      setShowQuantityDialog(true);
    } catch (error) {
      console.error('Error processing barcode scan:', error);
      toast({ title: 'Scan Error', description: 'Failed to process barcode scan', variant: 'destructive' });
    }
  };

  const handleConfirmQuantity = () => {
    if (!scannedProduct) return;
    const currentTempQuantity = tempQuantity === '' ? 1 : tempQuantity;
    if (currentTempQuantity < 1) {
      toast({ title: 'Invalid Quantity', description: 'Quantity must be at least 1', variant: 'destructive' });
      return;
    }

    const unitMultiplier = getUnitMultiplier(tempUnit);
    const actualQuantity = currentTempQuantity * unitMultiplier;

    if (!scannedProduct.isNonInventory) {
      if (scannedProduct.quantity < actualQuantity) {
        toast({ title: 'Insufficient Stock', description: `Only ${scannedProduct.quantity} pieces available`, variant: 'destructive' });
        return;
      }
      const existingCartItem = cart.find(item => item.productId === scannedProduct.id);
      const currentCartQuantity = existingCartItem ? existingCartItem.quantity : 0;
      if (currentCartQuantity + actualQuantity > scannedProduct.quantity) {
        toast({ title: 'Insufficient Stock', description: `Cannot add ${actualQuantity} more. Only ${scannedProduct.quantity - currentCartQuantity} pieces available`, variant: 'destructive' });
        return;
      }
    }

    const cartItem: CartItem = {
      productId: scannedProduct.id,
      name: scannedProduct.name,
      price: scannedProduct.price,
      quantity: currentTempQuantity,
      unit: tempUnit,
      subtotal: Math.round(scannedProduct.price * actualQuantity * 100) / 100,
      isNonInventory: !!scannedProduct.isNonInventory
    };

    addToCart(cartItem);
    toast({ title: 'Product Added', description: `${scannedProduct.name} (${currentTempQuantity} ${tempUnit}) added to cart` });
    setShowQuantityDialog(false);
    setScannedProduct(null);
  };

  const handleCancelQuantity = () => {
    setShowQuantityDialog(false);
    setScannedProduct(null);
  };

  const handleDeleteItem = async (productId: string) => {
    if (isStaff) {
      setDeleteItemId(productId);
      return;
    }
    removeFromCart(productId);
  };

  const handlePayClick = () => {
    if (cart.length === 0) {
      toast({ title: 'Empty Cart', description: 'Add products to cart before processing sale', variant: 'destructive' });
      return;
    }
    setIsPayModalOpen(true);
  };

  const handleEditItem = (item: CartItem) => {
    setEditingItem(item);
    setEditQuantityStr(item.quantity.toString());
  };

  const saveEditedQuantity = () => {
    if (!editingItem) return;
    const qty = parseInt(editQuantityStr);
    if (isNaN(qty) || qty < 1) {
       toast({ title: 'Invalid Quantity', description: 'Quantity must be at least 1', variant: 'destructive' });
       return;
    }
    updateCartItem(editingItem.productId, qty);
    setEditingItem(null);
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    const total = getCartTotal();
    const effectivePaymentAmount = paymentType === 'cash' ? (paymentAmount ?? 0) : paymentType === 'ewallet' ? total : 0;

    if (paymentType === 'cash' && paymentAmount === null) {
      setPaymentError(true);
      toast({ title: 'Payment Required', description: 'Please input the Total Amount', variant: 'destructive' });
      return;
    }
    if (paymentType === 'cash' && effectivePaymentAmount < total) {
      toast({ title: 'Insufficient Payment', description: `Payment amount must be at least ₱${total.toFixed(2)}`, variant: 'destructive' });
      return;
    }
    if (paymentType === 'credits' && !selectedCreditor) {
      toast({ title: 'Select Creditor', description: 'Please select a creditor for credit (utang) payment', variant: 'destructive' });
      setIsCreditorDialogOpen(true);
      return;
    }

    setIsProcessing(true);
    try {
      const sale = await SalesService.processSale({
        items: cart,
        total,
        paymentType,
        paymentAmount: effectivePaymentAmount,
        staffId: user?.id || undefined,
      });
      if (paymentType === 'credits' && selectedCreditor) {
        await CreditorService.applyCredit(selectedCreditor.id, cart, total);
      }

      const change = paymentType === 'cash' && effectivePaymentAmount > total ? effectivePaymentAmount - total : 0;
      if (paymentType !== 'credits') {
        const receiptItems = cart.map(item => `${item.name}\n${item.quantity} ${item.unit} x ₱${item.price.toFixed(2)}   ₱${item.subtotal.toFixed(2)}`).join('\n');
        let receiptContent = `${receiptSettings.storeName || 'SMARTPOS+ STORE'}\n`;
        if (receiptSettings.storeAddress) receiptContent += `${receiptSettings.storeAddress}\n`;
        if (receiptSettings.storePhone) receiptContent += `${receiptSettings.storePhone}\n`;
        if (receiptSettings.headerNote) receiptContent += `${receiptSettings.headerNote}\n`;
        if (receiptSettings.showDateTime) receiptContent += `${new Date(sale?.createdAt || new Date()).toLocaleString()}\n`;
        if (receiptSettings.showStaffName && user) receiptContent += `Staff: ${user.username || user.ownerName || 'Staff'}\n`;
        
        receiptContent += `--------------------------------\n`;
        receiptContent += `${receiptItems}\n`;
        receiptContent += `--------------------------------\n`;
        receiptContent += `TOTAL                 ₱${total.toFixed(2)}\n`;
        receiptContent += `${paymentType.toUpperCase().padEnd(9)}        ₱${effectivePaymentAmount.toFixed(2)}\n`;
        if (paymentType === 'cash') receiptContent += `CHANGE                ₱${change.toFixed(2)}\n`;
        receiptContent += `--------------------------------\n`;
        receiptContent += `${receiptSettings.footerNote || 'Thank you for your purchase!'}\n`;
        
        const printer = connectedDevices.find(d => d.type === 'printer');
        if (printer) {
          try { await printToThermalPrinter(receiptContent); } catch (e) { console.error('Printing failed:', e); }
        }
      }

      toast({ title: 'Sale Completed', description: paymentType === 'credits' ? `Credits applied to ${selectedCreditor?.name}` : `Sale processed successfully!` });
      clearCart();
      setPaymentAmount(0);
      setSelectedCreditor(null);
      setIsPayModalOpen(false);
    } catch (error) {
      toast({ title: 'Sale Failed', description: 'Failed to process sale', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmRemit = async () => {
    if (!user) return;
    setIsRemitting(true);
    try {
      const res = await RemittanceService.remit({
        staffId: user.id,
        staffName: user.ownerName || user.username || 'Staff',
        amount: remitAmount,
        transactionCount: remitTxCount
      });
      if (res.success) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const localSales = await SalesService.getAllSales();
        const toMarkRemitted = localSales.filter(s => {
          const saleDate = s.createdAt ? new Date(s.createdAt) : new Date();
          return s.staffId === user.id && saleDate >= today && !s.remitted;
        });
        for (const s of toMarkRemitted) { await db.sales.update(s.id, { remitted: true }); }
        toast({ title: "Remittance Sent", description: `Successfully remitted ₱${remitAmount.toLocaleString()}.` });
        setTodaysTotal(0);
        setIsRemitDialogOpen(false);
      }
    } catch (err) {
      toast({ title: "Remittance Failed", description: "Connection error", variant: "destructive" });
    } finally {
      setIsRemitting(false);
    }
  };

  const isDesktop = deviceMode === 'pc' || deviceMode === 'tablet';

  return (
    <Layout showNavigation={false}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-screen overflow-hidden bg-background flex flex-col"
      >
        <div className={cn(
          "flex-1 min-h-0 flex",
          isDesktop ? "flex-row overflow-hidden h-full" : "flex-col relative"
        )}>
          {/* Main Area */}
          <div className={cn(
            "text-gray-800 p-4 flex flex-col min-h-0",
            isDesktop ? "flex-1 border-r border-gray-200 overflow-y-auto h-full" : "flex-1 pb-[80px]"
          )}>
            <div className="flex justify-between items-center mb-6 flex-none px-1">
              <div className="flex flex-col">
                <h2 className="text-xl font-black tracking-tighter uppercase text-slate-900">Sales Terminal</h2>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {isStaff ? `Revenue: ₱${todaysTotal.toFixed(2)}` : 'Admin Console'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {isStaff && (
                  <Button onClick={handleRemitClick} className="bg-slate-900 h-11 px-5 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all"><Send className="w-4 h-4 mr-2 text-[#BF953F]" /> REMIT</Button>
                )}
                <Button variant="outline" className="h-11 w-11 p-0 rounded-2xl border-slate-100 shadow-sm bg-white active:scale-95 transition-all" onClick={() => { if (isStaff) setShowLogoutConfirm(true); else setLocation('/admin-main'); }}>
                  {isStaff ? <LogOut className="w-5 h-5 text-slate-600" /> : <Home className="w-5 h-5 text-slate-600" />}
                </Button>
              </div>
            </div>

            <div className="flex bg-slate-100/50 p-1.5 rounded-[1.25rem] mb-6 flex-none border border-slate-200/50">
              {deviceMode !== 'pc' && (
                <button 
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                    mode === 'scanner' ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 border border-slate-100" : "text-slate-400"
                  )} 
                  onClick={() => setMode('scanner')}
                >
                  Scanner
                </button>
              )}
              <button 
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  (mode === 'manual' || deviceMode === 'pc') ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 border border-slate-100" : "text-slate-400"
                )} 
                onClick={() => setMode('manual')}
              >
                Catalog
              </button>
            </div>

            {mode === 'scanner' ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-[2rem] border border-slate-100 bg-slate-900 shadow-inner">
                <div className="flex-1 relative overflow-hidden">
                  <Scanner onResult={handleBarcodeScan} onError={() => {}} />
                  <div className="absolute inset-0 border-[3px] border-white/20 rounded-[2rem] pointer-events-none" />
                </div>
                <div className="p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 flex gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Usb className="w-4 h-4" /></div>
                    <Input 
                      value={manualBarcode} 
                      onChange={(e) => setManualBarcode(e.target.value)} 
                      placeholder="Manual Barcode" 
                      className="pl-11 h-14 bg-slate-50 border-none rounded-2xl font-bold text-sm" 
                    />
                  </div>
                  <Button 
                    onClick={() => { handleBarcodeScan(manualBarcode); setManualBarcode(''); }}
                    className="h-14 w-14 p-0 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 active:scale-90 transition-all"
                  >
                    <Plus className="w-6 h-6 text-white" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex gap-3 mb-6 flex-none px-1">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <Input 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      placeholder="Search catalog..." 
                      className="pl-11 h-12 bg-white border-slate-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-slate-100 font-bold text-xs" 
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[110px] h-12 rounded-2xl border-slate-100 bg-white shadow-sm font-black text-[9px] uppercase tracking-widest"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100">{categories.map(c => <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase tracking-widest">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1 pb-10">
                    {filteredProducts.map(p => (
                      <motion.div 
                        key={p.id} 
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleProductClick(p)} 
                        className="bg-white border border-slate-100 rounded-[1.75rem] p-2.5 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
                      >
                        <div className="aspect-square bg-slate-50 rounded-[1.25rem] mb-2.5 flex items-center justify-center overflow-hidden relative border border-slate-50">
                          {p.image ? (
                            <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                              <Package className="w-7 h-7 text-slate-200" />
                            </div>
                          )}
                          {!p.isNonInventory && (p.quantity ?? 0) < 10 && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500 text-white text-[7px] font-black uppercase rounded-lg shadow-sm">Low</div>
                          )}
                        </div>
                        <div className="px-1">
                          <h3 className="font-bold text-[10px] uppercase tracking-tight text-slate-800 line-clamp-1 group-hover:text-slate-900 transition-colors">{p.name}</h3>
                          <p className="font-black text-[#FF8882] text-xs mt-0.5">₱{p.price.toLocaleString()}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Cart - Mobile Optimized */}
          <motion.div
            animate={{ 
              width: isDesktop ? '400px' : '100%',
              height: isDesktop ? '100%' : (isCartCollapsed ? '65px' : '65vh'),
              y: isDesktop ? 0 : 0
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "bg-white flex flex-col z-30",
              isDesktop 
                ? "h-full border-l border-gray-100 shadow-[-10px_0_30px_rgba(0,0,0,0.03)]" 
                : "fixed bottom-0 left-0 right-0 rounded-t-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] border-t border-gray-100"
            )}
          >
            {/* Mobile Drag Handle / Header */}
            {!isDesktop && (
              <div 
                className="w-full py-2 flex flex-col items-center cursor-pointer active:bg-gray-50 transition-colors rounded-t-[2rem]" 
                onClick={() => setIsCartCollapsed(!isCartCollapsed)}
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-2" />
                {!isCartCollapsed && (
                  <div className="flex items-center gap-2 py-1">
                    <ShoppingCart className="w-3.5 h-3.5 text-[#BF953F]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BF953F]">CUSTOMER CART</span>
                  </div>
                )}
                {isCartCollapsed && (
                  <div className="flex items-center justify-between w-full px-6 py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center relative shadow-lg shadow-slate-900/20">
                        <ShoppingCart className="w-4 h-4 text-white" />
                        {cart.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#FF8882] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                            {cart.length}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-tight text-slate-900">CUSTOMER CART</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{cart.length} products</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-black text-[#FF8882] tracking-tighter">₱{getCartTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className={cn(
              "flex flex-col flex-1 min-h-0",
              isDesktop ? "p-6" : "px-6 pb-6 pt-0"
            )}>
              {/* Desktop Header */}
              {isDesktop && (
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#BF953F]/10 rounded-2xl flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-[#BF953F]" />
                    </div>
                    <div>
                       <h3 className="font-black text-lg tracking-tighter uppercase">CUSTOMER CART</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cart.length} Items</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-4 rounded-xl border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                    onClick={() => setIsNonInventoryOpen(true)}
                  >
                    + Non-Inv
                  </Button>
                </div>
              )}

              {isPayModalOpen && isDesktop ? (
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="checkout"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex items-center gap-2 mb-6">
                      <Button variant="ghost" size="sm" onClick={() => setIsPayModalOpen(false)} className="w-10 h-10 p-0 rounded-xl hover:bg-gray-50 transition-all">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                      </Button>
                      <h2 className="font-black text-xl tracking-tighter uppercase">Finalize Sale</h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 mb-6">
                      {cart.map(item => (
                        <div key={item.productId} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs uppercase tracking-tight text-gray-800 line-clamp-1">{item.name}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">₱{item.price.toFixed(2)} × {item.quantity}</div>
                            <div className="text-[11px] font-black text-[#FF8882] mt-1">₱{item.subtotal.toFixed(2)}</div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)} className="h-8 w-8 rounded-lg hover:bg-gray-100"><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.productId)} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 bg-white border-t border-gray-100 pt-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Received Amount (₱)</Label>
                        <Input 
                          type="number" 
                          value={paymentAmount ?? ''} 
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setPaymentAmount(isNaN(val) ? null : val);
                            setPaymentError(false);
                          }} 
                          placeholder="0.00" 
                          className={cn(
                            "h-14 bg-gray-50 border-none rounded-2xl font-black text-xl px-6 focus:ring-2 focus:ring-[#BF953F]/20",
                            paymentError && "ring-2 ring-red-500/20 bg-red-50"
                          )} 
                        />
                      </div>
                      
                      <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transaction Total</span>
                          <span className="text-2xl font-black text-[#FF8882] tracking-tighter">₱{getCartTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        {paymentType === 'cash' && paymentAmount !== null && (
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200/50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Expected Change</span>
                            <span className="text-xl font-black text-emerald-500 tracking-tighter">
                              ₱{Math.max(0, paymentAmount - getCartTotal()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button 
                        onClick={handleProcessSale} 
                        disabled={isProcessing || cart.length === 0} 
                        className="w-full h-16 bg-gradient-to-r from-[#BF953F] to-[#B38728] rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[#BF953F]/20 hover:shadow-2xl hover:shadow-[#BF953F]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        {isProcessing ? 'Processing...' : 'Complete Sale'}
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col h-full">
                  <AnimatePresence mode="popLayout">
                    {cart.length > 0 ? (
                      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                        {cart.map(item => (
                          <motion.div 
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={item.productId} 
                            className="flex justify-between items-center p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group"
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="font-bold text-[11px] uppercase tracking-tight text-slate-800 line-clamp-1">{item.name}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">₱{item.price.toFixed(2)} × {item.quantity} {item.unit}</div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div className="font-black text-slate-900 text-[11px]">₱{item.subtotal.toFixed(2)}</div>
                              <button 
                                onClick={() => handleDeleteItem(item.productId)} 
                                className="text-slate-300 hover:text-red-500 transition-colors p-1.5 bg-white rounded-lg shadow-sm border border-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                        <div className="w-20 h-20 bg-gray-100 rounded-[2rem] flex items-center justify-center mb-4">
                          <ShoppingCart className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Empty Cart</p>
                        <p className="text-[8px] font-bold uppercase mt-1">Scan or search items to start</p>
                      </div>
                    )}
                  </AnimatePresence>
                  
                  <div className={cn(
                    "border-t border-slate-100 pt-4 mt-auto",
                    !isDesktop && isCartCollapsed && "hidden"
                  )}>
                    <div className="flex justify-between items-end mb-6 px-1">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Payment Total</span>
                        <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                          ₱{getCartTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-[#BF953F] bg-[#BF953F]/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">Checkout Ready</span>
                      </div>
                    </div>
                    <Button 
                      onClick={handlePayClick} 
                      disabled={cart.length === 0}
                      className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#BF953F] to-[#B38728] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Finalize Payment
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Dialogs - Consistent Styling */}
        <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
          <DialogContent className="rounded-[2.5rem] p-8 sm:max-w-[400px]">
            <DialogHeader className="mb-6">
              <div className="w-14 h-14 bg-[#BF953F]/10 rounded-2xl flex items-center justify-center mb-4">
                <Package className="w-7 h-7 text-[#BF953F]" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase">{scannedProduct?.name}</DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400">Adjust quantity & unit</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Enter Quantity</Label>
                <Input 
                  type="number" 
                  value={tempQuantity} 
                  onChange={e => setTempQuantity(parseInt(e.target.value) || '')} 
                  className="h-14 bg-gray-50 border-none rounded-2xl font-black text-xl px-6 focus:ring-2 focus:ring-[#BF953F]/20"
                  autoFocus 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Select Unit</Label>
                <Select value={tempUnit} onValueChange={(v: any) => setTempUnit(v)}>
                  <SelectTrigger className="h-14 bg-gray-50 border-none rounded-2xl font-black px-6 focus:ring-2 focus:ring-[#BF953F]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-100">
                    <SelectItem value="pieces" className="font-bold uppercase text-[10px]">Pieces</SelectItem>
                    <SelectItem value="dozen" className="font-bold uppercase text-[10px]">Dozen (12)</SelectItem>
                    <SelectItem value="carton" className="font-bold uppercase text-[10px]">Carton (24)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-8 flex gap-3 sm:gap-0">
              <Button onClick={handleConfirmQuantity} className="flex-1 h-14 bg-[#BF953F] rounded-2xl font-black uppercase tracking-widest text-white shadow-lg shadow-[#BF953F]/20">Update Cart</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent className="rounded-[2rem] p-8 border-none shadow-2xl">
            <AlertDialogHeader>
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-black text-center tracking-tighter uppercase text-slate-900">Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-slate-500 font-medium">
                Are you sure you want to end your shift and logout?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 flex gap-3">
              <AlertDialogCancel className="flex-1 h-14 rounded-2xl border-slate-100 font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  logout();
                  setLocation('/role-selection');
                }}
                className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Variant Selection Dialog */}
        <Dialog open={isVariantSelectionOpen} onOpenChange={setIsVariantSelectionOpen}>
          <DialogContent className="rounded-[2.5rem] p-8 sm:max-w-[500px]">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase">{selectedProductForVariant?.name}</DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select preferred variant</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
              {productVariants.map(variant => (
                <button 
                  key={variant.id}
                  onClick={() => handleVariantSelect(variant)}
                  disabled={(variant.quantity ?? 0) < 1}
                  className={cn(
                    "p-4 rounded-[1.5rem] border text-left transition-all group relative overflow-hidden",
                    (variant.quantity ?? 0) < 1 
                      ? "bg-gray-50 border-gray-100 opacity-50 grayscale" 
                      : "bg-white border-gray-100 hover:border-[#BF953F]/30 hover:shadow-md active:scale-[0.98]"
                  )}
                >
                  <div className="font-black text-[11px] uppercase tracking-tight text-gray-800 mb-1 group-hover:text-[#BF953F]">{variant.name}</div>
                  <div className="font-black text-[#FF8882] text-sm">₱{variant.price.toFixed(2)}</div>
                  <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2">{variant.quantity} In Stock</div>
                  {(variant.quantity ?? 0) < 1 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                      <span className="bg-red-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-sm">Out of Stock</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <DialogFooter className="mt-8">
               <Button variant="outline" onClick={() => setIsVariantSelectionOpen(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest border-gray-100">Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Non-Inventory Item Dialog */}
        <Dialog open={isNonInventoryOpen} onOpenChange={setIsNonInventoryOpen}>
          <DialogContent className="rounded-[2.5rem] p-8 sm:max-w-[400px]">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase">Non-Inventory Item</DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400">Add a one-time product</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Item Name</Label>
                <Input
                  value={nonInvName}
                  onChange={e => setNonInvName(e.target.value)}
                  placeholder="Enter item name"
                  className="h-12 bg-gray-50 border-gray-100 rounded-2xl font-bold text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Price (₱)</Label>
                <Input
                  type="number"
                  value={nonInvPrice}
                  onChange={e => setNonInvPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-12 bg-gray-50 border-gray-100 rounded-2xl font-bold text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Quantity</Label>
                <Input
                  type="number"
                  value={nonInvQty}
                  onChange={e => setNonInvQty(e.target.value)}
                  placeholder="1"
                  className="h-12 bg-gray-50 border-gray-100 rounded-2xl font-bold text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F]"
                />
              </div>
            </div>
            <DialogFooter className="mt-8 flex gap-3">
              <Button variant="outline" onClick={() => setIsNonInventoryOpen(false)} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest border-gray-100">Cancel</Button>
              <Button onClick={handleAddNonInventory} className="flex-1 h-12 bg-[#BF953F] rounded-2xl font-black uppercase tracking-widest text-white shadow-lg shadow-[#BF953F]/20">Add to Cart</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile Pay Modal */}
        <Dialog open={isPayModalOpen && !isDesktop} onOpenChange={setIsPayModalOpen}>
          <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-t-[3rem] border-none">
            <DialogHeader className="p-8 border-b border-gray-50 flex-none relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#FF8882]/10 rounded-[1.25rem] flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-[#FF8882]" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tighter uppercase">Checkout</DialogTitle>
                  <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400">{cart.length} Items to Process</DialogDescription>
                </div>
              </div>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-gray-50/30 custom-scrollbar">
              {cart.map(item => (
                <div key={item.productId} className="p-5 bg-white rounded-[1.5rem] shadow-sm border border-gray-100/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-tight text-gray-800">{item.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">₱{item.price.toFixed(2)} × {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-[#FF8882]">₱{item.subtotal.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 bg-white border-t border-gray-100 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Received Amount (₱)</Label>
                <Input 
                  type="number" 
                  value={paymentAmount ?? ''} 
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setPaymentAmount(isNaN(val) ? null : val);
                    setPaymentError(false);
                  }} 
                  placeholder="0.00" 
                  className={cn(
                    "h-16 bg-gray-50 border-none rounded-2xl font-black text-2xl px-6 focus:ring-2 focus:ring-[#BF953F]/20 text-center",
                    paymentError && "ring-2 ring-red-500/20 bg-red-50"
                  )} 
                />
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Total Due</span>
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">₱{getCartTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {paymentAmount !== null && paymentAmount > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Change</span>
                    <span className="text-2xl font-black text-emerald-500 tracking-tighter">₱{Math.max(0, paymentAmount - getCartTotal()).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleProcessSale} 
                disabled={isProcessing || cart.length === 0}
                className="w-full h-16 bg-gradient-to-r from-[#FF8882] to-[#D89D9D] text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#FF8882]/20 active:scale-[0.98] transition-all"
              >
                {isProcessing ? 'Finalizing...' : 'Complete Transaction'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remittance Dialog */}
        <Dialog open={isRemitDialogOpen} onOpenChange={setIsRemitDialogOpen}>
          <DialogContent className="rounded-[2.5rem] p-0 sm:max-w-[600px] overflow-hidden border-none shadow-2xl">
            <div className="bg-slate-900 p-8 text-white relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase mb-1">Daily Remittance</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Shift Summary & Revenue</p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Send className="w-6 h-6 text-[#BF953F]" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Total Revenue</p>
                  <p className="text-2xl font-black text-[#BF953F]">₱{remitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Transactions</p>
                  <p className="text-2xl font-black text-white">{remitTxCount}</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white">
              <div className="mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Transaction History</h3>
                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                  {remitTransactions.length > 0 ? (
                    remitTransactions.map((sale) => (
                      <div key={sale.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                        <div>
                          <p className="font-bold text-[11px] text-slate-900 uppercase tracking-tight">
                            {new Date(sale.createdAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {sale.paymentType}
                          </p>
                        </div>
                        <p className="font-black text-slate-900 text-sm">₱{sale.total.toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 opacity-40">
                      <p className="text-[10px] font-black uppercase tracking-widest">No transactions yet</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsRemitDialogOpen(false)}
                  className="flex-1 h-14 rounded-2xl border-slate-100 font-black uppercase tracking-widest text-slate-400"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmRemit}
                  disabled={isRemitting || remitAmount === 0}
                  className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {isRemitting ? 'Processing...' : 'Submit Remit'}
                </Button>
              </div>
              
              <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-6">
                Once submitted, your daily total will reset and await admin confirmation.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </Layout>
  );
};

export default ScannerSales;
