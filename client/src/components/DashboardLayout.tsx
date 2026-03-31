import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Menu, X, LogOut, Home } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const [, navigate] = useLocation();
  const unreadNotificationsQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 30000,
  });

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const isAdmin = user?.role === "admin";

  const navigationItems = isAdmin
    ? [
        { label: "Reports", href: "/admin/reports", icon: "📋" },
        { label: "Approvals", href: "/admin/approvals", icon: "✓" },
        { label: "Analytics", href: "/admin/analytics", icon: "📈" },
        { label: "Users", href: "/admin/users", icon: "👥" },
      ]
    : [
        { label: "Daily Field Report", href: "/employee/daily-report", icon: "📝" },
        { label: "Concrete Test Data", href: "/employee/concrete-test", icon: "🧪" },
        { label: "My Submissions", href: "/employee/submissions", icon: "📊" },
      ];

  navigationItems.push({ label: "Notifications", href: "/notifications", icon: "!" });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-300 ease-in-out md:translate-x-0 md:static`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-6 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">Inspection Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "Admin Panel" : "Employee Portal"}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.href);
                  setSidebarOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.href === "/notifications" && (unreadNotificationsQuery.data?.count ?? 0) > 0 && (
                  <Badge className="ml-auto bg-blue-100 text-blue-800">
                    {unreadNotificationsQuery.data?.count}
                  </Badge>
                )}
              </a>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-border space-y-3">
            <div className="px-4 py-2 bg-accent/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="font-semibold text-foreground truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {isAdmin ? "Administrator" : "Employee"}
              </p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-4 py-4 md:px-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>

          <h2 className="text-xl font-semibold text-foreground flex-1 md:flex-none">
            {isAdmin ? "Admin Dashboard" : "Employee Dashboard"}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hidden md:flex"
          >
            <Home className="h-5 w-5" />
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
