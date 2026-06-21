import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserPlus, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthService, StaffService } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Staff } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import io from 'socket.io-client';
import api from '@/lib/api';
import BarcodeScannerButton from '@/components/BarcodeScannerButton';

const staffSchema = z.object({
  name: z.string().min(1, 'Staff name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  passkey: z.string().min(4, 'Passkey must be at least 4 characters'),
});

type StaffFormData = z.infer<typeof staffSchema>;

// Extended Staff type with online status
interface StaffWithStatus extends Staff {
  isOnline?: boolean;
  lastActive?: Date;
}

// API endpoint for the real-time service will be discovered from the server
let REALTIME_SERVICE_URL: string | undefined = undefined;

const StaffManagement: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffWithStatus[]>([]);
  const [activeTab, setActiveTab] = useState<string>('active');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<StaffWithStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<any>(null);
  const [serverInfoState, setServerInfoState] = useState<string>('unknown');
  const [socketStatus, setSocketStatus] = useState<string>('disconnected');
  const [socketLastError, setSocketLastError] = useState<string | null>(null);

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      staffId: '',
      passkey: '',
    },
  });

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      // Fetch all staff members and manage filtering in the UI based on real-time status
      const staffData = await StaffService.getAllStaff();
      
      if (!Array.isArray(staffData)) {
        throw new Error('Invalid staff data format');
      }
      
      // Initialize staff with default status
      // Real-time updates will be applied via socket connection
      const staffWithStatus = staffData.map(member => {
        return {
          ...member,
          isOnline: false,
          lastActive: member.createdAt ? member.createdAt : undefined
        };
      });
      
      setStaff(staffWithStatus);
      
      // After loading staff, request their current status from the real-time service
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('getStaffStatus', staffData.map(s => s.id));
      }
      
      return staffWithStatus;
    } catch (error) {
      console.error('Error loading staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load staff list',
        variant: 'destructive',
      });
      setStaff([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to real-time service
  useEffect(() => {
    // Sync all local staff to server to ensure consistency for logins
    StaffService.getAllStaff().then(allStaff => {
      if (allStaff.length > 0) {
        api.post('/api/staff', allStaff).catch(e => console.warn('Background staff sync error:', e));
      }
    });

    // Discover real-time server origin from API, then connect
    let heartbeatInterval: any;
    let socketInstance: any = null;
    let cancelled = false;

    const init = async () => {
      try {
        // Fetch server info to discover the real backend URL
        let socketUrl = window.location.origin;
        try {
          const data = await api.get('/api/server-info');
          socketUrl = data.origin;
        } catch (e) {
          console.warn('Failed to fetch server info, falling back to current origin');
        }

        // If on Netlify, prioritize a direct connection to the backend to avoid proxy issues
        // (Netlify redirects do not support WebSockets)
        if (window.location.hostname.includes('netlify.app')) {
          socketUrl = 'https://smartposv4.onrender.com';
        }

        socketInstance = io(socketUrl, {
          auth: {
            token: localStorage.getItem('userToken') || '',
            businessId: user?.id || ''
          },
          transports: ['polling', 'websocket'], // Force polling first for better reliability
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000,
          timeout: 45000, // Increase timeout for slower connections
          autoConnect: true
        });
        
        setServerInfoState(socketUrl);
      } catch (error) {
        console.error('Socket init failed:', error);
        socketInstance = null;
      }

      if (cancelled) return;

      if (!socketInstance) {
        // Proceed without real-time features
        loadStaff();
        return;
      }

      socketRef.current = socketInstance;

      // Handle connection events
      socketInstance.on('connect', () => {
        console.log('Connected to real-time service');
        setSocketStatus('connected');
        setSocketLastError(null);
        loadStaff();

        if (user?.id) {
          socketInstance.emit('adminOnline', { adminId: user.id });
        }
      });

      socketInstance.on('connect_error', (error: any) => {
        console.error('Real-time service connection error:', error);
        setSocketStatus('error');
        setSocketLastError(error?.message || 'Unknown error');
        
        // Only show toast if it's a persistent failure (not just a momentary blip)
        if (socketInstance.reconnectionAttempts > 3) {
          toast({
            title: 'Real-time Service',
            description: 'Trying to establish real-time connection...',
            variant: 'default',
          });
        }
      });

      socketInstance.on('staffStatusUpdate', (data: { staffId: string, isOnline: boolean, lastActive?: Date }) => {
        setStaff(prevStaff => 
          prevStaff.map(member => 
            member.id === data.staffId 
              ? { ...member, isOnline: data.isOnline, lastActive: data.lastActive || member.lastActive } 
              : member
          )
        );

        const staffMember = staff.find(s => s.id === data.staffId);
        if (staffMember) {
          toast({
            title: `${staffMember.name} is ${data.isOnline ? 'Online' : 'Offline'}`,
            description: data.isOnline 
              ? 'Staff member has connected to the system' 
              : `Last active: ${formatLastActive(data.lastActive)}`,
            variant: data.isOnline ? 'default' : 'destructive',
          });
        }
      });

      socketInstance.on('staffStatusBulk', (statusUpdates: Array<{ staffId: string, isOnline: boolean, lastActive?: Date }>) => {
        setStaff(prevStaff => {
          const staffMap = new Map(prevStaff.map(s => [s.id, s]));

          statusUpdates.forEach(update => {
            const st = staffMap.get(update.staffId);
            if (st) {
              st.isOnline = update.isOnline;
              st.lastActive = update.lastActive || st.lastActive;
            }
          });

          return Array.from(staffMap.values());
        });
      });

      // Heartbeat
      heartbeatInterval = setInterval(() => {
        if (socketRef.current && socketRef.current.connected && user?.id) {
          socketRef.current.emit('heartbeat', { adminId: user.id });
        }
      }, 30000);
    };

    init();

    return () => {
      cancelled = true;
      clearInterval(heartbeatInterval);
      if (socketRef.current) {
        if (user?.id) {
          try { socketRef.current.emit('adminOffline', { adminId: user.id }); } catch (_) {}
        }
        try { socketRef.current.disconnect(); } catch (_) {}
      }
    };
  }, [user?.id, toast]);
  
  // Load staff when tab changes
  useEffect(() => {
    loadStaff();
    
    // Inform the real-time service about the current tab view
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('setStaffView', { view: activeTab });
    }
  }, [activeTab]);

  const onSubmit = async (data: StaffFormData) => {
    setIsLoading(true);
    try {
      const newStaff = await AuthService.createStaff({
        ...data,
        createdBy: user?.id || '',
        tenantId: user?.tenantId || '',
      });
      
      if (newStaff) {
        // Force reload the staff list to include the new staff member
        const updatedStaff = await loadStaff();
        
        // If the new staff isn't in the updated list, force add it
        if (updatedStaff && Array.isArray(updatedStaff) && !updatedStaff.some(s => s.id === newStaff.id)) {
          setStaff(prev => [...prev, { ...newStaff, isOnline: false }]);
        }
        
        toast({
          title: 'Staff Added',
          description: `${data.name} has been added to your team`,
        });
        
        setIsAddDialogOpen(false);
        form.reset();
        // Sync newly created staff to server so other LAN devices can use credentials
        try {
          await api.post('/api/staff', [newStaff]);
        } catch (e) {
          console.warn('Failed to sync new staff to server:', e);
        }
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add staff member',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStaff) return;

    try {
      await StaffService.deleteStaff(deletingStaff.id);
      toast({
        title: 'Staff Removed',
        description: `${deletingStaff.name} has been removed from your team`,
      });
      await loadStaff();
      setDeletingStaff(null);
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove staff member',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const formatLastActive = (date?: Date) => {
    if (!date) return 'Unknown';
    
    try {
      const now = new Date();
      const lastActiveDate = new Date(date);
      
      // Check if date is valid
      if (isNaN(lastActiveDate.getTime())) return 'Unknown';
      
      const diff = now.getTime() - lastActiveDate.getTime();
      
      // Less than a minute
      if (diff < 60 * 1000) {
        return 'Just now';
      }
      
      // Less than an hour
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      
      // Less than a day
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
      
      // Otherwise show the date
      return formatDate(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  const filteredStaff = staff.filter(member => {
    if (activeTab === 'active') return member.isOnline === true;
    return member.isOnline === false;
  });

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <div className="w-10" />
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Staff Management</h1>
            <div className="w-10" />
          </div>
        </div>
        
        {/* Toggle Tabs for Active/Inactive */}
        <div className="px-4 pt-4">
          <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 shadow-md">
              <TabsTrigger 
                value="active" 
                className="text-sm font-medium"
                style={{
                  backgroundColor: activeTab === 'active' ? '#e6f7ff' : 'transparent',
                  borderBottom: activeTab === 'active' ? '2px solid #1890ff' : 'none'
                }}
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="inactive" 
                className="text-sm font-medium"
                style={{
                  backgroundColor: activeTab === 'inactive' ? '#fff1f0' : 'transparent',
                  borderBottom: activeTab === 'inactive' ? '2px solid #ff4d4f' : 'none'
                }}
              >
                Inactive
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Debug Panel: server info + socket state (visible to admin for troubleshooting) */}
        <div className="px-4 pt-2">
          <div className="max-w-4xl mx-auto bg-white/5 dark:bg-gray-800/30 rounded-lg p-3 text-sm text-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="text-xs text-gray-400">Real-time Server</div>
                <div className="font-medium break-all">{serverInfoState}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-400">Socket</div>
                <div className={`px-2 py-1 rounded text-xs ${socketStatus === 'connected' ? 'bg-emerald-600 text-white' : socketStatus === 'error' ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'}`}>
                  {socketStatus}
                </div>
                <button
                  onClick={async () => {
                    try {
                      const d = await api.get('/api/server-info');
                      setServerInfoState(String(d.origin));
                      
                      // Also try to reconnect the socket if it's disconnected
                      if (socketRef.current && !socketRef.current.connected) {
                        socketRef.current.connect();
                      }
                      
                      toast({ title: 'Connection settings refreshed' });
                    } catch (e) {
                      toast({ title: 'Failed to reach server', variant: 'destructive' });
                    }
                  }}
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                  Refresh
                </button>
              </div>
            </div>
            {socketLastError ? <div className="mt-2 text-xs text-red-300">Last error: {socketLastError}</div> : null}
          </div>
        </div>
        
        <div className="p-4 pb-20">
          {/* Staff List */}
          {filteredStaff.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No staff members in this category</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Currently no {activeTab === 'active' ? 'online' : 'offline'} staff members</p>
              {staff.length === 0 && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  data-testid="button-add-first-staff"
                  className="bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                  style={{
                    boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Staff
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'active' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg mb-2">
                  <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Active Staff Members</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Staff members who are currently active</p>
                </div>
              )}
              {activeTab === 'inactive' && (
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg mb-2">
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Inactive Staff Members</h3>
                  <p className="text-xs text-red-600 dark:text-red-400">Staff members who are currently inactive</p>
                </div>
              )}
              {filteredStaff.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg ${activeTab === 'active' ? 'border-l-4 border-blue-500' : 'border-l-4 border-red-500'}`}
                  data-testid={`staff-${member.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-3 relative">
                        <Users className="w-6 h-6 text-primary-500" />
                        {/* Status indicator dot */}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white`}></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{member.name}</h3>
                          <Badge className={member.isOnline ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}>
                            {member.isOnline ? (
                              <>
                                <Wifi className="w-3 h-3 mr-1" />
                                <span>Online</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="w-3 h-3 mr-1" />
                                <span>Offline</span>
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Staff ID: {member.staffId}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Created: {formatDate(member.createdAt || new Date())}
                          </p>
                          {!member.isOnline && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Last active: {formatLastActive(member.lastActive)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeletingStaff(member)}
                      data-testid={`button-delete-staff-${member.id}`}
                      className="text-red-500 p-2 touch-feedback"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        
        {/* Add Staff Button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => setIsAddDialogOpen(true)}
          data-testid="button-add-staff"
          className="fixed bottom-28 right-6 bg-[#FF8882] text-white p-4 rounded-full shadow-xl hover:bg-[#D89D9D] touch-feedback z-50"
          style={{
            boxShadow: '0 10px 25px rgba(255, 136, 130, 0.3)',
          }}
        >
          <UserPlus className="w-6 h-6" />
        </motion.button>

        {/* Add Staff Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter staff member's full name"
                          data-testid="input-staff-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="staffId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff ID</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="e.g., STAFF001"
                            data-testid="input-staff-id-create"
                            {...field}
                          />
                        </FormControl>
                        <BarcodeScannerButton 
                          onBarcodeScanned={(barcode) => field.onChange(barcode)}
                          className="flex-none"
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="passkey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passkey</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Create a secure passkey"
                          data-testid="input-staff-passkey"
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
                    onClick={() => setIsAddDialogOpen(false)}
                    data-testid="button-cancel-staff"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    data-testid="button-save-staff"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                    style={{
                      boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
                    }}
                  >
                    {isLoading ? 'Adding...' : 'Add Staff'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingStaff} onOpenChange={() => setDeletingStaff(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove "{deletingStaff?.name}" from your team? 
                They will no longer be able to access the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-staff">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                data-testid="button-confirm-delete-staff"
                className="bg-red-500 hover:bg-red-600"
              >
                Remove Staff
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </Layout>
  );
};

export default StaffManagement;
