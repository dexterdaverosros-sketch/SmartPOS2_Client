import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, LogOut, User, Store, Settings, Wifi, Shield, Key, Bell, Smartphone, Scan, Camera, Moon, Sun, Info, Mail, Database, RefreshCw, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { AuthService, SalesService, StaffService, db } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

const profileSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  mobile: z.string().min(10, 'Valid mobile number is required'),
});

const credentialsSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type CredentialsFormData = z.infer<typeof credentialsSchema>;

type ReceiptSettings = {
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
};

type ExternalScannerSettings = {
  enabled: boolean;
  timeout: number;
};

type SettingsResponse = {
  receipt?: Partial<ReceiptSettings>;
  externalScanner?: Partial<ExternalScannerSettings>;
  [key: string]: any;
};

const defaultReceiptSettings: ReceiptSettings = {
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
};

const defaultExternalScannerSettings: ExternalScannerSettings = {
  enabled: true,
  timeout: 150,
};

const ReceiptSettingsCard: React.FC = () => {
  const { toast } = useToast();
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data: SettingsResponse = await api.get('/api/settings');
        if (!mounted) return;
        const merged: ReceiptSettings = {
          ...defaultReceiptSettings,
          ...(data.receipt || {}),
        };
        setReceiptSettings(merged);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveReceiptSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', { receipt: receiptSettings });
      toast({
        title: 'Receipt Settings Saved',
        description: 'Receipt configuration has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save receipt settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const testPrintReceipt = async () => {
    try {
      await api.post('/api/print/test-receipt', {});
      toast({
        title: 'Test Receipt Sent',
        description: 'Check the server console or printer output.',
      });
    } catch (error) {
      toast({
        title: 'Test Print Failed',
        description: error instanceof Error ? error.message : 'Could not send test receipt',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="mt-2 p-4 space-y-4">
      {loading ? (
        <div className="text-sm text-gray-500">Loading receipt settings…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receiptStoreName">Store Name</Label>
              <Input
                id="receiptStoreName"
                value={receiptSettings.storeName}
                onChange={(e) =>
                  setReceiptSettings((s) => ({ ...s, storeName: e.target.value }))
                }
                placeholder="SmartPOS+ Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptStorePhone">Store Phone</Label>
              <Input
                id="receiptStorePhone"
                value={receiptSettings.storePhone}
                onChange={(e) =>
                  setReceiptSettings((s) => ({ ...s, storePhone: e.target.value }))
                }
                placeholder="+63 900 000 0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptStoreAddress">Store Address</Label>
            <Textarea
              id="receiptStoreAddress"
              value={receiptSettings.storeAddress}
              onChange={(e) =>
                setReceiptSettings((s) => ({ ...s, storeAddress: e.target.value }))
              }
              placeholder="Street, City, Province, ZIP"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receiptHeaderNote">Header Note</Label>
              <Textarea
                id="receiptHeaderNote"
                value={receiptSettings.headerNote}
                onChange={(e) =>
                  setReceiptSettings((s) => ({ ...s, headerNote: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptFooterNote">Footer Note</Label>
              <Textarea
                id="receiptFooterNote"
                value={receiptSettings.footerNote}
                onChange={(e) =>
                  setReceiptSettings((s) => ({ ...s, footerNote: e.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receiptPrinterName">Printer Name</Label>
              <Input
                id="receiptPrinterName"
                value={receiptSettings.printerDeviceName}
                onChange={(e) =>
                  setReceiptSettings((s) => ({ ...s, printerDeviceName: e.target.value }))
                }
                placeholder="Optional printer name"
              />
            </div>
            <div className="space-y-2">
              <Label>Paper Width</Label>
              <Select
                value={receiptSettings.paperWidth}
                onValueChange={(val: '58mm' | '80mm') =>
                  setReceiptSettings((s) => ({ ...s, paperWidth: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm</SelectItem>
                  <SelectItem value="80mm">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto Print on Sale</Label>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white">
                <span className="text-sm text-gray-700">Auto Print</span>
                <Switch
                  checked={receiptSettings.autoPrintOnSale}
                  onCheckedChange={(checked) =>
                    setReceiptSettings((s) => ({ ...s, autoPrintOnSale: checked }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Show Staff Name</Label>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white">
                <span className="text-sm text-gray-700">Staff Name</span>
                <Switch
                  checked={receiptSettings.showStaffName}
                  onCheckedChange={(checked) =>
                    setReceiptSettings((s) => ({ ...s, showStaffName: checked }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-800">Show Date & Time</div>
              <div className="text-xs text-gray-500">
                Include transaction timestamp on receipt.
              </div>
            </div>
            <Switch
              checked={receiptSettings.showDateTime}
              onCheckedChange={(checked) =>
                setReceiptSettings((s) => ({ ...s, showDateTime: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={testPrintReceipt}
              disabled={saving}
            >
              Test Receipt
            </Button>
            <Button
              type="button"
              onClick={saveReceiptSettings}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Receipt Settings'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

const ExternalScannerSettingsCard: React.FC = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ExternalScannerSettings>(defaultExternalScannerSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data: SettingsResponse = await api.get('/api/settings');
        if (!mounted) return;
        const merged: ExternalScannerSettings = {
          ...defaultExternalScannerSettings,
          ...(data.externalScanner || {}),
        };
        setSettings(merged);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', { externalScanner: settings });
      toast({
        title: 'Scanner Settings Saved',
        description: 'External scanner configuration has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save scanner settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-2 p-4 space-y-4">
      {loading ? (
        <div className="text-sm text-gray-500">Loading scanner settings…</div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white">
            <div>
              <div className="text-sm font-medium text-gray-800">External Scanner Enabled</div>
              <div className="text-xs text-gray-500">
                Support physical USB/Bluetooth barcode scanners.
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, enabled: checked }))
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="scannerTimeout">Scanner Buffer Timeout (ms)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="scannerTimeout"
                type="number"
                value={settings.timeout}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, timeout: parseInt(e.target.value) || 150 }))
                }
                className="max-w-[150px]"
                disabled={!settings.enabled}
              />
              <span className="text-xs text-gray-500">
                Recommended: 150ms. Higher value allows for slower scanning speed.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Scanner Settings'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

const ProfileSettings: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { connectToRouter, disconnectFromRouter, isConnectedToRouter, syncWithRouter } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [showRouterSettings, setShowRouterSettings] = useState(false);
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedWiFiForPassword, setSelectedWiFiForPassword] = useState<string | null>(null);
  
  // App settings state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [routerSSID, setRouterSSID] = useState('');
  const [routerPassword, setRouterPassword] = useState('');
  const [captivePortalEnabled, setCaptivePortalEnabled] = useState(false);
  
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  
  // WiFi scanning state
  const [availableWiFis, setAvailableWiFis] = useState<Array<{ssid: string, signal: number, security: string}>>([]);
  const [selectedWiFi, setSelectedWiFi] = useState<string>('');
  const [selectedWiFiSecurity, setSelectedWiFiSecurity] = useState<string>('');
  const [isScanningWiFi, setIsScanningWiFi] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [totalCustomer, setTotalCustomer] = useState(0);
  const [showStoreInfoDialog, setShowStoreInfoDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupCounts, setBackupCounts] = useState<{users:number;products:number;sales:number;saleItems:number;staff:number;expenses:number;purchases:number;creditors:number}>({users:0,products:0,sales:0,saleItems:0,staff:0,expenses:0,purchases:0,creditors:0});
  const [gcashConnected, setGcashConnected] = useState(false);
  const [mayaConnected, setMayaConnected] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<null | 'gcash' | 'maya'>(null);

  useEffect(() => {
    const checkWalletStatus = async () => {
      try {
        const [gcashData, mayaData] = await Promise.all([
          api.get('/api/wallet/gcash/status'),
          api.get('/api/wallet/maya/status')
        ]);
        setGcashConnected(!!gcashData.connected);
        setMayaConnected(!!mayaData.connected);
      } catch (e) {
        console.error('Failed to load wallet status', e);
      }
    };
    checkWalletStatus();
  }, []);

  const startWalletOAuth = async (provider: 'gcash' | 'maya') => {
    if (!navigator.onLine) {
      toast({ title: 'Internet Required', description: 'Please connect to the internet to link wallet', variant: 'destructive' });
      return;
    }
    setConnectingWallet(provider);
    const oauthUrl = `/api/wallet/${provider}/oauth/start`;
    const popup = window.open(oauthUrl, 'wallet-oauth', 'width=500,height=700');

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as any;
      if (!data || !data.type) return;
      if (data.type === 'wallet_connected' && data.provider === provider) {
        try {
          // Tell the backend to persist the connection
          await fetch(`/api/wallet/${provider}/connect`, { method: 'POST' });
        } catch (e) {
          console.error(`Failed to persist ${provider} connection`, e);
        }
        if (provider === 'gcash') setGcashConnected(true); else setMayaConnected(true);
        toast({ title: `${provider === 'gcash' ? 'GCash' : 'Maya'} Connected`, description: 'Wallet linked successfully' });
        setConnectingWallet(null);
        window.removeEventListener('message', onMessage);
        try { popup?.close(); } catch {}
      } else if (data.type === 'wallet_error' && data.provider === provider) {
        toast({ title: 'Connection Failed', description: `Unable to link ${provider}`, variant: 'destructive' });
        setConnectingWallet(null);
        window.removeEventListener('message', onMessage);
        try { popup?.close(); } catch {}
      }
    };
    window.addEventListener('message', onMessage);

    let attempts = 0;
    const maxAttempts = 15;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/wallet/${provider}/status`);
        if (res.ok) {
          const status = await res.json();
          if (status.connected) {
            if (provider === 'gcash') setGcashConnected(true); else setMayaConnected(true);
            toast({ title: `${provider === 'gcash' ? 'GCash' : 'Maya'} Connected`, description: 'Wallet linked successfully' });
            clearInterval(poll);
            window.removeEventListener('message', onMessage);
            setConnectingWallet(null);
            try { popup?.close(); } catch {}
            return;
          }
        }
      } catch {}
      if (attempts >= maxAttempts || (popup && popup.closed)) {
        clearInterval(poll);
        window.removeEventListener('message', onMessage);
        setConnectingWallet(null);
      }
    }, 2000);
  };
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      businessName: user?.businessName || '',
      ownerName: user?.ownerName || '',
      mobile: user?.mobile || '',
    },
  });

  const credentialsForm = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setProfileImage(imageData);
        
        try {
          await AuthService.updateProfileImage(user.id, imageData);
          toast({
            title: 'Profile Picture Updated',
            description: 'Your profile picture has been saved successfully',
          });
        } catch (error) {
          console.error('Error saving profile image:', error);
          toast({
            title: 'Error',
            description: 'Failed to save profile picture',
            variant: 'destructive',
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    
    // Apply theme to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    toast({
      title: 'Theme Changed',
      description: `Switched to ${newTheme} mode`,
    });
  };

  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      // Here you would typically update the user profile in your database
      console.log('Profile updated:', data);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCredentials = async (data: CredentialsFormData) => {
    setIsLoading(true);
    try {
      // Here you would typically update the password in your database
      console.log('Password updated:', data);
      toast({
        title: 'Password Updated',
        description: 'Your password has been updated successfully',
      });
      credentialsForm.reset();
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: 'Error',
        description: 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation('/role-selection');
  };

  // Scan for available WiFi networks
  const scanWiFi = async () => {
    setIsScanningWiFi(true);
    try {
      // Call the API endpoint to scan for WiFi networks
      const routerUrl = localStorage.getItem('routerUrl') || 'http://localhost:5000';
      const response = await fetch(`${routerUrl}/api/wifi/scan`);
      
      if (!response.ok) {
        throw new Error('Failed to scan for WiFi networks');
      }
      
      const networks = await response.json();
      setAvailableWiFis(networks);
      toast({
        title: 'Scan Complete',
        description: `Found ${networks.length} available networks`,
      });
    } catch (error) {
      console.error('Error scanning WiFi:', error);
      toast({
        title: 'Scan Failed',
        description: 'Could not scan for WiFi networks',
        variant: 'destructive',
      });
    } finally {
      setIsScanningWiFi(false);
    }
  };

  // Handle WiFi network selection
  const handleWiFiSelection = (ssid: string) => {
    const wifi = availableWiFis.find(w => w.ssid === ssid);
    setSelectedWiFi(ssid);
    setSelectedWiFiSecurity(wifi?.security || '');
    
    // If the network requires a password, show password dialog
    if (wifi && wifi.security !== 'Open') {
      setSelectedWiFiForPassword(ssid);
      setShowPasswordDialog(true);
    } else {
      // For open networks, clear password and don't show dialog
      setSelectedWiFiForPassword(null);
      setPasswordInput('');
    }
  };

  // Connect to WiFi with password
  const connectToWiFi = async () => {
    if (!selectedWiFi) return;
    
    const wifi = availableWiFis.find(w => w.ssid === selectedWiFi);
    
    // If password is required but not provided
    if (wifi && wifi.security !== 'Open' && !passwordInput) {
      toast({
        title: 'Password Required',
        description: 'Please enter the WiFi password',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const routerUrl = localStorage.getItem('routerUrl') || 'http://localhost:5000';
      
      // Connect to WiFi
      const connectResponse = await fetch(`${routerUrl}/api/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: selectedWiFi, password: passwordInput }),
      });

      if (!connectResponse.ok) {
        throw new Error('Failed to connect to WiFi');
      }

      // Try to connect to the router
      const connected = await connectToRouter(routerUrl);
      
      if (connected) {
        setRouterSSID(selectedWiFi);
        setRouterPassword(passwordInput);
        toast({
          title: 'WiFi Connected',
          description: `Successfully connected to ${selectedWiFi}`,
        });
        setShowPasswordDialog(false);
        setPasswordInput('');
        setShowRouterSettings(false);
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Could not connect to the router. Please check your settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error connecting to WiFi:', error);
      toast({
        title: 'Connection Error',
        description: 'An error occurred while connecting to WiFi',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const saveRouterSettings = async () => {
    // If password dialog is showing, don't connect from here
    if (showPasswordDialog) return;
    
    // Connect to selected WiFi
    await connectToWiFi();
  };

  
  useEffect(() => {
    const loadStats = async () => {
      try {
        const income = await SalesService.getTotalSales();
        const staffList = await StaffService.getAllStaff();
        const sales = await db.sales.toArray();
        setTotalIncome(Math.round(income * 100) / 100);
        setActiveStaff(staffList.length);
        setTotalCustomer(sales.length);
      } catch {}
    };
    loadStats();
    if (location === '/account-details') {
      setShowAccountDetails(true);
    }
  }, []);

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setLocation('/admin-main')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 dark:text-gray-300" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Profile & Settings</h1>
            <div className="w-10" />
          </div>
        </div>
        
        <div className="p-4 space-y-4 pb-20">
          {/* Profile Avatar */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 p-8 rounded-2xl shadow-lg text-center text-white"
          >
            <div className="relative inline-block">
              <div 
                className="w-20 h-20 bg-[#FF8882] rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden relative cursor-pointer group"
                onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              >
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
                
                {/* Upload overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              
              {/* Hidden file input */}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                title="Click to upload profile picture"
              />
            </div>
            
            <h3 className="font-semibold text-white">
              {user?.ownerName || user?.username || 'User'}
            </h3>
            <p className="text-sm text-white/80">
              {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
            </p>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="rounded-lg bg-white/10 p-3">
                <div className="text-2xl font-bold">₱{totalIncome.toFixed(2)}</div>
                <div className="text-xs text-white/80">Total Income</div>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <div className="text-2xl font-bold">{activeStaff}</div>
                <div className="text-xs text-white/80">Active Staff</div>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <div className="text-2xl font-bold">{totalCustomer}</div>
                <div className="text-xs text-white/80">Total Customer</div>
              </div>
            </div>
          </motion.div>

          

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Account Details</h2>
            <div className="mt-3 space-y-3">
              <button
                onClick={() => setShowStoreInfoDialog(true)}
                className="w-full bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 text-left flex items-center justify-between"
              >
                <div className="flex items-center">
                  <ChevronRight className="w-5 h-5 text-gray-500 mr-2" />
                  <span className="font-semibold text-gray-800">Store information</span>
                </div>
              </button>

              <button
                onClick={() => setShowAccountDetails(true)}
                className="w-full bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 text-left flex items-center justify-between"
              >
                <div className="flex items-center">
                  <ChevronRight className="w-5 h-5 text-gray-500 mr-2" />
                  <span className="font-semibold text-gray-800">Security</span>
                </div>
              </button>
              <div className="pt-2">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Backup</h3>
                <button
                  onClick={async () => {
                    const users = await db.users.count();
                    const products = await db.products.count();
                    const sales = await db.sales.count();
                    const saleItems = await db.saleItems.count();
                    const staff = await db.staff.count();
                    const expenses = await db.expenses.count();
                    const purchases = await db.purchases.count();
                    const creditors = await db.creditors.count();
                    setBackupCounts({users,products,sales,saleItems,staff,expenses,purchases,creditors});
                    setShowBackupDialog(true);
                  }}
                  className="mt-2 w-full bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 text-left flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 text-[#7D6C7D] mr-2" />
                    <span className="font-semibold text-gray-800">Create Backup</span>
                  </div>
                </button>
              </div>
              <div className="pt-2">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Wallet</h3>
                <div className="space-y-3 mt-2">
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 flex items-center justify-between">
                    <div className="flex items-center">
                      {gcashConnected && <span className="text-xs text-green-600 mr-2">connected</span>}
                      <span className="font-medium text-gray-800">gcash</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => startWalletOAuth('gcash')}
                      disabled={connectingWallet === 'gcash'}
                    >
                      {connectingWallet === 'gcash' ? 'Connecting...' : (gcashConnected ? 'Connected' : 'Connect')}
                    </Button>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 flex items-center justify-between">
                    <div className="flex items-center">
                      {mayaConnected && <span className="text-xs text-green-600 mr-2">connected</span>}
                      <span className="font-medium text-gray-800">maya</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => startWalletOAuth('maya')}
                      disabled={connectingWallet === 'maya'}
                    >
                      {connectingWallet === 'maya' ? 'Connecting...' : (mayaConnected ? 'Connected' : 'Connect')}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Preferences</h3>
                <div className="space-y-3 mt-2">
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 flex items-center justify-between">
                    <div className="flex items-center">
                      <Bell className="w-5 h-5 mr-3 text-gray-600" />
                      <span className="font-medium text-gray-800">Notification</span>
                    </div>
                    <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 flex items-center justify-between">
                    <div className="flex items-center">
                      <Sun className="w-5 h-5 mr-3 text-gray-600" />
                      <span className="font-medium text-gray-800">Theme</span>
                    </div>
                    <Switch checked={themeMode === 'dark'} onCheckedChange={handleThemeToggle} />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Receipt Configuration</h3>
                <ReceiptSettingsCard />
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Scanner Configuration</h3>
                <ExternalScannerSettingsCard />
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={() => setShowLogoutDialog(true)}
              data-testid="button-logout-profile"
              variant="destructive"
              className="w-full p-4 rounded-xl font-semibold touch-feedback"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </motion.div>
        </div>

        {/* Password Management Dialog */}
        <Dialog open={showAccountDetails} onOpenChange={setShowAccountDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-[#FF8882]" />
                Password Management
              </DialogTitle>
            </DialogHeader>
            
            <Form {...credentialsForm}>
              <form onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)} className="space-y-4">
                <FormField
                  control={credentialsForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter current password"
                          value={localStorage.getItem('admin_password') || field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={credentialsForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={credentialsForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAccountDetails(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                    style={{
                      boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
                    }}
                  >
                    {isLoading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2 text-[#7D6C7D]" />
                Backup Options
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Users: {backupCounts.users}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Products: {backupCounts.products}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Sales: {backupCounts.sales}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Sale Items: {backupCounts.saleItems}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Staff: {backupCounts.staff}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Expenses: {backupCounts.expenses}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Purchases: {backupCounts.purchases}</div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">Creditors: {backupCounts.creditors}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const users = await db.users.toArray();
                    const products = await db.products.toArray();
                    const sales = await db.sales.toArray();
                    const saleItems = await db.saleItems.toArray();
                    const staff = await db.staff.toArray();
                    const expenses = await db.expenses.toArray();
                    const purchases = await db.purchases.toArray();
                    const creditors = await db.creditors.toArray();
                    const payload = { timestamp: new Date().toISOString(), users, products, sales, saleItems, staff, expenses, purchases, creditors };
                    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `smartpos-backup-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: 'Backup Downloaded', description: 'Saved backup JSON file' });
                  }}
                  className="flex-1"
                >
                  Download JSON
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const success = await syncWithRouter();
                    if (success) {
                      toast({ title: 'Backup Synced', description: 'Data synced to router successfully' });
                    } else {
                      toast({ title: 'Sync Failed', description: 'Could not sync to router', variant: 'destructive' });
                    }
                  }}
                  className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                >
                  Sync to Router
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBackupDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Router Settings Dialog */}
        <Dialog open={showRouterSettings} onOpenChange={setShowRouterSettings}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Wifi className="w-5 h-5 mr-2 text-[#7D6C7D]" />
                Router Settings
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnectedToRouter ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={`font-medium ${isConnectedToRouter ? 'text-green-700' : 'text-gray-600'}`}>
                    {isConnectedToRouter ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Scan WiFi Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={scanWiFi}
                disabled={isScanningWiFi}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isScanningWiFi ? 'animate-spin' : ''}`} />
                {isScanningWiFi ? 'Scanning...' : 'Scan for Available WiFis'}
              </Button>

              {/* WiFi Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available WiFi Networks
                </label>
                <Select value={selectedWiFi} onValueChange={handleWiFiSelection}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a WiFi network" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWiFis.length > 0 ? (
                      availableWiFis.map((wifi) => (
                        <SelectItem key={wifi.ssid} value={wifi.ssid}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>{wifi.ssid}</span>
                              {wifi.security !== 'Open' && (
                                <Shield className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                            <span className="text-xs text-gray-500 ml-2">{wifi.signal} dBm</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No networks found. Click scan.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* WiFi Details */}
              {selectedWiFi && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700">Network Details:</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>SSID:</span>
                        <span className="font-medium">{selectedWiFi}</span>
                      </div>
                      {availableWiFis.find(w => w.ssid === selectedWiFi) && (
                        <div className="flex justify-between">
                          <span>Security:</span>
                          <span className="font-medium">{availableWiFis.find(w => w.ssid === selectedWiFi)?.security}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Button (shown when connected) */}
              {isConnectedToRouter && (
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      const success = await syncWithRouter();
                      if (success) {
                        toast({
                          title: 'Database Synced',
                          description: 'Database has been synced with connected devices',
                        });
                      } else {
                        toast({
                          title: 'Sync Failed',
                          description: 'Failed to sync database with connected devices',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Database Now
                  </Button>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRouterSettings(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveRouterSettings}
                  disabled={!selectedWiFi || isConnecting || showPasswordDialog}
                  className="flex-1 bg-[#7D6C7D] hover:bg-[#D89D9D] text-white"
                  style={{
                    boxShadow: '0 4px 12px rgba(125, 108, 125, 0.3)',
                  }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStoreInfoDialog} onOpenChange={setShowStoreInfoDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Store className="w-5 h-5 mr-2 text-[#FF8882]" />
                Store Information
              </DialogTitle>
            </DialogHeader>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="ownerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter owner name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowStoreInfoDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-[#FF8882] hover:bg-[#D89D9D] text-white">
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        

        {/* WiFi Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2 text-[#7D6C7D]" />
                Enter WiFi Password
              </DialogTitle>
              <DialogDescription>
                Enter the password for <strong>{selectedWiFiForPassword}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter WiFi password"
                className="w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    connectToWiFi();
                  }
                }}
              />
              <p className="text-sm text-gray-500">
                Press Enter or click Connect to proceed
              </p>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPasswordInput('');
                  setSelectedWiFiForPassword(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={connectToWiFi}
                disabled={!passwordInput || isConnecting}
                className="bg-[#7D6C7D] hover:bg-[#D89D9D] text-white"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You'll need to log in again to access the app.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-logout">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                data-testid="button-confirm-logout"
                className="bg-red-500 hover:bg-red-600"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </Layout>
  );
};

export default ProfileSettings;
