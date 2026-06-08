import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

export type DeviceMode = 'pc' | 'tablet' | 'mobile';

interface ExternalDevice {
  id: string;
  name: string;
  type: 'scanner' | 'printer';
  connection: 'usb' | 'bluetooth';
  device?: any; // The raw USBDevice or BluetoothDevice
}

interface DeviceContextType {
  deviceMode: DeviceMode | null;
  setDeviceMode: (mode: DeviceMode) => void;
  connectedDevices: ExternalDevice[];
  connectUSBDevice: (type: 'scanner' | 'printer') => Promise<void>;
  connectBluetoothDevice: (type: 'scanner' | 'printer') => Promise<void>;
  disconnectDevice: (id: string) => void;
  printToThermalPrinter: (content: string) => Promise<boolean>;
  isUSBSupported: boolean;
  isBluetoothSupported: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deviceMode, setDeviceModeState] = useState<DeviceMode | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ExternalDevice[]>([]);
  const { toast } = useToast();

  const isUSBSupported = 'usb' in navigator;
  const isBluetoothSupported = 'bluetooth' in navigator;

  // Initialize from localStorage
  useEffect(() => {
    const savedDevices = localStorage.getItem('smartpos_external_devices');
    if (savedDevices) {
      try {
        const parsed = JSON.parse(savedDevices);
        setConnectedDevices(parsed.map((d: any) => ({ ...d, device: null })));
      } catch (e) {
        console.error('Failed to load external devices:', e);
      }
    }

    const savedMode = localStorage.getItem('smartpos_device_mode') as DeviceMode;
    if (savedMode && ['pc', 'tablet', 'mobile'].includes(savedMode)) {
      setDeviceModeState(savedMode);
    }
  }, []);

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    localStorage.setItem('smartpos_device_mode', mode);
  };

  // Save devices to localStorage whenever they change
  useEffect(() => {
    const metadata = connectedDevices.map(({ id, name, type, connection }) => ({ id, name, type, connection }));
    localStorage.setItem('smartpos_external_devices', JSON.stringify(metadata));
  }, [connectedDevices]);

  const connectUSBDevice = async (type: 'scanner' | 'printer') => {
    if (!isUSBSupported) {
      toast({ title: 'USB Not Supported', description: 'Your browser does not support WebUSB.', variant: 'destructive' });
      return;
    }

    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);

      const newDevice: ExternalDevice = {
        id: `usb-${device.productId}-${device.vendorId}`,
        name: device.productName || `USB Device ${device.productId}`,
        type,
        connection: 'usb',
        device,
      };

      setConnectedDevices(prev => [...prev, newDevice]);
      toast({ title: 'Device Connected', description: `${newDevice.name} connected successfully.` });
    } catch (error) {
      console.error('USB Connection Error:', error);
      toast({ title: 'Connection Failed', description: 'Could not connect to USB device.', variant: 'destructive' });
    }
  };

  const connectBluetoothDevice = async (type: 'scanner' | 'printer') => {
    if (!isBluetoothSupported) {
      toast({ title: 'Bluetooth Not Supported', description: 'Your browser does not support Web Bluetooth.', variant: 'destructive' });
      return;
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Common for thermal printers
      });

      const server = await device.gatt.connect();
      
      const newDevice: ExternalDevice = {
        id: `bt-${device.id}`,
        name: device.name || `Bluetooth Device ${device.id}`,
        type,
        connection: 'bluetooth',
        device,
      };

      setConnectedDevices(prev => [...prev, newDevice]);
      toast({ title: 'Device Connected', description: `${newDevice.name} connected successfully.` });
    } catch (error) {
      console.error('Bluetooth Connection Error:', error);
      toast({ title: 'Connection Failed', description: 'Could not connect to Bluetooth device.', variant: 'destructive' });
    }
  };

  const disconnectDevice = (id: string) => {
    setConnectedDevices(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Device Disconnected', description: 'Device removed successfully.' });
  };

  const printToThermalPrinter = async (content: string): Promise<boolean> => {
    const printer = connectedDevices.find(d => d.type === 'printer');
    if (!printer) {
      toast({ title: 'No Printer', description: 'Please connect a printer first.', variant: 'destructive' });
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content + '\n\n\n'); // Add some extra lines for paper feed

      if (printer.connection === 'usb' && printer.device) {
        await printer.device.transferOut(1, data);
      } else if (printer.connection === 'bluetooth' && printer.device) {
        const server = await printer.device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        await characteristic.writeValue(data);
      }

      toast({ title: 'Print Successful', description: 'Receipt sent to printer.' });
      return true;
    } catch (error) {
      console.error('Printing Error:', error);
      toast({ title: 'Print Failed', description: 'Could not send data to printer.', variant: 'destructive' });
      return false;
    }
  };

  return (
    <DeviceContext.Provider value={{
      deviceMode,
      setDeviceMode,
      connectedDevices,
      connectUSBDevice,
      connectBluetoothDevice,
      disconnectDevice,
      printToThermalPrinter,
      isUSBSupported,
      isBluetoothSupported
    }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
};
