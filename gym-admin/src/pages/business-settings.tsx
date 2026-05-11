import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Settings, Save, Facebook, Instagram } from "lucide-react";

export default function BusinessSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    gymName: "", address: "", phone: "", email: "", website: "",
    dailyFee: "", weeklyFee: "", monthlyFee: "", quarterlyFee: "", yearlyFee: "", currency: "PKR",
    openTime: "", closeTime: "", taxRate: "",
    facebook: "", instagram: "", snapchat: "", tiktok: "",
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error();
      const s = await res.json();
      setForm({
        gymName: s.gymName || "",
        address: s.address || "",
        phone: s.phone || "",
        email: s.email || "",
        website: s.website || "",
        dailyFee: String(s.dailyFee || "200"),
        weeklyFee: String(s.weeklyFee || "800"),
        monthlyFee: String(s.monthlyFee || "3000"),
        quarterlyFee: String(s.quarterlyFee || "8000"),
        yearlyFee: String(s.yearlyFee || "28000"),
        currency: s.currency || "PKR",
        openTime: s.openTime || "",
        closeTime: s.closeTime || "",
        taxRate: String(s.taxRate || ""),
        facebook: s.facebook || "",
        instagram: s.instagram || "",
        snapchat: s.snapchat || "",
        tiktok: s.tiktok || "",
      });
    } catch {
      toast({ title: "Failed to load settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymName: form.gymName,
          address: form.address,
          phone: form.phone,
          email: form.email,
          currency: form.currency,
          dailyFee: form.dailyFee ? parseFloat(form.dailyFee) : undefined,
          weeklyFee: form.weeklyFee ? parseFloat(form.weeklyFee) : undefined,
          monthlyFee: form.monthlyFee ? parseFloat(form.monthlyFee) : undefined,
          quarterlyFee: form.quarterlyFee ? parseFloat(form.quarterlyFee) : undefined,
          yearlyFee: form.yearlyFee ? parseFloat(form.yearlyFee) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Business settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Gym Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Gym Name</Label>
            <Input value={form.gymName} onChange={(e) => setForm(f => ({ ...f, gymName: e.target.value }))} placeholder="Core X Gym" />
          </div>
          <div className="grid gap-2">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City, Country" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92-21-..." />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="gym@example.com" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://mygym.com" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Membership Fees (PKR)</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="grid gap-2">
              <Label>Daily</Label>
              <Input type="number" value={form.dailyFee} onChange={(e) => setForm(f => ({ ...f, dailyFee: e.target.value }))} placeholder="200" />
            </div>
            <div className="grid gap-2">
              <Label>Weekly</Label>
              <Input type="number" value={form.weeklyFee} onChange={(e) => setForm(f => ({ ...f, weeklyFee: e.target.value }))} placeholder="800" />
            </div>
            <div className="grid gap-2">
              <Label>Monthly</Label>
              <Input type="number" value={form.monthlyFee} onChange={(e) => setForm(f => ({ ...f, monthlyFee: e.target.value }))} placeholder="3000" />
            </div>
            <div className="grid gap-2">
              <Label>Quarterly</Label>
              <Input type="number" value={form.quarterlyFee} onChange={(e) => setForm(f => ({ ...f, quarterlyFee: e.target.value }))} placeholder="8000" />
            </div>
            <div className="grid gap-2">
              <Label>Yearly</Label>
              <Input type="number" value={form.yearlyFee} onChange={(e) => setForm(f => ({ ...f, yearlyFee: e.target.value }))} placeholder="28000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Facebook className="h-5 w-5" /> Social Media</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Facebook</Label>
              <Input value={form.facebook} onChange={(e) => setForm(f => ({ ...f, facebook: e.target.value }))} placeholder="https://facebook.com/yourgym" />
            </div>
            <div className="grid gap-2">
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))} placeholder="https://instagram.com/yourgym" />
            </div>
            <div className="grid gap-2">
              <Label>Snapchat</Label>
              <Input value={form.snapchat} onChange={(e) => setForm(f => ({ ...f, snapchat: e.target.value }))} placeholder="https://snapchat.com/add/yourgym" />
            </div>
            <div className="grid gap-2">
              <Label>TikTok</Label>
              <Input value={form.tiktok} onChange={(e) => setForm(f => ({ ...f, tiktok: e.target.value }))} placeholder="https://tiktok.com/@yourgym" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Operating Hours</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Opening Time</Label>
              <Input type="time" value={form.openTime} onChange={(e) => setForm(f => ({ ...f, openTime: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Closing Time</Label>
              <Input type="time" value={form.closeTime} onChange={(e) => setForm(f => ({ ...f, closeTime: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
