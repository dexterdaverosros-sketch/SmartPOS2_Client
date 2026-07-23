import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Lock,
  Activity,
  Clock,
  Plus,
  X,
  Check,
  ChevronRight,
  Shield,
  Calendar,
  Phone,
  Mail,
  MapPin,
  User,
  Briefcase,
  Building
} from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthService, StaffService } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Staff } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import io from 'socket.io-client';
import api from '@/lib/api';

const staffSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  passkey: z.string().min(4, 'Passkey must be at least 4 characters'),
  role: z.enum(['cashier', 'manager', 'admin']),
  branch: z.string().optional(),
  department: z.string().optional(),
  employmentStatus: z.enum(['active', 'inactive', 'on_leave']),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthdate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateHired: z.string().optional(),
  assignedShift: z.enum(['morning', 'afternoon', 'evening']).optional(),
  profileImage: z.string().optional(),
  username: z.string().optional(),
  permissions: z.array(z.string()),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface StaffWithStatus {
  [key: string]: any;
  isOnline?: boolean;
  lastActive?: Date;
  todaySales?: number;
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getGradient = (name: string) => {
  const colors = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-pink-400',
    'from-green-500 to-emerald-400',
    'from-orange-500 to-amber-400',
    'from-rose-500 to-red-400'
  ];
  const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Types for staff details
interface StaffDetails extends Staff {
  performance?: {
    todaySales: number;
    weeklySales: number;
    monthlySales: number;
    transactionCount: number;
    itemsSold: number;
  };
  attendance?: {
    date: string;
    clockIn: string;
    clockOut: string;
    hoursWorked: number;
    isLate: boolean;
  };
  activity?: any[];
  loginHistory?: any[];
}

const StaffManagement: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffWithStatus[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<StaffWithStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<any>(null);
  const [serverInfoState, setServerInfoState] = useState('unknown');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [socketLastError, setSocketLastError] = useState<string | null>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffDetails | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushingToCloud, setIsPushingToCloud] = useState(false);

  // Permission options
  const permissionOptions = [
    { id: 'sales.create', label: 'Create Sales' },
    { id: 'sales.view', label: 'View Sales' },
    { id: 'products.manage', label: 'Manage Products' },
    { id: 'customers.manage', label: 'Manage Customers' },
    { id: 'staff.view', label: 'View Staff' },
    { id: 'reports.view', label: 'View Reports' },
  ];

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      staffId: '',
      passkey: '',
      role: 'cashier',
      branch: '',
      department: '',
      employmentStatus: 'active',
      email: '',
      phone: '',
      address: '',
      birthdate: '',
      gender: undefined,
      dateHired: '',
      assignedShift: undefined,
      profileImage: '',
      username: '',
      permissions: [],
    },
  });

  // Load staff by ID for view/edit
  const loadStaffDetails = async (staffId: string) => {
    setIsLoadingStaff(true);
    try {
      const response = await api.get(`/api/staff/${staffId}`);
      setSelectedStaff(response);
      return response;
    } catch (error) {
      console.error('Error loading staff details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load staff details',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // Handle view staff
  const handleViewStaff = async (id: string) => {
    setIsLoadingStaff(true);
    setViewDialogOpen(true);
    await loadStaffDetails(id);
  };

  // Handle edit staff
  const handleEditStaff = async (id: string) => {
    setIsLoadingStaff(true);
    await loadStaffDetails(id);
    setEditDialogOpen(true);
  };

  // Handle save staff
  const handleSaveStaff = async (data: any) => {
    if (!selectedStaff) return;
    setIsSaving(true);
    try {
      const response = await api.put(`/api/staff/${selectedStaff.id}`, data);
      setSelectedStaff(response);
      toast({ title: 'Success', description: 'Staff updated successfully' });
      setEditDialogOpen(false);
      await loadStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to save staff',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      let staffData: any[] = [];
      try {
        staffData = await api.get('/api/staff');
      } catch {
        staffData = await StaffService.getAllStaff();
      }

      const staffWithStatus: StaffWithStatus[] = await Promise.all((staffData || []).map(async member => {
        let todaySales = 0;
        try {
          const performance = await api.get(`/api/staff/${member.id}/performance`);
          todaySales = Number(performance.todaySales) || 0;
        } catch {
          todaySales = 0;
        }
        const name = member.name || [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ');
        return {
        ...member,
        name,
        isOnline: false,
        lastActive: member.createdAt || new Date(),
        role: (member as any).role || 'Cashier',
        todaySales,
        };
      }));

      setStaff(staffWithStatus);

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('getStaffStatus', staffWithStatus.map(s => s.id));
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

  useEffect(() => {
    let heartbeatInterval: any;
    let socketInstance: any = null;
    let cancelled = false;

    const init = async () => {
      try {
        let socketUrl = window.location.origin;
        try {
          const data = await api.get('/api/server-info');
          socketUrl = data.origin;
        } catch (e) {
          console.warn('Failed to fetch server info');
        }

        if (window.location.hostname.includes('netlify.app')) {
          socketUrl = 'https://smartposv4.onrender.com';
        }

        socketInstance = io(socketUrl, {
          auth: {
            token: localStorage.getItem('userToken') || '',
            businessId: user?.id || ''
          },
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000,
          timeout: 45000,
          autoConnect: true
        });

        setServerInfoState(socketUrl);
      } catch (error) {
        console.error('Socket init failed:', error);
        socketInstance = null;
      }

      if (cancelled) return;
      if (!socketInstance) {
        loadStaff();
        return;
      }

      socketRef.current = socketInstance;

      socketInstance.on('connect', () => {
        setSocketStatus('connected');
        setSocketLastError(null);
        loadStaff();
        if (user?.id) socketInstance.emit('adminOnline', { adminId: user.id });
      });

      socketInstance.on('connect_error', (error: any) => {
        setSocketStatus('error');
        setSocketLastError(error?.message || 'Unknown error');
      });

      socketInstance.on('staffStatusUpdate', (data: { staffId: string, isOnline: boolean, lastActive?: Date }) => {
        setStaff(prevStaff =>
          prevStaff.map(member =>
            member.id === data.staffId
              ? { ...member, isOnline: data.isOnline, lastActive: data.lastActive || member.lastActive }
              : member
          )
        );
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

  const onSubmit = async (data: StaffFormData) => {
    setIsLoading(true);
    try {
      const newStaff = await AuthService.createStaff({
        ...data,
        name: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' '),
        createdBy: user?.id || '',
        tenantId: user?.tenantId || '',
      });

      if (newStaff) {
        const updatedStaff = await loadStaff();
        if (updatedStaff && Array.isArray(updatedStaff) && !updatedStaff.some(s => s.id === newStaff.id)) {
          setStaff(prev => [...prev, { ...newStaff, isOnline: false, role: 'Cashier', todaySales: 0 }]);
        }

        toast({ title: 'Staff Added', description: `${[data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')} has been added to your team` });
        setIsAddDialogOpen(false);
        form.reset();
        try {
          await api.post('/api/staff', [newStaff]);
        } catch (e) {
          console.warn('Failed to sync new staff:', e);
        }
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({ title: 'Error', description: 'Failed to add staff', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStaff) return;

    try {
      await api.delete(`/api/staff/${deletingStaff.id}`);
      await StaffService.deleteStaff(deletingStaff.id);
      toast({ title: 'Staff Removed', description: `${deletingStaff.name} removed` });
      await loadStaff();
      setDeletingStaff(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove staff', variant: 'destructive' });
    }
  };

  const handlePushToCloud = async () => {
    if (isPushingToCloud) return;
    setIsPushingToCloud(true);
    try {
      const result = await api.post('/api/sync/push-all', {});
      toast({ title: 'Cloud Sync Complete', description: result.message || 'Staff and business data pushed to the cloud.' });
    } catch (error) {
      toast({ title: 'Cloud Sync Failed', description: error instanceof Error ? error.message : 'Unable to push data to the cloud.', variant: 'destructive' });
    } finally {
      setIsPushingToCloud(false);
    }
  };

  const formatLastActive = (date?: Date) => {
    if (!date) return 'Never';
    try {
      const diff = new Date().getTime() - new Date(date).getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
      }
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.staffId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' ||
      (activeFilter === 'online' && member.isOnline) ||
      (activeFilter === 'offline' && !member.isOnline) ||
      (activeFilter.toLowerCase() === (member.role || 'cashier').toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: staff.length,
    online: staff.filter(s => s.isOnline).length,
    active: staff.filter(s => s.isOnline).length,
    inactive: staff.filter(s => !s.isOnline).length,
  };

  const filterOptions = ['All', 'Online', 'Offline', 'Cashier', 'Manager', 'Admin'];

  return (
    <Layout>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Staff Management
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage employees, monitor activity, and assign roles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-gray-200 bg-white hover:bg-gray-50"
                onClick={async () => {
                  try {
                    const data = await api.get('/api/server-info');
                    setServerInfoState(data.origin);
                    if (socketRef.current && !socketRef.current.connected) socketRef.current.connect();
                    toast({ title: 'Connection refreshed' });
                  } catch (e) {
                    toast({ title: 'Failed to connect', variant: 'destructive' });
                  }
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff
              </Button>
              <Button variant="outline" onClick={handlePushToCloud} disabled={isPushingToCloud} className="border-blue-200 text-blue-700 bg-white">
                <RefreshCw className={`w-4 h-4 mr-2 ${isPushingToCloud ? 'animate-spin' : ''}`} />
                {isPushingToCloud ? 'Pushing...' : 'Push to Cloud'}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5 text-[#2563EB]" />}
              value={stats.total}
              label="Total Staff"
              color="border-blue-100"
            />
            <StatCard
              icon={<Wifi className="w-5 h-5 text-[#10B981]" />}
              value={stats.online}
              label="Online Now"
              color="border-green-100"
            />
            <StatCard
              icon={<Activity className="w-5 h-5 text-[#F59E0B]" />}
              value={stats.active}
              label="Active"
              color="border-orange-100"
            />
            <StatCard
              icon={<WifiOff className="w-5 h-5 text-gray-500" />}
              value={stats.inactive}
              label="Inactive"
              color="border-gray-100"
            />
          </div>
        </div>

        {/* Connection Status */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto pb-6">
          <Card className="border-gray-100 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    socketStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">
                      {socketStatus === 'connected' ? 'Live Monitoring' : 'Disconnected'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {socketStatus === 'connected' ? 'Real-time updates active' : 'Trying to reconnect'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="text-xs text-gray-500">
                    <div className="text-gray-400 mb-1">Server Address</div>
                    <div className="text-gray-600 break-all font-mono">{serverInfoState}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="text-gray-400 mb-1">Last Sync</div>
                    <div className="text-gray-600 font-mono">Just now</div>
                  </div>
                </div>
              </div>
              {socketLastError && (
                <div className="mt-3 text-xs text-red-500">{socketLastError}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto pb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="w-full sm:max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, role, or staff ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filterOptions.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter.toLowerCase())}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                    activeFilter === filter.toLowerCase()
                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Staff List */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto pb-24">
          <AnimatePresence mode="popLayout">
            {filteredStaff.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <Users className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Staff Found</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery ? 'Try adjusting your search' : 'Start by inviting your first employee'}
                </p>
                {!searchQuery && staff.length === 0 && (
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Staff
                  </Button>
                )}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStaff.map((member, index) => (
                  <StaffCard
                    key={member.id}
                    member={member}
                    index={index}
                    onDelete={() => setDeletingStaff(member)}
                    onView={() => handleViewStaff(member.id)}
                    onEdit={() => handleEditStaff(member.id)}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* View Staff Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Staff Details</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-full pr-4">
              {isLoadingStaff ? (
                <div className="py-8 text-center">Loading...</div>
              ) : selectedStaff ? (
                <div className="space-y-6 py-4">
                  {/* Profile Section */}
                  <div className="flex items-center gap-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={selectedStaff.profileImage ?? undefined} />
                      <AvatarFallback>{getInitials(selectedStaff.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedStaff.name}</h2>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Badge className="bg-blue-100 text-blue-700">{selectedStaff.role}</Badge>
                        <Badge className={`${selectedStaff.employmentStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {selectedStaff.employmentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Staff ID</p>
                      <p className="font-medium">{selectedStaff.staffId}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Username</p>
                      <p className="font-medium">{selectedStaff.username || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {selectedStaff.email || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {selectedStaff.phone || '-'}
                      </p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {selectedStaff.address || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Branch</p>
                      <p className="font-medium">{selectedStaff.branch || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="font-medium">{selectedStaff.department || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Date Hired</p>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {selectedStaff.dateHired ? new Date(selectedStaff.dateHired).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Assigned Shift</p>
                      <p className="font-medium">{selectedStaff.assignedShift || '-'}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Permissions */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Permissions
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {permissionOptions.map(permission => (
                        <div
                          key={permission.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border ${
                            (selectedStaff.permissions as string[] | null | undefined)?.includes(permission.id)
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          {(selectedStaff.permissions as string[] | null | undefined)?.includes(permission.id) ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm">{permission.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Attendance */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Today's Attendance
                    </h3>
                    {selectedStaff.attendance && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm text-gray-500">Clock In</p>
                          <p className="font-medium">{selectedStaff.attendance.clockIn}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Clock Out</p>
                          <p className="font-medium">{selectedStaff.attendance.clockOut}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Hours Worked</p>
                          <p className="font-medium">{selectedStaff.attendance.hoursWorked}h</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Late</p>
                          <p className="font-medium">{selectedStaff.attendance.isLate ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Performance */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Performance
                    </h3>
                    {selectedStaff.performance && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-xl">
                          <p className="text-sm text-blue-700">Today's Sales</p>
                          <p className="text-2xl font-bold text-blue-900">₱{selectedStaff.performance.todaySales.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl">
                          <p className="text-sm text-green-700">Weekly Sales</p>
                          <p className="text-2xl font-bold text-green-900">₱{selectedStaff.performance.weeklySales.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl">
                          <p className="text-sm text-purple-700">Monthly Sales</p>
                          <p className="text-2xl font-bold text-purple-900">₱{selectedStaff.performance.monthlySales.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl">
                          <p className="text-sm text-orange-700">Transactions</p>
                          <p className="text-2xl font-bold text-orange-900">{selectedStaff.performance.transactionCount}</p>
                        </div>
                        <div className="p-4 bg-pink-50 rounded-xl col-span-2">
                          <p className="text-sm text-pink-700">Items Sold (Today)</p>
                          <p className="text-2xl font-bold text-pink-900">{selectedStaff.performance.itemsSold}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Login History */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Recent Login History</h3>
                    {selectedStaff.loginHistory?.length ? (
                      <div className="space-y-2">
                        {selectedStaff.loginHistory.slice(0, 5).map((login, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{login.device_info}</p>
                              <p className="text-xs text-gray-500">{login.ip_address}</p>
                            </div>
                            <p className="text-xs text-gray-500">{new Date(login.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No login history</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">Staff not found</div>
              )}
            </ScrollArea>
            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedStaff) {
                    setViewDialogOpen(false);
                    handleEditStaff(selectedStaff.id);
                  }
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Staff Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Staff</DialogTitle>
            </DialogHeader>
            {isLoadingStaff ? (
              <div className="py-8 text-center">Loading...</div>
            ) : selectedStaff ? (
              <EditStaffForm
                staff={selectedStaff}
                onSave={handleSaveStaff}
                onCancel={() => setEditDialogOpen(false)}
                isSaving={isSaving}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Floating Add Staff Button */}
        <div className="fixed bottom-8 right-8">
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => setIsAddDialogOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Add Staff</span>
          </motion.button>
        </div>

        {/* Add Staff Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input placeholder="First name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="middleName" render={({ field }) => (
                  <FormItem><FormLabel>Middle Name</FormLabel><FormControl><Input placeholder="Middle name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Last name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="staffId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., STAFF001" {...field} />
                      </FormControl>
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
                        <Input type="password" placeholder="Create a secure passkey" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="Login username" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="staff@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="Phone number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="branch" render={({ field }) => (
                  <FormItem><FormLabel>Branch</FormLabel><FormControl><Input placeholder="Branch" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="Department" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birthdate" render={({ field }) => (
                  <FormItem><FormLabel>Birthdate</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dateHired" render={({ field }) => (
                  <FormItem><FormLabel>Date Hired</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cashier">Cashier</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="employmentStatus" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_leave">On Leave</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="assignedShift" render={({ field }) => (
                  <FormItem><FormLabel>Shift</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger></FormControl><SelectContent><SelectItem value="morning">Morning</SelectItem><SelectItem value="afternoon">Afternoon</SelectItem><SelectItem value="evening">Evening</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="Address" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="permissions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissions</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {permissionOptions.map(permission => (
                        <label key={permission.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                          <Checkbox checked={field.value.includes(permission.id)} onCheckedChange={(checked) => field.onChange(checked ? [...field.value, permission.id] : field.value.filter(value => value !== permission.id))} />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="flex-1 border-gray-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    {isLoading ? 'Adding...' : 'Add Staff'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingStaff} onOpenChange={() => setDeletingStaff(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove "{deletingStaff?.name}"? They will no longer have access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

const StatCard = ({
  icon,
  value,
  label,
  color
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}) => (
  <Card className={`border ${color} bg-white shadow-sm hover:shadow-md transition-shadow`}>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-gray-50 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const EditStaffForm = ({
  staff,
  onSave,
  onCancel,
  isSaving
}: {
  staff: StaffDetails;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    firstName: staff.firstName || staff.name.split(' ')[0] || '',
    middleName: staff.middleName || '',
    lastName: staff.lastName || staff.name.split(' ').slice(1).join(' ') || '',
    name: staff.name,
    email: staff.email || '',
    phone: staff.phone || '',
    address: staff.address || '',
    role: (staff.role || 'cashier').toLowerCase(),
    branch: staff.branch || '',
    department: staff.department || '',
    employmentStatus: staff.employmentStatus || 'active',
    assignedShift: staff.assignedShift || '',
    birthdate: staff.birthdate ? String(staff.birthdate).slice(0, 10) : '',
    gender: staff.gender || '',
    dateHired: staff.dateHired ? String(staff.dateHired).slice(0, 10) : '',
    profileImage: staff.profileImage || '',
    username: staff.username || '',
    permissions: staff.permissions || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmDialogOpen(true);
  };

  const handleConfirm = () => {
    setConfirmDialogOpen(false);
    onSave({
      ...formData,
      name: [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' '),
      birthdate: formData.birthdate || null,
      dateHired: formData.dateHired || null,
      gender: formData.gender || null,
      assignedShift: formData.assignedShift || null,
    });
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormData((current: any) => ({ ...current, profileImage: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      {/* Profile Section */}
      <div className="flex items-center gap-4">
        <Avatar className="w-20 h-20">
          <AvatarImage src={formData.profileImage} />
          <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
        </Avatar>
        <Input type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-xs" />
        <Button type="button" variant="outline" onClick={() => setFormData({ ...formData, profileImage: '' })}>
          Change Photo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">First Name</label>
          <Input
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1"><label className="text-sm font-medium">Middle Name</label><Input value={formData.middleName} onChange={(e) => setFormData({ ...formData, middleName: e.target.value })} /></div>
        <div className="space-y-1"><label className="text-sm font-medium">Last Name</label><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required /></div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Username</label>
          <Input
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-sm font-medium">Address</label>
          <Input
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Role</label>
          <Select
            value={formData.role}
            onValueChange={(val) => setFormData({ ...formData, role: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashier">Cashier</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Branch</label>
          <Input
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Department</label>
          <Input
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={formData.employmentStatus}
            onValueChange={(val) => setFormData({ ...formData, employmentStatus: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Shift</label>
          <Select
            value={formData.assignedShift}
            onValueChange={(val) => setFormData({ ...formData, assignedShift: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><label className="text-sm font-medium">Birthdate</label><Input type="date" value={formData.birthdate} onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })} /></div>
        <div className="space-y-1"><label className="text-sm font-medium">Date Hired</label><Input type="date" value={formData.dateHired} onChange={(e) => setFormData({ ...formData, dateHired: e.target.value })} /></div>
        <div className="space-y-1"><label className="text-sm font-medium">Gender</label><Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
      </div>

      {/* Permissions */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Permissions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'sales.create', label: 'Create Sales' },
            { id: 'sales.view', label: 'View Sales' },
            { id: 'products.manage', label: 'Manage Products' },
            { id: 'customers.manage', label: 'Manage Customers' },
            { id: 'staff.view', label: 'View Staff' },
            { id: 'reports.view', label: 'View Reports' },
          ].map(permission => (
            <div
              key={permission.id}
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200"
            >
              <Checkbox
                id={permission.id}
                checked={formData.permissions.includes(permission.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({
                      ...formData,
                      permissions: [...formData.permissions, permission.id],
                    });
                  } else {
                    setFormData({
                      ...formData,
                      permissions: formData.permissions.filter((p: string) => p !== permission.id),
                    });
                  }
                }}
              />
              <label htmlFor={permission.id} className="text-sm cursor-pointer">
                {permission.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-[#2563EB]" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes? This will update the staff information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
};

const StaffCard = ({
  member,
  index,
  onDelete,
  onView,
  onEdit
}: {
  member: StaffWithStatus;
  index: number;
  onDelete: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}) => {
  const initials = getInitials(member.name);
  const gradient = getGradient(member.name);
  const roleColor = member.role?.toLowerCase().includes('manager')
    ? 'bg-blue-100 text-blue-700'
    : member.role?.toLowerCase().includes('admin')
      ? 'bg-purple-100 text-purple-700'
      : 'bg-green-100 text-green-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all"
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
              {initials}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                member.isOnline ? 'bg-green-500' : 'bg-gray-300'
              } ${member.isOnline ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">{member.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 ${roleColor}`}>
                  {member.role || 'Cashier'}
                </Badge>
                <Badge className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 ${
                  member.isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
                }`}>
                  {member.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            <span>Last active: {member.isOnline ? 'Just now' : 'Unknown'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-xs text-gray-500 mb-1">Staff ID</div>
              <div className="font-medium text-gray-900">{member.staffId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Today's Sales</div>
              <div className="font-medium text-[#2563EB]">
                ₱{member.todaySales?.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={() => onView(member.id)} className="flex-1 h-9 border-gray-200 bg-white">
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(member.id)} className="flex-1 h-9 border-gray-200 bg-white">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 px-3 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </motion.div>
  );
};

export default StaffManagement;
