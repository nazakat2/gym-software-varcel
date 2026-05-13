import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScanBarcode, CheckCircle2, XCircle, Users, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;
const h = { "Content-Type": "application/json" };

type CheckIn = {
  id: number;
  memberId: number;
  memberName: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
};

type ScanResult = {
  status: "success" | "error" | "idle";
  memberName?: string;
  memberPhoto?: string;
  plan?: string;
  message?: string;
};

export default function AttendanceScan() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>({ status: "idle" });
  const [todayCheckIns, setTodayCheckIns] = useState<CheckIn[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadTodayCheckIns = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await fetch(API(`/attendance?date=${today}`)).then(r => r.json());
      setTodayCheckIns(Array.isArray(data) ? data : []);
    } catch {
      setTodayCheckIns([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadTodayCheckIns();
    inputRef.current?.focus();
  }, []);

  // Auto-focus input when page is clicked
  const handlePageClick = () => {
    inputRef.current?.focus();
  };

  const parseBarcode = (value: string): number | null => {
    const trimmed = value.trim().toUpperCase();
    // Format: MEM000001
    const match = trimmed.match(/^MEM(\d+)$/);
    if (match) return parseInt(match[1], 10);
    // Fallback: plain number
    const num = parseInt(trimmed, 10);
    return isNaN(num) ? null : num;
  };

  const handleScan = async (raw: string) => {
    if (!raw.trim() || scanning) return;
    setScanning(true);
    setBarcodeInput("");

    const memberId = parseBarcode(raw);
    if (!memberId) {
      setResult({ status: "error", message: "Invalid barcode format. Expected MEM######" });
      setScanning(false);
      setTimeout(() => setResult({ status: "idle" }), 3000);
      return;
    }

    try {
      // Get member info first
      const member = await fetch(API(`/members/${memberId}`)).then(async r => {
        if (!r.ok) return null;
        return r.json();
      });

      if (!member) {
        setResult({ status: "error", message: `Member #${memberId} not found` });
        setTimeout(() => setResult({ status: "idle" }), 3000);
        return;
      }

      // Check if blacklisted
      if (member.blacklisted) {
        setResult({ status: "error", message: `${member.name} is blacklisted — access denied` });
        setTimeout(() => setResult({ status: "idle" }), 4000);
        return;
      }

      // Check if already checked in today
      const existing = todayCheckIns.find(a => a.memberId === memberId);

      if (existing && existing.checkOutTime) {
        // Already checked in AND out today
        setResult({
          status: "error",
          message: `${member.name} already checked out at ${existing.checkOutTime}`,
        });
        setTimeout(() => setResult({ status: "idle" }), 3500);
        return;
      }

      if (existing && !existing.checkOutTime) {
        // Already checked in — do checkout
        const att = await fetch(API("/attendance/checkout"), {
          method: "POST", headers: h,
          body: JSON.stringify({ memberId }),
        }).then(r => r.json());

        setResult({
          status: "success",
          memberName: member.name,
          memberPhoto: member.photoUrl,
          plan: member.plan,
          message: `Checked OUT at ${att.checkOutTime}`,
        });
      } else {
        // Not checked in yet — do check-in
        const att = await fetch(API("/attendance"), {
          method: "POST", headers: h,
          body: JSON.stringify({ memberId }),
        }).then(r => r.json());

        setResult({
          status: "success",
          memberName: member.name,
          memberPhoto: member.photoUrl,
          plan: member.plan,
          message: `Checked IN at ${att.checkInTime}`,
        });
      }

      await loadTodayCheckIns();
      setTimeout(() => {
        setResult({ status: "idle" });
        inputRef.current?.focus();
      }, 3500);
    } catch {
      setResult({ status: "error", message: "Server error — please try again" });
      setTimeout(() => setResult({ status: "idle" }), 3000);
    } finally {
      setScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleScan(barcodeInput);
    }
  };

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="max-w-4xl mx-auto space-y-6" onClick={handlePageClick}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanBarcode className="h-6 w-6 text-primary" />
            Attendance Scanner
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTodayCheckIns}>
          <RefreshCw className="h-4 w-4 mr-1" />Refresh
        </Button>
      </div>

      {/* Scanner Input */}
      <Card className={`border-2 transition-colors ${
        result.status === "success" ? "border-green-500" :
        result.status === "error" ? "border-red-500" :
        "border-primary/30"
      }`}>
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto transition-colors ${
            result.status === "success" ? "bg-green-100" :
            result.status === "error" ? "bg-red-100" :
            "bg-primary/10"
          }`}>
            {result.status === "success" ? (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            ) : result.status === "error" ? (
              <XCircle className="h-10 w-10 text-red-600" />
            ) : result.memberPhoto ? (
              <img src={result.memberPhoto} className="h-full w-full rounded-full object-cover" alt="" />
            ) : (
              <ScanBarcode className="h-10 w-10 text-primary" />
            )}
          </div>

          {result.status === "success" && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-700">{result.memberName}</p>
              <p className="text-sm font-medium text-green-600">{result.message}</p>
              <p className="text-xs text-muted-foreground capitalize">{result.plan} Plan</p>
            </div>
          )}

          {result.status === "error" && (
            <p className="text-lg font-semibold text-red-600">{result.message}</p>
          )}

          {result.status === "idle" && (
            <p className="text-muted-foreground">
              {scanning ? "Processing..." : "Scan member barcode or type ID and press Enter"}
            </p>
          )}

          <div className="max-w-xs mx-auto">
            <Input
              ref={inputRef}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan barcode here..."
              className="text-center text-lg font-mono h-12 tracking-widest"
              autoComplete="off"
              disabled={scanning}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Input is always active — just scan the ID card barcode
          </p>
        </CardContent>
      </Card>

      {/* Today's Stats + Check-in Log */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold text-primary">{todayCheckIns.length}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Users className="h-3.5 w-3.5" />Today's Check-ins
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold">
              {todayCheckIns.length > 0 ? todayCheckIns[0].checkInTime : "—"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Last Check-in Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-3xl font-bold">
              {todayCheckIns.filter(a => !a.checkOutTime).length}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" />Still Inside
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check-in log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today's Check-in Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Loading...</p>
          ) : todayCheckIns.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No check-ins yet today</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {todayCheckIns.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <span className="font-medium">{a.memberName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">In: {a.checkInTime}</span>
                    {a.checkOutTime
                      ? <span className="text-muted-foreground text-xs">Out: {a.checkOutTime}</span>
                      : <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">Inside</Badge>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
