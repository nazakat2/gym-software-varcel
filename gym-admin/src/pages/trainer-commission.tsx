import { useState } from "react";
import { Link } from "wouter";
import {
  useListTrainerCommissions,
  useListPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  useListClientSubscriptions,
  useCreateClientSubscription,
  useUpdateClientSubscription,
  useDeleteClientSubscription,
  useListMembers,
  useListEmployees,
  useGetMonthlyReport,
  type Plan,
  type ClientSubscription,
  type CommissionType,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Eye, TrendingUp, Users, DollarSign, BarChart2, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { format } from "date-fns";

const fmt = (n: number) => `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
const currentMonth = () => new Date().toISOString().slice(0, 7);

type PlanForm = {
  name: string;
  totalFee: string;
  commissionType: CommissionType;
  commissionValue: string;
  description: string;
  isActive: boolean;
};

const emptyPlanForm: PlanForm = {
  name: "",
  totalFee: "",
  commissionType: "percentage",
  commissionValue: "",
  description: "",
  isActive: true,
};

type SubForm = {
  memberId: string;
  trainerId: string;
  planId: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: string;
};

const emptySubForm: SubForm = {
  memberId: "",
  trainerId: "",
  planId: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  purpose: "",
  status: "active",
};

export default function TrainerCommission() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);

  const [planOpen, setPlanOpen] = useState(false);
  const [planEditId, setPlanEditId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [deletePlanId, setDeletePlanId] = useState<number | null>(null);

  const [subOpen, setSubOpen] = useState(false);
  const [subEditId, setSubEditId] = useState<number | null>(null);
  const [subForm, setSubForm] = useState<SubForm>(emptySubForm);
  const [deleteSubId, setDeleteSubId] = useState<number | null>(null);

  const { data: trainers, isLoading } = useListTrainerCommissions();
  const { data: plans, refetch: refetchPlans } = useListPlans();
  const { data: subscriptions, refetch: refetchSubs } = useListClientSubscriptions();
  const { data: members } = useListMembers();
  const { data: employees } = useListEmployees();
  const { data: report, refetch: refetchReport } = useGetMonthlyReport({ month });

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const createSub = useCreateClientSubscription();
  const updateSub = useUpdateClientSubscription();
  const deleteSub = useDeleteClientSubscription();

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/trainer-commissions/seed-demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: data.message });
      refetchPlans(); refetchSubs();
    } catch (e: any) {
      toast({ title: e.message || "Demo data add nahi ho saka", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const trainerEmployees = (employees || []).filter((e) => e.role === "trainer");
  const filteredTrainers = (trainers || []).filter((t) =>
    t.trainerName.toLowerCase().includes(search.toLowerCase())
  );

  const totalCommissions = (trainers || []).reduce((s, t) => s + t.totalEarnings, 0);
  const monthlyCommissions = (trainers || []).reduce((s, t) => s + t.monthlyEarnings, 0);
  const totalClients = (trainers || []).reduce((s, t) => s + t.totalClients, 0);

  // Plan handlers
  const openNewPlan = () => { setPlanEditId(null); setPlanForm(emptyPlanForm); setPlanOpen(true); };
  const openEditPlan = (p: Plan) => {
    setPlanEditId(p.id);
    setPlanForm({
      name: p.name,
      totalFee: String(p.totalFee),
      commissionType: p.commissionType,
      commissionValue: String(p.commissionValue),
      description: p.description || "",
      isActive: p.isActive,
    });
    setPlanOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.totalFee) {
      toast({ title: "Name and fee are required", variant: "destructive" });
      return;
    }
    const payload = {
      name: planForm.name,
      totalFee: parseFloat(planForm.totalFee),
      commissionType: planForm.commissionType,
      commissionValue: parseFloat(planForm.commissionValue || "0"),
      description: planForm.description || null,
      isActive: planForm.isActive,
    };
    try {
      if (planEditId) {
        await updatePlan.mutateAsync({ id: planEditId, data: payload });
        toast({ title: "Plan updated" });
      } else {
        await createPlan.mutateAsync({ data: payload });
        toast({ title: "Plan created" });
      }
      setPlanOpen(false);
      refetchPlans();
    } catch {
      toast({ title: "Failed to save plan", variant: "destructive" });
    }
  };

  const handleDeletePlan = async (id: number) => {
    try {
      await deletePlan.mutateAsync({ id });
      toast({ title: "Plan deleted" });
      refetchPlans();
    } catch {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    }
    setDeletePlanId(null);
  };

  // Subscription handlers
  const openNewSub = () => { setSubEditId(null); setSubForm(emptySubForm); setSubOpen(true); };
  const openEditSub = (s: ClientSubscription) => {
    setSubEditId(s.id);
    setSubForm({
      memberId: String(s.memberId),
      trainerId: String(s.trainerId),
      planId: s.planId ? String(s.planId) : "",
      startDate: s.startDate,
      endDate: s.endDate || "",
      purpose: s.purpose || "",
      status: s.status,
    });
    setSubOpen(true);
  };

  const handleSaveSub = async () => {
    if (!subForm.memberId || !subForm.trainerId || !subForm.startDate) {
      toast({ title: "Member, trainer, and start date are required", variant: "destructive" });
      return;
    }
    const payload = {
      memberId: parseInt(subForm.memberId),
      trainerId: parseInt(subForm.trainerId),
      planId: subForm.planId ? parseInt(subForm.planId) : null,
      startDate: subForm.startDate,
      endDate: subForm.endDate || null,
      purpose: subForm.purpose || null,
      status: subForm.status as any,
    };
    try {
      if (subEditId) {
        await updateSub.mutateAsync({ id: subEditId, data: payload });
        toast({ title: "Subscription updated" });
      } else {
        await createSub.mutateAsync({ data: payload });
        toast({ title: "Subscription created" });
      }
      setSubOpen(false);
      refetchSubs();
    } catch {
      toast({ title: "Failed to save subscription", variant: "destructive" });
    }
  };

  const handleDeleteSub = async (id: number) => {
    try {
      await deleteSub.mutateAsync({ id });
      toast({ title: "Subscription deleted" });
      refetchSubs();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteSubId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Trainer Commission</h1>
        {/* <Button variant="outline" onClick={handleSeedDemo} disabled={seeding}>
          {seeding ? "Loading..." : "Load Demo Data"}
        </Button> */}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trainers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(trainers || []).length}</div>
            <p className="text-xs text-muted-foreground">{totalClients} total clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(monthlyCommissions)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gym Revenue (Monthly)</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(report?.totalGymRevenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground">After trainer commissions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trainers">
        <TabsList>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="reports">Monthly Report</TabsTrigger>
        </TabsList>

        {/* Trainers tab */}
        <TabsContent value="trainers" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trainers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Total Clients</TableHead>
                    <TableHead>Active Clients</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Monthly Earnings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : filteredTrainers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No trainers found</TableCell>
                    </TableRow>
                  ) : filteredTrainers.map((t) => (
                    <TableRow key={t.trainerId}>
                      <TableCell className="text-muted-foreground text-sm">{t.trainerId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{t.trainerName}</div>
                        <div className="text-xs text-muted-foreground">{t.phone}</div>
                      </TableCell>
                      <TableCell>{t.totalClients}</TableCell>
                      <TableCell>
                        <Badge variant={t.activeClients > 0 ? "default" : "secondary"}>
                          {t.activeClients}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{fmt(t.totalEarnings)}</TableCell>
                      <TableCell>{fmt(t.monthlyEarnings)}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "active" ? "default" : "secondary"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/trainer-commission/${t.trainerId}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" /> Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewSub}>
              <Plus className="mr-2 h-4 w-4" /> New Subscription
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptions || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No subscriptions yet</TableCell>
                    </TableRow>
                  ) : (subscriptions || []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.memberName}</TableCell>
                      <TableCell>{s.trainerName}</TableCell>
                      <TableCell>{s.planName ?? <span className="text-muted-foreground text-xs">No plan</span>}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{s.purpose || "—"}</TableCell>
                      <TableCell>{s.startDate}</TableCell>
                      <TableCell>{s.endDate || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : s.status === "expired" ? "secondary" : "destructive"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditSub(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteSubId(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewPlan}>
              <Plus className="mr-2 h-4 w-4" /> New Plan
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Total Fee</TableHead>
                    <TableHead>Commission Type</TableHead>
                    <TableHead>Commission Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(plans || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No plans yet. Create one to define commission rules.</TableCell>
                    </TableRow>
                  ) : (plans || []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                      </TableCell>
                      <TableCell>{fmt(p.totalFee)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.commissionType}</Badge>
                      </TableCell>
                      <TableCell>
                        {p.commissionType === "percentage"
                          ? `${p.commissionValue}%`
                          : fmt(p.commissionValue)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditPlan(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletePlanId(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={() => refetchReport()}>Refresh</Button>
          </div>

          {report && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Gym Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">{fmt(report.totalGymRevenue)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Commissions Paid</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">{fmt(report.totalCommissions)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report.month}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Trainer-wise Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainer</TableHead>
                        <TableHead className="text-right">Commission Earned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.trainerBreakdown.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">No commission data for this month</TableCell>
                        </TableRow>
                      ) : report.trainerBreakdown.map((tb) => (
                        <TableRow key={tb.trainerId}>
                          <TableCell className="font-medium">{tb.trainerName}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(tb.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{planEditId ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="e.g. Personal Training Monthly" />
            </div>
            <div className="space-y-1">
              <Label>Total Fee (PKR)</Label>
              <Input type="number" value={planForm.totalFee} onChange={(e) => setPlanForm({ ...planForm, totalFee: e.target.value })} placeholder="e.g. 5000" />
            </div>
            <div className="space-y-1">
              <Label>Commission Type</Label>
              <Select value={planForm.commissionType} onValueChange={(v) => setPlanForm({ ...planForm, commissionType: v as CommissionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (PKR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Commission Value {planForm.commissionType === "percentage" ? "(%)" : "(PKR)"}</Label>
              <Input type="number" value={planForm.commissionValue} onChange={(e) => setPlanForm({ ...planForm, commissionValue: e.target.value })} placeholder={planForm.commissionType === "percentage" ? "e.g. 30" : "e.g. 1500"} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Brief description" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={planForm.isActive} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })} />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={createPlan.isPending || updatePlan.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{subEditId ? "Edit Subscription" : "New Subscription"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Member</Label>
              <Select value={subForm.memberId} onValueChange={(v) => setSubForm({ ...subForm, memberId: v })} disabled={!!subEditId}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {(members || []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Trainer</Label>
              <Select value={subForm.trainerId} onValueChange={(v) => setSubForm({ ...subForm, trainerId: v })} disabled={!!subEditId}>
                <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
                <SelectContent>
                  {trainerEmployees.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={subForm.planId || "none"} onValueChange={(v) => setSubForm({ ...subForm, planId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="No plan (use trainer commission)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plan (use trainer's base commission)</SelectItem>
                  {(plans || []).filter(p => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Purpose</Label>
              <Input value={subForm.purpose} onChange={(e) => setSubForm({ ...subForm, purpose: e.target.value })} placeholder="e.g. Weight loss, Muscle gain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={subForm.startDate} onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={subForm.endDate} onChange={(e) => setSubForm({ ...subForm, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={subForm.status} onValueChange={(v) => setSubForm({ ...subForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSub} disabled={createSub.isPending || updateSub.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletePlanId !== null}
        title="Delete Plan"
        description="This will permanently delete the plan."
        onConfirm={() => deletePlanId && handleDeletePlan(deletePlanId)}
        onOpenChange={(open) => { if (!open) setDeletePlanId(null); }}
        variant="destructive"
      />
      <ConfirmDialog
        open={deleteSubId !== null}
        title="Delete Subscription"
        description="This will permanently delete the subscription."
        onConfirm={() => deleteSubId && handleDeleteSub(deleteSubId)}
        onOpenChange={(open) => { if (!open) setDeleteSubId(null); }}
        variant="destructive"
      />
    </div>
  );
}
