import { useListAdminNotifications, useMarkAdminNotificationRead } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, AlertCircle, Package, CreditCard, UserPlus } from "lucide-react";
import { format } from "date-fns";

function NotifIcon({ type }: { type: string }) {
  if (type === "low_stock") return <Package className="h-5 w-5 text-orange-500" />;
  if (type === "payment_reminder") return <CreditCard className="h-5 w-5 text-yellow-500" />;
  if (type === "new_member") return <UserPlus className="h-5 w-5 text-green-500" />;
  return <AlertCircle className="h-5 w-5 text-destructive" />;
}

export default function Notifications() {
  const { toast } = useToast();
  const { data: notifications, refetch } = useListAdminNotifications();
  const markRead = useMarkAdminNotificationRead();

  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const handleMarkRead = async (id: number) => {
    try {
      await markRead.mutateAsync({ id });
      refetch();
    } catch {
      toast({ title: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    const unread = (notifications || []).filter(n => !n.read);
    for (const n of unread) {
      try { await markRead.mutateAsync({ id: n.id }); } catch {}
    }
    refetch();
    toast({ title: "All notifications marked as read" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount} new</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {(notifications || []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p>No notifications</p>
            </CardContent>
          </Card>
        ) : (
          (notifications || []).map((n) => (
            <Card key={n.id} className={!n.read ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="mt-0.5">
                  <NotifIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {!n.read && <Badge variant="default" className="text-xs">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  {n.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(n.createdAt), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n.id)}>
                    Mark Read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
