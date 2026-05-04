import { useState } from "react";
import { useListMeasurements, useCreateMeasurement, useDeleteMeasurement, useListMembers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function Measurements() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    memberId: "", weight: "", height: "", chest: "",
    waist: "", hips: "", biceps: "", bodyFat: "", notes: "",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: measurements, isLoading, refetch } = useListMeasurements();
  const { data: members } = useListMembers();
  const createMeasurement = useCreateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();

  const filtered = (Array.isArray(measurements) ? measurements : []).filter((m: any) =>
    m.memberName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.memberId || !form.weight) {
      toast({ title: "Member and weight are required", variant: "destructive" });
      return;
    }
    try {
      await createMeasurement.mutateAsync({
        data: {
          memberId: parseInt(form.memberId),
          weight: parseFloat(form.weight) || 0,
          height: parseFloat(form.height) || 0,
          bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : undefined,
          notes: form.notes || undefined,
          date: new Date().toISOString().split("T")[0],
          ...({
            chest: form.chest ? parseFloat(form.chest) : undefined,
            waist: form.waist ? parseFloat(form.waist) : undefined,
            hips: form.hips ? parseFloat(form.hips) : undefined,
            arms: form.biceps ? parseFloat(form.biceps) : undefined,
          } as any)
        }
      });
      toast({ title: "Measurement recorded" });
      setOpen(false);
      setForm({ memberId: "", weight: "", height: "", chest: "", waist: "", hips: "", biceps: "", bodyFat: "", notes: "" });
      refetch();
    } catch {
      toast({ title: "Failed to save measurement", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMeasurement.mutateAsync({ id: deleteId });
      toast({ title: "Measurement deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Measurements</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record Measurement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Measurement Records</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search member..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <TableHead>Member</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Weight (kg)</TableHead>
                  <TableHead>Height (cm)</TableHead>
                  <TableHead>Chest (cm)</TableHead>
                  <TableHead>Waist (cm)</TableHead>
                  <TableHead>Body Fat %</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No measurements recorded yet</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.memberName}</TableCell>
                      <TableCell>{m.date ? format(new Date(m.date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{m.weight ?? "—"}</TableCell>
                      <TableCell>{m.height ?? "—"}</TableCell>
                      <TableCell>{m.chest ?? "—"}</TableCell>
                      <TableCell>{m.waist ?? "—"}</TableCell>
                      <TableCell>{m.bodyFat ? `${m.bodyFat}%` : "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
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
            <DialogTitle>Record Measurement</DialogTitle>
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
                <Label>Weight (kg) *</Label>
                <Input type="number" value={form.weight} onChange={(e) => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="75" />
              </div>
              <div className="grid gap-2">
                <Label>Height (cm)</Label>
                <Input type="number" value={form.height} onChange={(e) => setForm(f => ({ ...f, height: e.target.value }))} placeholder="175" />
              </div>
              <div className="grid gap-2">
                <Label>Chest (cm)</Label>
                <Input type="number" value={form.chest} onChange={(e) => setForm(f => ({ ...f, chest: e.target.value }))} placeholder="95" />
              </div>
              <div className="grid gap-2">
                <Label>Waist (cm)</Label>
                <Input type="number" value={form.waist} onChange={(e) => setForm(f => ({ ...f, waist: e.target.value }))} placeholder="80" />
              </div>
              <div className="grid gap-2">
                <Label>Hips (cm)</Label>
                <Input type="number" value={form.hips} onChange={(e) => setForm(f => ({ ...f, hips: e.target.value }))} placeholder="95" />
              </div>
              <div className="grid gap-2">
                <Label>Biceps (cm)</Label>
                <Input type="number" value={form.biceps} onChange={(e) => setForm(f => ({ ...f, biceps: e.target.value }))} placeholder="35" />
              </div>
              <div className="grid gap-2">
                <Label>Body Fat %</Label>
                <Input type="number" value={form.bodyFat} onChange={(e) => setForm(f => ({ ...f, bodyFat: e.target.value }))} placeholder="18" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMeasurement.isPending}>Save Measurement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Measurement"
        description="Are you sure you want to delete this measurement record? This action cannot be undone."
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
