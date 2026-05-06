import { useState } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, type Employee } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type EmployeeForm = {
  name: string;
  role: string;
  phone: string;
  cnic: string;
  email: string;
  salary: string;
  commission: string;
  joinDate: string;
  address: string;
};

const emptyForm: EmployeeForm = {
  name: "",
  role: "trainer",
  phone: "",
  cnic: "",
  email: "",
  salary: "",
  commission: "",
  joinDate: new Date().toISOString().split("T")[0],
  address: "",
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: employees, isLoading, refetch } = useListEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const filtered = (employees || []).filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      cnic: emp.cnic || "",
      email: emp.email || "",
      salary: String(emp.salary),
      commission: String(emp.commission || 0),
      joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      address: (emp as any).address || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.salary) {
      toast({ title: "Name, phone and salary are required", variant: "destructive" });
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      toast({ title: "Phone number must be exactly 11 digits", variant: "destructive" });
      return;
    }
    if (form.cnic) {
      const cnicDigits = form.cnic.replace(/\D/g, "");
      if (cnicDigits.length !== 13) {
        toast({ title: "CNIC must be exactly 13 digits", variant: "destructive" });
        return;
      }
    }
    const payload = {
      name: form.name,
      role: form.role as any,
      phone: form.phone,
      cnic: form.cnic || undefined,
      email: form.email || undefined,
      salary: parseFloat(form.salary),
      commission: form.commission ? parseFloat(form.commission) : undefined,
      joinDate: form.joinDate,
      address: form.address || undefined,
    };
    try {
      if (editId) {
        await updateEmployee.mutateAsync({ id: editId, data: payload });
        toast({ title: "Employee updated" });
      } else {
        await createEmployee.mutateAsync({ data: payload });
        toast({ title: "Employee added" });
      }
      setOpen(false);
      refetch();
    } catch {
      toast({ title: "Failed to save employee", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEmployee.mutateAsync({ id: deleteId });
      toast({ title: "Employee deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete employee", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Staff List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>CNIC</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="text-muted-foreground text-sm">{emp.id}</TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{emp.role}</Badge>
                      </TableCell>
                      <TableCell>{emp.phone}</TableCell>
                      <TableCell>{emp.cnic || "—"}</TableCell>
                      <TableCell>{emp.email || "—"}</TableCell>
                      <TableCell>{(emp as any).address || "—"}</TableCell>
                      <TableCell>PKR {Number(emp.salary).toLocaleString()}</TableCell>
                      <TableCell>{emp.commission ? `PKR ${Number(emp.commission).toLocaleString()}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Tariq Ahmed" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Phone <span className="text-muted-foreground text-xs">(11 digits)</span></Label>
                <Input
                  value={form.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setForm(f => ({ ...f, phone: digits }));
                  }}
                  placeholder="03001234567"
                  maxLength={11}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>CNIC <span className="text-muted-foreground text-xs">(13 digits)</span></Label>
              <Input
                value={form.cnic}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setForm(f => ({ ...f, cnic: digits }));
                }}
                placeholder="3520112345678"
                maxLength={13}
              />
            </div>
            <div className="grid gap-2">
              <Label>Email </Label>
              <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@gym.com" />
            </div>
            <div className="grid gap-2">
              <Label>Address </Label>
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, Area, City" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Monthly Salary (PKR)</Label>
                <Input type="number" value={form.salary} onChange={(e) => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="45000" />
              </div>
              <div className="grid gap-2">
                <Label>Commission (PKR)</Label>
                <Input type="number" value={form.commission} onChange={(e) => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createEmployee.isPending || updateEmployee.isPending}>
              {editId ? "Update" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Employee"
        description="Are you sure you want to delete this employee? This action cannot be undone."
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
