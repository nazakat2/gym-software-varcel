import { useState } from "react";
import { useListBilling, useMarkInvoicePaid, useCreateInvoice, useListMembers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, AlertCircle, CheckCircle, Plus, Search } from "lucide-react";
import { format } from "date-fns";

export default function Billing() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "", amount: "", plan: "monthly", paymentMethod: "cash" });
  const { toast } = useToast();

  const { data: invoices, isLoading, refetch } = useListBilling();
  const { data: members } = useListMembers();
  const markPaid = useMarkInvoicePaid();
  const createInvoice = useCreateInvoice();

  const billingInvoices = Array.isArray(invoices) ? invoices : [];
  const filtered = billingInvoices.filter((inv) => {
    const matchSearch = inv.memberName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = billingInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalUnpaid = billingInvoices.filter(i => i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0);

  const handleMarkPaid = async (id: number) => {
    try {
      await markPaid.mutateAsync({ id, data: { paymentMethod: "cash" } });
      toast({ title: "Invoice marked as paid" });
      refetch();
    } catch {
      toast({ title: "Failed to mark as paid", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.memberId || !form.amount) {
      toast({ title: "Member and amount are required", variant: "destructive" });
      return;
    }
    try {
      await createInvoice.mutateAsync({
        data: {
          memberId: parseInt(form.memberId),
          amount: parseFloat(form.amount),
          plan: form.plan,
          dueDate: new Date().toISOString().split("T")[0],
        }
      });
      toast({ title: "Invoice created" });
      setCreateOpen(false);
      setForm({ memberId: "", amount: "", plan: "monthly", paymentMethod: "cash" });
      refetch();
    } catch {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">PKR {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{(Array.isArray(invoices) ? invoices : []).filter(i => i.status === "paid").length} paid invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Dues</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">PKR {totalUnpaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{(Array.isArray(invoices) ? invoices : []).filter(i => i.status === "unpaid").length} unpaid invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(Array.isArray(invoices) ? invoices : []).length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Invoice List</CardTitle>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search member..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-muted-foreground">#{inv.id}</TableCell>
                      <TableCell className="font-medium">{inv.memberName}</TableCell>
                      <TableCell className="capitalize">{inv.plan}</TableCell>
                      <TableCell>PKR {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{inv.paidDate ? format(new Date(inv.paidDate), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "paid" ? "default" : "destructive"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inv.status === "unpaid" && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv.id)} disabled={markPaid.isPending}>
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Member</Label>
              <Select value={form.memberId} onValueChange={(v) => setForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(members) ? members : []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Amount (PKR)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="3000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvoice.isPending}>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
