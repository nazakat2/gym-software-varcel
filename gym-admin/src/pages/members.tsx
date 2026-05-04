import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListMembers, useDeleteMember } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Edit, Eye } from "lucide-react";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function Members() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: members, isLoading, refetch } = useListMembers();
  const deleteMember = useDeleteMember();

  const filteredMembers = (Array.isArray(members) ? members : []).filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.cnic.includes(search)
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMember.mutateAsync({ id: deleteId });
      toast({ title: "Member deleted successfully" });
      refetch();
    } catch (error) {
      toast({ title: "Failed to delete member", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <Button onClick={() => setLocation("/members/new")}>
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, phone or CNIC..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>CNIC</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredMembers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.cnic}</TableCell>
                  <TableCell>{(member as any).address || "—"}</TableCell>
                  <TableCell className="capitalize">{member.plan}</TableCell>
                  <TableCell>
                    {format(new Date(member.planExpiryDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === "active" ? "default" : "destructive"}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/members/${member.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(member.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Member"
        description="Are you sure you want to delete this member? All their data will be permanently removed."
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
