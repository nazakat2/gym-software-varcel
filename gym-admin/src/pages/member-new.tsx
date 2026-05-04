import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, X, User, Phone, HeartPulse, Dumbbell, Shield } from "lucide-react";
import { useListEmployees } from "@workspace/api-client-react";

const CONDITIONS = [
  "High Blood Pressure (BP)", "Diabetes", "PCOS", "Thyroid", "Asthma",
  "Heart Condition", "Back/Spine Issue", "Knee Problem", "Shoulder Injury",
  "Obesity", "Arthritis", "Depression/Anxiety",
];

const REFERRAL_SOURCES = [
  "Walk-in", "Facebook Ad", "Instagram Ad", "Friend Referral", "Google Search",
  "WhatsApp", "Flyer/Banner", "Other",
];

async function apiFetch(path: string, body: object) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

export default function AddMember() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: employees } = useListEmployees();
  const trainers = (employees || []).filter(e => e.role === "trainer" || e.role === "Trainer");

  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Basic Info
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");

  // Contact
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");

  // ID & Emergency
  const [cnic, setCnic] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Membership
  const [plan, setPlan] = useState("monthly");
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [fitnessGoal, setFitnessGoal] = useState("general");
  const [trainerId, setTrainerId] = useState("none");
  const [referralSource, setReferralSource] = useState("");

  // Health
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [doctorRecs, setDoctorRecs] = useState("");

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Photo must be under 5MB", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleCondition = (c: string) => {
    setSelectedConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !cnic) { toast({ title: "Name, Phone and CNIC are required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const member = await apiFetch("/members", {
        name, gender, dob: dob || null, bloodGroup: bloodGroup || null,
        phone, whatsapp: whatsapp || null, email: email || null,
        city: city || null, area: area || null, address: address || null,
        cnic,
        emergencyContactName: emergencyName || null,
        emergencyContactPhone: emergencyPhone || null,
        plan, planStartDate,
        fitnessGoal, referralSource: referralSource || null,
        assignedTrainerId: (trainerId && trainerId !== "none") ? parseInt(trainerId) : null,
        photoUrl: photoPreview || null,
      });

      // Save health info if any
      if (selectedConditions.length > 0 || allergies || medicalHistory) {
        await fetch(`/api/members/${member.id}/health`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditions: selectedConditions,
            allergies: allergies || null,
            medicalHistory: medicalHistory || null,
            doctorRecommendations: doctorRecs || null,
          }),
        });
      }

      toast({ title: "Member registered successfully!" });
      setLocation(`/members/${member.id}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to add member", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-base">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/members")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Register New Member</h1>
          <p className="text-muted-foreground text-sm">Fill in member details to create a complete profile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Basic Info ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg"><SectionHeader icon={User} title="Personal Information" /></CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <Label>Full Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmed Ali Khan" required />
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Blood Group</Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>CNIC *</Label>
                  <Input value={cnic} onChange={e => setCnic(e.target.value)} placeholder="XXXXX-XXXXXXX-X" required />
                </div>
              </div>

              {/* Photo */}
              <div className="w-full md:w-52 space-y-2">
                <Label>Profile Photo</Label>
                <div
                  className="relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-52 overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => !photoPreview && fileRef.current?.click()}
                >
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} className="absolute inset-0 w-full h-full object-cover" alt="preview" />
                      <button type="button" onClick={e => { e.stopPropagation(); setPhotoPreview(null); }}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 z-10">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground text-center px-2">Click to upload<br/>Max 5 MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Contact Info ────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            <SectionHeader icon={Phone} title="Contact Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Phone Number *</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" required />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp Number</Label>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="03XX-XXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="member@email.com" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Lahore" />
              </div>
              <div className="space-y-1">
                <Label>Area / Locality</Label>
                <Input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. DHA Phase 5" />
              </div>
              <div className="space-y-1">
                <Label>Emergency Contact Name</Label>
                <Input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Parent / Spouse name" />
              </div>
              <div className="space-y-1">
                <Label>Emergency Contact Phone</Label>
                <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Full Address</Label>
                <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address..." rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Membership ─────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            <SectionHeader icon={Shield} title="Membership & Assignment" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Membership Plan *</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Rs 200)</SelectItem>
                    <SelectItem value="weekly">Weekly (Rs 800)</SelectItem>
                    <SelectItem value="monthly">Monthly (Rs 3,000)</SelectItem>
                    <SelectItem value="quarterly">Quarterly (Rs 8,000)</SelectItem>
                    <SelectItem value="yearly">Yearly (Rs 28,000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Fitness Goal</Label>
                <Select value={fitnessGoal} onValueChange={setFitnessGoal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight-loss">Weight / Fat Loss</SelectItem>
                    <SelectItem value="muscle-gain">Muscle Gain</SelectItem>
                    <SelectItem value="general">General Fitness</SelectItem>
                    <SelectItem value="strength">Strength & Endurance</SelectItem>
                    <SelectItem value="cardio">Cardio & Stamina</SelectItem>
                    <SelectItem value="rehabilitation">Rehabilitation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assign Trainer</Label>
                <Select value={trainerId} onValueChange={setTrainerId}>
                  <SelectTrigger><SelectValue placeholder="No trainer assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No trainer assigned</SelectItem>
                    {(employees || []).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Referral Source</Label>
                <Select value={referralSource} onValueChange={setReferralSource}>
                  <SelectTrigger><SelectValue placeholder="How did they find us?" /></SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Health & Medical ───────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            <SectionHeader icon={HeartPulse} title="Health & Medical Information (Optional)" />
            <div className="space-y-5">
              <div>
                <Label className="mb-3 block">Medical Conditions</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CONDITIONS.map(c => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={c}
                        checked={selectedConditions.includes(c)}
                        onCheckedChange={() => toggleCondition(c)}
                      />
                      <label htmlFor={c} className="text-sm cursor-pointer">{c}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Allergies</Label>
                  <Textarea value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Food or medicine allergies..." rows={2} />
                </div>
                <div className="space-y-1">
                  <Label>Doctor Recommendations</Label>
                  <Textarea value={doctorRecs} onChange={e => setDoctorRecs(e.target.value)} placeholder="Any doctor advice to follow..." rows={2} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Medical / Injury History</Label>
                  <Textarea value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} placeholder="Past surgeries, injuries, chronic conditions..." rows={3} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Fitness Details ─────────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            <SectionHeader icon={Dumbbell} title="Initial Fitness Assessment (Optional)" />
            <p className="text-sm text-muted-foreground mb-4">You can add body measurements and progress tracking after registration from the member's profile.</p>
            <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
              After saving, go to the member profile → Measurements tab to record weight, BMI, chest, waist, arms, and before/after photos.
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" type="button" onClick={() => setLocation("/members")}>Cancel</Button>
          <Button type="submit" disabled={loading} className="min-w-32">
            {loading ? "Saving..." : "Register Member"}
          </Button>
        </div>
      </form>
    </div>
  );
}
