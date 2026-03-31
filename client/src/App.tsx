import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import DailyFieldReportForm from "./pages/DailyFieldReportForm";
import ConcreteTestForm from "./pages/ConcreteTestForm";
import MySubmissions from "./pages/MySubmissions";
import AdminReports from "./pages/AdminReports";
import AdminApprovals from "./pages/AdminApprovals";
import AdminAnalytics from "./pages/AdminAnalytics";
import LocalLogin from "./pages/LocalLogin";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import EditDailyFieldReport from "./pages/EditDailyFieldReport";
import EditConcreteTestForm from "./pages/EditConcreteTestForm";
import NotificationsPage from "./pages/NotificationsPage";

function Router() {
  return (
    <Switch>
      {/* <Route path="/" component={Home} />
      <Route path="/login" component={LocalLogin} /> */}
      <Route path="/" component={Login} />
      
      {/* Employee Routes */}
      <Route path="/employee/daily-report">
        {() => (
          <DashboardLayout>
            <DailyFieldReportForm />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/employee/concrete-test">
        {() => (
          <DashboardLayout>
            <ConcreteTestForm />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/employee/submissions">
        {() => (
          <DashboardLayout>
            <MySubmissions />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/notifications">
        {() => (
          <DashboardLayout>
            <NotificationsPage />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/edit-daily/:id">
        {() => <EditDailyFieldReport />}
      </Route>
      <Route path="/edit-concrete/:id">
        {() => <EditConcreteTestForm />}
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/reports">
        {() => (
          <DashboardLayout>
            <AdminReports />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/admin/approvals">
        {() => (
          <DashboardLayout>
            <AdminApprovals />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/admin/analytics">
        {() => <AdminAnalytics />}
      </Route>
      <Route path="/admin/users">
        {() => <AdminUsers />}
      </Route>

      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
