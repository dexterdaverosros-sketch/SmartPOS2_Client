import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { CartItem } from '@shared/schema';
import { databaseSyncService } from '@/lib/sync';
import { getUnitMultiplier } from '@/lib/utils';

interface AppContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  isOffline: boolean;
  isConnectedToRouter: boolean;
  routerUrl: string | null;
  connectToRouter: (url: string) => Promise<boolean>;
  disconnectFromRouter: () => void;
  syncWithRouter: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isConnectedToRouter, setIsConnectedToRouter] = useState(false);
  const [routerUrl, setRouterUrl] = useState<string | null>(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize router connection from localStorage if available
  useEffect(() => {
    const savedRouterUrl = localStorage.getItem('routerUrl');
    if (savedRouterUrl) {
      setRouterUrl(savedRouterUrl);
      databaseSyncService.setBaseUrl(savedRouterUrl);
      
      // Check if we can connect to the router
      databaseSyncService.checkServerConnection()
        .then(connected => {
          setIsConnectedToRouter(connected);
          if (!connected) {
            // If not connected, clear the router URL
            localStorage.removeItem('routerUrl');
            setRouterUrl(null);
            databaseSyncService.setBaseUrl('');
          }
        });
    }
  }, []);

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const safeItem = {
        ...item,
        price: Number(item.price) || 0,
        subtotal: Math.round(Number(item.subtotal || (item.price * item.quantity * getUnitMultiplier(item.unit))) * 100) / 100,
      };
      const existingItem = prevCart.find(cartItem => cartItem.productId === safeItem.productId && cartItem.unit === safeItem.unit);
      if (existingItem && existingItem.unit === safeItem.unit) {
        const newQuantity = existingItem.quantity + safeItem.quantity;
        const newSubtotal = Math.round(newQuantity * getUnitMultiplier(existingItem.unit) * existingItem.price * 100) / 100;
        return prevCart.map(cartItem =>
          cartItem.productId === safeItem.productId && cartItem.unit === safeItem.unit
            ? { ...cartItem, quantity: newQuantity, subtotal: newSubtotal }
            : cartItem
        );
      }
      return [...prevCart, safeItem];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const updateCartItem = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Round quantity to avoid floating point issues
    const roundedQuantity = Math.max(1, Math.floor(quantity));

    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId
          ? { 
              ...item, 
              quantity: roundedQuantity, 
              price: Number(item.price) || 0, 
              subtotal: Math.round(roundedQuantity * getUnitMultiplier(item.unit) * (Number(item.price) || 0) * 100) / 100 
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  // Connect to router
  const connectToRouter = async (url: string): Promise<boolean> => {
    try {
      // Validate input
      if (!url || typeof url !== 'string' || url.trim() === '') {
        console.error('Invalid URL provided: empty or null');
        return false;
      }

      const trimmedUrl = url.trim();
      
      // Validate URL format
      try {
        new URL(trimmedUrl);
      } catch (e) {
        console.error('Invalid URL format:', trimmedUrl);
        return false;
      }

      // Set the router URL
      setRouterUrl(trimmedUrl);
      databaseSyncService.setBaseUrl(trimmedUrl);
      
      // Check if we can connect to the router
      const connected = await databaseSyncService.checkServerConnection();
      setIsConnectedToRouter(connected);
      
      if (connected) {
        // Save the router URL to localStorage
        localStorage.setItem('routerUrl', trimmedUrl);
        
        // Sync with the router
        try {
          await syncWithRouter();
        } catch (syncError) {
          console.error('Initial sync failed:', syncError);
          // Continue even if sync fails, connection is still valid
        }
      } else {
        // If not connected, clear the router URL
        setRouterUrl(null);
        databaseSyncService.setBaseUrl('');
        console.error('Failed to connect to router at:', trimmedUrl);
      }
      
      return connected;
    } catch (error) {
      console.error('Error connecting to router:', error);
      setIsConnectedToRouter(false);
      setRouterUrl(null);
      databaseSyncService.setBaseUrl('');
      return false;
    }
  };

  // Disconnect from router
  const disconnectFromRouter = () => {
    try {
      setIsConnectedToRouter(false);
      setRouterUrl(null);
      databaseSyncService.setBaseUrl('');
      localStorage.removeItem('routerUrl');
      console.log('Successfully disconnected from router');
    } catch (error) {
      console.error('Error disconnecting from router:', error);
    }
  };

  // Sync with router
  const syncWithRouter = async (): Promise<boolean> => {
    try {
      if (!routerUrl) {
        console.error('No router URL configured for sync');
        return false;
      }
      
      if (!isConnectedToRouter) {
        console.error('Not connected to router, cannot sync');
        return false;
      }
      
      await databaseSyncService.syncDatabase();
      console.log('Database sync completed successfully');
      return true;
    } catch (error) {
      console.error('Error during database sync:', error);
      
      // If sync fails due to connection issues, disconnect from router
      if (error instanceof Error && (error.message.includes('Network error') || error.message.includes('timed out'))) {
        console.log('Connection lost, disconnecting from router');
        disconnectFromRouter();
      }
      
      return false;
    }
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    getCartTotal,
    isOffline,
    isConnectedToRouter,
    routerUrl,
    connectToRouter,
    disconnectFromRouter,
    syncWithRouter,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
