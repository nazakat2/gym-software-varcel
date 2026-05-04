import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Activity,
  CalendarCheck,
  Briefcase,
  Receipt,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
  FileBarChart,
  Bell,
  Shield,
  Smartphone,
  ScanFace,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GymLogo = () => (
  <img src="/images/logo.png" alt="Core X" className="h-9 w-9 object-contain" />
);

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/measurements", label: "Measurements", icon: Activity },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/employees", label: "Employees", icon: Briefcase },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/sales", label: "POS & Sales", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/users", label: "Admin Users", icon: Shield },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/app-content", label: "Mobile Content", icon: Smartphone },
  { href: "/ai-security", label: "AI Security", icon: ScanFace, premium: true },
  { href: "/business", label: "Business Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r glass glass-dark sm:flex">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <GymLogo />
          <span className="">Core X</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.premium && (
                  <span className="text-[9px] font-bold tracking-wide bg-amber-400 text-amber-950 rounded px-1.5 py-0.5">
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
