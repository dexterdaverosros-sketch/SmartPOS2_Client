import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import Scanner from '@/components/Scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Moon, Sun, Keyboard, Camera, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import io from 'socket.io-client';
import { ProductService } from '@/lib/db';
import { 
  BrowserMultiFormatReader, 
  DecodeHintType, 
  BarcodeFormat 
} from '@zxing/library';
import api from '@/lib/api';

// Product interface
interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  description?: string;
  imageUrl?: string;
  inStock: boolean;
}

const CustomerScan: React.FC = () => {
  const [, setLocation] = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user prefers dark mode
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [manualEntry, setManualEntry] = useState(false);
  const [useLiveScanner, setUseLiveScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [showProduct, setShowProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inventoryUpdated, setInventoryUpdated] = useState(false);

  const [scannerSettings, setScannerSettings] = useState<{ enabled: boolean; timeout: number }>({
    enabled: true,
    timeout: 150
  });

  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);
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
      } catch (err) {
        console.error('Failed to load scanner settings', err);
      }
    };
    loadSettings();
  }, []);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);
  
  // Connect to socket for real-time inventory updates
  useEffect(() => {
    const initSocket = async () => {
      let socketUrl = window.location.origin;
      try {
        const data = await api.get('/api/server-info');
        socketUrl = data.origin;
      } catch (e) {
        console.warn('Failed to fetch server info');
      }

      // Handle Netlify WebSocket proxy limitation
      if (window.location.hostname.includes('netlify.app')) {
        socketUrl = 'https://smartposv4.onrender.com';
      }

      socketRef.current = io(socketUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 20,
        timeout: 45000,
        autoConnect: true
      });
      
      // Listen for inventory updates
      socketRef.current.on('inventory-update', () => {
        setInventoryUpdated(true);
        if (product && showProduct && product.barcode) {
          lookupProduct(product.barcode as string);
        }
      });
    };

    initSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [product, showProduct]);

  useEffect(() => {
    if (!scannerSettings.enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input or textarea, don't capture for scanner
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        const code = scannerBufRef.current.trim();
        if (code) {
          lookupProduct(code);
          scannerBufRef.current = '';
        }
        return;
      }
      if (e.key.length === 1) {
        scannerBufRef.current += e.key;
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const code = scannerBufRef.current.trim();
          if (code) lookupProduct(code);
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

  // Handle barcode scan result
  const handleScanResult = (barcode: string) => {
    if (barcode) {
      lookupProduct(barcode);
    }
  };

  // Handle scan error
  const handleScanError = (error: Error) => {
    toast({
      title: "Scanner Error",
      description: error.message,
      variant: "destructive",
    });
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hints = new Map();
    const formats = [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, true);

    const reader = new BrowserMultiFormatReader(hints);
    const url = URL.createObjectURL(file);
    setLoading(true);
    try {
      const result = await reader.decodeFromImageUrl(url);
      if (result) {
        handleScanResult(result.getText());
      } else {
        toast({ title: "Scan Failed", description: "No barcode detected in photo. Please ensure the barcode is clear and well-lit.", variant: "destructive" });
      }
    } catch (err) {
      console.error('Image scan error:', err);
      toast({ title: "Scan Failed", description: "Could not read barcode from photo. Try taking a closer, clearer picture.", variant: "destructive" });
    } finally {
      URL.revokeObjectURL(url);
      setLoading(false);
      e.target.value = "";
    }
  };

  // Handle manual barcode input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      lookupProduct(barcodeInput.trim());
      setBarcodeInput('');
    }
  };

  // Toggle between camera and manual entry
  const toggleInputMethod = () => {
    setManualEntry(!manualEntry);
    if (!manualEntry) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Look up product by barcode
  const lookupProduct = async (barcode: string) => {
    setLoading(true);
    setInventoryUpdated(false);
    try {
      // Fetch product from server with cache-busting parameter for real-time data
      const data = await api.get(`/api/products/barcode/${encodeURIComponent(barcode)}`);
      if (data) {
        setProduct({
          id: data.id,
          name: data.name,
          price: data.price,
          barcode: data.barcode,
          description: data.description || '',
          imageUrl: data.image || '',
          inStock: (data.quantity ?? 0) > 0
        });
        setShowProduct(true);
      }
      
      // Emit event to notify server that product was viewed
      if (socketRef.current) {
        socketRef.current.emit('product-viewed', { barcode });
      }
    } catch (error) {
      console.error('API product lookup failed, trying local DB', error);
      // Fallback to local DB
      const localProduct = await ProductService.getProductByBarcode(barcode);
      if (localProduct) {
        setProduct({
          id: localProduct.id,
          name: localProduct.name,
          price: Number(localProduct.price),
          barcode: localProduct.barcode ?? null,
          description: localProduct.description || '',
          imageUrl: localProduct.image || '',
          inStock: (localProduct.quantity ?? 0) > 0
        });
        setShowProduct(true);
      } else {
        toast({
          title: "Product Not Found",
          description: `Barcode: ${barcode}`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Close product dialog
  const closeProductDialog = () => {
    setShowProduct(false);
    // Resume scanning after dialog closes
    setScanning(true);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#FDE2E4] text-gray-900'}`}>
      {/* Header */}
      <header className={`p-4 flex justify-between items-center border-b ${darkMode ? '' : 'bg-[#FDE2E4]'}`}>
        <div className="w-10"></div> {/* Spacer for alignment */}
        <h1 className="text-xl font-bold text-center flex-grow">SmartPOS Scanner</h1>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      <main className="container mx-auto p-4 max-w-md sm:max-w-md md:max-w-lg lg:max-w-xl w-full">
        <Card className={`${darkMode ? "bg-gray-800 border-gray-700" : ""} w-full`}>
          <CardHeader className="sm:p-6">
            <CardTitle className="text-lg sm:text-xl md:text-2xl">Product Scanner</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Scan a product barcode or enter it manually
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="w-full max-w-sm flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button 
                  onClick={() => setUseLiveScanner(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!useLiveScanner ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
                >
                  Take Photo
                </button>
                <button 
                  onClick={() => setUseLiveScanner(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${useLiveScanner ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
                >
                  Live Scan
                </button>
              </div>

              {useLiveScanner ? (
                <div className="w-full max-w-sm aspect-video bg-black rounded-3xl overflow-hidden border-2 border-primary/20 shadow-xl">
                  <Scanner 
                    onResult={handleScanResult}
                    onError={handleScanError}
                  />
                </div>
              ) : (
                <div className="w-full aspect-square max-w-sm bg-gray-100 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Scan Product Barcode</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Use your device's native camera to scan a product barcode</p>
                  </div>
                  <label className="w-full cursor-pointer">
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageCapture}
                      className="hidden"
                    />
                    <div className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all text-center">
                      Open Camera
                    </div>
                  </label>
                </div>
              )}

              <div className="w-full max-w-sm flex items-center gap-4">
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or Enter Manually</span>
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
              </div>

              <form onSubmit={handleManualSubmit} className="w-full max-w-sm flex gap-2">
                <Input
                  placeholder="Enter Barcode"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 h-14 rounded-2xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <Button 
                  type="submit"
                  disabled={loading || !barcodeInput.trim()}
                  className="h-14 w-14 rounded-2xl shadow-lg active:scale-95 transition-all"
                >
                  <Keyboard className="w-6 h-6" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Product Dialog */}
      <Dialog open={showProduct} onOpenChange={setShowProduct}>
        <DialogContent className={darkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Product Information</span>
              {inventoryUpdated && (
                <span className="text-xs text-blue-500 flex items-center">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Updated
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Details for the scanned product
            </DialogDescription>
          </DialogHeader>
          
          {product && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {product.imageUrl && (
                  <div className="flex justify-center">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="h-40 object-contain"
                    />
                  </div>
                )}
                
                <div className="grid gap-2">
                  <h3 className="font-bold text-xl">{product.name}</h3>
                  <p className="text-2xl font-semibold">
                    ₱{product.price.toFixed(2)}
                  </p>
                  {product.description && (
                    <p className="text-sm opacity-80">{product.description}</p>
                  )}
                  <div className="flex items-center mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      product.inStock 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </div>
                
                <div className="pt-4 flex gap-2">
                  <Button 
                    onClick={() => product.barcode && lookupProduct(product.barcode as string)} 
                    variant="outline"
                    className="flex-1"
                    disabled={loading || !product.barcode}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    onClick={closeProductDialog} 
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerScan;
