import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth, registerQueryCacheClearer } from "@/contexts/auth-context";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import AddMember from "@/pages/member-new";
import MemberDetail from "@/pages/member-detail";
import Measurements from "@/pages/measurements";
import Attendance from "@/pages/attendance";
import AttendanceScan from "@/pages/attendance-scan";
import Employees from "@/pages/employees";
import Billing from "@/pages/billing";
import Subscription from "@/pages/subscription";
import PaymentSuccess from "@/pages/payment-success";
import PaymentFailure from "@/pages/payment-failure";
import Inventory from "@/pages/inventory";
import Sales from "@/pages/sales";
import Accounts from "@/pages/accounts";
import Reports from "@/pages/reports";
import Notifications from "@/pages/notifications";
import AdminUsers from "@/pages/admin-users";
import AppContent from "@/pages/app-content";
import BusinessSettings from "@/pages/business-settings";
import AISecurity from "@/pages/ai-security";
import TrainerCommission from "@/pages/trainer-commission";
import TrainerCommissionDetail from "@/pages/trainer-commission-detail";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";
import SuperAdminLogin from "@/pages/super-admin-login";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import SuperAdminGyms from "@/pages/super-admin-gyms";
import SuperAdminSubscriptions from "@/pages/super-admin-subscriptions";
import SuperAdminAnalytics from "@/pages/super-admin-analytics";
import { SuperAdminLayout } from "@/components/super-admin-layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Register cache clearer so AuthProvider can clear on login/logout
registerQueryCacheClearer(() => queryClient.clear());

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-2">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p>Coming soon</p>
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - Login & Register */}
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/register">
        {user ? <Redirect to="/" /> : <Register />}
      </Route>

      {/* Super Admin Routes */}
      <Route path="/super-admin/login" component={SuperAdminLogin} />

      <Route path="/super-admin/:rest*">
        {!user ? (
          <Redirect to="/super-admin/login" />
        ) : user.role !== "super_admin" ? (
          <Redirect to="/" />
        ) : (
          <SuperAdminLayout>
            <Switch>
              <Route path="/super-admin/dashboard" component={SuperAdminDashboard} />
              <Route path="/super-admin/gyms" component={SuperAdminGyms} />
              <Route path="/super-admin/subscriptions" component={SuperAdminSubscriptions} />
              <Route path="/super-admin/analytics" component={SuperAdminAnalytics} />
              <Route component={NotFound} />
            </Switch>
          </SuperAdminLayout>
        )}
      </Route>

      {/* Protected routes - require authentication */}
      <Route path="/">
        {!user ? (
          <Redirect to="/login" />
        ) : (
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/members" component={Members} />
              <Route path="/members/new" component={AddMember} />
              <Route path="/members/:id" component={MemberDetail} />
              <Route path="/measurements" component={Measurements} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/attendance-scan" component={AttendanceScan} />
              <Route path="/employees" component={Employees} />
              <Route path="/billing" component={Billing} />
              <Route path="/subscription" component={Subscription} />
              <Route path="/subscription/success" component={PaymentSuccess} />
              <Route path="/subscription/failure" component={PaymentFailure} />
              <Route path="/trainer-commission" component={TrainerCommission} />
              <Route path="/trainer-commission/:trainerId" component={TrainerCommissionDetail} />
              <Route path="/sales" component={Sales} />
              <Route path="/inventory" component={Inventory} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/users" component={AdminUsers} />
              <Route path="/app-content" component={AppContent} />
              <Route path="/reports" component={Reports} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/business" component={BusinessSettings} />
              <Route path="/ai-security" component={AISecurity} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
