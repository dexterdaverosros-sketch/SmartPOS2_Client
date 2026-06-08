import React, { useEffect, useState } from 'react';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useDevices } from '@/contexts/DeviceContext';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
  fullWidth?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showNavigation = true, fullWidth = false }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const { isOffline } = useApp();
  const { deviceMode } = useDevices();
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getLayoutWidth = () => {
    if (fullWidth) return "w-full";
    
    switch (deviceMode) {
      case 'pc':
        return "w-full max-w-full";
      case 'tablet':
        return "w-full max-w-5xl";
      case 'mobile':
        return "w-full max-w-md mx-auto";
      default:
        return "w-full sm:w-[95%] md:max-w-2xl lg:max-w-4xl xl:max-w-6xl";
    }
  };

  return (
    <div className={cn(
      "min-h-screen bg-background relative",
      getLayoutWidth(),
      "transition-all duration-300"
    )}>
      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-warning-500 text-white text-center py-2 text-sm z-50 flex items-center justify-center">
          <WifiOff className="w-4 h-4 inline-block mr-2" />
          <span>Offline Mode</span>
        </div>
      )}
      
      {/* Main Content */}
      <main className={cn(
        "min-h-screen", 
        isOffline && "pt-10", 
        showNavigation && isAuthenticated && isAdmin && "pb-24",
        "px-2 sm:px-4 md:px-6"
      )}>
        {children}
      </main>
      
      {/* Bottom Navigation */}
      {showNavigation && isAuthenticated && <BottomNavigation />}

      
    </div>
  );
};

export default Layout;
