import { useEffect } from "react";
import { useGetDashboardStats, useGetRecentActivity, useGetRevenueChart, useGetMembershipBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, DollarSign, AlertCircle, Briefcase, Package } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

export default function Dashboard() {
  const { logout } = useAuth();

  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorObj } = useGetDashboardStats({
    query: { retry: false }
  });
  const { data: activities, isLoading: activitiesLoading } = useGetRecentActivity({
    query: { retry: false }
  });
  const { data: revenueChart, isLoading: revenueLoading } = useGetRevenueChart({
    query: { retry: false }
  });
  const { data: membershipBreakdown, isLoading: membershipLoading } = useGetMembershipBreakdown({
    query: { retry: false }
  });

  // Auto-logout on 401 — token expired or invalid
  useEffect(() => {
    if (statsError && (statsErrorObj as any)?.status === 401) {
      logout();
    }
  }, [statsError, statsErrorObj, logout]);

  const isLoading = statsLoading || activitiesLoading || revenueLoading || membershipLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    const is401 = (statsErrorObj as any)?.status === 401;
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">
            {is401 ? "Session expired" : "Failed to load dashboard"}
          </p>
          <p className="text-sm text-muted-foreground">
            {is401 ? "Redirecting to login..." : "Please refresh the page or try again."}
          </p>
        </div>
      </div>
    );
  }

  const COLORS = ['#E31C25', '#10b981', '#f59e0b', '#3b82f6'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">+4% from last month</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayAttendance || 0}</div>
            <p className="text-xs text-muted-foreground">12 currently in gym</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.monthlyRevenue?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-destructive/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Dues</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${stats?.unpaidDues?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">14 members pending</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEmployees || 0}</div>
            <p className="text-xs text-muted-foreground">4 trainers, 2 staff</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lowStockItems || 0}</div>
            <p className="text-xs text-muted-foreground">Items need reorder</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-4 glass glass-dark border-primary/10">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(revenueChart) ? revenueChart : []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Membership Breakdown */}
        <Card className="col-span-3 glass glass-dark border-primary/10">
          <CardHeader>
            <CardTitle>Membership Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Array.isArray(membershipBreakdown) ? membershipBreakdown : []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(Array.isArray(membershipBreakdown) ? membershipBreakdown : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="glass glass-dark border-primary/10">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {(Array.isArray(activities) ? activities : []).slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">{activity.description}</p>
                  <p className="text-sm text-muted-foreground capitalize">{activity.type.replace("_", " ")}</p>
                </div>
                <div className="ml-auto font-medium text-xs text-muted-foreground">
                  {format(new Date(activity.time), "MMM d, h:mm a")}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
