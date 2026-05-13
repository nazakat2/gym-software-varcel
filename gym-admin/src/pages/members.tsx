import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListMembers, useDeleteMember, useUpdateMember, useListEmployees } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Trash2, Pencil, Eye } from "lucide-react";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function Members() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", whatsapp: "", email: "", cnic: "",
    gender: "male", dob: "", address: "",
    plan: "monthly", planStartDate: "", status: "active",
    assignedTrainerId: "" as string,
    trainerCommission: "" as string,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const { data: members, isLoading, refetch } = useListMembers();
  const { data: employees } = useListEmployees();
  const deleteMember = useDeleteMember();
  const updateMember = useUpdateMember();

  const filteredMembers = (Array.isArray(members) ? members : []).filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.cnic.includes(search)
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMember.mutateAsync({ id: deleteId });
      toast({ title: "Member deleted successfully" });
      refetch();
    } catch (error) {
      toast({ title: "Failed to delete member", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (m: any) => {
    setEditMember(m);
    setEditForm({
      name: m.name ?? "",
      phone: m.phone ?? "",
      whatsapp: m.whatsapp ?? "",
      email: m.email ?? "",
      cnic: m.cnic ?? "",
      gender: m.gender ?? "male",
      dob: m.dob ?? "",
      address: (m as any).address ?? "",
      plan: m.plan ?? "monthly",
      planStartDate: m.planStartDate ?? new Date().toISOString().split("T")[0],
      status: m.status ?? "active",
      assignedTrainerId: (m as any).assignedTrainerId ? String((m as any).assignedTrainerId) : "",
      trainerCommission: "",
    });
  };

  const handleEditSave = async () => {
    if (!editMember) return;
    if (!editForm.name || !editForm.phone || !editForm.cnic) {
      toast({ title: "Name, phone and CNIC are required", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const { trainerCommission: _unused, ...memberData } = editForm;
      await updateMember.mutateAsync({
        id: editMember.id,
        data: {
          ...memberData,
          assignedTrainerId: editForm.assignedTrainerId ? editForm.assignedTrainerId : null,
        } as any,
      });
      toast({ title: "Member updated" });
      setEditMember(null);
      refetch();
    } catch {
      toast({ title: "Failed to update member", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <Button onClick={() => setLocation("/members/new")}>
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, phone or CNIC..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>CNIC</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredMembers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="text-muted-foreground text-sm">{member.id}</TableCell>
                  <TableCell>
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.cnic}</TableCell>
                  <TableCell>{(member as any).address || "—"}</TableCell>
                  <TableCell className="capitalize">{member.plan}</TableCell>
                  <TableCell>
                    {format(new Date(member.planExpiryDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === "active" ? "default" : "destructive"}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/members/${member.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(member)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(member.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Edit Member Dialog */}
      <Dialog open={editMember !== null} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member — {editMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label>Name *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="grid gap-2">
                <Label>Phone *</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="03xx-xxxxxxx" />
              </div>
              <div className="grid gap-2">
                <Label>WhatsApp</Label>
                <Input value={editForm.whatsapp} onChange={(e) => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="03xx-xxxxxxx" />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>
              <div className="grid gap-2">
                <Label>CNIC *</Label>
                <Input value={editForm.cnic} onChange={(e) => setEditForm(f => ({ ...f, cnic: e.target.value }))} placeholder="xxxxx-xxxxxxx-x" />
              </div>
              <div className="grid gap-2">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.dob} onChange={(e) => setEditForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, area, city" />
              </div>
              <div className="grid gap-2">
                <Label>Plan</Label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Plan Start Date</Label>
                <Input type="date" value={editForm.planStartDate} onChange={(e) => setEditForm(f => ({ ...f, planStartDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Trainer</Label>
                <Select value={editForm.assignedTrainerId || "none"} onValueChange={(v) => setEditForm(f => ({ ...f, assignedTrainerId: v === "none" ? "" : v, trainerCommission: "" }))}>
                  <SelectTrigger><SelectValue placeholder="No trainer assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No trainer assigned</SelectItem>
                    {(employees || []).filter(e => e.role === "trainer").map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editForm.assignedTrainerId && editForm.assignedTrainerId !== "none" && (
                <div className="grid gap-2">
                  <Label>Commission %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 30"
                    value={editForm.trainerCommission}
                    onChange={e => setEditForm(f => ({ ...f, trainerCommission: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Member"
        description="Are you sure you want to delete this member? All their data will be permanently removed."
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
