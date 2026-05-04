import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, Megaphone, Calendar, Dumbbell, Salad, PlaySquare,
  Plus, Pencil, Trash2, Save, X, Check, ToggleLeft, ToggleRight,
  Users, Clock, MapPin, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = "/api";

async function apiFetch(path: string, opts?: RequestInit) {
  const adminEmail = localStorage.getItem("adminEmail") || "";
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "x-admin-email": adminEmail },
    ...opts,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Request failed"); }
  return res.json();
}

const TABS = [
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "classes", label: "Classes", icon: Calendar },
  { id: "workout-plans", label: "Workout Plans", icon: Dumbbell },
  { id: "diet-plans", label: "Diet Plans", icon: Salad },
  { id: "onboarding", label: "Onboarding Slides", icon: PlaySquare },
];

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  promo: "bg-purple-100 text-purple-700",
  warning: "bg-amber-100 text-amber-700",
};

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function AnnouncementsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [form, setForm] = useState({ title: "", body: "", type: "info" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-content-announcements"],
    queryFn: () => apiFetch("/app-content/announcements"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (modal.item) {
        return apiFetch(`/app-content/announcements/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
      }
      return apiFetch("/app-content/announcements", { method: "POST", body: JSON.stringify(form) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-content-announcements"] });
      setModal({ open: false });
      toast({ title: modal.item ? "Announcement updated" : "Announcement created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: any) => apiFetch(`/app-content/announcements/${item.id}`, { method: "PUT", body: JSON.stringify({ isActive: !item.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-content-announcements"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/app-content/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-announcements"] }); toast({ title: "Deleted" }); },
  });

  const openCreate = () => { setForm({ title: "", body: "", type: "info" }); setModal({ open: true }); };
  const openEdit = (item: any) => { setForm({ title: item.title, body: item.body, type: item.type }); setModal({ open: true, item }); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">These banners appear on the member home screen. Active announcements show immediately.</p>
        <Button onClick={openCreate} size="sm" className="bg-[#E31C25] hover:bg-[#c0121a]">
          <Plus className="w-4 h-4 mr-2" /> New Announcement
        </Button>
      </div>

      {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={item.id} className={`border rounded-xl p-4 flex gap-4 items-start bg-white ${!item.isActive ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[item.type] || TYPE_COLORS.info}`}>{item.type?.toUpperCase()}</span>
                  {!item.isActive && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                  {item.isActive && <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>}
                </div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => toggleMut.mutate(item)} title={item.isActive ? "Hide" : "Show"}>
                  {item.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(item.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No announcements yet. Create one to show it to members.</div>}
        </div>
      )}

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{modal.item ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekend Special Offer" /></div>
            <div><Label>Message</Label><Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Write the announcement body..." /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="promo">Promotion</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.title || !form.body} className="bg-[#E31C25] hover:bg-[#c0121a]">
              {saveMut.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSES TAB
// ─────────────────────────────────────────────────────────────────────────────
const CLASS_CATEGORIES = ["HIIT", "Yoga", "Cardio", "Strength", "Other"];
const CLASS_LEVELS = ["All levels", "Beginner", "Intermediate", "Advanced"];

function ClassesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const blank = { name: "", category: "HIIT", instructor: "", time: "07:00 AM", date: "", duration: 60, capacity: 20, location: "Main Floor", level: "All levels" };
  const [modal, setModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [form, setForm] = useState<any>(blank);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-content-classes"],
    queryFn: () => apiFetch("/app-content/classes"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (modal.item) return apiFetch(`/app-content/classes/${modal.item.id}`, { method: "PUT", body: JSON.stringify(form) });
      return apiFetch("/app-content/classes", { method: "POST", body: JSON.stringify(form) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-classes"] }); setModal({ open: false }); toast({ title: modal.item ? "Class updated" : "Class added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: any) => apiFetch(`/app-content/classes/${item.id}`, { method: "PUT", body: JSON.stringify({ isActive: !item.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-content-classes"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/app-content/classes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-classes"] }); toast({ title: "Class deleted" }); },
  });

  const openCreate = () => { setForm(blank); setModal({ open: true }); };
  const openEdit = (item: any) => {
    setForm({ name: item.name, category: item.category, instructor: item.instructor, time: item.time, date: item.date, duration: item.duration, capacity: item.capacity, location: item.location, level: item.level });
    setModal({ open: true, item });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Manage the class schedule visible to all app members.</p>
        <Button onClick={openCreate} size="sm" className="bg-[#E31C25] hover:bg-[#c0121a]"><Plus className="w-4 h-4 mr-2" /> Add Class</Button>
      </div>

      {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={item.id} className={`border rounded-xl p-4 bg-white ${!item.isActive ? "opacity-60" : ""}`}>
              <div className="flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold bg-[#E31C25]/10 text-[#E31C25] px-2 py-0.5 rounded-full">{item.category}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{item.level}</span>
                    {!item.isActive && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                  </div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {item.instructor}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.time} • {item.duration}min • {item.date}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location}</span>
                    <span>{item.enrolled}/{item.capacity} enrolled</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleMut.mutate(item)}>
                    {item.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(item.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No classes added yet.</div>}
        </div>
      )}

      <Dialog open={modal.open} onOpenChange={o => setModal({ open: o })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{modal.item ? "Edit Class" : "Add Class"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Class Name</Label><Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Power Yoga" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLASS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Level</Label>
              <Select value={form.level} onValueChange={v => setForm((f: any) => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLASS_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Instructor</Label><Input value={form.instructor} onChange={e => setForm((f: any) => ({ ...f, instructor: e.target.value }))} placeholder="e.g. Lisa Park" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Time</Label><Input value={form.time} onChange={e => setForm((f: any) => ({ ...f, time: e.target.value }))} placeholder="e.g. 7:00 AM" /></div>
            <div><Label>Duration (min)</Label><Input type="number" value={form.duration} onChange={e => setForm((f: any) => ({ ...f, duration: parseInt(e.target.value) || 60 }))} /></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm((f: any) => ({ ...f, capacity: parseInt(e.target.value) || 20 }))} /></div>
            <div className="col-span-2"><Label>Location</Label><Input value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} placeholder="e.g. Studio A" /></div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.instructor || !form.date} className="bg-[#E31C25] hover:bg-[#c0121a]">
              {saveMut.isPending ? "Saving..." : "Save Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT PLANS TAB
// ─────────────────────────────────────────────────────────────────────────────
function WorkoutPlansTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const blank = { name: "", goal: "Build muscle mass", level: "Intermediate", duration: "8 weeks", daysPerWeek: 4, trainer: "", exercises: [{ name: "", sets: 3, reps: "10", rest: "60s" }] };
  const [modal, setModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [form, setForm] = useState<any>(blank);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-content-workout-plans"],
    queryFn: () => apiFetch("/app-content/workout-plans"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, exercises: form.exercises.filter((e: any) => e.name.trim()) };
      if (modal.item) return apiFetch(`/app-content/workout-plans/${modal.item.id}`, { method: "PUT", body: JSON.stringify(payload) });
      return apiFetch("/app-content/workout-plans", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-workout-plans"] }); setModal({ open: false }); toast({ title: modal.item ? "Plan updated" : "Plan created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: any) => apiFetch(`/app-content/workout-plans/${item.id}`, { method: "PUT", body: JSON.stringify({ isActive: !item.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-content-workout-plans"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/app-content/workout-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-workout-plans"] }); toast({ title: "Plan deleted" }); },
  });

  const openEdit = (item: any) => {
    setForm({ name: item.name, goal: item.goal, level: item.level, duration: item.duration, daysPerWeek: item.daysPerWeek, trainer: item.trainer, exercises: item.exercises?.length ? item.exercises : [{ name: "", sets: 3, reps: "10", rest: "60s" }] });
    setModal({ open: true, item });
  };

  const updateEx = (i: number, field: string, val: any) => {
    setForm((f: any) => { const exs = [...f.exercises]; exs[i] = { ...exs[i], [field]: val }; return { ...f, exercises: exs }; });
  };
  const addEx = () => setForm((f: any) => ({ ...f, exercises: [...f.exercises, { name: "", sets: 3, reps: "10", rest: "60s" }] }));
  const removeEx = (i: number) => setForm((f: any) => ({ ...f, exercises: f.exercises.filter((_: any, idx: number) => idx !== i) }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Create workout plans that members can follow in the app.</p>
        <Button onClick={() => { setForm(blank); setModal({ open: true }); }} size="sm" className="bg-[#E31C25] hover:bg-[#c0121a]"><Plus className="w-4 h-4 mr-2" /> New Plan</Button>
      </div>

      {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={item.id} className={`border rounded-xl bg-white ${!item.isActive ? "opacity-60" : ""}`}>
              <div className="p-4 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold bg-[#E31C25]/10 text-[#E31C25] px-2 py-0.5 rounded-full">{item.level}</span>
                    {item.isActive ? <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.goal} • {item.duration} • {item.daysPerWeek}x/week • Trainer: {item.trainer || "—"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.exercises?.length || 0} exercises</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    {expanded === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleMut.mutate(item)}>
                    {item.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(item.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              {expanded === item.id && item.exercises?.length > 0 && (
                <div className="border-t px-4 pb-4">
                  <p className="text-xs font-semibold text-muted-foreground mt-3 mb-2 uppercase tracking-wide">Exercises</p>
                  <div className="grid gap-1">
                    {item.exercises.map((ex: any, idx: number) => (
                      <div key={ex.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                        <span className="w-6 h-6 rounded-full bg-[#E31C25]/10 text-[#E31C25] text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="flex-1 font-medium">{ex.name}</span>
                        <span className="text-muted-foreground text-xs">{ex.sets} sets × {ex.reps} reps</span>
                        <span className="text-muted-foreground text-xs">Rest: {ex.rest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No workout plans yet.</div>}
        </div>
      )}

      <Dialog open={modal.open} onOpenChange={o => setModal({ open: o })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal.item ? "Edit Workout Plan" : "New Workout Plan"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Plan Name</Label><Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Strength Builder" /></div>
            <div className="col-span-2"><Label>Goal</Label><Input value={form.goal} onChange={e => setForm((f: any) => ({ ...f, goal: e.target.value }))} placeholder="e.g. Build muscle mass" /></div>
            <div><Label>Level</Label>
              <Select value={form.level} onValueChange={v => setForm((f: any) => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Beginner","Intermediate","Advanced"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={e => setForm((f: any) => ({ ...f, duration: e.target.value }))} placeholder="e.g. 8 weeks" /></div>
            <div><Label>Days / Week</Label><Input type="number" min={1} max={7} value={form.daysPerWeek} onChange={e => setForm((f: any) => ({ ...f, daysPerWeek: parseInt(e.target.value) || 3 }))} /></div>
            <div><Label>Trainer Name</Label><Input value={form.trainer} onChange={e => setForm((f: any) => ({ ...f, trainer: e.target.value }))} placeholder="e.g. Marcus Reid" /></div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Exercises</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEx}><Plus className="w-3 h-3 mr-1" /> Add</Button>
            </div>
            <div className="space-y-2">
              {form.exercises?.map((ex: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
                  <div className="col-span-4"><Input value={ex.name} onChange={e => updateEx(i, "name", e.target.value)} placeholder="Exercise name" className="text-sm" /></div>
                  <div className="col-span-2"><Input type="number" value={ex.sets} onChange={e => updateEx(i, "sets", parseInt(e.target.value) || 1)} placeholder="Sets" className="text-sm" /></div>
                  <div className="col-span-3"><Input value={ex.reps} onChange={e => updateEx(i, "reps", e.target.value)} placeholder="Reps/time" className="text-sm" /></div>
                  <div className="col-span-2"><Input value={ex.rest} onChange={e => updateEx(i, "rest", e.target.value)} placeholder="Rest" className="text-sm" /></div>
                  <div className="col-span-1 flex justify-center">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEx(i)} className="text-red-500 h-7 w-7"><X className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
              {form.exercises?.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No exercises added yet</p>}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name} className="bg-[#E31C25] hover:bg-[#c0121a]">
              {saveMut.isPending ? "Saving..." : "Save Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIET PLANS TAB
// ─────────────────────────────────────────────────────────────────────────────
function DietPlansTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const blank = { name: "", goal: "Muscle gain", calories: 2500, protein: 150, carbs: 300, fat: 80, dietitian: "", meals: [{ type: "Breakfast", time: "7:00 AM", items: [""], calories: 0 }] };
  const [modal, setModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [form, setForm] = useState<any>(blank);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-content-diet-plans"],
    queryFn: () => apiFetch("/app-content/diet-plans"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, meals: form.meals.map((m: any) => ({ ...m, items: m.items.filter((it: string) => it.trim()) })).filter((m: any) => m.type.trim()) };
      if (modal.item) return apiFetch(`/app-content/diet-plans/${modal.item.id}`, { method: "PUT", body: JSON.stringify(payload) });
      return apiFetch("/app-content/diet-plans", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-diet-plans"] }); setModal({ open: false }); toast({ title: modal.item ? "Plan updated" : "Plan created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (item: any) => apiFetch(`/app-content/diet-plans/${item.id}`, { method: "PUT", body: JSON.stringify({ isActive: !item.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-content-diet-plans"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/app-content/diet-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-diet-plans"] }); toast({ title: "Plan deleted" }); },
  });

  const openEdit = (item: any) => {
    setForm({
      name: item.name, goal: item.goal, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, dietitian: item.dietitian,
      meals: item.meals?.length ? item.meals.map((m: any) => ({ ...m, items: Array.isArray(m.items) ? m.items : [] })) : [{ type: "Breakfast", time: "7:00 AM", items: [""], calories: 0 }],
    });
    setModal({ open: true, item });
  };

  const updateMeal = (i: number, field: string, val: any) => {
    setForm((f: any) => { const meals = [...f.meals]; meals[i] = { ...meals[i], [field]: val }; return { ...f, meals }; });
  };
  const updateMealItem = (mi: number, ii: number, val: string) => {
    setForm((f: any) => { const meals = [...f.meals]; const items = [...meals[mi].items]; items[ii] = val; meals[mi] = { ...meals[mi], items }; return { ...f, meals }; });
  };
  const addMeal = () => setForm((f: any) => ({ ...f, meals: [...f.meals, { type: "Snack", time: "3:00 PM", items: [""], calories: 0 }] }));
  const removeMeal = (i: number) => setForm((f: any) => ({ ...f, meals: f.meals.filter((_: any, idx: number) => idx !== i) }));
  const addMealItem = (mi: number) => setForm((f: any) => { const meals = [...f.meals]; meals[mi] = { ...meals[mi], items: [...meals[mi].items, ""] }; return { ...f, meals }; });
  const removeMealItem = (mi: number, ii: number) => setForm((f: any) => { const meals = [...f.meals]; meals[mi] = { ...meals[mi], items: meals[mi].items.filter((_: string, idx: number) => idx !== ii) }; return { ...f, meals }; });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Create diet and nutrition plans for members.</p>
        <Button onClick={() => { setForm(blank); setModal({ open: true }); }} size="sm" className="bg-[#E31C25] hover:bg-[#c0121a]"><Plus className="w-4 h-4 mr-2" /> New Plan</Button>
      </div>

      {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={item.id} className={`border rounded-xl bg-white ${!item.isActive ? "opacity-60" : ""}`}>
              <div className="p-4 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.isActive ? <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.goal} • {item.calories} cal/day • {item.meals?.length || 0} meals</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Protein: {item.protein}g</span>
                    <span>Carbs: {item.carbs}g</span>
                    <span>Fat: {item.fat}g</span>
                    {item.dietitian && <span>By {item.dietitian}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    {expanded === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleMut.mutate(item)}>
                    {item.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(item.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              {expanded === item.id && item.meals?.length > 0 && (
                <div className="border-t px-4 pb-4">
                  <p className="text-xs font-semibold text-muted-foreground mt-3 mb-2 uppercase tracking-wide">Meals</p>
                  <div className="grid gap-2">
                    {item.meals.map((m: any) => (
                      <div key={m.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-sm">{m.type} <span className="text-muted-foreground font-normal">• {m.time}</span></span>
                          <span className="text-xs text-[#E31C25] font-semibold">{m.calories} cal</span>
                        </div>
                        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                          {(Array.isArray(m.items) ? m.items : []).map((it: string, i: number) => <li key={i}>{it}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <div className="py-12 text-center text-muted-foreground">No diet plans yet.</div>}
        </div>
      )}

      <Dialog open={modal.open} onOpenChange={o => setModal({ open: o })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal.item ? "Edit Diet Plan" : "New Diet Plan"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Plan Name</Label><Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. High Protein Bulk" /></div>
            <div className="col-span-2"><Label>Goal</Label><Input value={form.goal} onChange={e => setForm((f: any) => ({ ...f, goal: e.target.value }))} placeholder="e.g. Muscle gain" /></div>
            <div><Label>Daily Calories</Label><Input type="number" value={form.calories} onChange={e => setForm((f: any) => ({ ...f, calories: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Dietitian</Label><Input value={form.dietitian} onChange={e => setForm((f: any) => ({ ...f, dietitian: e.target.value }))} placeholder="e.g. Dr. Emily" /></div>
            <div><Label>Protein (g)</Label><Input type="number" value={form.protein} onChange={e => setForm((f: any) => ({ ...f, protein: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Carbs (g)</Label><Input type="number" value={form.carbs} onChange={e => setForm((f: any) => ({ ...f, carbs: parseInt(e.target.value) || 0 }))} /></div>
            <div className="col-span-2"><Label>Fat (g)</Label><Input type="number" value={form.fat} onChange={e => setForm((f: any) => ({ ...f, fat: parseInt(e.target.value) || 0 }))} /></div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Meals</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMeal}><Plus className="w-3 h-3 mr-1" /> Add Meal</Button>
            </div>
            <div className="space-y-3">
              {form.meals?.map((meal: any, mi: number) => (
                <div key={mi} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={meal.type} onChange={e => updateMeal(mi, "type", e.target.value)} placeholder="Meal type" className="flex-1 text-sm" />
                    <Input value={meal.time} onChange={e => updateMeal(mi, "time", e.target.value)} placeholder="Time" className="w-28 text-sm" />
                    <Input type="number" value={meal.calories} onChange={e => updateMeal(mi, "calories", parseInt(e.target.value) || 0)} placeholder="Cal" className="w-20 text-sm" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMeal(mi)} className="text-red-500 h-7 w-7"><X className="w-3 h-3" /></Button>
                  </div>
                  <div className="space-y-1">
                    {meal.items?.map((item: string, ii: number) => (
                      <div key={ii} className="flex gap-1">
                        <Input value={item} onChange={e => updateMealItem(mi, ii, e.target.value)} placeholder="Food item..." className="flex-1 text-xs h-7" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMealItem(mi, ii)} className="text-red-500 h-7 w-7 shrink-0"><X className="w-3 h-3" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => addMealItem(mi)} className="text-xs h-7"><Plus className="w-3 h-3 mr-1" /> Add item</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name} className="bg-[#E31C25] hover:bg-[#c0121a]">
              {saveMut.isPending ? "Saving..." : "Save Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING SLIDES TAB
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingSlidesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["app-content-onboarding"],
    queryFn: () => apiFetch("/app-content/onboarding-slides"),
  });

  const saveMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/app-content/onboarding-slides/${id}`, { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-content-onboarding"] }); setEditing(null); toast({ title: "Slide updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const SLIDE_IMAGES = [
    { label: "Slide 1", desc: "Workout hero image (hero-workout.png)" },
    { label: "Slide 2", desc: "Sports people image (sports-people.jpg)" },
    { label: "Slide 3", desc: "Classes image (hero-classes.jpg)" },
  ];

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Edit the text shown on each onboarding slide. Images are fixed app assets.</p>

      {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : (
        <div className="grid gap-4">
          {slides.map((slide: any, idx: number) => (
            <div key={slide.id} className="border rounded-xl bg-white overflow-hidden">
              <div className="flex items-start gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-[#E31C25] text-white flex items-center justify-center font-bold text-sm shrink-0">{slide.order}</div>
                <div className="flex-1 min-w-0">
                  {editing === slide.id ? (
                    <div className="space-y-3">
                      <div><Label className="text-xs">Title</Label><Input value={form.title ?? slide.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
                      <div><Label className="text-xs">Subtitle</Label><Input value={form.subtitle ?? slide.subtitle} onChange={e => setForm((f: any) => ({ ...f, subtitle: e.target.value }))} /></div>
                      <div><Label className="text-xs">Description</Label><Textarea value={form.description ?? slide.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`active-${slide.id}`} checked={form.isActive ?? slide.isActive} onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))} />
                        <label htmlFor={`active-${slide.id}`} className="text-sm">Slide active</label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveMut.mutate(slide.id)} disabled={saveMut.isPending} className="bg-[#E31C25] hover:bg-[#c0121a]">
                          <Save className="w-3 h-3 mr-1" />{saveMut.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(null); setForm({}); }}>
                          <X className="w-3 h-3 mr-1" />Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{slide.title}</p>
                        {!slide.isActive && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                      </div>
                      <p className="text-xs text-[#E31C25] font-medium mb-1">{slide.subtitle}</p>
                      <p className="text-xs text-muted-foreground">{slide.description}</p>
                      <p className="text-xs text-muted-foreground mt-2 italic">Image: {SLIDE_IMAGES[idx]?.desc}</p>
                    </div>
                  )}
                </div>
                {editing !== slide.id && (
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(slide.id); setForm({ title: slide.title, subtitle: slide.subtitle, description: slide.description, isActive: slide.isActive }); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {slides.length === 0 && <div className="py-12 text-center text-muted-foreground">No slides found.</div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AppContent() {
  const [tab, setTab] = useState("announcements");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#E31C25]/10 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-[#E31C25]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mobile App Content</h1>
          <p className="text-sm text-muted-foreground">Manage content shown to members in the mobile app</p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap mb-6 bg-muted/50 p-1 rounded-xl">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white shadow text-[#E31C25]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "announcements" && <AnnouncementsTab />}
        {tab === "classes" && <ClassesTab />}
        {tab === "workout-plans" && <WorkoutPlansTab />}
        {tab === "diet-plans" && <DietPlansTab />}
        {tab === "onboarding" && <OnboardingSlidesTab />}
      </div>
    </div>
  );
}
