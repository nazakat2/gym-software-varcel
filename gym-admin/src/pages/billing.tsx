import { useState } from "react";
import { useListBilling, useMarkInvoicePaid, useMarkInvoiceUnpaid, useCreateInvoice, useListMembers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, AlertCircle, CheckCircle, Plus, Search, Printer } from "lucide-react";
import { format } from "date-fns";

function buildInvoiceHtml(inv: { id: number; memberName: string; plan: string; amount: number; dueDate?: string; paidDate?: string; isPaid: boolean; phone?: string }) {
  const statusColor = inv.isPaid ? "#16a34a" : "#dc2626";
  const statusBg = inv.isPaid ? "#dcfce7" : "#fee2e2";
  const statusText = inv.isPaid ? "PAID" : "UNPAID";
  const statusNote = inv.isPaid
    ? "Payment received on " + (inv.paidDate || "—")
    : "Payment due by " + (inv.dueDate || "—");
  const now = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
  const paidRow = inv.isPaid
    ? "<tr><td class=\"lbl\">Paid On</td><td class=\"val\">" + (inv.paidDate || "—") + "</td></tr>"
    : "";
  const phoneRow = inv.phone
    ? "<p class=\"member-phone\">" + inv.phone + "</p>"
    : "";
  const amountFmt = inv.amount.toLocaleString("en-PK");

  const css = [
    "*{margin:0;padding:0;box-sizing:border-box}",
    "body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px 16px}",
    ".toolbar{max-width:700px;margin:0 auto 16px;display:flex;gap:10px}",
    ".print-btn{background:#0f172a;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.4px;display:flex;align-items:center;gap:6px}",
    ".print-btn:hover{background:#1e293b}",
    ".page{background:#fff;max-width:700px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}",
    ".hdr{background:#0f172a;padding:28px 36px;display:table;width:100%;table-layout:fixed}",
    ".hdr-left{display:table-cell;vertical-align:middle}",
    ".hdr-right{display:table-cell;vertical-align:middle;text-align:right}",
    ".gym-name{font-size:20px;font-weight:800;color:#fff;letter-spacing:1px;text-transform:uppercase}",
    ".gym-sub{font-size:10px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-top:3px}",
    ".inv-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px}",
    ".inv-num{font-size:26px;font-weight:800;color:#f97316;margin-top:2px}",
    ".inv-date{font-size:10px;color:#94a3b8;margin-top:3px}",
    ".ribbon{background:#1e293b;padding:9px 36px;display:table;width:100%;table-layout:fixed}",
    ".ribbon-left{display:table-cell;vertical-align:middle}",
    ".ribbon-right{display:table-cell;vertical-align:middle;text-align:right}",
    ".status-pill{display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:1.5px;background:" + statusBg + ";color:" + statusColor + "}",
    ".ribbon-note{font-size:10px;color:#94a3b8}",
    ".bd{padding:32px 36px}",
    ".sec-lbl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}",
    ".member-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px}",
    ".member-name{font-size:17px;font-weight:700;color:#0f172a}",
    ".member-phone{font-size:12px;color:#64748b;margin-top:2px}",
    "table.det{width:100%;border-collapse:collapse;margin-bottom:24px}",
    "table.det th{text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;padding:6px 0;border-bottom:2px solid #e2e8f0}",
    "table.det td{padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:13px}",
    "td.lbl{color:#64748b;width:45%}",
    "td.val{font-weight:600;color:#0f172a;text-align:right}",
    "tr.amt td{padding-top:18px;border-bottom:none}",
    "tr.amt td.lbl{font-size:12px;font-weight:700;color:#0f172a}",
    "tr.amt td.val{font-size:20px;font-weight:800}",
    ".cap{text-transform:capitalize}",
    ".ft{background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;display:table;width:100%;table-layout:fixed}",
    ".ft-left{display:table-cell;vertical-align:middle;font-size:11px;color:#94a3b8}",
    ".ft-right{display:table-cell;vertical-align:middle;text-align:right;font-size:10px;font-weight:700;color:#0f172a;letter-spacing:1px;text-transform:uppercase}",
    "@media print{body{background:#fff;padding:0}.toolbar{display:none}.page{box-shadow:none;border-radius:0;max-width:100%}}",
  ].join("");

  return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/>"
    + "<title>Invoice #" + inv.id + " — " + inv.memberName + "</title>"
    + "<style>" + css + "</style></head><body>"
    + "<div class=\"toolbar\">"
    + "<button class=\"print-btn\" onclick=\"window.print()\">&#128438; Print Invoice</button>"
    + "</div>"
    + "<div class=\"page\">"
    + "<div class=\"hdr\">"
    + "<div class=\"hdr-left\"><div class=\"gym-name\">Core X Gym</div><div class=\"gym-sub\">Fitness &amp; Wellness</div></div>"
    + "<div class=\"hdr-right\"><div class=\"inv-label\">Invoice</div><div class=\"inv-num\">#" + inv.id + "</div><div class=\"inv-date\">Printed: " + now + "</div></div>"
    + "</div>"
    + "<div class=\"ribbon\">"
    + "<div class=\"ribbon-left\"><span class=\"status-pill\">" + statusText + "</span></div>"
    + "<div class=\"ribbon-right\"><span class=\"ribbon-note\">" + statusNote + "</span></div>"
    + "</div>"
    + "<div class=\"bd\">"
    + "<div class=\"sec-lbl\">Bill To</div>"
    + "<div class=\"member-box\"><div class=\"member-name\">" + inv.memberName + "</div>" + phoneRow + "</div>"
    + "<div class=\"sec-lbl\">Invoice Details</div>"
    + "<table class=\"det\"><thead><tr><th>Description</th><th style=\"text-align:right\">Details</th></tr></thead>"
    + "<tbody>"
    + "<tr><td class=\"lbl\">Membership Plan</td><td class=\"val cap\">" + inv.plan + " Plan</td></tr>"
    + "<tr><td class=\"lbl\">Due Date</td><td class=\"val\">" + (inv.dueDate || "—") + "</td></tr>"
    + paidRow
    + "<tr><td class=\"lbl\">Status</td><td class=\"val\" style=\"color:" + statusColor + "\">" + statusText + "</td></tr>"
    + "<tr class=\"amt\"><td class=\"lbl\">Total Amount</td><td class=\"val\">PKR " + amountFmt + "</td></tr>"
    + "</tbody></table>"
    + "</div>"
    + "<div class=\"ft\"><div class=\"ft-left\">Thank you for choosing Core X Gym!</div><div class=\"ft-right\">Core X</div></div>"
    + "</div>"
    + "</body></html>";
}

export default function Billing() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "", amount: "", plan: "monthly", paymentMethod: "cash" });
  const { toast } = useToast();

  const { data: invoices, isLoading, refetch } = useListBilling();
  const { data: members } = useListMembers();
  const markPaid = useMarkInvoicePaid();
  const markUnpaid = useMarkInvoiceUnpaid();
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

  const handleMarkUnpaid = async (id: number) => {
    try {
      await markUnpaid.mutateAsync({ id });
      toast({ title: "Invoice marked as unpaid" });
      refetch();
    } catch {
      toast({ title: "Failed to mark as unpaid", variant: "destructive" });
    }
  };

  const printInvoice = (inv: any) => {
    const isPaid = inv.status === "paid";
    const html = buildInvoiceHtml({
      id: inv.id,
      memberName: inv.memberName,
      plan: inv.plan,
      amount: Number(inv.amount),
      dueDate: inv.dueDate,
      paidDate: inv.paidDate,
      isPaid,
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.focus();
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
                        <div className="flex items-center gap-1">
                          {inv.status === "unpaid" ? (
                            <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv.id)} disabled={markPaid.isPending}>
                              Mark Paid
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleMarkUnpaid(inv.id)} disabled={markUnpaid.isPending}>
                              Mark Unpaid
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => printInvoice(inv)}><Printer className="h-4 w-4" /></Button>
                        </div>
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
