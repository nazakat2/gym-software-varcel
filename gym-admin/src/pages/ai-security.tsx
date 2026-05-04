import { useEffect, useMemo, useState } from "react";
import {
  ScanFace,
  Users,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  Camera,
  Activity,
  Crown,
  Wifi,
  Eye,
  Clock,
  Calendar,
  TrendingUp,
  CircleDot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---------- Demo data (front-end only mock for Premium UI) ----------

const CAMERAS = [
  { id: "CAM-01", name: "Main Entrance", zone: "Entry", status: "live" as const, faces: 2 },
  { id: "CAM-02", name: "Reception", zone: "Lobby", status: "live" as const, faces: 1 },
  { id: "CAM-03", name: "Workout Floor", zone: "Gym Floor", status: "live" as const, faces: 7 },
  { id: "CAM-04", name: "Locker Room Hallway", zone: "Restricted", status: "live" as const, faces: 0 },
];

const SEED_LOG = [
  { time: "10:42 AM", name: "Ahmed Raza", id: "M-1042", zone: "Main Entrance", status: "Check-In", confidence: 98 },
  { time: "10:39 AM", name: "Sara Khan", id: "M-0871", zone: "Main Entrance", status: "Check-In", confidence: 96 },
  { time: "10:33 AM", name: "Unknown", id: "—", zone: "Reception", status: "Unknown Face", confidence: 41 },
  { time: "10:28 AM", name: "Bilal Hussain", id: "M-0319", zone: "Workout Floor", status: "Check-In", confidence: 99 },
  { time: "10:21 AM", name: "Hina Tariq", id: "M-0654", zone: "Main Entrance", status: "Check-Out", confidence: 97 },
  { time: "10:15 AM", name: "Usman Ali", id: "M-0411", zone: "Main Entrance", status: "Check-In", confidence: 95 },
  { time: "10:08 AM", name: "Trainer · Imran", id: "S-0007", zone: "Workout Floor", status: "Staff Check-In", confidence: 99 },
  { time: "09:59 AM", name: "Maria Yousaf", id: "M-0233", zone: "Main Entrance", status: "Check-In", confidence: 94 },
];

const SEED_ALERTS = [
  { time: "10:33 AM", level: "warning" as const, title: "Unknown face detected", detail: "Reception · 41% confidence · No member match" },
  { time: "10:11 AM", level: "info" as const, title: "Crowd peak reached", detail: "Workout Floor exceeded 25 people" },
  { time: "09:47 AM", level: "danger" as const, title: "Restricted zone access", detail: "Movement detected in Locker Room Hallway after-hours window" },
  { time: "09:30 AM", level: "info" as const, title: "AI model warm-up complete", detail: "Face recognition engine ready · Avg latency 180ms" },
];

const WEEKLY_VISITORS = [
  { day: "Mon", count: 142 },
  { day: "Tue", count: 158 },
  { day: "Wed", count: 174 },
  { day: "Thu", count: 165 },
  { day: "Fri", count: 189 },
  { day: "Sat", count: 211 },
  { day: "Sun", count: 96 },
];

// ---------- Page ----------

export default function AISecurityPage() {
  // Live counters that gently fluctuate to feel "live"
  const [insideNow, setInsideNow] = useState(34);
  const [todayCheckins, setTodayCheckins] = useState(127);
  const [recognized, setRecognized] = useState(312);
  const [unknown, setUnknown] = useState(3);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setTick((x) => x + 1);
      setInsideNow((v) => Math.max(8, Math.min(60, v + (Math.random() > 0.5 ? 1 : -1))));
      if (Math.random() > 0.7) setTodayCheckins((v) => v + 1);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const maxVisitors = useMemo(() => Math.max(...WEEKLY_VISITORS.map((d) => d.count)), []);

  return (
    <div className="space-y-6">
      {/* ----------- Premium Header ----------- */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary to-red-900 text-primary-foreground p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400 border-0 gap-1.5">
              <Crown className="h-3.5 w-3.5" /> PREMIUM PLAN
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <ScanFace className="h-7 w-7" /> AI Security &amp; Attendance
            </h1>
            <p className="text-sm sm:text-base text-white/85 max-w-2xl">
              Smart Face Recognition, Real-time People Counting, and Automatic
              Attendance — fully AI-powered. No cards, no fingerprints required.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 text-xs font-medium bg-white/15 rounded-full px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              AI Engine Online
            </div>
            <div className="text-xs text-white/80 flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5" /> 4 cameras connected · 180ms avg latency
            </div>
          </div>
        </div>
      </div>

      {/* ----------- KPI Cards ----------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="People Inside Now"
          value={insideNow}
          icon={Users}
          accent="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/30"
          subtitle="Real-time count"
          live
        />
        <KpiCard
          title="Auto Check-ins Today"
          value={todayCheckins}
          icon={UserCheck}
          accent="text-emerald-600"
          bg="bg-emerald-50 dark:bg-emerald-950/30"
          subtitle="+12% vs yesterday"
        />
        <KpiCard
          title="Recognized Members"
          value={recognized}
          icon={ScanFace}
          accent="text-primary"
          bg="bg-red-50 dark:bg-red-950/30"
          subtitle="Faces enrolled in AI"
        />
        <KpiCard
          title="Unknown Faces Today"
          value={unknown}
          icon={AlertTriangle}
          accent="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-950/30"
          subtitle="Flagged for review"
        />
      </div>

      {/* ----------- Live Monitoring + Alerts ----------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Camera Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Live Camera Monitoring
              </CardTitle>
              <CardDescription>AI face detection running on all feeds</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <CircleDot className="h-3 w-3 text-red-500 animate-pulse" /> LIVE
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAMERAS.map((cam) => (
                <CameraTile key={cam.id} cam={cam} tick={tick} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> AI Alerts
            </CardTitle>
            <CardDescription>Unknown faces &amp; suspicious activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {SEED_ALERTS.map((a, i) => (
              <AlertRow key={i} alert={a} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ----------- Reports + Recognition Log ----------- */}
      <Tabs defaultValue="log" className="w-full">
        <TabsList>
          <TabsTrigger value="log">
            <Activity className="h-4 w-4 mr-2" /> Recognition Log
          </TabsTrigger>
          <TabsTrigger value="reports">
            <TrendingUp className="h-4 w-4 mr-2" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Recognition Activity</CardTitle>
              <CardDescription>
                Automatic attendance entries from face recognition · No manual action required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Time</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SEED_LOG.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.time}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                        <TableCell>{row.zone}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfidencePill value={row.confidence} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{todayCheckins}</div>
                <p className="text-xs text-muted-foreground mt-1">automatic check-ins</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">1,135</div>
                <p className="text-xs text-emerald-600 mt-1">+8.4% vs last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">4,872</div>
                <p className="text-xs text-emerald-600 mt-1">+12.1% vs last month</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Visitor Count</CardTitle>
              <CardDescription>Unique people detected per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-48">
                {WEEKLY_VISITORS.map((d) => {
                  const h = (d.count / maxVisitors) * 100;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-xs font-semibold text-muted-foreground">{d.count}</div>
                      <div className="w-full bg-muted rounded-t-md relative" style={{ height: "100%" }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-red-400 rounded-t-md transition-all"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">{d.day}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ----------- Premium Plan Footer ----------- */}
      <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Premium Plan</div>
              <p className="text-sm text-muted-foreground">
                AI-powered Security &amp; Attendance with Smart Face Recognition,
                Real-time People Counting, and Automatic Attendance for fully
                automated monitoring.
              </p>
            </div>
          </div>
          <Button className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold shrink-0">
            Manage Premium
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------

function KpiCard({
  title,
  value,
  icon: Icon,
  accent,
  bg,
  subtitle,
  live,
}: {
  title: string;
  value: number;
  icon: any;
  accent: string;
  bg: string;
  subtitle: string;
  live?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold">{value.toLocaleString()}</p>
              {live && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center", bg)}>
            <Icon className={cn("h-5 w-5", accent)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CameraTile({
  cam,
  tick,
}: {
  cam: (typeof CAMERAS)[number];
  tick: number;
}) {
  // Animate scan line position based on tick
  const scanY = (tick * 17) % 100;
  return (
    <div className="relative rounded-lg overflow-hidden border bg-slate-900 aspect-video">
      {/* simulated camera background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)",
      }} />

      {/* scan line */}
      <div
        className="absolute left-0 right-0 h-px bg-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.8)] transition-all duration-1000"
        style={{ top: `${scanY}%` }}
      />

      {/* fake face boxes */}
      {Array.from({ length: cam.faces }).slice(0, 3).map((_, i) => {
        const left = 10 + i * 28 + ((tick * 3 + i * 11) % 10);
        const top = 30 + ((tick * 5 + i * 17) % 25);
        return (
          <div
            key={i}
            className="absolute border-2 border-emerald-400 rounded-sm transition-all duration-700"
            style={{ left: `${left}%`, top: `${top}%`, width: "60px", height: "70px" }}
          >
            <div className="absolute -top-5 left-0 text-[9px] font-mono bg-emerald-400 text-slate-900 px-1 rounded-sm">
              ID·{(i + 1) * 217 + tick % 10}
            </div>
          </div>
        );
      })}

      {/* overlay info */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-white">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
          <CircleDot className="h-2.5 w-2.5 text-red-500 animate-pulse" />
          {cam.id}
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">{cam.zone}</div>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-white">
        <div className="font-medium drop-shadow">{cam.name}</div>
        <div className="bg-emerald-500/90 rounded px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1">
          <Eye className="h-3 w-3" /> {cam.faces} face{cam.faces === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: (typeof SEED_ALERTS)[number] }) {
  const styles =
    alert.level === "danger"
      ? { ring: "border-l-red-500", bg: "bg-red-50 dark:bg-red-950/20", icon: "text-red-600" }
      : alert.level === "warning"
      ? { ring: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", icon: "text-amber-600" }
      : { ring: "border-l-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", icon: "text-blue-600" };

  return (
    <div className={cn("rounded-md border border-l-4 p-3", styles.ring, styles.bg)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">{alert.title}</p>
            <span className="text-[11px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {alert.time}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Check-In": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
    "Check-Out": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    "Staff Check-In": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400",
    "Unknown Face": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] || "")}>
      {status}
    </Badge>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-emerald-500"
      : value >= 70
      ? "bg-amber-500"
      : "bg-red-500";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{value}%</span>
    </div>
  );
}
