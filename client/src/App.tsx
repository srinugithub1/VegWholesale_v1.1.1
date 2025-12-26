import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Store, LogOut, User } from "lucide-react";
import { useShop } from "@/hooks/use-shop";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Sell from "@/pages/sell";
import Dashboard from "@/pages/dashboard";
import Vendors from "@/pages/vendors";
import Customers from "@/pages/customers";
import Vehicles from "@/pages/vehicles";
import Products from "@/pages/products";
import Stock from "@/pages/stock";
import Purchases from "@/pages/purchases";
import Payments from "@/pages/payments";
import Reports from "@/pages/reports";
import PrintCenter from "@/pages/print";
import Settings from "@/pages/settings";
import Weighing from "@/pages/weighing";
import VendorReturns from "@/pages/vendor-returns";
import AuthPage from "@/pages/auth-page";
import CustomerEdit from "@/pages/customer-edit";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/sell" component={Sell} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/customers" component={Customers} />
      <Route path="/vehicles" component={Vehicles} />
      <Route path="/products" component={Products} />
      <Route path="/customer-edit" component={CustomerEdit} />
      <Route path="/stock" component={Stock} />
      <Route path="/purchases" component={Purchases} />
      <Route path="/vendor-returns" component={VendorReturns} />
      <Route path="/weighing" component={Weighing} />
      <Route path="/payments" component={Payments} />
      <Route path="/reports" component={Reports} />
      <Route path="/print" component={PrintCenter} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedApp() {
  const [location, setLocation] = useLocation();
  const { shop, setShop } = useShop();
  const { user, logoutMutation } = useAuth();
  const isAdmin = user?.role === "admin";

  // Redirect non-admins to /sell if they try to access restricted routes
  useEffect(() => {
    if (!user) return; // Should not happen in ProtectedApp but safe check

    // List of allowed routes for non-admins
    const allowed = ['/sell', '/customer-edit'];

    if (!isAdmin) {
      if (!allowed.includes(location)) {
        setLocation('/sell');
      }
    }
  }, [user, isAdmin, location, setLocation]);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (!isAdmin && location !== '/sell' && location !== '/customer-edit') {
    return null; // Don't render restricted content while redirecting
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="relative flex items-center justify-between gap-2 p-2 border-b h-14 flex-shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>

            {/* Shop Icons (Only on Sell Page) - Centered */}
            {(location === '/sell') && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
                {/* Shop 42 */}
                <div
                  className={`flex items-center gap-2 cursor-pointer group transition-all duration-300 ${shop === 42 ? 'scale-110 opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  onClick={() => setShop(42)}
                  title="Shop 42"
                >
                  <div className={`p-1.5 rounded-full transition-colors ${shop === 42 ? 'bg-orange-100' : 'bg-orange-100/30'}`}>
                    <Store className={`h-6 w-6 transition-colors ${shop === 42 ? 'text-orange-600' : 'text-orange-600/70'}`} />
                  </div>
                  <span className={`text-xl font-bold transition-colors ${shop === 42 ? 'text-orange-700' : 'text-orange-700/70'}`}>42</span>
                </div>

                {/* Shop 50 */}
                <div
                  className={`flex items-center gap-2 cursor-pointer group transition-all duration-300 ${shop === 50 ? 'scale-110 opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  onClick={() => setShop(50)}
                  title="Shop 50"
                >
                  <div className={`p-1.5 rounded-full transition-colors ${shop === 50 ? 'bg-blue-100' : 'bg-blue-100/30'}`}>
                    <Store className={`h-6 w-6 transition-colors ${shop === 50 ? 'text-blue-600' : 'text-blue-600/70'}`} />
                  </div>
                  <span className={`text-xl font-bold transition-colors ${shop === 50 ? 'text-blue-700' : 'text-blue-700/70'}`}>50</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 mr-2 border-r">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-sm hidden md:flex">
                  <span className="font-medium leading-none">{user?.username}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
                </div>
              </div>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return <ProtectedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
