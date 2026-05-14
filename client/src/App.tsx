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
import ProtectedAdmin from "@/components/ProtectedAdmin";
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
      <Route path="/account-details" component={ProfileSettings} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin-signup" component={AdminSignup} />
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/admin-dashboard" component={AdminDashboard} />
      <Route path="/admin/dashboard" component={() => <ProtectedAdmin component={AdminDashboard} />} />
      <Route path="/admin/creditors" component={() => <ProtectedAdmin component={AdminCreditors} />} />
      <Route path="/admin/creditors/:id" component={() => <ProtectedAdmin component={AdminCreditors} />} />
      <Route path="/admin/settings" component={() => <ProtectedAdmin component={AdminSettings} />} />
      <Route path="/admin/audit-log" component={() => <ProtectedAdmin component={AdminAuditLog} />} />
      <Route path="/admin/reports" component={() => <ProtectedAdmin component={AdminReports} />} />
      <Route path="/stock-insights" component={() => <ProtectedAdmin component={StockInsights} />} />
      <Route path="/sales-summary" component={() => <ProtectedAdmin component={SalesSummary} />} />
      <Route path="/admin-main" component={AdminMain} />
      <Route path="/purchased" component={PurchasedPage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/expense-report" component={ExpenseReport} />
      <Route path="/ledger" component={LedgerPage} />
      <Route path="/ledger/add-customer" component={LedgerAddCustomer} />
      <Route path="/scanner" component={ScannerSales} />
      <Route path="/inventory" component={InventoryManagement} />
      <Route path="/inventory/product/:id" component={ProductDetails} />
        <Route path="/inventory/variant/add" component={ProductVariantBlank} />
        <Route path="/inventory/product/:id/variant/add" component={ProductVariantAdd} />
        <Route path="/inventory/product/:id/variant/edit/:variantId" component={ProductVariantEdit} />
        <Route path="/staff" component={StaffManagement} />
      <Route path="/profile" component={ProfileSettings} />
      <Route path="/transaction-history" component={TransactionHistory} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/security-questions" component={() => <ProtectedAdmin component={SecurityQuestionsPage} />} />
      <Route path="/reset-data" component={ResetDataPage} />
      <Route path="/customer" component={CustomerScan} />
      <Route path="/wallet-callback" component={WalletCallback} />
      <Route path="/report-blank" component={ReportBlank} />
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
