import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { queryClient } from "./lib/queryClient";

// Import pages
import SplashScreen from "@/pages/splash";
import RoleSelection from "@/pages/role-selection";
import AdminMain from "@/pages/admin-main";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminLogin from "@/pages/admin-login";
import AdminSignup from "@/pages/admin-signup";
import StaffLogin from "@/pages/staff-login";
import DeveloperLogin from "@/pages/developer-login";
import DeveloperConsole from "@/pages/developer-console";
import Inventory from "@/pages/inventory-management";
import Ledger from "@/pages/ledger";
import Expenses from "@/pages/expenses";
import StaffManagement from "@/pages/staff-management";
import POS from "@/pages/scanner-sales";
import CustomerPage from "@/pages/customer-scan";
import AdminReports from "@/pages/admin-reports";
import ProfileSettings from "@/pages/profile-settings";
import TransactionHistory from "@/pages/transaction-history";
import BookKeeping from "@/pages/bookkeeping";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SecurityQuestionsPage from "@/pages/security-questions";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Routes with tenant prefix */}
      <Route path="/store/:tenant" component={SplashScreen} />
      <Route path="/store/:tenant/role-selection" component={RoleSelection} />
      <Route path="/store/:tenant/admin-login" component={AdminLogin} />
      <Route path="/store/:tenant/admin-signup" component={AdminSignup} />
      <Route path="/store/:tenant/staff-login" component={StaffLogin} />
      <Route path="/store/:tenant/developer-login" component={DeveloperLogin} />
      <Route path="/store/:tenant/developer-console" component={DeveloperConsole} />
      <Route path="/store/:tenant/account-details" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/store/:tenant/admin-main" component={() => <ProtectedRoute component={AdminMain} role="admin" />} />
      <Route path="/store/:tenant/admin-dashboard" component={() => <ProtectedRoute component={AdminDashboard} role="admin" />} />
      <Route path="/store/:tenant/inventory" component={() => <ProtectedRoute component={Inventory} role="admin" />} />
      <Route path="/store/:tenant/ledger" component={() => <ProtectedRoute component={Ledger} role="admin" />} />
      <Route path="/store/:tenant/expenses" component={() => <ProtectedRoute component={Expenses} role="admin" />} />
      <Route path="/store/:tenant/staff" component={() => <ProtectedRoute component={StaffManagement} role="admin" />} />
      <Route path="/store/:tenant/profile" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/store/:tenant/transaction-history" component={() => <ProtectedRoute component={TransactionHistory} />} />
      <Route path="/store/:tenant/bookkeeping" component={() => <ProtectedRoute component={BookKeeping} role="admin" />} />
      <Route path="/store/:tenant/forgot-password" component={ForgotPassword} />
      <Route path="/store/:tenant/reset-password" component={ResetPassword} />
      <Route path="/store/:tenant/security-questions" component={SecurityQuestionsPage} />
      <Route path="/store/:tenant/admin/reports" component={() => <ProtectedRoute component={AdminReports} role="admin" />} />
      <Route path="/store/:tenant/pos" component={() => <ProtectedRoute component={POS} role="any" />} />
      <Route path="/store/:tenant/customer" component={CustomerPage} />
      
      {/* Original routes for backward compatibility */}
      <Route path="/" component={SplashScreen} />
      <Route path="/role-selection" component={RoleSelection} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin-signup" component={AdminSignup} />
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/developer-login" component={DeveloperLogin} />
      <Route path="/developer-console" component={DeveloperConsole} />
      <Route path="/account-details" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/admin-main" component={() => <ProtectedRoute component={AdminMain} role="admin" />} />
      <Route path="/admin-dashboard" component={() => <ProtectedRoute component={AdminDashboard} role="admin" />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={Inventory} role="admin" />} />
      <Route path="/ledger" component={() => <ProtectedRoute component={Ledger} role="admin" />} />
      <Route path="/expenses" component={() => <ProtectedRoute component={Expenses} role="admin" />} />
      <Route path="/staff" component={() => <ProtectedRoute component={StaffManagement} role="admin" />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/transaction-history" component={() => <ProtectedRoute component={TransactionHistory} />} />
      <Route path="/bookkeeping" component={() => <ProtectedRoute component={BookKeeping} role="admin" />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/security-questions" component={SecurityQuestionsPage} />
      <Route path="/admin/reports" component={() => <ProtectedRoute component={AdminReports} role="admin" />} />
      <Route path="/pos" component={() => <ProtectedRoute component={POS} role="any" />} />
      <Route path="/customer" component={CustomerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppProvider>
            <DeviceProvider>
              <Toaster />
              <Router />
            </DeviceProvider>
          </AppProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
