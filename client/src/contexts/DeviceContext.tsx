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
  // Printer-specific cached resources
  bluetoothServer?: any;
  bluetoothCharacteristic?: any;
  usbEndpoint?: any;
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
      let hasRealDevices = false;
      
      // 1. Scan for USB devices
      if (isUSBSupported) {
        try {
          const usbDevices = await (navigator as any).usb.getDevices();
          if (usbDevices.length > 0) hasRealDevices = true;
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
          if (printers.length > 0) hasRealDevices = true;
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
      }

      // 3. If no real devices, add fallback demo devices (for testing)
      if (!hasRealDevices && newAvailableDevices.length === 0) {
        newAvailableDevices.push(
          {
            id: 'demo-epson',
            name: 'Epson TM-T88VI Thermal Printer',
            type: 'printer',
            connection: 'usb',
            device: null,
            isOperational: true
          },
          {
            id: 'demo-bluetooth',
            name: 'Bluetooth Thermal Printer 58mm',
            type: 'printer',
            connection: 'bluetooth',
            device: null,
            isOperational: true
          }
        );
      }

      // 4. Validate all devices are operational
      const validatedDevices = [];
      for (const device of newAvailableDevices) {
        const isOperational = device.device === null ? true : await validateDeviceConnection(device);
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

      // Find and store endpoint for printers
      let usbEndpoint = null;
      if (type === 'printer') {
        const config = device.configuration;
        if (config?.interfaces?.length > 0) {
          const iface = config.interfaces[0];
          if (iface.alternate?.endpoints) {
            usbEndpoint = iface.alternate.endpoints.find(
              ep => ep.type === 'bulk' && ep.direction === 'out'
            );
          }
        }
        if (!usbEndpoint) {
          usbEndpoint = { endpointNumber: 1 };
        }
      }

      const newDevice: ExternalDevice = {
        id: `usb-${device.productId}-${device.vendorId}`,
        name: device.productName || `USB Device ${device.productId}`,
        type,
        connection: 'usb',
        device,
        isOperational: true,
        usbEndpoint
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
      let bluetoothCharacteristic = null;
      
      // For printers, get the characteristic now
      if (type === 'printer') {
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      }
      
      const newDevice: ExternalDevice = {
        id: `bt-${device.id}`,
        name: device.name || `Bluetooth Device ${device.id}`,
        type,
        connection: 'bluetooth',
        device,
        isOperational: true,
        bluetoothServer: server,
        bluetoothCharacteristic
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
      console.log('[PRINT LOG]: Attempting to print to', printer.name, content);
      
      if (!printer.device) {
        toast({ title: 'Print Failed', description: 'No hardware printer connected. Please connect via USB or Bluetooth.', variant: 'destructive' });
        return false;
      }
      
      let device = printer.device;
      
      // Ensure USB device is still open and configured
      if (printer.connection === 'usb') {
        if (!device.opened) {
          console.log('[PRINT LOG]: Reopening USB device...');
          await device.open();
        }
        if (device.configuration === null) {
          console.log('[PRINT LOG]: Selecting USB configuration...');
          await device.selectConfiguration(1);
        }
        // Check if interface is claimed
        const config = device.configuration;
        if (config?.interfaces?.length > 0) {
          const iface = config.interfaces[0];
          if (!iface.claimed) {
            console.log('[PRINT LOG]: Claiming USB interface...');
            await device.claimInterface(0);
          }
        }
        
        // Use cached endpoint if available, else find again
        let outEndpoint = printer.usbEndpoint;
        if (!outEndpoint) {
          const currentConfig = device.configuration;
          if (currentConfig?.interfaces?.length > 0) {
            const iface = currentConfig.interfaces[0];
            if (iface.alternate?.endpoints) {
              outEndpoint = iface.alternate.endpoints.find(
                ep => ep.type === 'bulk' && ep.direction === 'out'
              );
            }
          }
          if (!outEndpoint) {
            outEndpoint = { endpointNumber: 1 };
          }
        }

        // Prepare ESC/POS data
        const encoder = new TextEncoder();
        // ESC @ (initialize printer), then content, then line feeds, then cut (optional)
        const escPosInit = new Uint8Array([0x1B, 0x40]);
        const textData = encoder.encode(content);
        const lineFeeds = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A]);
        const cutCommand = new Uint8Array([0x1D, 0x56, 0x42, 0x00]); // Partial cut
        const fullData = new Uint8Array([...escPosInit, ...textData, ...lineFeeds, ...cutCommand]);
        
        await device.transferOut(outEndpoint.endpointNumber, fullData);
      } else if (printer.connection === 'bluetooth') {
        // Ensure Bluetooth is connected
        let server = printer.bluetoothServer;
        let characteristic = printer.bluetoothCharacteristic;
        
        try {
          if (!device.gatt.connected || !server) {
            console.log('[PRINT LOG]: Reconnecting Bluetooth...');
            server = await device.gatt.connect();
            // Update cached server
            setConnectedDevices(prev => prev.map(d => 
              d.id === printer.id ? { ...d, bluetoothServer: server } : d
            ));
            
            // Re-fetch characteristic if needed
            if (!characteristic) {
              const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
              characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
              // Update cached characteristic
              setConnectedDevices(prev => prev.map(d => 
                d.id === printer.id ? { ...d, bluetoothCharacteristic: characteristic } : d
              ));
            }
          } else {
            server = device.gatt;
          }
        } catch (e) {
          console.log('[PRINT LOG]: Bluetooth not connected, connecting fresh...');
          server = await device.gatt.connect();
          const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
          characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
          // Update both server and characteristic in state
          setConnectedDevices(prev => prev.map(d => 
            d.id === printer.id ? { 
              ...d, 
              bluetoothServer: server, 
              bluetoothCharacteristic: characteristic 
            } : d
          ));
        }
        
        const encoder = new TextEncoder();
        const escPosInit = new Uint8Array([0x1B, 0x40]);
        const textData = encoder.encode(content);
        const lineFeeds = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A]);
        const cutCommand = new Uint8Array([0x1D, 0x56, 0x42, 0x00]);
        const fullData = new Uint8Array([...escPosInit, ...textData, ...lineFeeds, ...cutCommand]);

        await characteristic.writeValue(fullData);
      } else {
        toast({ title: 'Print Failed', description: 'Unsupported printer connection type.', variant: 'destructive' });
        return false;
      }

      toast({ title: 'Print Successful', description: 'Receipt sent to printer.' });
      return true;
    } catch (error) {
      console.error('[PRINT ERROR]:', error);
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
