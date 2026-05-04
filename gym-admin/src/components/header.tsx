import * as React from "react";
import { Menu, Bell, LogOut, User, Settings, Sun, Moon } from "lucide-react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Briefcase,
  Receipt,
  ShoppingCart,
  Package,
  Wallet,
  FileBarChart,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";

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
  { href: "/business", label: "Business Settings", icon: Settings },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b glass glass-dark px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-4 text-primary">
              <GymLogo />
              <span>Core X</span>
            </Link>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground",
                    isActive ? "bg-muted text-foreground" : ""
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1" />

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && (theme === "dark" ? (
            <Sun className="h-4 w-4 transition-all" />
          ) : (
            <Moon className="h-4 w-4 transition-all" />
          ))}
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-destructive border-2 border-sidebar" />
            <span className="sr-only">Notifications</span>
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
              <Avatar className="h-8 w-8 cursor-pointer border-2 border-transparent hover:border-primary transition-colors">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user ? getInitials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-sm leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
                <Badge variant="outline" className="w-fit mt-1 text-xs capitalize">{user?.role}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/users" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Admin Users
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/business" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Business Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
