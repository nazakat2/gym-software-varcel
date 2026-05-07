import { useState, useRef } from "react";
import { useListMeasurements, useCreateMeasurement, useDeleteMeasurement, useListMembers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Eye, Upload, X, Pencil, Camera } from "lucide-react";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/confirm-dialog";

// ── Calculation helpers ──────────────────────────────────────────────────────

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age > 0 ? age : null;
}

function calcBMR(weight: number, height: number, age: number, gender: string): number {
  // Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === "female" ? base - 161 : base + 5);
}

function calcBodyFatEst(weight: number, height: number, age: number, gender: string): number {
  // Deurenberg formula
  const bmi = weight / Math.pow(height / 100, 2);
  const bf = 1.20 * bmi + 0.23 * age - (gender === "female" ? 5.4 : 16.2);
  return Math.round(bf * 10) / 10;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(dataUrl: string, filename: string): Promise<string> {
  try {
    const res = await fetch("/api/upload-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, filename }),
    });
    const json = await res.json();
    return json.url ?? dataUrl; // fallback to base64 if no Blob token
  } catch {
    return dataUrl;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Measurements() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    memberId: "", weight: "", height: "", chest: "",
    waist: "", hips: "", biceps: "", bodyFat: "", notes: "",
  });
  const [formBeforePhoto, setFormBeforePhoto] = useState<string | null>(null);
  const [formAfterPhoto, setFormAfterPhoto] = useState<string | null>(null);
  const formBeforeRef = useRef<HTMLInputElement>(null);
  const formAfterRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    weight: "", height: "", chest: "", waist: "", hips: "", biceps: "", bodyFat: "", notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Photo dialog — store only the record ID; display derives from live photoRecord
  // pendingBefore/pendingAfter: undefined = no change, null = removed, string = new upload
  const [photoRecordId, setPhotoRecordId] = useState<number | null>(null);
  const [pendingBefore, setPendingBefore] = useState<string | null | undefined>(undefined);
  const [pendingAfter, setPendingAfter] = useState<string | null | undefined>(undefined);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { toast } = useToast();

  const { data: measurements, isLoading, refetch } = useListMeasurements();
  const { data: members } = useListMembers();
  const createMeasurement = useCreateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();

  const allMeasurements = Array.isArray(measurements) ? measurements : [];
  const filtered = allMeasurements.filter((m: any) =>
    m.memberName?.toLowerCase().includes(search.toLowerCase())
  );

  // Derive photoRecord live from the refreshed list
  const photoRecord = photoRecordId !== null
    ? (allMeasurements.find((m: any) => m.id === photoRecordId) ?? null)
    : null;

  // What the dialog actually displays — pending edit wins, otherwise live DB value
  const displayBefore = pendingBefore !== undefined ? pendingBefore : (photoRecord?.beforePhoto ?? null);
  const displayAfter  = pendingAfter  !== undefined ? pendingAfter  : (photoRecord?.afterPhoto  ?? null);

  // Live form calculations
  const selectedMember = (Array.isArray(members) ? members : []).find(
    (m) => String(m.id) === form.memberId
  ) as any;
  const formAge = calcAge(selectedMember?.dob);
  const formGender = selectedMember?.gender ?? "male";
  const formWeight = parseFloat(form.weight);
  const formHeight = parseFloat(form.height);
  const validWeight = formWeight >= 1 && formWeight <= 500;
  const validHeight = formHeight >= 50 && formHeight <= 300;
  const canCalc = validWeight && validHeight && formAge !== null;
  const liveBMR = canCalc ? calcBMR(formWeight, formHeight, formAge!, formGender) : null;
  const liveBodyFat = canCalc ? calcBodyFatEst(formWeight, formHeight, formAge!, formGender) : null;
  const liveBMI = validWeight && validHeight
    ? Math.round((formWeight / Math.pow(formHeight / 100, 2)) * 10) / 10
    : null;

  const handleCreate = async () => {
    if (!form.memberId || !form.weight) {
      toast({ title: "Member and weight are required", variant: "destructive" });
      return;
    }
    const wt = parseFloat(form.weight);
    const ht = parseFloat(form.height);
    if (form.height && (ht < 50 || ht > 300)) {
      toast({ title: "Height must be between 50 and 300 cm", variant: "destructive" });
      return;
    }
    if (wt < 1 || wt > 500) {
      toast({ title: "Weight must be between 1 and 500 kg", variant: "destructive" });
      return;
    }
    try {
      const created = await createMeasurement.mutateAsync({
        data: {
          memberId: parseInt(form.memberId),
          weight: parseFloat(form.weight) || 0,
          height: parseFloat(form.height) || 0,
          bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : (liveBodyFat ?? undefined),
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
      const measurementId = (created as any)?.id;
      if ((formBeforePhoto || formAfterPhoto) && measurementId) {
        const [before, after] = await Promise.all([
          formBeforePhoto ? uploadPhoto(formBeforePhoto, `before-${measurementId}.jpg`) : Promise.resolve(null),
          formAfterPhoto ? uploadPhoto(formAfterPhoto, `after-${measurementId}.jpg`) : Promise.resolve(null),
        ]);
        const photoRes = await fetch(`/api/measurements/${measurementId}/photos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beforePhoto: before, afterPhoto: after }),
        });
        if (!photoRes.ok) {
          const err = await photoRes.text().catch(() => "");
          console.error("Photo save failed:", photoRes.status, err);
          toast({ title: "Measurement saved but photos failed to upload", variant: "destructive" });
        } else {
          toast({ title: "Measurement recorded with photos" });
        }
      } else {
        toast({ title: "Measurement recorded" });
      }
      setOpen(false);
      setForm({ memberId: "", weight: "", height: "", chest: "", waist: "", hips: "", biceps: "", bodyFat: "", notes: "" });
      setFormBeforePhoto(null);
      setFormAfterPhoto(null);
      await refetch();
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

  const openEdit = (m: any) => {
    setEditRecord(m);
    setEditForm({
      weight: String(m.weight ?? ""),
      height: String(m.height ?? ""),
      chest: m.chest != null ? String(m.chest) : "",
      waist: m.waist != null ? String(m.waist) : "",
      hips: m.hips != null ? String(m.hips) : "",
      biceps: m.arms != null ? String(m.arms) : "",
      bodyFat: m.bodyFat != null ? String(m.bodyFat) : "",
      notes: m.notes ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editRecord) return;
    const wt = parseFloat(editForm.weight);
    const ht = parseFloat(editForm.height);
    if (!editForm.weight || wt < 1 || wt > 500) {
      toast({ title: "Weight must be between 1 and 500 kg", variant: "destructive" });
      return;
    }
    if (!editForm.height || ht < 50 || ht > 300) {
      toast({ title: "Height must be between 50 and 300 cm", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/measurements/${editRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: wt,
          height: ht,
          bodyFat: editForm.bodyFat ? parseFloat(editForm.bodyFat) : null,
          chest: editForm.chest ? parseFloat(editForm.chest) : null,
          waist: editForm.waist ? parseFloat(editForm.waist) : null,
          arms: editForm.biceps ? parseFloat(editForm.biceps) : null,
          hips: editForm.hips ? parseFloat(editForm.hips) : null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Measurement updated" });
      setEditRecord(null);
      await refetch();
    } catch {
      toast({ title: "Failed to update measurement", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  // Live calculations for edit form
  const editWeight = parseFloat(editForm.weight);
  const editHeight = parseFloat(editForm.height);
  const editValidWeight = editWeight >= 1 && editWeight <= 500;
  const editValidHeight = editHeight >= 50 && editHeight <= 300;
  const editLiveBMI = editValidWeight && editValidHeight
    ? Math.round((editWeight / Math.pow(editHeight / 100, 2)) * 10) / 10
    : null;

  const openPhotoDialog = (record: any) => {
    setPhotoRecordId(record.id);
    setPendingBefore(undefined);
    setPendingAfter(undefined);
  };

  const closePhotoDialog = () => {
    setPhotoRecordId(null);
    setPendingBefore(undefined);
    setPendingAfter(undefined);
  };

  const handlePhotoSelect = async (
    file: File,
    setter: (v: string | null) => void
  ) => {
    if (file.size > MAX_PHOTO_BYTES) {
      toast({ title: "Photo must be under 2 MB", variant: "destructive" });
      return;
    }
    const b64 = await fileToBase64(file);
    setter(b64);
  };

  const handleSavePhotos = async () => {
    if (!photoRecord) return;
    setSavingPhotos(true);
    try {
      const [before, after] = await Promise.all([
        displayBefore?.startsWith("data:") ? uploadPhoto(displayBefore, `before-${photoRecord.id}.jpg`) : Promise.resolve(displayBefore),
        displayAfter?.startsWith("data:") ? uploadPhoto(displayAfter, `after-${photoRecord.id}.jpg`) : Promise.resolve(displayAfter),
      ]);
      const res = await fetch(`/api/measurements/${photoRecord.id}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforePhoto: before, afterPhoto: after }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => String(res.status)));
      toast({ title: "Photos saved" });
      await refetch();
      setPendingBefore(undefined);
      setPendingAfter(undefined);
    } catch {
      toast({ title: "Failed to save photos", variant: "destructive" });
    } finally {
      setSavingPhotos(false);
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
                  <TableHead>BMI</TableHead>
                  <TableHead>BMR (kcal)</TableHead>
                  <TableHead>Body Fat %</TableHead>
                  <TableHead>Chest (cm)</TableHead>
                  <TableHead>Waist (cm)</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No measurements recorded yet</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m: any) => {
                    const w = parseFloat(m.weight);
                    const h = parseFloat(m.height);
                    const age = calcAge(m.memberDob);
                    const gender = m.memberGender ?? "male";
                    const bmr = w > 0 && h > 0 && age !== null
                      ? calcBMR(w, h, age, gender)
                      : null;
                    const bfEst = w > 0 && h > 0 && age !== null
                      ? calcBodyFatEst(w, h, age, gender)
                      : null;
                    const bodyFatDisplay = m.bodyFat ?? bfEst;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.memberName}</TableCell>
                        <TableCell>{m.date ? format(new Date(m.date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>{m.weight ?? "—"}</TableCell>
                        <TableCell>{m.height ?? "—"}</TableCell>
                        <TableCell>{m.bmi ?? "—"}</TableCell>
                        <TableCell className="text-blue-500 font-medium">
                          {bmr ? `${bmr.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className={bodyFatDisplay ? (bodyFatDisplay > 25 ? "text-red-500" : "text-green-500") : ""}>
                          {bodyFatDisplay ? `${bodyFatDisplay}%${!m.bodyFat ? " (est.)" : ""}` : "—"}
                        </TableCell>
                        <TableCell>{m.chest ?? "—"}</TableCell>
                        <TableCell>{m.waist ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(m as any).beforePhoto ? (
                              <img src={(m as any).beforePhoto} alt="B" className="h-8 w-8 rounded object-cover border cursor-pointer" onClick={() => setLightboxSrc((m as any).beforePhoto)} />
                            ) : <span className="h-8 w-8 rounded border border-dashed flex items-center justify-center"><Camera className="h-3 w-3 text-muted-foreground/40" /></span>}
                            {(m as any).afterPhoto ? (
                              <img src={(m as any).afterPhoto} alt="A" className="h-8 w-8 rounded object-cover border cursor-pointer" onClick={() => setLightboxSrc((m as any).afterPhoto)} />
                            ) : <span className="h-8 w-8 rounded border border-dashed flex items-center justify-center"><Camera className="h-3 w-3 text-muted-foreground/40" /></span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openPhotoDialog(m)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Measurement Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              {selectedMember && (
                <p className="text-xs text-muted-foreground">
                  {formAge ? `Age: ${formAge}` : "DOB not set"} · Gender: {formGender}
                </p>
              )}
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
                <Label>Body Fat % (optional override)</Label>
                <Input type="number" value={form.bodyFat} onChange={(e) => setForm(f => ({ ...f, bodyFat: e.target.value }))} placeholder="Auto-calculated" />
              </div>
            </div>

            {/* Live calculations */}
            {(liveBMI !== null || liveBMR !== null || liveBodyFat !== null) && (
              <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-center">
                {liveBMI !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">BMI</p>
                    <p className={`text-lg font-bold ${liveBMI < 18.5 ? "text-yellow-500" : liveBMI < 25 ? "text-green-500" : liveBMI < 30 ? "text-orange-500" : "text-red-500"}`}>
                      {liveBMI}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {liveBMI < 18.5 ? "Underweight" : liveBMI < 25 ? "Normal" : liveBMI < 30 ? "Overweight" : "Obese"}
                    </p>
                  </div>
                )}
                {liveBMR !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">BMR</p>
                    <p className="text-lg font-bold text-blue-500">{liveBMR.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">kcal/day</p>
                  </div>
                )}
                {liveBodyFat !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Body Fat</p>
                    <p className={`text-lg font-bold ${liveBodyFat > 25 ? "text-red-500" : "text-green-500"}`}>
                      {liveBodyFat}%
                    </p>
                    <p className="text-xs text-muted-foreground">estimated</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
            </div>

            {/* Before / After photos in form */}
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">Before / After Photos</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Before */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Before</p>
                  {formBeforePhoto ? (
                    <div className="relative">
                      <img src={formBeforePhoto} alt="Before" className="w-full h-28 rounded object-cover border cursor-pointer" onClick={() => setLightboxSrc(formBeforePhoto)} />
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6 bg-background/80" onClick={() => setFormBeforePhoto(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center border-2 border-dashed rounded h-28 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => formBeforeRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Click to upload</p>
                      <p className="text-xs text-muted-foreground">Max 2 MB</p>
                    </div>
                  )}
                  <input ref={formBeforeRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f, setFormBeforePhoto); e.target.value = ""; }} />
                </div>
                {/* After */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">After</p>
                  {formAfterPhoto ? (
                    <div className="relative">
                      <img src={formAfterPhoto} alt="After" className="w-full h-28 rounded object-cover border cursor-pointer" onClick={() => setLightboxSrc(formAfterPhoto)} />
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6 bg-background/80" onClick={() => setFormAfterPhoto(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center border-2 border-dashed rounded h-28 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => formAfterRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Click to upload</p>
                      <p className="text-xs text-muted-foreground">Max 2 MB</p>
                    </div>
                  )}
                  <input ref={formAfterRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f, setFormAfterPhoto); e.target.value = ""; }} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMeasurement.isPending}>Save Measurement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Before / After Photo Dialog */}
      <Dialog open={photoRecord !== null} onOpenChange={(o) => !o && closePhotoDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Before / After Photos — {photoRecord?.memberName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Before photo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Before</Label>
              {displayBefore ? (
                <div className="relative">
                  <img src={displayBefore} alt="Before" className="w-full rounded-lg object-cover max-h-64 cursor-pointer" onClick={() => setLightboxSrc(displayBefore)} />
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 bg-background/80" onClick={() => setPendingBefore(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-48 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => beforeInputRef.current?.click()}>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground">Max 2 MB</p>
                </div>
              )}
              <input ref={beforeInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoSelect(file, setPendingBefore); e.target.value = ""; }} />
              {displayBefore && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => beforeInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" /> Replace
                </Button>
              )}
            </div>

            {/* After photo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">After</Label>
              {displayAfter ? (
                <div className="relative">
                  <img src={displayAfter} alt="After" className="w-full rounded-lg object-cover max-h-64 cursor-pointer" onClick={() => setLightboxSrc(displayAfter)} />
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 bg-background/80" onClick={() => setPendingAfter(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-48 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => afterInputRef.current?.click()}>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground">Max 2 MB</p>
                </div>
              )}
              <input ref={afterInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoSelect(file, setPendingAfter); e.target.value = ""; }} />
              {displayAfter && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => afterInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" /> Replace
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePhotoDialog}>Cancel</Button>
            <Button onClick={handleSavePhotos} disabled={savingPhotos}>
              {savingPhotos ? "Saving..." : "Save Photos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Measurement Dialog */}
      <Dialog open={editRecord !== null} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Measurement — {editRecord?.memberName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Weight (kg) *</Label>
                <Input type="number" value={editForm.weight} onChange={(e) => setEditForm(f => ({ ...f, weight: e.target.value }))} placeholder="75" />
              </div>
              <div className="grid gap-2">
                <Label>Height (cm) *</Label>
                <Input type="number" value={editForm.height} onChange={(e) => setEditForm(f => ({ ...f, height: e.target.value }))} placeholder="175" />
              </div>
              <div className="grid gap-2">
                <Label>Chest (cm)</Label>
                <Input type="number" value={editForm.chest} onChange={(e) => setEditForm(f => ({ ...f, chest: e.target.value }))} placeholder="95" />
              </div>
              <div className="grid gap-2">
                <Label>Waist (cm)</Label>
                <Input type="number" value={editForm.waist} onChange={(e) => setEditForm(f => ({ ...f, waist: e.target.value }))} placeholder="80" />
              </div>
              <div className="grid gap-2">
                <Label>Hips (cm)</Label>
                <Input type="number" value={editForm.hips} onChange={(e) => setEditForm(f => ({ ...f, hips: e.target.value }))} placeholder="95" />
              </div>
              <div className="grid gap-2">
                <Label>Biceps (cm)</Label>
                <Input type="number" value={editForm.biceps} onChange={(e) => setEditForm(f => ({ ...f, biceps: e.target.value }))} placeholder="35" />
              </div>
              <div className="grid gap-2">
                <Label>Body Fat % (optional override)</Label>
                <Input type="number" value={editForm.bodyFat} onChange={(e) => setEditForm(f => ({ ...f, bodyFat: e.target.value }))} placeholder="Auto-calculated" />
              </div>
            </div>
            {editLiveBMI !== null && (
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">BMI</p>
                <p className={`text-lg font-bold ${editLiveBMI < 18.5 ? "text-yellow-500" : editLiveBMI < 25 ? "text-green-500" : editLiveBMI < 30 ? "text-orange-500" : "text-red-500"}`}>
                  {editLiveBMI}
                </p>
                <p className="text-xs text-muted-foreground">
                  {editLiveBMI < 18.5 ? "Underweight" : editLiveBMI < 25 ? "Normal" : editLiveBMI < 30 ? "Overweight" : "Obese"}
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
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

      {/* Lightbox */}
      <Dialog open={lightboxSrc !== null} onOpenChange={(o) => !o && setLightboxSrc(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt="Full size"
              className="w-full max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
