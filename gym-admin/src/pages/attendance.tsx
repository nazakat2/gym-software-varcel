import { useState } from "react";
import { useListAttendance, useCheckIn, useGetTodayAttendanceStats, useListMembers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, Users, UserCheck, Search, LogIn } from "lucide-react";
import { format } from "date-fns";

export default function Attendance() {
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const { toast } = useToast();
  const { data: attendanceList, isLoading, refetch } = useListAttendance();
  const { data: stats } = useGetTodayAttendanceStats();
  const { data: members } = useListMembers();
  const checkIn = useCheckIn();

  const filtered = (attendanceList || []).filter((a) =>
    a.memberName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckIn = async () => {
    if (!selectedMemberId) {
      toast({ title: "Please select a member", variant: "destructive" });
      return;
    }
    try {
      await checkIn.mutateAsync({ data: { memberId: parseInt(selectedMemberId) } });
      toast({ title: "Member checked in successfully" });
      setSelectedMemberId("");
      refetch();
    } catch {
      toast({ title: "Failed to check in member", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Check-ins</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Members visited today</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Present</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.present ?? 0}</div>
            <p className="text-xs text-muted-foreground">Members in gym right now</p>
          </CardContent>
        </Card>
        <Card className="glass glass-dark border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.peakHour ?? "—"}</div>
            <p className="text-xs text-muted-foreground">Most active time today</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass glass-dark border-primary/10">
        <CardHeader>
          <CardTitle>Manual Check-In</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select member to check in..." />
              </SelectTrigger>
              <SelectContent>
                {(members || []).filter(m => m.status === "active").map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} — {m.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCheckIn} disabled={checkIn.isPending}>
              <LogIn className="mr-2 h-4 w-4" />
              Check In
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass glass-dark border-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Attendance Log</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search member..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                  <TableHead>Check-In Time</TableHead>
                  <TableHead>Check-Out Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.memberName}</TableCell>
                      <TableCell>{a.date}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.checkInTime || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {a.checkOutTime ? (
                          <Badge variant="outline">{a.checkOutTime}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Still in</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
