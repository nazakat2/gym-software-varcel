import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetMember, useListEmployees } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Phone, Mail, MapPin, CreditCard, User, HeartPulse, Dumbbell, MessageSquare,
  Calendar, FileText, Snowflake, RotateCcw, Plus, Trash2, Activity, Edit, Save, X,
  CheckCircle2, AlertTriangle, Ban, RefreshCw, Shield, Camera, Pencil, Printer,
} from "lucide-react";
import { format } from "date-fns";

const API = (path: string) => `/api${path}`;
const h = { "Content-Type": "application/json" };

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
    ".print-btn{background:#0f172a;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.4px}",
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

const CONDITIONS = [
  "High Blood Pressure (BP)", "Diabetes", "PCOS", "Thyroid", "Asthma",
  "Heart Condition", "Back/Spine Issue", "Knee Problem", "Shoulder Injury",
  "Obesity", "Arthritis", "Depression/Anxiety",
];

const PLAN_PRICES: Record<string, number> = { daily: 200, weekly: 800, monthly: 3000, quarterly: 8000, yearly: 28000 };

function statusBadge(status: string, blacklisted?: boolean | null) {
  if (blacklisted) return <Badge variant="destructive">Blacklisted</Badge>;
  const map: Record<string, string> = { active: "bg-green-100 text-green-800", expired: "bg-red-100 text-red-800", frozen: "bg-blue-100 text-blue-800", inactive: "bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: member, isLoading, refetch: refetchMember } = useGetMember(Number(id));
  const { data: employees } = useListEmployees();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editBloodGroup, setEditBloodGroup] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editFitnessGoal, setEditFitnessGoal] = useState("");
  const [editReferral, setEditReferral] = useState("");
  const [editTrainerId, setEditTrainerId] = useState("none");
  const [editPlan, setEditPlan] = useState("");
  const [editPlanStart, setEditPlanStart] = useState("");

  // Health tab
  const [health, setHealth] = useState<any>(null);
  const [editHealth, setEditHealth] = useState(false);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [healthAllergies, setHealthAllergies] = useState("");
  const [healthMedHistory, setHealthMedHistory] = useState("");
  const [healthDoctorRecs, setHealthDoctorRecs] = useState("");
  const [healthMeds, setHealthMeds] = useState("");

  // Notes tab
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState("admin");
  const [addingNote, setAddingNote] = useState(false);

  // Membership History tab
  const [membershipHistory, setMembershipHistory] = useState<any[]>([]);

  // Measurements tab
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [mWeight, setMWeight] = useState("");
  const [mHeight, setMHeight] = useState("");
  const [mChest, setMChest] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mArms, setMArms] = useState("");
  const [mHips, setMHips] = useState("");
  const [mBodyFat, setMBodyFat] = useState("");
  const [mDate, setMDate] = useState(new Date().toISOString().split("T")[0]);
  const [mNotes, setMNotes] = useState("");

  // Attendance tab
  const [attendance, setAttendance] = useState<any[]>([]);
  // Invoices tab
  const [invoices, setInvoices] = useState<any[]>([]);

  // Edit measurement
  const [editMeas, setEditMeas] = useState<any | null>(null);
  const [editMeasForm, setEditMeasForm] = useState({ weight: "", height: "", chest: "", waist: "", arms: "", hips: "", bodyFat: "", notes: "" });
  const [savingMeas, setSavingMeas] = useState(false);

  // Freeze
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [freezeDays, setFreezeDays] = useState("7");
  const [freezing, setFreezing] = useState(false);

  // Renewal
  const [renewPlan, setRenewPlan] = useState("monthly");
  const [renewDate, setRenewDate] = useState(new Date().toISOString().split("T")[0]);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    if (!member) return;
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditWhatsapp((member as any).whatsapp || "");
    setEditEmail((member as any).email || "");
    setEditGender((member as any).gender || "male");
    setEditDob((member as any).dob || "");
    setEditBloodGroup((member as any).bloodGroup || "");
    setEditCity((member as any).city || "");
    setEditArea((member as any).area || "");
    setEditAddress(member.address || "");
    setEditEmergencyName((member as any).emergencyContactName || "");
    setEditEmergencyPhone((member as any).emergencyContactPhone || "");
    setEditFitnessGoal((member as any).fitnessGoal || "general");
    setEditReferral((member as any).referralSource || "");
    setEditTrainerId((member as any).assignedTrainerId ? String((member as any).assignedTrainerId) : "none");
    setEditPlan(member.plan);
    setEditPlanStart(member.planStartDate);

    // Load sub-resources
    fetch(API(`/members/${id}/health`)).then(r => r.json()).then(d => {
      setHealth(d);
      setHealthConditions(d.conditions || []);
      setHealthAllergies(d.allergies || "");
      setHealthMedHistory(d.medicalHistory || "");
      setHealthDoctorRecs(d.doctorRecommendations || "");
      setHealthMeds(d.currentMedications || "");
    });
    fetch(API(`/members/${id}/notes`)).then(r => r.json()).then(setNotes).catch(() => {});
    fetch(API(`/members/${id}/membership-history`)).then(r => r.json()).then(setMembershipHistory).catch(() => {});
    fetch(API(`/members/${id}/measurements`)).then(r => r.json()).then(setMeasurements).catch(() => {});
    fetch(API(`/members/${id}/attendance`)).then(r => r.json()).then(setAttendance).catch(() => {});
    fetch(API(`/members/${id}/invoices`)).then(r => r.json()).then(setInvoices).catch(() => {});
  }, [member, id]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch(API(`/members/${id}`), {
        method: "PUT", headers: h,
        body: JSON.stringify({
          name: editName, phone: editPhone, whatsapp: editWhatsapp, email: editEmail,
          gender: editGender, dob: editDob, bloodGroup: editBloodGroup,
          city: editCity, area: editArea, address: editAddress,
          emergencyContactName: editEmergencyName, emergencyContactPhone: editEmergencyPhone,
          fitnessGoal: editFitnessGoal, referralSource: editReferral,
          assignedTrainerId: (editTrainerId && editTrainerId !== "none") ? editTrainerId : null,
          plan: editPlan, planStartDate: editPlanStart,
        }),
      });
      await refetchMember();
      setEditMode(false);
      toast({ title: "Profile updated successfully" });
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveHealth = async () => {
    setSaving(true);
    try {
      await fetch(API(`/members/${id}/health`), {
        method: "PUT", headers: h,
        body: JSON.stringify({ conditions: healthConditions, allergies: healthAllergies, medicalHistory: healthMedHistory, doctorRecommendations: healthDoctorRecs, currentMedications: healthMeds }),
      });
      setEditHealth(false);
      toast({ title: "Health info saved" });
      const d = await fetch(API(`/members/${id}/health`)).then(r => r.json());
      setHealth(d);
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const data = await fetch(API(`/members/${id}/notes`), {
        method: "POST", headers: h,
        body: JSON.stringify({ note: newNote, type: newNoteType, createdBy: "Admin" }),
      }).then(r => r.json());
      setNotes(prev => [data, ...prev]);
      setNewNote("");
      toast({ title: "Note added" });
    } catch { toast({ title: "Failed to add note", variant: "destructive" }); }
    finally { setAddingNote(false); }
  };

  const deleteNote = async (noteId: number) => {
    if (!confirm("Delete this note?")) return;
    await fetch(API(`/members/${id}/notes/${noteId}`), { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== noteId));
    toast({ title: "Note deleted" });
  };

  const addMeasurement = async () => {
    if (!mWeight || !mHeight) { toast({ title: "Weight and Height required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = await fetch(API("/measurements"), {
        method: "POST", headers: h,
        body: JSON.stringify({ memberId: parseInt(id!), weight: parseFloat(mWeight), height: parseFloat(mHeight), bodyFat: mBodyFat ? parseFloat(mBodyFat) : null, chest: mChest ? parseFloat(mChest) : null, waist: mWaist ? parseFloat(mWaist) : null, arms: mArms ? parseFloat(mArms) : null, hips: mHips ? parseFloat(mHips) : null, date: mDate, notes: mNotes }),
      }).then(r => r.json());
      setMeasurements(prev => [data, ...prev]);
      setShowMeasurementForm(false);
      setMWeight(""); setMHeight(""); setMChest(""); setMWaist(""); setMArms(""); setMHips(""); setMBodyFat(""); setMNotes("");
      toast({ title: "Measurement recorded" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const deleteMeasurement = async (mId: number) => {
    if (!confirm("Delete this measurement?")) return;
    await fetch(API(`/measurements/${mId}`), { method: "DELETE" });
    setMeasurements(prev => prev.filter(m => m.id !== mId));
    toast({ title: "Measurement deleted" });
  };

  const openEditMeasurement = (m: any) => {
    setEditMeas(m);
    setEditMeasForm({
      weight: String(m.weight ?? ""),
      height: String(m.height ?? ""),
      chest: m.chest != null ? String(m.chest) : "",
      waist: m.waist != null ? String(m.waist) : "",
      arms: m.arms != null ? String(m.arms) : "",
      hips: m.hips != null ? String(m.hips) : "",
      bodyFat: m.bodyFat != null ? String(m.bodyFat) : "",
      notes: m.notes ?? "",
    });
  };

  const handleUpdateMeasurement = async () => {
    if (!editMeas) return;
    const wt = parseFloat(editMeasForm.weight);
    const ht = parseFloat(editMeasForm.height);
    if (!editMeasForm.weight || wt < 1 || wt > 500) { toast({ title: "Weight must be 1–500 kg", variant: "destructive" }); return; }
    if (!editMeasForm.height || ht < 50 || ht > 300) { toast({ title: "Height must be 50–300 cm", variant: "destructive" }); return; }
    setSavingMeas(true);
    try {
      const res = await fetch(API(`/measurements/${editMeas.id}`), {
        method: "PUT", headers: h,
        body: JSON.stringify({
          weight: wt, height: ht,
          bodyFat: editMeasForm.bodyFat ? parseFloat(editMeasForm.bodyFat) : null,
          chest: editMeasForm.chest ? parseFloat(editMeasForm.chest) : null,
          waist: editMeasForm.waist ? parseFloat(editMeasForm.waist) : null,
          arms: editMeasForm.arms ? parseFloat(editMeasForm.arms) : null,
          hips: editMeasForm.hips ? parseFloat(editMeasForm.hips) : null,
          notes: editMeasForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Measurement updated" });
      setEditMeas(null);
      fetch(API(`/members/${id}/measurements`)).then(r => r.json()).then(setMeasurements);
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    finally { setSavingMeas(false); }
  };

  const freezeMembership = async () => {
    setFreezing(true);
    try {
      await fetch(API(`/members/${id}/freeze`), { method: "POST", headers: h, body: JSON.stringify({ freezeDays: parseInt(freezeDays) }) });
      await refetchMember();
      toast({ title: `Membership frozen for ${freezeDays} days` });
    } catch { toast({ title: "Failed to freeze", variant: "destructive" }); }
    finally { setFreezing(false); }
  };

  const unfreezeMembership = async () => {
    setFreezing(true);
    try {
      await fetch(API(`/members/${id}/unfreeze`), { method: "POST", headers: h, body: JSON.stringify({}) });
      await refetchMember();
      toast({ title: "Membership reactivated" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setFreezing(false); }
  };

  const renewMembership = async () => {
    setRenewing(true);
    try {
      await fetch(API(`/members/${id}`), {
        method: "PUT", headers: h,
        body: JSON.stringify({ plan: renewPlan, planStartDate: renewDate }),
      });
      // Only create invoice if no unpaid invoice already exists for this member+plan+dueDate
      const existingInvoices: any[] = await fetch(API(`/members/${id}/invoices`)).then(r => r.json());
      const alreadyHasUnpaid = existingInvoices.some(
        inv => inv.status === "unpaid" && inv.plan === renewPlan && inv.dueDate === renewDate
      );
      if (!alreadyHasUnpaid) {
        const price = PLAN_PRICES[renewPlan] || 3000;
        await fetch(API("/billing"), {
          method: "POST", headers: h,
          body: JSON.stringify({ memberId: parseInt(id!), amount: String(price), plan: renewPlan, dueDate: renewDate }),
        });
      }
      await refetchMember();
      fetch(API(`/members/${id}/membership-history`)).then(r => r.json()).then(setMembershipHistory);
      fetch(API(`/members/${id}/invoices`)).then(r => r.json()).then(setInvoices);
      toast({ title: "Membership renewed!" });
    } catch { toast({ title: "Failed to renew", variant: "destructive" }); }
    finally { setRenewing(false); }
  };

  const changeStatus = async (status: string) => {
    await fetch(API(`/members/${id}`), { method: "PUT", headers: h, body: JSON.stringify({ status }) });
    await refetchMember();
    toast({ title: `Member marked as ${status}` });
  };

  const toggleBlacklist = async () => {
    const bl = !((member as any)?.blacklisted);
    await fetch(API(`/members/${id}`), { method: "PUT", headers: h, body: JSON.stringify({ blacklisted: bl }) });
    await refetchMember();
    toast({ title: bl ? "Member blacklisted" : "Member removed from blacklist" });
  };

  const markInvoicePaid = async (invId: number) => {
    await fetch(API(`/billing/${invId}/pay`), { method: "POST", headers: h, body: JSON.stringify({ paymentMethod: "cash" }) });
    fetch(API(`/members/${id}/invoices`)).then(r => r.json()).then(setInvoices);
    toast({ title: "Invoice marked as paid" });
  };

  const printInvoice = (inv: any) => {
    const html = buildInvoiceHtml({
      id: inv.id,
      memberName: m.name,
      phone: m.phone,
      plan: inv.plan,
      amount: parseInt(inv.amount),
      dueDate: inv.dueDate,
      paidDate: inv.paidDate,
      isPaid: inv.status === "paid",
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.focus();
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Loading member profile...</div></div>;
  if (!member) return <div className="text-center py-20 text-muted-foreground">Member not found</div>;

  const m = member as any;
  const assignedTrainer = employees?.find(e => e.id === m.assignedTrainerId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/members")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{member.name}</h1>
            <div className="flex items-center gap-2 mt-1">{statusBadge(member.status, m.blacklisted)}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button onClick={saveProfile} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving..." : "Save"}</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}><Edit className="h-4 w-4 mr-1" />Edit Profile</Button>
          )}
        </div>
      </div>

      {/* Avatar + summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="h-24 w-24 rounded-full bg-muted overflow-hidden flex items-center justify-center text-3xl font-bold text-muted-foreground flex-shrink-0">
              {member.photoUrl ? <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" /> : member.name.charAt(0)}
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
              <div><span className="text-muted-foreground block text-xs">Phone</span><span className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span></div>
              {m.whatsapp && <div><span className="text-muted-foreground block text-xs">WhatsApp</span><span className="font-medium">{m.whatsapp}</span></div>}
              {m.email && <div><span className="text-muted-foreground block text-xs">Email</span><span className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span></div>}
              <div><span className="text-muted-foreground block text-xs">CNIC</span><span className="font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" />{member.cnic}</span></div>
              <div><span className="text-muted-foreground block text-xs">Plan</span><span className="font-medium capitalize">{member.plan}</span></div>
              <div><span className="text-muted-foreground block text-xs">Expiry</span><span className="font-medium">{member.planExpiryDate}</span></div>
              {m.fitnessGoal && <div><span className="text-muted-foreground block text-xs">Goal</span><span className="font-medium capitalize">{m.fitnessGoal?.replace(/-/g," ")}</span></div>}
              {assignedTrainer && <div><span className="text-muted-foreground block text-xs">Trainer</span><span className="font-medium">{assignedTrainer.name}</span></div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="health"><HeartPulse className="h-4 w-4 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="membership"><Shield className="h-4 w-4 mr-1" />Membership</TabsTrigger>
          <TabsTrigger value="measurements"><Activity className="h-4 w-4 mr-1" />Measurements</TabsTrigger>
          <TabsTrigger value="attendance"><Calendar className="h-4 w-4 mr-1" />Attendance</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-1" />Invoices</TabsTrigger>
          <TabsTrigger value="notes"><MessageSquare className="h-4 w-4 mr-1" />Notes</TabsTrigger>
        </TabsList>

        {/* ── PROFILE TAB ─────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4"/>Personal Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {editMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input value={editName} onChange={e=>setEditName(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Gender</Label>
                      <Select value={editGender} onValueChange={setEditGender}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Date of Birth</Label><Input type="date" value={editDob} onChange={e=>setEditDob(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Blood Group</Label>
                      <Select value={editBloodGroup} onValueChange={setEditBloodGroup}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <InfoRow label="Gender" value={m.gender || "—"} />
                    <InfoRow label="Date of Birth" value={m.dob ? format(new Date(m.dob), "MMM d, yyyy") : "—"} />
                    <InfoRow label="Blood Group" value={m.bloodGroup || "—"} />
                    <InfoRow label="CNIC" value={m.cnic} />
                    <InfoRow label="Joined" value={format(new Date(member.createdAt), "MMM d, yyyy")} />
                    <InfoRow label="Referral" value={m.referralSource || "—"} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4"/>Contact & Emergency</CardTitle></CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Phone (11 digits)</Label><Input value={editPhone} onChange={e=>setEditPhone(e.target.value.replace(/\D/g,"").slice(0,11))} maxLength={11} /></div>
                    <div className="space-y-1"><Label className="text-xs">WhatsApp (11 digits)</Label><Input value={editWhatsapp} onChange={e=>setEditWhatsapp(e.target.value.replace(/\D/g,"").slice(0,11))} maxLength={11} /></div>
                    <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={editEmail} onChange={e=>setEditEmail(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">City</Label><Input value={editCity} onChange={e=>setEditCity(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Area</Label><Input value={editArea} onChange={e=>setEditArea(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Emergency Contact</Label><Input value={editEmergencyName} onChange={e=>setEditEmergencyName(e.target.value)} placeholder="Name" /></div>
                    <div className="space-y-1"><Label className="text-xs">Emergency Phone (11 digits)</Label><Input value={editEmergencyPhone} onChange={e=>setEditEmergencyPhone(e.target.value.replace(/\D/g,"").slice(0,11))} maxLength={11} /></div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <InfoRow label="Phone" value={m.phone} />
                    <InfoRow label="WhatsApp" value={m.whatsapp || "—"} />
                    <InfoRow label="Email" value={m.email || "—"} />
                    <InfoRow label="City" value={m.city || "—"} />
                    <InfoRow label="Area" value={m.area || "—"} />
                    <InfoRow label="Address" value={m.address || "—"} />
                    <InfoRow label="Emergency Contact" value={m.emergencyContactName || "—"} />
                    <InfoRow label="Emergency Phone" value={m.emergencyContactPhone || "—"} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Access Control */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4"/>Access Control</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => changeStatus("active")} className="text-green-700 border-green-300"><CheckCircle2 className="h-4 w-4 mr-1"/>Mark Active</Button>
                <Button size="sm" variant="outline" onClick={() => changeStatus("inactive")} className="text-gray-600"><X className="h-4 w-4 mr-1"/>Mark Inactive</Button>
                <Button size="sm" variant="outline" onClick={toggleBlacklist} className={m.blacklisted ? "text-green-700" : "text-red-700 border-red-300"}>
                  <Ban className="h-4 w-4 mr-1"/>{m.blacklisted ? "Remove Blacklist" : "Blacklist Member"}
                </Button>
              </div>
              {m.blacklisted && <p className="text-sm text-destructive mt-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>This member is blacklisted and should not be granted access.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HEALTH TAB ──────────────────────────────────────── */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="flex justify-end">
            {editHealth ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditHealth(false)}>Cancel</Button>
                <Button size="sm" onClick={saveHealth} disabled={saving}>Save Health Info</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditHealth(true)}><Edit className="h-4 w-4 mr-1"/>Edit Health Info</Button>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4"/>Medical Conditions</CardTitle></CardHeader>
            <CardContent>
              {editHealth ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CONDITIONS.map(c => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox id={`cond-${c}`} checked={healthConditions.includes(c)} onCheckedChange={() => setHealthConditions(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c])} />
                      <label htmlFor={`cond-${c}`} className="text-sm cursor-pointer">{c}</label>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {(health?.conditions || []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No conditions recorded</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(health?.conditions || []).map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Allergies</CardTitle></CardHeader>
              <CardContent>
                {editHealth ? <Textarea value={healthAllergies} onChange={e=>setHealthAllergies(e.target.value)} placeholder="Food, medicine allergies..." rows={3} /> : <p className="text-sm">{health?.allergies || <span className="text-muted-foreground">None recorded</span>}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Doctor Recommendations</CardTitle></CardHeader>
              <CardContent>
                {editHealth ? <Textarea value={healthDoctorRecs} onChange={e=>setHealthDoctorRecs(e.target.value)} placeholder="Doctor advice..." rows={3} /> : <p className="text-sm">{health?.doctorRecommendations || <span className="text-muted-foreground">None recorded</span>}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Medical / Injury History</CardTitle></CardHeader>
              <CardContent>
                {editHealth ? <Textarea value={healthMedHistory} onChange={e=>setHealthMedHistory(e.target.value)} placeholder="Past injuries, surgeries..." rows={3} /> : <p className="text-sm">{health?.medicalHistory || <span className="text-muted-foreground">None recorded</span>}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Current Medications</CardTitle></CardHeader>
              <CardContent>
                {editHealth ? <Textarea value={healthMeds} onChange={e=>setHealthMeds(e.target.value)} placeholder="Medicines currently taking..." rows={3} /> : <p className="text-sm">{health?.currentMedications || <span className="text-muted-foreground">None recorded</span>}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── MEMBERSHIP TAB ─────────────────────────────────── */}
        <TabsContent value="membership" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Current Plan</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Plan" value={<span className="capitalize font-semibold">{member.plan}</span>} />
                <InfoRow label="Start Date" value={member.planStartDate} />
                <InfoRow label="Expiry Date" value={member.planExpiryDate} />
                {m.frozenUntil && <InfoRow label="Frozen Until" value={<span className="text-blue-600">{m.frozenUntil}</span>} />}
                <InfoRow label="Fitness Goal" value={<span className="capitalize">{m.fitnessGoal?.replace(/-/g," ") || "General"}</span>} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4"/>Renew Membership</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">New Plan</Label>
                  <Select value={renewPlan} onValueChange={setRenewPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily – Rs 200</SelectItem>
                      <SelectItem value="weekly">Weekly – Rs 800</SelectItem>
                      <SelectItem value="monthly">Monthly – Rs 3,000</SelectItem>
                      <SelectItem value="quarterly">Quarterly – Rs 8,000</SelectItem>
                      <SelectItem value="yearly">Yearly – Rs 28,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Renewal Date</Label><Input type="date" value={renewDate} onChange={e=>setRenewDate(e.target.value)} /></div>
                <Button onClick={renewMembership} disabled={renewing} className="w-full"><RotateCcw className="h-4 w-4 mr-2"/>{renewing ? "Processing..." : "Renew Membership"}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Snowflake className="h-4 w-4"/>Freeze Membership</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Pause the membership for a set number of days. Member won't be charged during freeze.</p>
                <div className="flex gap-2">
                  <div className="space-y-1 flex-1"><Label className="text-xs">Freeze Days</Label>
                    <Select value={freezeDays} onValueChange={setFreezeDays}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={freezeMembership} disabled={freezing}><Snowflake className="h-4 w-4 mr-1"/>Freeze</Button>
                  </div>
                </div>
                {m.frozenUntil && (
                  <Button variant="outline" onClick={unfreezeMembership} disabled={freezing} className="w-full text-green-700"><CheckCircle2 className="h-4 w-4 mr-2"/>Unfreeze Now</Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Membership History */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Membership History</CardTitle></CardHeader>
            <CardContent>
              {membershipHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No history recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {membershipHistory.map(h => (
                    <div key={h.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                      <div>
                        <span className="font-medium capitalize">{h.plan}</span>
                        <span className="text-muted-foreground ml-2">{h.startDate} → {h.expiryDate}</span>
                        {h.notes && <span className="text-muted-foreground ml-2 italic">— {h.notes}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {h.amount && <span className="font-medium">Rs {parseInt(h.amount).toLocaleString()}</span>}
                        <Badge variant={h.status === "active" ? "default" : "secondary"}>{h.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEASUREMENTS TAB ────────────────────────────────── */}
        <TabsContent value="measurements" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Body Measurements History</h3>
            <Button size="sm" onClick={() => setShowMeasurementForm(!showMeasurementForm)}><Plus className="h-4 w-4 mr-1"/>Add Measurement</Button>
          </div>

          {showMeasurementForm && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2"><CardTitle className="text-base">New Measurement Entry</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={mDate} onChange={e=>setMDate(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Weight (kg) *</Label><Input type="number" value={mWeight} onChange={e=>setMWeight(e.target.value)} placeholder="70.5" /></div>
                  <div className="space-y-1"><Label className="text-xs">Height (cm) *</Label><Input type="number" value={mHeight} onChange={e=>setMHeight(e.target.value)} placeholder="175" /></div>
                  <div className="space-y-1"><Label className="text-xs">Body Fat (%)</Label><Input type="number" value={mBodyFat} onChange={e=>setMBodyFat(e.target.value)} placeholder="20" /></div>
                  <div className="space-y-1"><Label className="text-xs">Chest (cm)</Label><Input type="number" value={mChest} onChange={e=>setMChest(e.target.value)} placeholder="90" /></div>
                  <div className="space-y-1"><Label className="text-xs">Waist (cm)</Label><Input type="number" value={mWaist} onChange={e=>setMWaist(e.target.value)} placeholder="80" /></div>
                  <div className="space-y-1"><Label className="text-xs">Arms (cm)</Label><Input type="number" value={mArms} onChange={e=>setMArms(e.target.value)} placeholder="35" /></div>
                  <div className="space-y-1"><Label className="text-xs">Hips (cm)</Label><Input type="number" value={mHips} onChange={e=>setMHips(e.target.value)} placeholder="95" /></div>
                </div>
                <div className="space-y-1 mb-3"><Label className="text-xs">Notes</Label><Input value={mNotes} onChange={e=>setMNotes(e.target.value)} placeholder="e.g. after 1 month of training" /></div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowMeasurementForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addMeasurement} disabled={saving}>Save</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {measurements.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No measurements recorded yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {measurements.map((m, i) => (
                <Card key={m.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-semibold">{m.date}</span>
                        {m.notes && <span className="text-muted-foreground text-xs ml-2">— {m.notes}</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEditMeasurement(m)}><Pencil className="h-3.5 w-3.5"/></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMeasurement(m.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-sm">
                      <StatBox label="Weight" value={`${m.weight} kg`} />
                      <StatBox label="BMI" value={String(m.bmi)} highlight={m.bmi > 30 ? "text-red-600" : m.bmi > 25 ? "text-orange-500" : "text-green-600"} />
                      {m.bodyFat && <StatBox label="Body Fat" value={`${m.bodyFat}%`} />}
                      {m.chest && <StatBox label="Chest" value={`${m.chest} cm`} />}
                      {m.waist && <StatBox label="Waist" value={`${m.waist} cm`} />}
                      {m.arms && <StatBox label="Arms" value={`${m.arms} cm`} />}
                      {m.hips && <StatBox label="Hips" value={`${m.hips} cm`} />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Progress Photos Timeline */}
          {measurements.some((m: any) => m.beforePhoto || m.afterPhoto) && (
            <div className="mt-6">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Camera className="h-4 w-4" /> Progress Photos</h3>
              <div className="space-y-4">
                {measurements.filter((m: any) => m.beforePhoto || m.afterPhoto).map((m: any, i: number) => (
                  <Card key={m.id}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{m.date}</span>
                        <span className="text-muted-foreground">— {m.weight} kg · BMI {m.bmi}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Before</p>
                          {m.beforePhoto ? (
                            <img src={m.beforePhoto} alt="Before" className="w-full h-40 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightboxSrc(m.beforePhoto)} />
                          ) : (
                            <div className="w-full h-40 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground/40">
                              <Camera className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">After</p>
                          {m.afterPhoto ? (
                            <img src={m.afterPhoto} alt="After" className="w-full h-40 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightboxSrc(m.afterPhoto)} />
                          ) : (
                            <div className="w-full h-40 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground/40">
                              <Camera className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── ATTENDANCE TAB ──────────────────────────────────── */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-primary">{attendance.length}</div>
              <div className="text-sm text-muted-foreground">Total Visits</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold">{attendance.filter(a => a.date?.startsWith(new Date().getFullYear().toString())).length}</div>
              <div className="text-sm text-muted-foreground">This Year</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <div className="text-sm font-medium">{attendance[0]?.date || "—"}</div>
              <div className="text-sm text-muted-foreground">Last Visit</div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Attendance Log</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No attendance records found</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {attendance.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                      <span className="font-medium">{a.date}</span>
                      <span className="text-muted-foreground">{a.checkInTime && `In: ${a.checkInTime}`} {a.checkOutTime && `— Out: ${a.checkOutTime}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INVOICES TAB ────────────────────────────────────── */}
        <TabsContent value="invoices" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-green-600">
                Rs {invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+parseFloat(i.amount||0),0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Paid</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-red-600">
                Rs {invoices.filter(i=>i.status==="unpaid").reduce((s,i)=>s+parseFloat(i.amount||0),0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Pending Dues</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold">{invoices.length}</div>
              <div className="text-sm text-muted-foreground">Total Invoices</div>
            </CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices found</p>
              ) : (
                <div className="divide-y">
                  {invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium capitalize">{inv.plan} Plan</span>
                        <span className="text-muted-foreground ml-2">Due: {inv.dueDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Rs {parseInt(inv.amount).toLocaleString()}</span>
                        <Badge variant={inv.status === "paid" ? "default" : "destructive"}>{inv.status}</Badge>
                        {inv.status === "unpaid" && (
                          <Button size="sm" variant="outline" onClick={() => markInvoicePaid(inv.id)}>Mark Paid</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => printInvoice(inv)}><Printer className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NOTES TAB ──────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Add Note / Remark</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Note</Label>
                  <Textarea value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="e.g. Client has knee pain, avoid squats..." rows={2} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={newNoteType} onValueChange={setNewNoteType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="behavior">Behavior</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={addNote} disabled={addingNote || !newNote.trim()}><Plus className="h-4 w-4 mr-1"/>Add Note</Button>
              </div>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No notes recorded yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <Card key={note.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{note.type}</Badge>
                        <span className="text-xs text-muted-foreground">by {note.createdBy}</span>
                        <span className="text-xs text-muted-foreground">— {format(new Date(note.createdAt), "MMM d, yyyy HH:mm")}</span>
                      </div>
                      <p className="text-sm">{note.note}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => deleteNote(note.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Measurement Dialog */}
      <Dialog open={editMeas !== null} onOpenChange={(o) => !o && setEditMeas(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Measurement — {editMeas?.date}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1"><Label className="text-xs">Weight (kg) *</Label><Input type="number" value={editMeasForm.weight} onChange={e=>setEditMeasForm(f=>({...f,weight:e.target.value}))} placeholder="70" /></div>
            <div className="space-y-1"><Label className="text-xs">Height (cm) *</Label><Input type="number" value={editMeasForm.height} onChange={e=>setEditMeasForm(f=>({...f,height:e.target.value}))} placeholder="175" /></div>
            <div className="space-y-1"><Label className="text-xs">Chest (cm)</Label><Input type="number" value={editMeasForm.chest} onChange={e=>setEditMeasForm(f=>({...f,chest:e.target.value}))} placeholder="90" /></div>
            <div className="space-y-1"><Label className="text-xs">Waist (cm)</Label><Input type="number" value={editMeasForm.waist} onChange={e=>setEditMeasForm(f=>({...f,waist:e.target.value}))} placeholder="80" /></div>
            <div className="space-y-1"><Label className="text-xs">Arms (cm)</Label><Input type="number" value={editMeasForm.arms} onChange={e=>setEditMeasForm(f=>({...f,arms:e.target.value}))} placeholder="35" /></div>
            <div className="space-y-1"><Label className="text-xs">Hips (cm)</Label><Input type="number" value={editMeasForm.hips} onChange={e=>setEditMeasForm(f=>({...f,hips:e.target.value}))} placeholder="95" /></div>
            <div className="space-y-1"><Label className="text-xs">Body Fat %</Label><Input type="number" value={editMeasForm.bodyFat} onChange={e=>setEditMeasForm(f=>({...f,bodyFat:e.target.value}))} placeholder="20" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Notes</Label><Input value={editMeasForm.notes} onChange={e=>setEditMeasForm(f=>({...f,notes:e.target.value}))} placeholder="Notes..." /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditMeas(null)}>Cancel</Button>
            <Button onClick={handleUpdateMeasurement} disabled={savingMeas}>{savingMeas ? "Saving..." : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightboxSrc !== null} onOpenChange={(o) => !o && setLightboxSrc(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
          <DialogHeader className="sr-only"><DialogTitle>Photo Preview</DialogTitle></DialogHeader>
          {lightboxSrc && <img src={lightboxSrc} alt="Full size" className="w-full max-h-[80vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-48">{value}</span>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-muted rounded-lg p-2 text-center">
      <div className={`font-semibold ${highlight || ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
