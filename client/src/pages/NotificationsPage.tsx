import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { normalizeCollection } from "@/lib/normalize-collection";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

function formatNotificationDate(value: unknown) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM dd, yyyy h:mm a");
}

function categoryLabel(category: string) {
  switch (category) {
    case "submission":
      return "Submission";
    case "approval":
      return "Approved";
    case "rejection":
      return "Rejected";
    default:
      return "System";
  }
}

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const notificationsQuery = trpc.notifications.listMine.useQuery();
  const unreadCountQuery = trpc.notifications.unreadCount.useQuery();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.listMine.invalidate();
      await utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.listMine.invalidate();
      await utils.notifications.unreadCount.invalidate();
    },
  });

  if (notificationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { items: notifications, issue: notificationsIssue } = normalizeCollection<any>(
    notificationsQuery.data,
    "notification"
  );
  const unreadCount = unreadCountQuery.data?.count ?? 0;

  return (
    <div className="space-y-6">
      {notificationsIssue && (
        <Alert>
          <AlertDescription>{notificationsIssue}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Review approval updates and submission alerts from the system.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending || unreadCount === 0}
        >
          Mark All Read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {unreadCount > 0 ? `${unreadCount} unread notification(s)` : "All caught up"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-3">
                {notifications.map((notification: any) => {
                  const unread = !notification.readAt;
                  return (
                    <Card key={notification.id} className={unread ? "border-primary/40" : ""}>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={unread ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}>
                              {unread ? "Unread" : "Read"}
                            </Badge>
                            <Badge variant="outline">{categoryLabel(notification.category)}</Badge>
                            {notification.sourceFormType && (
                              <Badge variant="outline">
                                {notification.sourceFormType === "daily" ? "Daily Report" : "Concrete Test"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatNotificationDate(notification.createdAt)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{notification.title}</h3>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                            {notification.content}
                          </p>
                        </div>
                        {unread && (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markReadMutation.mutate({ id: notification.id })}
                              disabled={markReadMutation.isPending}
                            >
                              Mark Read
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
