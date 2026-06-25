import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@shared/schema';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { AuthService } from '@/lib/db';

interface AuthContextType {
  user: User | null;
  token: string | null;
  socket: Socket | null;
  login: (user: User, token?: string) => void;
  loginStaff: (staffId: string, passkey: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    // Check for guest mode expiry
    const guestMode = localStorage.getItem('smartpos_guest_mode') === 'true';
    const guestExpiry = localStorage.getItem('smartpos_guest_expiry');
    
    if (guestMode && guestExpiry) {
      const expiryDate = new Date(guestExpiry);
      const now = new Date();
      
      if (now > expiryDate) {
        // Guest mode expired - clean up everything
        localStorage.removeItem('smartpos_guest_mode');
        localStorage.removeItem('smartpos_guest_user_id');
        localStorage.removeItem('smartpos_guest_expiry');
        localStorage.removeItem('smartpos_user');
        localStorage.removeItem('smartpos_token');
        // Also clear any other local storage items related to the app
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('smartpos_')) {
            localStorage.removeItem(key);
          }
        });
        setIsGuest(false);
        setUser(null);
        setToken(null);
      } else {
        setIsGuest(true);
      }
    }
  }, []);

  useEffect(() => {
    // Initialize socket by asking the server for the correct origin (works across LAN)
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/api/server-info');
        if (cancelled) return;

        // Simplified socket initialization for dev/prod stability
        let socketUrl = window.location.origin;
        if (socketUrl.includes('localhost')) {
          socketUrl = socketUrl.replace('localhost', '127.0.0.1');
        }
        
        if (window.location.hostname.includes('netlify.app')) {
          socketUrl = 'https://smartposv4.onrender.com';
        }

        const newSocket = io(socketUrl, {
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          timeout: 20000,
          autoConnect: true
        });
        setSocket(newSocket);

        return () => {
          cancelled = true;
          newSocket.close();
        };
      } catch (error) {
        console.warn('Socket init failed:', error);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Check for stored auth on startup
    const storedUser = localStorage.getItem('smartpos_user');
    const storedToken = localStorage.getItem('smartpos_token');
    const guestMode = localStorage.getItem('smartpos_guest_mode') === 'true';

    if (guestMode && storedUser) {
      // Guest mode - use stored user without server verification
      try {
        setUser(JSON.parse(storedUser));
        if (storedToken) {
          setToken(storedToken);
        }
        setIsGuest(true);
      } catch (error) {
        localStorage.removeItem('smartpos_user');
        localStorage.removeItem('smartpos_token');
      }
    } else if (storedToken) {
      setToken(storedToken);
      console.log('AuthContext: Found stored token:', storedToken);
      // Verify token with server
      api.get('/api/auth/session')
      .then(data => {
        setUser(data.user);
      })
      .catch((error) => {
        // Token invalid - don't log scary error for 401
        if (error && error.message && !error.message.includes('401')) {
          console.error('Session verification failed:', error);
        }
        // Token invalid - clear it
        localStorage.removeItem('smartpos_token');
        setToken(null);
        // If we have storedUser (local admin), maybe keep it?
        if (storedUser) {
           try {
             const u = JSON.parse(storedUser);
             if (u.role === 'staff') {
               localStorage.removeItem('smartpos_user');
               setUser(null);
             } else {
               // Admin or local user
               setUser(u);
             }
           } catch (e) {
             localStorage.removeItem('smartpos_user');
             setUser(null);
           }
        }
      });
    } else if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('smartpos_user');
      }
    }
  }, []);

  useEffect(() => {
    if (socket && user) {
      socket.emit('join-user', user.id);
      
      const handleForceLogout = () => {
        toast({
            title: "Session Ended",
            description: "You have been logged out remotely.",
            variant: "destructive"
        });
        logout();
      };

      socket.on('force-logout', handleForceLogout);

      return () => {
        socket.off('force-logout', handleForceLogout);
        socket.emit('leave-user', user.id);
      };
    }
  }, [socket, user]);

  const login = (userData: User, authToken?: string) => {
    setUser(userData);
    localStorage.setItem('smartpos_user', JSON.stringify(userData));
    if (authToken) {
      setToken(authToken);
      localStorage.setItem('smartpos_token', authToken);
      console.log('AuthContext: Token set in localStorage:', authToken);
    }
  };

  const loginStaff = async (staffId: string, passkey: string) => {
    try {
      const data = await api.post('/api/auth/login', { 
        staffId, 
        passkey, 
        deviceInfo: navigator.userAgent 
      });
      
      login(data.user, data.token);
    } catch (error) {
      console.warn('Server login failed, trying local:', error);
      const user = await AuthService.loginStaff(staffId, passkey);
      if (user) {
        login(user);
      } else {
        throw new Error('Invalid credentials');
      }
    }
  };

  const logout = () => {
    if (socket && user) {
      socket.emit('leave-user', user.id);
    }

    if (token) {
      api.post('/api/auth/logout', {}).catch(console.error);
    }
    
    // If in guest mode, clean up all guest data
    if (isGuest) {
      localStorage.removeItem('smartpos_guest_mode');
      localStorage.removeItem('smartpos_guest_user_id');
      localStorage.removeItem('smartpos_guest_expiry');
      // Clear all other smartpos_ items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('smartpos_')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    setUser(null);
    setToken(null);
    setIsGuest(false);
    localStorage.removeItem('smartpos_user');
    localStorage.removeItem('smartpos_token');
  };

  const value = {
    user,
    token,
    socket,
    login,
    loginStaff,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
