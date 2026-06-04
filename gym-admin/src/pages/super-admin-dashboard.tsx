import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  CreditCard,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
  totalGyms: number;
  activeGyms: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  monthlyRecurringRevenue: number;
  totalRevenue: number;
  recentGyms: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    gymName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const token = localStorage.getItem("gym_access_token");
      const res = await fetch("/api/super-admin/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Gyms",
      value: stats?.totalGyms || 0,
      subtitle: `${stats?.activeGyms || 0} active`,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Active Subscriptions",
      value: stats?.activeSubscriptions || 0,
      subtitle: `${stats?.trialSubscriptions || 0} on trial`,
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Monthly Revenue",
      value: `PKR ${(stats?.monthlyRecurringRevenue || 0).toLocaleString()}`,
      subtitle: "MRR",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Total Revenue",
      value: `PKR ${(stats?.totalRevenue || 0).toLocaleString()}`,
      subtitle: "All time",
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and key metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Gyms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Recent Gyms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentGyms?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No gyms registered yet
                </p>
              ) : (
                stats?.recentGyms?.map((gym) => (
                  <div
                    key={gym.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{gym.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {gym.email}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge
                        variant={gym.status === "active" ? "default" : "secondary"}
                      >
                        {gym.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(gym.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentPayments?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No payments yet
                </p>
              ) : (
                stats?.recentPayments?.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{payment.gymName}</p>
                      <p className="text-xs text-muted-foreground">
                        PKR {payment.amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge
                        variant={
                          payment.status === "succeeded"
                            ? "default"
                            : payment.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(payment.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
