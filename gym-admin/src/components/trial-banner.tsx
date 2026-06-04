import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface TrialStatus {
  status: string;
  tier: string;
  daysRemaining: number;
  expiresAt: string;
}

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [, setLocation] = useLocation();

  const { data } = useQuery<{ success: boolean } & TrialStatus>({
    queryKey: ["trial-status"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return null;

      const response = await fetch("/api/onboarding/trial-status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Don't show banner if:
  // - No data
  // - Not on trial
  // - User dismissed it
  // - Already on paid subscription
  if (!data || data.status !== "trial" || dismissed) {
    return null;
  }

  const { daysRemaining, expiresAt } = data;
  const isUrgent = daysRemaining <= 3;

  // Don't show if trial already expired
  if (daysRemaining <= 0) {
    return null;
  }

  return (
    <Alert
      className={`mb-4 ${
        isUrgent
          ? "border-destructive bg-destructive/10"
          : "border-orange-500 bg-orange-50 dark:bg-orange-950"
      }`}
    >
      <div className="flex items-start gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
        )}

        <div className="flex-1">
          <AlertDescription className="text-sm">
            <span className="font-semibold">
              {daysRemaining === 1
                ? "Last day of your trial!"
                : `${daysRemaining} days left in your trial`}
            </span>
            <span className="text-muted-foreground ml-2">
              Your trial expires on{" "}
              {new Date(expiresAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              . Upgrade now to continue using all features.
            </span>
          </AlertDescription>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => setLocation("/subscription")}
              className={isUrgent ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Upgrade Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
