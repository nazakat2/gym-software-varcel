import { useState } from "react";
import {
  useGetDashboardStats, useGetRevenueChart, useGetAttendanceReport,
  useListMembers, useListBilling, useGetFinancialReport, useGetMemberReport,
  useGetBusinessSettings,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  FileBarChart, Users, DollarSign, CalendarCheck, Download, TrendingUp,
  FileText, CreditCard, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parse, addMonths, subMonths } from "date-fns";

const PRIMARY = "#E31C25";
const COLORS = ["#E31C25", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4"];

// ── helpers ──────────────────────────────────────────────────────────────────
function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  try { return format(parse(m + "-01", "yyyy-MM-dd", new Date()), "MMMM yyyy"); }
  catch { return m; }
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function addPdfHeader(doc: jsPDF, gymName: string, reportTitle: string, subtitle?: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(227, 28, 37);
  doc.rect(0, 0, pw, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(gymName, 14, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(reportTitle, 14, 23);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, pw - 14, 13, { align: "right" });
  if (subtitle) doc.text(subtitle, pw - 14, 23, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return 42;
}

function addPdfFooter(doc: jsPDF, gymName: string) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(14, ph - 12, pw - 14, ph - 12);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${gymName} — Confidential`, 14, ph - 6);
    doc.text(`Page ${i} of ${pageCount}`, pw - 14, ph - 6, { align: "right" });
  }
}

function statBox(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color = "red") {
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(x, y, w, 22, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 4, y + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const colorMap: Record<string, [number, number, number]> = {
    red: [227, 28, 37], green: [34, 197, 94], blue: [59, 130, 246], gray: [80, 80, 80]
  };
  const rgb = colorMap[color] || colorMap.red;
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(value, x + 4, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(toMonthStr(new Date()));

  const { data: stats } = useGetDashboardStats();
  const { data: attendanceReport } = useGetAttendanceReport({ month: selectedMonth });
  const { data: revenueChart } = useGetRevenueChart();
  const { data: members } = useListMembers();
  const { data: billing } = useListBilling();
  const { data: financialReport } = useGetFinancialReport({ month: selectedMonth });
  const { data: memberReport } = useGetMemberReport();
  const { data: bizSettings } = useGetBusinessSettings();

  const [downloading, setDownloading] = useState<string | null>(null);
  const gymName: string = (bizSettings as any)?.gymName || "Core X";
  const mLabel = monthLabel(selectedMonth);

  const attendanceChart = attendanceReport?.chart || [];
  const fr = financialReport as any;
  const mr = memberReport as any;

  // billing filtered to selected month
  const monthBilling = (billing || []).filter((inv: any) => {
    const d = inv.dueDate || inv.paidDate || "";
    return d.startsWith(selectedMonth);
  });

  // members joined in selected month
  const monthMembers = (members || []).filter((m: any) => {
    const joined = (m.createdAt || m.planStartDate || "").slice(0, 7);
    return joined === selectedMonth;
  });

  // members expiring in selected month
  const monthExpiring = (members || []).filter((m: any) => {
    return (m.planExpiryDate || "").startsWith(selectedMonth);
  }).sort((a: any, b: any) => a.planExpiryDate.localeCompare(b.planExpiryDate));

  // ── DOWNLOAD: Overview ────────────────────────────────────────────────────
  const downloadOverview = () => {
    setDownloading("overview");
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, gymName, "Overview Summary Report", mLabel);

    const bw = (pw - 28 - 9) / 4;
    statBox(doc, 14, y, bw, "Total Members", String(stats?.totalMembers || 0), "gray");
    statBox(doc, 14 + bw + 3, y, bw, "Active Members", String(stats?.activeMembers || 0), "green");
    statBox(doc, 14 + (bw + 3) * 2, y, bw, `Revenue (${mLabel})`, `Rs ${(fr?.totalRevenue || 0).toLocaleString()}`, "green");
    statBox(doc, 14 + (bw + 3) * 3, y, bw, "Net Profit", `Rs ${(fr?.netProfit || 0).toLocaleString()}`, "blue");
    y += 28;
    statBox(doc, 14, y, bw, "Membership Income", `Rs ${(fr?.membershipIncome || 0).toLocaleString()}`, "green");
    statBox(doc, 14 + bw + 3, y, bw, "Sales Income", `Rs ${(fr?.salesIncome || 0).toLocaleString()}`, "green");
    statBox(doc, 14 + (bw + 3) * 2, y, bw, "Expenses", `Rs ${(fr?.totalExpenses || 0).toLocaleString()}`, "red");
    statBox(doc, 14 + (bw + 3) * 3, y, bw, "Unpaid Dues", `Rs ${(stats?.unpaidDues || 0).toLocaleString()}`, "red");
    y += 30;

    // Weekly breakdown for selected month
    if (fr?.breakdown && fr.breakdown.length > 0) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Weekly Breakdown — ${mLabel}`, 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Week", "Revenue (Rs)", "Expenses (Rs)", "Net (Rs)"]],
        body: (fr.breakdown as any[]).map((r: any) => [
          r.month, `Rs ${(r.revenue || 0).toLocaleString()}`,
          `Rs ${(r.expenses || 0).toLocaleString()}`,
          `Rs ${((r.revenue || 0) - (r.expenses || 0)).toLocaleString()}`,
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255 },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        styles: { fontSize: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (attendanceChart.length > 0) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Attendance — ${mLabel}`, 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Day", "Visits"]],
        body: attendanceChart.map((r: any) => [r.day, r.count]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255 },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        styles: { fontSize: 10 },
      });
    }

    addPdfFooter(doc, gymName);
    doc.save(`${gymName.replace(/\s+/g, "_")}_Overview_${selectedMonth}.pdf`);
    setDownloading(null);
  };

  // ── DOWNLOAD: Members ─────────────────────────────────────────────────────
  const downloadMembers = () => {
    setDownloading("members");
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, gymName, `Members Report — ${mLabel}`, `Total: ${(members || []).length} members`);

    const bw = (pw - 28 - 12) / 5;
    const active = (members || []).filter((m: any) => m.status === "active").length;
    const expired = (members || []).filter((m: any) => m.status === "expired").length;
    statBox(doc, 14, y, bw, "Total Members", String((members || []).length), "gray");
    statBox(doc, 14 + (bw + 3), y, bw, "Active", String(active), "green");
    statBox(doc, 14 + (bw + 3) * 2, y, bw, "Expired", String(expired), "red");
    statBox(doc, 14 + (bw + 3) * 3, y, bw, `Joined in ${mLabel}`, String(monthMembers.length), "blue");
    statBox(doc, 14 + (bw + 3) * 4, y, bw, `Expiring in ${mLabel}`, String(monthExpiring.length), "red");
    y += 30;

    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("All Members", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["#", "Name", "Phone", "CNIC", "Plan", "Start Date", "Expiry Date", "Status", "Fitness Goal"]],
      body: (members || []).map((m: any, i: number) => [
        i + 1, m.name, m.phone, m.cnic || "—",
        (m.plan?.charAt(0).toUpperCase() + m.plan?.slice(1)) || "—",
        m.planStartDate || "—", m.planExpiryDate || "—",
        (m.status || "—").toUpperCase(),
        (m.fitnessGoal?.replace(/-/g, " ")) || "General",
      ]),
      headStyles: { fillColor: [227, 28, 37], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [253, 242, 242] },
      styles: { fontSize: 8, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.column.index === 7 && data.cell.raw === "ACTIVE") { data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.fontStyle = "bold"; }
        if (data.column.index === 7 && data.cell.raw === "EXPIRED") { data.cell.styles.textColor = [227, 28, 37]; }
      },
    });

    if (monthMembers.length > 0) {
      doc.addPage();
      let y2 = addPdfHeader(doc, gymName, `New Members — ${mLabel}`, `${monthMembers.length} joined this month`);
      autoTable(doc, {
        startY: y2,
        head: [["#", "Name", "Phone", "Plan", "Start Date", "Expiry Date", "Status"]],
        body: monthMembers.map((m: any, i: number) => [
          i + 1, m.name, m.phone,
          (m.plan?.charAt(0).toUpperCase() + m.plan?.slice(1)) || "—",
          m.planStartDate || "—", m.planExpiryDate || "—",
          (m.status || "—").toUpperCase(),
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [253, 242, 242] },
        styles: { fontSize: 9, cellPadding: 3 },
      });
    }

    addPdfFooter(doc, gymName);
    doc.save(`${gymName.replace(/\s+/g, "_")}_Members_${selectedMonth}.pdf`);
    setDownloading(null);
  };

  // ── DOWNLOAD: Revenue ─────────────────────────────────────────────────────
  const downloadRevenue = () => {
    setDownloading("revenue");
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, gymName, `Revenue & Billing Report — ${mLabel}`, mLabel);

    const bw = (pw - 28 - 9) / 4;
    statBox(doc, 14, y, bw, "Total Revenue", `Rs ${(fr?.totalRevenue || 0).toLocaleString()}`, "green");
    statBox(doc, 14 + bw + 3, y, bw, "Membership Income", `Rs ${(fr?.membershipIncome || 0).toLocaleString()}`, "green");
    statBox(doc, 14 + (bw + 3) * 2, y, bw, "Net Profit", `Rs ${(fr?.netProfit || 0).toLocaleString()}`, "blue");
    statBox(doc, 14 + (bw + 3) * 3, y, bw, "Total Expenses", `Rs ${(fr?.totalExpenses || 0).toLocaleString()}`, "red");
    y += 30;

    if (fr?.breakdown && fr.breakdown.length > 0) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Weekly Breakdown — ${mLabel}`, 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Week", "Revenue (Rs)", "Expenses (Rs)", "Net (Rs)"]],
        body: (fr.breakdown as any[]).map((r: any) => [
          r.month, `Rs ${(r.revenue || 0).toLocaleString()}`,
          `Rs ${(r.expenses || 0).toLocaleString()}`,
          `Rs ${((r.revenue || 0) - (r.expenses || 0)).toLocaleString()}`,
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255 },
        styles: { fontSize: 10 }, tableWidth: 140,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`Invoice Log — ${mLabel} (${monthBilling.length} invoices)`, 14, y); y += 4;
    if (monthBilling.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150, 150, 150);
      doc.text("No invoices found for this month.", 14, y + 6);
      doc.setTextColor(0, 0, 0);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["#", "Member Name", "Plan", "Amount (Rs)", "Due Date", "Paid Date", "Status", "Method"]],
        body: monthBilling.map((inv: any, i: number) => [
          i + 1, inv.memberName || "—",
          (inv.plan?.charAt(0).toUpperCase() + inv.plan?.slice(1)) || "—",
          `Rs ${parseInt(inv.amount || 0).toLocaleString()}`,
          inv.dueDate || "—", inv.paidDate || "—",
          (inv.status || "").toUpperCase(), inv.paymentMethod || "—",
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [253, 242, 242] },
        styles: { fontSize: 8, cellPadding: 3 },
        didParseCell: (data) => {
          if (data.column.index === 6 && data.cell.raw === "PAID") { data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.fontStyle = "bold"; }
          if (data.column.index === 6 && data.cell.raw === "UNPAID") { data.cell.styles.textColor = [227, 28, 37]; }
        },
      });
    }

    addPdfFooter(doc, gymName);
    doc.save(`${gymName.replace(/\s+/g, "_")}_Revenue_${selectedMonth}.pdf`);
    setDownloading(null);
  };

  // ── DOWNLOAD: Attendance ──────────────────────────────────────────────────
  const downloadAttendance = async () => {
    setDownloading("attendance");
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, gymName, `Attendance Report — ${mLabel}`, mLabel);

    const bw = (pw - 28 - 6) / 3;
    statBox(doc, 14, y, bw, "Total Visits", String(attendanceReport?.totalVisits || 0), "green");
    statBox(doc, 14 + bw + 3, y, bw, "Avg Daily Visits", String(attendanceReport?.avgDailyVisits || 0), "blue");
    statBox(doc, 14 + (bw + 3) * 2, y, bw, "Unique Members", String(attendanceReport?.uniqueMembers || 0), "gray");
    y += 30;

    if (attendanceReport?.peakDay) {
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Peak Day: ${attendanceReport.peakDay}  |  Month: ${mLabel}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    // Fetch detailed attendance records with member names and times
    let detailedRecords: any[] = [];
    try {
      detailedRecords = await fetch(`/api/attendance?month=${selectedMonth}`).then(r => r.json());
    } catch { detailedRecords = []; }

    if (detailedRecords.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150, 150, 150);
      doc.text("No attendance records found for this month.", 14, y + 6);
      doc.setTextColor(0, 0, 0);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["#", "Member Name", "Date", "Check In", "Check Out"]],
        body: detailedRecords.map((r: any, i: number) => [
          i + 1,
          r.memberName || "—",
          r.date || "—",
          r.checkInTime || "—",
          r.checkOutTime || "—",
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 10 },
          3: { textColor: [34, 197, 94], fontStyle: "bold" },
          4: { textColor: [100, 116, 139] },
        },
      });
    }

    addPdfFooter(doc, gymName);
    doc.save(`${gymName.replace(/\s+/g, "_")}_Attendance_${selectedMonth}.pdf`);
    setDownloading(null);
  };

  // ── DOWNLOAD: Expiring Members ────────────────────────────────────────────
  const downloadExpiring = () => {
    setDownloading("expiring");
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, gymName, `Expiring Members — ${mLabel}`, `${monthExpiring.length} members expiring`);

    const bw = (pw - 28 - 3) / 2;
    statBox(doc, 14, y, bw, `Expiring in ${mLabel}`, String(monthExpiring.length), "red");
    statBox(doc, 14 + bw + 3, y, bw, "Potential Renewal Revenue", `Rs ${(monthExpiring.length * 3000).toLocaleString()}+`, "green");
    y += 30;

    if (monthExpiring.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150, 150, 150);
      doc.text(`No members expiring in ${mLabel}.`, 14, y + 6);
      doc.setTextColor(0, 0, 0);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["#", "Member Name", "Phone", "Plan", "Expiry Date"]],
        body: monthExpiring.map((m: any, i: number) => [
          i + 1, m.name, m.phone,
          m.plan?.charAt(0).toUpperCase() + m.plan?.slice(1),
          m.planExpiryDate,
        ]),
        headStyles: { fillColor: [227, 28, 37], textColor: 255 },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        styles: { fontSize: 10 },
      });
    }

    addPdfFooter(doc, gymName);
    doc.save(`${gymName.replace(/\s+/g, "_")}_Expiring_${selectedMonth}.pdf`);
    setDownloading(null);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const membershipBreakdown = (Array.isArray(mr?.byPlan) && mr.byPlan.length > 0)
    ? mr.byPlan
    : ["monthly", "quarterly", "yearly", "weekly", "daily"].map(plan => ({
        name: plan.charAt(0).toUpperCase() + plan.slice(1),
        value: (Array.isArray(members) ? members : []).filter((m: any) => m.plan === plan).length,
      })).filter((x: any) => x.value > 0);

  const statusBreakdown = [
    { name: "Active", value: stats?.activeMembers || 0 },
    { name: "Expired", value: stats?.expiredMembers || 0 },
    { name: "Frozen", value: (Array.isArray(members) ? members : []).filter((m: any) => m.status === "frozen").length },
  ].filter(x => x.value > 0);

  const DownloadBtn = ({ label, onClick, id }: { label: string; onClick: () => void; id: string }) => (
    <Button size="sm" variant="outline" onClick={onClick} disabled={!!downloading}
      className="gap-1.5 text-primary border-primary/40 hover:bg-primary hover:text-white transition-colors">
      <Download className="h-3.5 w-3.5" />
      {downloading === id ? "Generating..." : label}
    </Button>
  );

  // month nav helpers
  const prevMonth = () => setSelectedMonth(toMonthStr(subMonths(parse(selectedMonth + "-01", "yyyy-MM-dd", new Date()), 1)));
  const nextMonth = () => {
    const next = addMonths(parse(selectedMonth + "-01", "yyyy-MM-dd", new Date()), 1);
    if (next <= new Date()) setSelectedMonth(toMonthStr(next));
  };
  const isCurrentMonth = selectedMonth === toMonthStr(new Date());

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Monthly analytics and PDF reports for {mLabel}</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-muted/40 border rounded-lg px-3 py-2 w-fit">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="month"
            value={selectedMonth}
            max={toMonthStr(new Date())}
            onChange={e => e.target.value && setSelectedMonth(e.target.value)}
            className="bg-transparent text-sm font-semibold outline-none cursor-pointer w-32 text-center"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">+{monthMembers.length} joined in {mLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue ({mLabel})</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rs {(fr?.totalRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Net: Rs {(fr?.netProfit || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance ({mLabel})</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceReport?.totalVisits || 0}</div>
            <p className="text-xs text-muted-foreground">Avg {attendanceReport?.avgDailyVisits || 0}/day · {attendanceReport?.uniqueMembers || 0} unique</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring ({mLabel})</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{monthExpiring.length}</div>
            <p className="text-xs text-muted-foreground">memberships expire this month</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><TrendingUp className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" />Members</TabsTrigger>
          <TabsTrigger value="revenue"><CreditCard className="h-4 w-4 mr-1.5" />Revenue</TabsTrigger>
          <TabsTrigger value="attendance"><Activity className="h-4 w-4 mr-1.5" />Attendance</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <DownloadBtn label="Download Overview PDF" onClick={downloadOverview} id="overview" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend (6 Months)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={Array.isArray(revenueChart) ? revenueChart : []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke={PRIMARY} strokeWidth={2.5} dot={{ fill: PRIMARY, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Membership Plan Split</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={Array.isArray(membershipBreakdown) ? membershipBreakdown : []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {(Array.isArray(membershipBreakdown) ? membershipBreakdown : []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" />Financial Summary — {mLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                  <p className="text-xl font-bold text-green-600">Rs {(fr?.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Membership Income</p>
                  <p className="text-xl font-bold">Rs {(fr?.membershipIncome || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className="text-xl font-bold text-blue-600">Rs {(fr?.netProfit || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                  <p className="text-xl font-bold text-destructive">Rs {(fr?.totalExpenses || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEMBERS ───────────────────────────────────────────────────────── */}
        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{(members || []).length} Total</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{stats?.activeMembers || 0} Active</Badge>
              <Badge variant="destructive">{stats?.expiredMembers || 0} Expired</Badge>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{monthMembers.length} Joined in {mLabel}</Badge>
              {monthExpiring.length > 0 && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">{monthExpiring.length} Expiring in {mLabel}</Badge>}
            </div>
            <div className="flex gap-2">
              <DownloadBtn label="Members PDF" onClick={downloadMembers} id="members" />
              <DownloadBtn label="Expiring PDF" onClick={downloadExpiring} id="expiring" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Members by Plan</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Array.isArray(membershipBreakdown) ? membershipBreakdown : []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PRIMARY} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={Array.isArray(statusBreakdown) ? statusBreakdown : []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}>
                      {(Array.isArray(statusBreakdown) ? statusBreakdown : []).map((_, i) => <Cell key={i} fill={i === 0 ? "#22c55e" : i === 1 ? "#E31C25" : "#3b82f6"} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Expiring in {mLabel}</CardTitle>
                <Badge variant={monthExpiring.length > 0 ? "destructive" : "outline"}>{monthExpiring.length} members</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {monthExpiring.length === 0
                ? <p className="text-muted-foreground text-sm py-4 text-center">No members expiring in {mLabel}</p>
                : (
                  <div className="divide-y">
                    {monthExpiring.slice(0, 15).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground ml-2">{m.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{m.planExpiryDate}</span>
                          <Badge variant="destructive" className="text-xs capitalize">{m.plan}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── REVENUE ──────────────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <DownloadBtn label="Download Revenue PDF" onClick={downloadRevenue} id="revenue" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Total Revenue</p><p className="text-2xl font-bold text-green-600">Rs {(fr?.totalRevenue || 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Membership Income</p><p className="text-2xl font-bold">Rs {(fr?.membershipIncome || 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Net Profit</p><p className="text-2xl font-bold text-blue-600">Rs {(fr?.netProfit || 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Expenses</p><p className="text-2xl font-bold text-destructive">Rs {(fr?.totalExpenses || 0).toLocaleString()}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Revenue Trend (6 Months)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={Array.isArray(revenueChart) ? revenueChart : []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Invoices — {mLabel}</CardTitle>
                <Badge variant="outline">{monthBilling.length} invoices</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {monthBilling.length === 0
                ? <p className="text-center text-sm text-muted-foreground py-6">No invoices found for {mLabel}</p>
                : (
                  <div className="divide-y max-h-72 overflow-y-auto">
                    {monthBilling.slice(0, 30).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div><span className="font-medium">{inv.memberName || "—"}</span><span className="text-muted-foreground ml-2 capitalize">{inv.plan}</span></div>
                        <div className="flex items-center gap-2">
                          <span>Rs {parseInt(inv.amount || 0).toLocaleString()}</span>
                          <Badge variant={inv.status === "paid" ? "default" : "destructive"} className="text-xs">{inv.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ATTENDANCE ───────────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <DownloadBtn label="Download Attendance PDF" onClick={downloadAttendance} id="attendance" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5 text-center"><div className="text-2xl font-bold text-primary">{stats?.todayAttendance || 0}</div><div className="text-sm text-muted-foreground">Today</div></CardContent></Card>
            <Card><CardContent className="pt-5 text-center"><div className="text-2xl font-bold">{attendanceReport?.totalVisits || 0}</div><div className="text-sm text-muted-foreground">Total in {mLabel}</div></CardContent></Card>
            <Card><CardContent className="pt-5 text-center"><div className="text-2xl font-bold">{attendanceReport?.avgDailyVisits || 0}</div><div className="text-sm text-muted-foreground">Daily Average</div></CardContent></Card>
            <Card><CardContent className="pt-5 text-center"><div className="text-sm font-medium">{attendanceReport?.peakDay || "—"}</div><div className="text-sm text-muted-foreground">Peak Day</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Daily Attendance — {mLabel}</CardTitle></CardHeader>
            <CardContent>
              {attendanceChart.length === 0
                ? <p className="text-center text-sm text-muted-foreground py-8">No attendance records for {mLabel}</p>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={Array.isArray(attendanceChart) ? attendanceChart : []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
