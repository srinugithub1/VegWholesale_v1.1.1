import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Truck,
  Package,
  Warehouse,
  ShoppingCart,
  Leaf,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  Scale,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    title: "Sell",
    url: "/sell",
    icon: ShoppingBag,
    roles: ["user"],
  },
  {
    title: "Stock",
    url: "/stock",
    icon: Warehouse,
    roles: ["admin"],
  },
  {
    title: "Vendors",
    url: "/vendors",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Customers",
    url: "/customers",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    title: "Vehicles",
    url: "/vehicles",
    icon: Truck,
    roles: ["admin"],
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
    roles: ["admin"],
  },
];

const transactionItems = [
  {
    title: "Purchases",
    url: "/purchases",
    icon: ShoppingCart,
    roles: ["admin"],
  },
  {
    title: "Returns",
    url: "/vendor-returns",
    icon: RotateCcw,
    roles: ["admin"],
  },
  {
    title: "Weighing Settings",
    url: "/weighing",
    icon: Scale,
    roles: ["admin"], // Weighing page hidden for user, assuming integration is in Sell
  },
  {
    title: "Payments",
    url: "/payments",
    icon: CreditCard,
    roles: ["admin"],
  },
];

const reportItems = [
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    title: "Print Center",
    url: "/print",
    icon: FileText,
    roles: ["admin"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const filterItems = (items: typeof navigationItems) => {
    return items.filter(item => item.roles.includes(user?.role || "user"));
  };

  const navItems = filterItems(navigationItems);
  const transItems = filterItems(transactionItems);
  const repItems = filterItems(reportItems);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-sidebar-foreground" data-testid="text-app-title">
              VegWholesale
            </h1>
            <p className="text-xs text-muted-foreground">Business Manager</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {transItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Transactions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {transItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {repItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Reports & Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {repItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Version 1.0.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
