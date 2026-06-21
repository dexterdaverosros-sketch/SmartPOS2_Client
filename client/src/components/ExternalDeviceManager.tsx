import React, { useState } from 'react';
import { 
  Bluetooth, 
  Usb, 
  Plus, 
  Trash2, 
  Smartphone, 
  HardDrive, 
  Search, 
  Printer, 
  Scan, 
  CheckCircle2, 
  Settings, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDevices } from '@/contexts/DeviceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';

const ExternalDeviceManager: React.FC = () => {
  const { 
    connectedDevices, 
    availableDevices, 
    isScanning, 
    scanForDevices, 
    selectDevice, 
    setDefaultPrinter,
    disconnectDevice, 
    isUSBSupported, 
    isBluetoothSupported,
    connectUSBDevice,
    connectBluetoothDevice
  } = useDevices();
  const { toast } = useToast();
  const [showReceiptConfig, setShowReceiptConfig] = useState(false);

  const defaultPrinter = connectedDevices.find(d => d.type === 'printer' && d.isDefault);
  const connectedPrinters = connectedDevices.filter(d => d.type === 'printer');
  const availablePrinters = availableDevices.filter(d => d.type === 'printer');

  return (
    <div className="space-y-6">
      {/* Printer Setup Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Printer className="w-5 h-5 text-[#FF8882]" />
            Printer Setup
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Connect and configure your thermal printer for receipt printing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connected Status */}
          {defaultPrinter && (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-sm font-semibold text-green-800 dark:text-green-200">Connected</div>
                <div className="text-sm text-green-700 dark:text-green-300">{defaultPrinter.name} is ready to print receipts</div>
              </div>
            </div>
          )}

          {/* Available Printers List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Printer Device Available</h4>
            <div className="space-y-2">
              {availablePrinters.map((device) => {
                const isConnected = connectedDevices.some(d => d.id === device.id);
                return (
                  <div 
                    key={device.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium dark:text-white">{device.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 uppercase">
                          {device.connection === 'usb' ? <Usb className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
                          {device.connection}
                        </div>
                      </div>
                    </div>
                    {isConnected ? (
                      <Badge variant="default" className="bg-green-600">Connected</Badge>
                    ) : (
                      <Button 
                        onClick={() => selectDevice(device)}
                        className="bg-[#FF8882] hover:bg-[#FF7770] text-white"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connect Buttons */}
          <div className="flex flex-wrap gap-2">
            {isUSBSupported && (
              <Button 
                onClick={() => connectUSBDevice('printer')} 
                className="bg-[#FF8882] hover:bg-[#FF7770] text-white"
              >
                <Usb className="w-4 h-4 mr-2" />
                Connect via USB
              </Button>
            )}
            {isBluetoothSupported && (
              <Button 
                onClick={() => connectBluetoothDevice('printer')} 
                className="bg-[#FF8882] hover:bg-[#FF7770] text-white"
              >
                <Bluetooth className="w-4 h-4 mr-2" />
                Connect via Bluetooth
              </Button>
            )}
            <Button 
              onClick={scanForDevices} 
              disabled={isScanning}
              variant="outline"
              className="dark:text-white dark:border-gray-600"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Scan
                </>
              )}
            </Button>
          </div>

          {/* Connected Printers & Set Default */}
          {connectedPrinters.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Connected Printers</h4>
              <div className="space-y-2">
                {connectedPrinters.map((device) => (
                  <div 
                    key={device.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${device.isDefault ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'}`}>
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium dark:text-white flex items-center gap-2">
                          {device.name}
                          {device.isDefault && <Badge variant="default" className="bg-green-600">Default</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 uppercase">
                          {device.connection === 'usb' ? <Usb className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
                          {device.connection}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!device.isDefault && (
                        <Button 
                          onClick={() => setDefaultPrinter(device.id)}
                          variant="outline"
                          className="dark:text-white dark:border-gray-600"
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => disconnectDevice(device.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt Configuration Button */}
          <div className="pt-2">
            <Button 
              onClick={() => {
                // Find the admin settings tab and switch to receipt
                const receiptTab = document.querySelector('[data-value="receipt"]') as HTMLElement;
                if (receiptTab) {
                  receiptTab.click();
                }
                toast({ title: 'Receipt Configuration', description: 'Opening receipt configuration...' });
              }}
              variant="outline"
              className="w-full sm:w-auto dark:text-white dark:border-gray-600"
            >
              <Settings className="w-4 h-4 mr-2" />
              Receipt Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanner & Other Devices Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <Scan className="w-5 h-5 text-[#FF8882]" />
            Scanners & Other Devices
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Connect external scanners and other hardware.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Scan className="w-4 h-4" /> External Scanner
              </h4>
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    if (isUSBSupported) {
                      // For demo, select the first available scanner
                      const scanner = availableDevices.find(d => d.type === 'scanner');
                      if (scanner) {
                        await selectDevice(scanner);
                      }
                    }
                  }}
                  disabled={!isUSBSupported}
                  variant="outline"
                  className="flex-1 gap-2 dark:text-white dark:border-gray-600"
                >
                  <Usb className="w-4 h-4" /> USB
                </Button>
                <Button 
                  onClick={async () => {
                    if (isBluetoothSupported) {
                      // For demo, select the first available scanner
                      const scanner = availableDevices.find(d => d.type === 'scanner');
                      if (scanner) {
                        await selectDevice(scanner);
                      }
                    }
                  }}
                  disabled={!isBluetoothSupported}
                  variant="outline"
                  className="flex-1 gap-2 dark:text-white dark:border-gray-600"
                >
                  <Bluetooth className="w-4 h-4" /> BT
                </Button>
              </div>
            </div>
          </div>

          {/* All Connected Devices */}
          <div className="pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">All Connected Devices</h4>
            <div className="space-y-2">
              <AnimatePresence>
                {connectedDevices.map((device) => (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${device.type === 'printer' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {device.type === 'printer' ? <Printer className="w-4 h-4" /> : <Scan className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium dark:text-white">{device.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 uppercase">
                          {device.connection === 'usb' ? <Usb className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
                          {device.connection}
                          {device.isDefault && ' • Default'}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => disconnectDevice(device.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {connectedDevices.length === 0 && (
                <div className="text-center py-8">
                  <Smartphone className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No external devices connected.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalDeviceManager;
