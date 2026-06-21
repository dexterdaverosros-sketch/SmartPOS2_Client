import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExternalDeviceManager from '@/components/ExternalDeviceManager';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

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

type SettingsResponse = {
  receipt?: Partial<ReceiptSettings>;
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

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(defaultReceiptSettings);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data: SettingsResponse = await api.get('/api/settings');
        const merged: ReceiptSettings = {
          ...defaultReceiptSettings,
          ...(data.receipt || {}),
        };
        if (mounted) {
          setReceiptSettings(merged);
        }
      } catch {
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', { receipt: receiptSettings });
      toast({
        title: 'Settings Saved',
        description: 'Receipt settings have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      await api.post('/api/print/test-receipt', {});
      toast({
        title: 'Test Receipt Sent',
        description: 'Check your connected printer for the test receipt.',
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
    <Layout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Admin Settings</h1>
        </div>

        <Tabs defaultValue="receipt" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-gray-800 border dark:border-gray-700 mb-4">
            <TabsTrigger value="receipt" className="data-[state=active]:bg-[#FF8882] data-[state=active]:text-white">
              Receipt Configuration
            </TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-[#FF8882] data-[state=active]:text-white">
              External Devices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receipt">
            <Card className="p-3 space-y-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Receipt Configuration</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Customize how receipts look when printing from the scanner and sales screen.
                </p>
              </div>

              {loading ? (
                <div className="text-sm text-gray-500">Loading settings…</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="storeName" className="dark:text-gray-300 text-sm">Store Name</Label>
                      <Input
                        id="storeName"
                        value={receiptSettings.storeName}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({ ...s, storeName: e.target.value }))
                        }
                        placeholder="SmartPOS+ Store"
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="storePhone" className="dark:text-gray-300 text-sm">Store Phone</Label>
                      <Input
                        id="storePhone"
                        value={receiptSettings.storePhone}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({ ...s, storePhone: e.target.value }))
                        }
                        placeholder="+63 900 000 0000"
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="storeAddress" className="dark:text-gray-300 text-sm">Store Address</Label>
                    <Textarea
                      id="storeAddress"
                      value={receiptSettings.storeAddress}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({ ...s, storeAddress: e.target.value }))
                      }
                      placeholder="Street, City, Province, ZIP"
                      rows={1.5}
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="headerNote" className="dark:text-gray-300 text-sm">Header Note</Label>
                      <Textarea
                        id="headerNote"
                        value={receiptSettings.headerNote}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({ ...s, headerNote: e.target.value }))
                        }
                        rows={1.5}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="footerNote" className="dark:text-gray-300 text-sm">Footer Note</Label>
                      <Textarea
                        id="footerNote"
                        value={receiptSettings.footerNote}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({ ...s, footerNote: e.target.value }))
                        }
                        rows={1.5}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="printerDeviceName" className="dark:text-gray-300 text-sm">Printer Name</Label>
                      <Input
                        id="printerDeviceName"
                        value={receiptSettings.printerDeviceName}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({ ...s, printerDeviceName: e.target.value }))
                        }
                        placeholder="Leave empty for system default"
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9"
                      />
                      <p className="text-xs text-gray-500">
                        Optional. Use the exact printer name from your system.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="dark:text-gray-300 text-sm">Paper Width</Label>
                      <Select
                        value={receiptSettings.paperWidth}
                        onValueChange={(value: '58mm' | '80mm') =>
                          setReceiptSettings((s) => ({ ...s, paperWidth: value }))
                        }
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="58mm" className="dark:text-white">58mm</SelectItem>
                          <SelectItem value="80mm" className="dark:text-white">80mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="dark:text-gray-300 text-sm">Auto Print on Sale</Label>
                      <div className="flex items-center justify-between rounded-lg border dark:border-gray-600 px-3 py-2 h-9">
                        <span className="text-xs text-gray-700 dark:text-gray-300">Auto print</span>
                        <Switch
                          checked={receiptSettings.autoPrintOnSale}
                          onCheckedChange={(checked) =>
                            setReceiptSettings((s) => ({ ...s, autoPrintOnSale: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-lg border dark:border-gray-600 px-3 py-2 h-10">
                      <div>
                        <div className="text-xs font-medium text-gray-800 dark:text-white">Show Date & Time</div>
                      </div>
                      <Switch
                        checked={receiptSettings.showDateTime}
                        onCheckedChange={(checked) =>
                          setReceiptSettings((s) => ({ ...s, showDateTime: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border dark:border-gray-600 px-3 py-2 h-10">
                      <div>
                        <div className="text-xs font-medium text-gray-800 dark:text-white">Show Staff Name</div>
                      </div>
                      <Switch
                        checked={receiptSettings.showStaffName}
                        onCheckedChange={(checked) =>
                          setReceiptSettings((s) => ({ ...s, showStaffName: checked }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestPrint}
                      disabled={saving}
                      className="dark:text-white dark:border-gray-600 h-9"
                    >
                      Print Test Receipt
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="bg-[#FF8882] hover:bg-[#FF7770] text-white h-9">
                      {saving ? 'Saving…' : 'Save Settings'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <ExternalDeviceManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
