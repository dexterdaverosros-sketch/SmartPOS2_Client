import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

export type DeviceMode = 'pc' | 'tablet' | 'mobile';

interface ExternalDevice {
  id: string;
  name: string;
  type: 'scanner' | 'printer';
  connection: 'usb' | 'bluetooth' | 'system';
  device?: any; // The raw USBDevice, BluetoothDevice, or PrinterInfo
  isDefault?: boolean;
  isOperational?: boolean;
}

interface DeviceContextType {
  deviceMode: DeviceMode | null;
  setDeviceMode: (mode: DeviceMode) => void;
  connectedDevices: ExternalDevice[];
  availableDevices: ExternalDevice[];
  isScanning: boolean;
  scanForDevices: () => Promise<void>;
  connectUSBDevice: (type: 'scanner' | 'printer') => Promise<void>;
  connectBluetoothDevice: (type: 'scanner' | 'printer') => Promise<void>;
  selectDevice: (device: ExternalDevice) => void;
  setDefaultPrinter: (deviceId: string) => void;
  disconnectDevice: (id: string) => void;
  printToThermalPrinter: (content: string) => Promise<boolean>;
  isUSBSupported: boolean;
  isBluetoothSupported: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Helper to validate if a device is operational
const validateDeviceConnection = async (device: ExternalDevice): Promise<boolean> => {
  try {
    if (device.connection === 'usb' && device.device) {
      // Check if USB device is still open and accessible
      return device.device.opened;
    } else if (device.connection === 'bluetooth' && device.device) {
      // Check if Bluetooth device is still connected
      return device.device.gatt.connected;
    } else if (device.connection === 'system') {
      // For system printers, we assume they are available if listed
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deviceMode, setDeviceModeState] = useState<DeviceMode | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ExternalDevice[]>([]);
  const [availableDevices, setAvailableDevices] = useState<ExternalDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const isUSBSupported = 'usb' in navigator;
  const isBluetoothSupported = 'bluetooth' in navigator;

  // Load saved devices from localStorage
  useEffect(() => {
    const savedDevices = localStorage.getItem('smartpos_external_devices');
    const savedDefaultPrinter = localStorage.getItem('smartpos_default_printer');
    if (savedDevices) {
      try {
        const parsed = JSON.parse(savedDevices);
        const withDefault = parsed.map((d: any) => ({
          ...d,
          device: null,
          isDefault: savedDefaultPrinter === d.id
        }));
        setConnectedDevices(withDefault);
      } catch (e) {
        console.error('Failed to load external devices:', e);
      }
    }

    const savedMode = localStorage.getItem('smartpos_device_mode') as DeviceMode;
    if (savedMode && ['pc', 'tablet', 'mobile'].includes(savedMode)) {
      setDeviceModeState(savedMode);
    }
  }, []);

  // Save devices to localStorage whenever they change
  useEffect(() => {
    const metadata = connectedDevices.map(({ id, name, type, connection, isDefault }) => ({ id, name, type, connection, isDefault }));
    localStorage.setItem('smartpos_external_devices', JSON.stringify(metadata));
    const defaultPrinter = connectedDevices.find(d => d.isDefault);
    if (defaultPrinter) {
      localStorage.setItem('smartpos_default_printer', defaultPrinter.id);
    } else {
      localStorage.removeItem('smartpos_default_printer');
    }
  }, [connectedDevices]);

  // Set up real-time device listeners
  useEffect(() => {
    const handleUSBConnect = async (event: any) => {
      const device = event.device;
      toast({
        title: 'USB Device Connected',
        description: device.productName || 'New USB device detected'
      });
      await scanForDevices();
    };

    const handleUSBDisconnect = async (event: any) => {
      const device = event.device;
      const deviceId = `usb-${device.productId}-${device.vendorId}`;
      
      // Remove from connected devices if present
      setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
      
      toast({
        title: 'USB Device Disconnected',
        description: device.productName || 'USB device removed'
      });
      
      await scanForDevices();
    };

    if (isUSBSupported) {
      (navigator as any).usb.addEventListener('connect', handleUSBConnect);
      (navigator as any).usb.addEventListener('disconnect', handleUSBDisconnect);
    }

    // Initial scan on mount
    scanForDevices();

    return () => {
      if (isUSBSupported) {
        (navigator as any).usb.removeEventListener('connect', handleUSBConnect);
        (navigator as any).usb.removeEventListener('disconnect', handleUSBDisconnect);
      }
    };
  }, []);

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    localStorage.setItem('smartpos_device_mode', mode);
  };

  const scanForDevices = async () => {
    setIsScanning(true);
    const newAvailableDevices: ExternalDevice[] = [];
    
    try {
      // 1. Scan for USB devices
      if (isUSBSupported) {
        try {
          const usbDevices = await (navigator as any).usb.getDevices();
          for (const device of usbDevices) {
            const isOperational = await validateDeviceConnection({
              id: `usb-${device.productId}-${device.vendorId}`,
              name: device.productName || `USB Device ${device.productId}`,
              type: 'printer', // Default to printer, can be scanner too
              connection: 'usb',
              device
            });
            
            newAvailableDevices.push({
              id: `usb-${device.productId}-${device.vendorId}`,
              name: device.productName || `USB Device ${device.productId}`,
              type: 'printer',
              connection: 'usb',
              device,
              isOperational
            });
          }
        } catch (usbError) {
          console.warn('USB scan error:', usbError);
        }
      }

      // 2. Get system printers (using experimental API if available)
      try {
        if ('printerManager' in navigator) {
          const printers = await (navigator as any).printerManager.getPrinters();
          for (const printer of printers) {
            newAvailableDevices.push({
              id: `printer-${printer.name}`,
              name: printer.name,
              type: 'printer',
              connection: 'system',
              device: printer,
              isOperational: true
            });
          }
        }
      } catch (printerError) {
        console.warn('System printer scan error:', printerError);
        // Fallback: if we can't get real printers, at least keep the UI functional
      }

      // 3. Validate all devices are operational
      const validatedDevices = [];
      for (const device of newAvailableDevices) {
        const isOperational = await validateDeviceConnection(device);
        if (isOperational) {
          validatedDevices.push({ ...device, isOperational: true });
        }
      }

      setAvailableDevices(validatedDevices);
      toast({
        title: 'Scan Complete',
        description: `Found ${validatedDevices.length} available device(s)`
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan Failed',
        description: 'Could not complete device scan. Please check permissions.',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const selectDevice = async (device: ExternalDevice) => {
    try {
      // Validate device before connecting
      const isOperational = await validateDeviceConnection(device);
      if (!isOperational) {
        throw new Error('Device is not operational');
      }

      const newDevice: ExternalDevice = {
        ...device,
        isOperational: true
      };
      
      // Check if already connected
      const alreadyConnected = connectedDevices.some(d => d.id === device.id);
      if (!alreadyConnected) {
        setConnectedDevices(prev => [...prev, newDevice]);
        toast({ title: 'Device Connected', description: `${device.name} is now connected` });
      } else {
        toast({ title: 'Device Already Connected', description: `${device.name} is already in use` });
      }
    } catch (error) {
      console.error('Device connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Could not connect to device',
        variant: 'destructive'
      });
    }
  };

  const setDefaultPrinter = (deviceId: string) => {
    setConnectedDevices(prev => prev.map(d => ({
      ...d,
      isDefault: d.id === deviceId
    })));
    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) {
      toast({ title: 'Default Printer Set', description: `${device.name} is now your default printer` });
    }
  };

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
        isOperational: true
      };

      // Check if already connected
      const alreadyConnected = connectedDevices.some(d => d.id === newDevice.id);
      if (!alreadyConnected) {
        setConnectedDevices(prev => [...prev, newDevice]);
      }
      
      // Add to available devices if not present
      setAvailableDevices(prev => {
        if (prev.some(d => d.id === newDevice.id)) return prev;
        return [...prev, newDevice];
      });
      
      toast({ title: 'Device Connected', description: `${newDevice.name} connected successfully.` });
    } catch (error) {
      console.error('USB Connection Error:', error);
      toast({ title: 'Connection Failed', description: 'Could not connect to USB device. Did you grant permission?', variant: 'destructive' });
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
        isOperational: true
      };

      // Check if already connected
      const alreadyConnected = connectedDevices.some(d => d.id === newDevice.id);
      if (!alreadyConnected) {
        setConnectedDevices(prev => [...prev, newDevice]);
      }
      
      // Add to available devices if not present
      setAvailableDevices(prev => {
        if (prev.some(d => d.id === newDevice.id)) return prev;
        return [...prev, newDevice];
      });

      toast({ title: 'Device Connected', description: `${newDevice.name} connected successfully.` });
    } catch (error) {
      console.error('Bluetooth Connection Error:', error);
      toast({ title: 'Connection Failed', description: 'Could not connect to Bluetooth device. Did you grant permission?', variant: 'destructive' });
    }
  };

  const disconnectDevice = async (id: string) => {
    const device = connectedDevices.find(d => d.id === id);
    if (device) {
      try {
        if (device.connection === 'usb' && device.device && device.device.opened) {
          await device.device.close();
        } else if (device.connection === 'bluetooth' && device.device && device.device.gatt.connected) {
          device.device.gatt.disconnect();
        }
      } catch (e) {
        console.warn('Error while disconnecting:', e);
      }
    }
    
    setConnectedDevices(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Device Disconnected', description: 'Device removed successfully.' });
    
    // Re-scan available devices
    await scanForDevices();
  };

  const printToThermalPrinter = async (content: string): Promise<boolean> => {
    const printer = connectedDevices.find(d => d.type === 'printer' && d.isDefault) || connectedDevices.find(d => d.type === 'printer');
    if (!printer) {
      toast({ title: 'No Printer', description: 'Please connect and set a default printer first.', variant: 'destructive' });
      return false;
    }

    try {
      if (printer.connection === 'system') {
        // Use system printer via browser's print dialog
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`<pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>`);
          printWindow.document.close();
          printWindow.print();
        }
      } else if (printer.connection === 'usb' && printer.device) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content + '\n\n\n'); // Add some extra lines for paper feed
        await printer.device.transferOut(1, data);
      } else if (printer.connection === 'bluetooth' && printer.device) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content + '\n\n\n');
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
      availableDevices,
      isScanning,
      scanForDevices,
      connectUSBDevice,
      connectBluetoothDevice,
      selectDevice,
      setDefaultPrinter,
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
