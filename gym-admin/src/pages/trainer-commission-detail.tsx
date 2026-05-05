import { useParams, Link } from "wouter";
import { useGetTrainerCommissionDetail } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, TrendingUp, CalendarDays } from "lucide-react";

const fmt = (n: number) => `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;

export default function TrainerCommissionDetail() {
  const params = useParams<{ trainerId: string }>();
  const trainerId = parseInt(params.trainerId || "0");

  const { data, isLoading, isError } = useGetTrainerCommissionDetail(trainerId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading trainer details...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Trainer not found or failed to load.</p>
        <Link href="/trainer-commission">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        </Link>
      </div>
    );
  }

  const { trainer, subscriptions, earnings, stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trainer-commission">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{trainer.name}</h1>
          <p className="text-muted-foreground">{trainer.phone}{trainer.email ? ` · ${trainer.email}` : ""}</p>
        </div>
        <Badge variant={trainer.status === "active" ? "default" : "secondary"} className="ml-auto">
          {trainer.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">{stats.activeClients} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats.totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats.monthlyEarnings)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(trainer.commission)}</div>
            <p className="text-xs text-muted-foreground">Base commission (PKR)</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Assigned Clients ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="earnings">Commission History ({earnings.length})</TabsTrigger>
        </TabsList>

        {/* Clients tab */}
        <TabsContent value="clients">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No clients assigned to this trainer yet
                      </TableCell>
                    </TableRow>
                  ) : subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.memberName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.memberPhone}</TableCell>
                      <TableCell>{s.planName ?? <span className="text-muted-foreground text-xs">No plan</span>}</TableCell>
                      <TableCell>
                        {s.commissionType && s.commissionValue != null ? (
                          <span className="text-sm">
                            {s.commissionType === "percentage"
                              ? `${s.commissionValue}%`
                              : fmt(s.commissionValue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">{s.purpose || "—"}</TableCell>
                      <TableCell>{s.startDate}</TableCell>
                      <TableCell>{s.endDate || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === "active" ? "default" :
                            s.status === "expired" ? "secondary" : "destructive"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings tab */}
        <TabsContent value="earnings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Invoice Amount</TableHead>
                    <TableHead className="text-right">Commission Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No commission earnings recorded yet
                      </TableCell>
                    </TableRow>
                  ) : earnings.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell className="font-medium">{e.memberName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.invoicePlan || "—"}</Badge>
                      </TableCell>
                      <TableCell>{fmt(e.invoiceAmount)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-500">{fmt(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {earnings.length > 0 && (
            <div className="flex justify-end mt-4">
              <Card className="w-64">
                <CardContent className="py-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Commissions</span>
                    <span className="font-semibold">{fmt(stats.totalEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">This Month</span>
                    <span className="font-semibold text-green-500">{fmt(stats.monthlyEarnings)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
