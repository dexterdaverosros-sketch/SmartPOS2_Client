import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { queryClient } from "./lib/queryClient";
import { ProductService } from "@/lib/db";

// Import pages
import SplashScreen from "@/pages/splash";
import RoleSelection from "@/pages/role-selection";
import AdminLogin from "@/pages/admin-login";
import AdminSignup from "@/pages/admin-signup";
import StaffLogin from "@/pages/staff-login";
import AdminDashboard from "@/pages/admin-dashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminCreditors from "@/pages/admin-creditors";
import AdminSettings from "@/pages/admin-settings";
import AdminAuditLog from "@/pages/admin-audit-log";
import AdminReports from "@/pages/admin-reports";
import StockInsights from "@/pages/stock-insights";
import SalesSummary from "@/pages/sales-summary";
import AdminMain from "@/pages/admin-main";
import LedgerPage from "@/pages/ledger";
import LedgerAddCustomer from "@/pages/ledger-add-customer";
import PurchasedPage from "@/pages/purchased";
import ExpensesPage from "@/pages/expenses";
import ExpenseReport from "@/pages/expense-report";
import ScannerSales from "@/pages/scanner-sales";
import InventoryManagement from "@/pages/inventory-management";
import ProductDetails from "@/pages/product-details";
import ProductVariantBlank from "@/pages/product-variant-blank";
import ProductVariantAdd from "@/pages/product-variant-add";
import ProductVariantEdit from "@/pages/product-variant-edit";
import StaffManagement from "@/pages/staff-management";
import ProfileSettings from "@/pages/profile-settings";
import TransactionHistory from "@/pages/transaction-history";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SecurityQuestionsPage from "@/pages/security-questions";
import ResetDataPage from "@/pages/reset-data";
import CustomerScan from "@/pages/customer-scan";
import WalletCallback from "@/pages/wallet-callback";
import ReportBlank from "@/pages/report-blank";
import NotFound from "@/pages/not-found";
import { databaseSyncService } from "@/lib/sync";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SplashScreen} />
      <Route path="/role-selection" component={RoleSelection} />
      <Route path="/account-details" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin-signup" component={AdminSignup} />
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/admin-dashboard" component={() => <ProtectedRoute component={AdminDashboard} role="admin" />} />
      <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} role="admin" />} />
      <Route path="/admin/creditors" component={() => <ProtectedRoute component={AdminCreditors} role="admin" />} />
      <Route path="/admin/creditors/:id" component={() => <ProtectedRoute component={AdminCreditors} role="admin" />} />
      <Route path="/admin/settings" component={() => <ProtectedRoute component={AdminSettings} role="admin" />} />
      <Route path="/admin/audit-log" component={() => <ProtectedRoute component={AdminAuditLog} role="admin" />} />
      <Route path="/admin/reports" component={() => <ProtectedRoute component={AdminReports} role="admin" />} />
      <Route path="/stock-insights" component={() => <ProtectedRoute component={StockInsights} role="admin" />} />
      <Route path="/sales-summary" component={() => <ProtectedRoute component={SalesSummary} role="admin" />} />
      <Route path="/admin-main" component={() => <ProtectedRoute component={AdminMain} role="admin" />} />
      <Route path="/purchased" component={() => <ProtectedRoute component={PurchasedPage} />} />
      <Route path="/expenses" component={() => <ProtectedRoute component={ExpensesPage} />} />
      <Route path="/expense-report" component={() => <ProtectedRoute component={ExpenseReport} />} />
      <Route path="/ledger" component={() => <ProtectedRoute component={LedgerPage} />} />
      <Route path="/ledger/add-customer" component={() => <ProtectedRoute component={LedgerAddCustomer} />} />
      <Route path="/scanner" component={() => <ProtectedRoute component={ScannerSales} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={InventoryManagement} role="admin" />} />
      <Route path="/inventory/product/:id" component={() => <ProtectedRoute component={ProductDetails} role="admin" />} />
      <Route path="/inventory/variant/add" component={() => <ProtectedRoute component={ProductVariantBlank} role="admin" />} />
      <Route path="/inventory/product/:id/variant/add" component={() => <ProtectedRoute component={ProductVariantAdd} role="admin" />} />
      <Route path="/inventory/product/:id/variant/edit/:variantId" component={() => <ProtectedRoute component={ProductVariantEdit} role="admin" />} />
      <Route path="/staff" component={() => <ProtectedRoute component={StaffManagement} role="admin" />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfileSettings} />} />
      <Route path="/transaction-history" component={() => <ProtectedRoute component={TransactionHistory} />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/security-questions" component={() => <ProtectedRoute component={SecurityQuestionsPage} role="admin" />} />
      <Route path="/reset-data" component={() => <ProtectedRoute component={ResetDataPage} role="admin" />} />
      <Route path="/customer" component={CustomerScan} />
      <Route path="/wallet-callback" component={WalletCallback} />
      <Route path="/report-blank" component={() => <ProtectedRoute component={ReportBlank} role="admin" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    let syncTimer: any;
    
    const runSync = async () => {
      try {
        await ProductService.syncAllProductsToServer();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        databaseSyncService.setBaseUrl(origin);
        await databaseSyncService.syncDatabase();
      } catch (err) {
        console.warn('Background sync failed:', err);
      } finally {
        // Schedule next sync only after current one finishes
        syncTimer = setTimeout(runSync, 60000); // Increase to 60s for better stability
      }
    };
    
    runSync();
    return () => clearTimeout(syncTimer);
  }, []);
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
