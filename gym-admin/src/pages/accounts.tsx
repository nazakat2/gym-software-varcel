import { useState } from "react";
import { useListAccounts, useListVouchers, useCreateVoucher } from "@workspace/api-client-react";
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
import { Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function Accounts() {
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [form, setForm] = useState({ accountId: "", type: "credit", amount: "", description: "", reference: "" });
  const { toast } = useToast();

  const { data: accounts } = useListAccounts();
  const { data: vouchers, refetch } = useListVouchers();
  const createVoucher = useCreateVoucher();

  const totalIncome = (accounts || []).filter(a => a.type === "income").reduce((s, a) => s + Number(a.balance), 0);
  const totalExpense = (accounts || []).filter(a => a.type === "expense").reduce((s, a) => s + Number(a.balance), 0);
  const totalAssets = (accounts || []).filter(a => a.type === "asset").reduce((s, a) => s + Number(a.balance), 0);

  const handleCreateVoucher = async () => {
    if (!form.accountId || !form.amount || !form.description) {
      toast({ title: "Account, amount and description are required", variant: "destructive" }); return;
    }
    try {
      await createVoucher.mutateAsync({
        data: {
          accountId: parseInt(form.accountId),
          type: form.type as any,
          amount: parseFloat(form.amount),
          description: form.description,
          reference: form.reference || undefined,
          date: new Date().toISOString().split("T")[0],
        }
      });
      toast({ title: "Voucher created" });
      setVoucherOpen(false);
      setForm({ accountId: "", type: "credit", amount: "", description: "", reference: "" });
      refetch();
    } catch { toast({ title: "Failed to create voucher", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Accounts & Vouchers</h1>
        <Button onClick={() => setVoucherOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Voucher</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">PKR {totalIncome.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">PKR {totalExpense.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {totalAssets.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accounts || []).length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No accounts set up</TableCell></TableRow>
                  ) : (accounts || []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                      <TableCell>PKR {Number(a.balance).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vouchers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vouchers || []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No vouchers recorded</TableCell></TableRow>
                  ) : (vouchers || []).map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.date ? format(new Date(v.date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{v.description}</TableCell>
                      <TableCell>
                        <Badge variant={v.type === "credit" ? "default" : "destructive"} className="capitalize">{v.type}</Badge>
                      </TableCell>
                      <TableCell className={v.type === "credit" ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                        PKR {Number(v.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{v.reference || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Voucher</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {(accounts || []).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Amount (PKR)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Monthly membership income" />
            </div>
            <div className="grid gap-2">
              <Label>Reference (optional)</Label>
              <Input value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="INV-001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateVoucher} disabled={createVoucher.isPending}>Create Voucher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
