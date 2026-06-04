import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  MoreVertical,
  Search,
  Loader2,
  Ban,
  CheckCircle,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Gym {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  createdAt: string;
  subscription?: {
    tier: string;
    status: string;
  };
}

export default function SuperAdminGyms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "activate" | null>(null);

  const { data: gyms, isLoading } = useQuery<Gym[]>({
    queryKey: ["super-admin-gyms", searchQuery],
    queryFn: async () => {
      const token = localStorage.getItem("gym_access_token");
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/super-admin/gyms?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch gyms");
      const data = await res.json();
      return data.data.gyms;
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (gymId: string) => {
      const token = localStorage.getItem("gym_access_token");
      const res = await fetch(`/api/super-admin/gyms/${gymId}/suspend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to suspend gym");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-gyms"] });
      toast({
        title: "Gym suspended",
        description: "The gym has been suspended successfully.",
      });
      setSelectedGym(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to suspend gym",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (gymId: string) => {
      const token = localStorage.getItem("gym_access_token");
      const res = await fetch(`/api/super-admin/gyms/${gymId}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to activate gym");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-gyms"] });
      toast({
        title: "Gym activated",
        description: "The gym has been activated successfully.",
      });
      setSelectedGym(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to activate gym",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = () => {
    if (!selectedGym) return;
    if (actionType === "suspend") {
      suspendMutation.mutate(selectedGym.id);
    } else if (actionType === "activate") {
      activateMutation.mutate(selectedGym.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gym Management</h1>
        <p className="text-muted-foreground">
          Manage all registered gyms on the platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Gyms ({gyms?.length || 0})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search gyms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : gyms?.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No gyms found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gyms?.map((gym) => (
                  <TableRow key={gym.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{gym.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gym.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{gym.email}</p>
                        <p className="text-muted-foreground">{gym.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {gym.subscription ? (
                        <div>
                          <Badge variant="outline">
                            {gym.subscription.tier}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {gym.subscription.status}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary">No subscription</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          gym.status === "active"
                            ? "default"
                            : gym.status === "suspended"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {gym.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(gym.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {gym.status === "active" ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedGym(gym);
                                setActionType("suspend");
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Suspend Gym
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedGym(gym);
                                setActionType("activate");
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activate Gym
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!selectedGym && !!actionType}
        onOpenChange={() => {
          setSelectedGym(null);
          setActionType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "suspend" ? "Suspend Gym" : "Activate Gym"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "suspend"
                ? `Are you sure you want to suspend "${selectedGym?.name}"? This will prevent them from accessing the platform.`
                : `Are you sure you want to activate "${selectedGym?.name}"? This will restore their access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={
                actionType === "suspend"
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {actionType === "suspend" ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
