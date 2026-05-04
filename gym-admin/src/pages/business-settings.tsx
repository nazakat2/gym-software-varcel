import { useState, useEffect } from "react";
import { useGetBusinessSettings, useUpdateBusinessSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Settings, Save } from "lucide-react";

export default function BusinessSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();

  const [form, setForm] = useState({
    gymName: "", address: "", phone: "", email: "", website: "",
    monthlyFee: "", quarterlyFee: "", yearlyFee: "", currency: "PKR",
    openTime: "", closeTime: "", taxRate: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        gymName: (settings as any).gymName || "",
        address: (settings as any).address || "",
        phone: (settings as any).phone || "",
        email: (settings as any).email || "",
        website: (settings as any).website || "",
        monthlyFee: String((settings as any).monthlyFee || ""),
        quarterlyFee: String((settings as any).quarterlyFee || ""),
        yearlyFee: String((settings as any).yearlyFee || ""),
        currency: (settings as any).currency || "PKR",
        openTime: (settings as any).openTime || "",
        closeTime: (settings as any).closeTime || "",
        taxRate: String((settings as any).taxRate || ""),
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        data: {
          gymName: form.gymName,
          address: form.address,
          phone: form.phone,
          email: form.email,
          website: form.website || undefined,
          monthlyFee: form.monthlyFee ? parseFloat(form.monthlyFee) : undefined,
          quarterlyFee: form.quarterlyFee ? parseFloat(form.quarterlyFee) : undefined,
          yearlyFee: form.yearlyFee ? parseFloat(form.yearlyFee) : undefined,
          currency: form.currency,
          openTime: form.openTime || undefined,
          closeTime: form.closeTime || undefined,
          taxRate: form.taxRate ? parseFloat(form.taxRate) : undefined,
        }
      });
      toast({ title: "Business settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
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
        <CardHeader><CardTitle>Membership Fees</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Monthly (PKR)</Label>
              <Input type="number" value={form.monthlyFee} onChange={(e) => setForm(f => ({ ...f, monthlyFee: e.target.value }))} placeholder="3000" />
            </div>
            <div className="grid gap-2">
              <Label>Quarterly (PKR)</Label>
              <Input type="number" value={form.quarterlyFee} onChange={(e) => setForm(f => ({ ...f, quarterlyFee: e.target.value }))} placeholder="8000" />
            </div>
            <div className="grid gap-2">
              <Label>Yearly (PKR)</Label>
              <Input type="number" value={form.yearlyFee} onChange={(e) => setForm(f => ({ ...f, yearlyFee: e.target.value }))} placeholder="28000" />
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
