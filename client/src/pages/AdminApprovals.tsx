import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, CheckCircle, XCircle, Clock, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Approved", icon: CheckCircle, className: "bg-green-100 text-green-800" },
    rejected: { label: "Rejected", icon: XCircle, className: "bg-red-100 text-red-800" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function safeLower(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function safeFormatDate(value: unknown) {
  if (!value) return "N/A";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM dd, yyyy");
}

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formType: "daily" | "concrete";
  formId: number;
  formTitle: string;
  employeeName: string;
  onApprovalComplete: () => void;
}

function ApprovalDialog({
  open,
  onOpenChange,
  formType,
  formId,
  formTitle,
  employeeName,
  onApprovalComplete,
}: ApprovalDialogProps) {
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [comments, setComments] = useState("");
  const approveDailyMutation = trpc.approval.approveDailyReport.useMutation();
  const approveTestMutation = trpc.approval.approveConcreteTest.useMutation();

  const handleSubmit = async () => {
    try {
      if (formType === "daily") {
        await approveDailyMutation.mutateAsync({
          reportId: formId,
          decision,
          comments: comments || undefined,
        });
      } else {
        await approveTestMutation.mutateAsync({
          testId: formId,
          decision,
          comments: comments || undefined,
        });
      }

      toast.success(`Form ${decision} successfully!`);
      onOpenChange(false);
      setComments("");
      setDecision("approved");
      onApprovalComplete();
    } catch (error: any) {
      toast.error(error.message || "Failed to process approval");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review & Approve Form</DialogTitle>
          <DialogDescription>{formTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Form ID: {formId}</p>
            <p className="text-sm text-muted-foreground">Type: {formType === "daily" ? "Daily Field Report" : "Concrete Test"}</p>
            <p className="text-sm text-muted-foreground">Employee: {employeeName || "Unknown"}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Decision</label>
            <div className="flex gap-4">
              <Button
                variant={decision === "approved" ? "default" : "outline"}
                onClick={() => setDecision("approved")}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant={decision === "rejected" ? "destructive" : "outline"}
                onClick={() => setDecision("rejected")}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comments (Optional)</label>
            <Textarea
              placeholder="Add any comments or feedback..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
      <Button
        onClick={handleSubmit}
        disabled={formType === "daily" ? approveDailyMutation.isPending : approveTestMutation.isPending}
        variant={decision === "approved" ? "default" : "destructive"}
      >
        {(formType === "daily" ? approveDailyMutation.isPending : approveTestMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {decision === "approved" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminApprovals() {
  const [, navigate] = useLocation();
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [concreteSearchTerm, setConcreteSearchTerm] = useState("");
  const [selectedForm, setSelectedForm] = useState<{
    type: "daily" | "concrete";
    id: number;
    title: string;
    employeeName: string;
  } | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  const dailyReportsQuery = trpc.dailyReport.getAllReports.useQuery();
  const concreteTestsQuery = trpc.concreteTest.getAllTests.useQuery();
  const isLoading = dailyReportsQuery.isLoading || concreteTestsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allDailyReports = dailyReportsQuery.data || [];
  const allConcreteTests = concreteTestsQuery.data || [];

  // Filter pending items
  const pendingDailyReports = allDailyReports.filter(
    (report: any) =>
      report.status === "pending" &&
      (safeLower(report.projectName).includes(dailySearchTerm.toLowerCase()) ||
        safeLower(report.jobNo).includes(dailySearchTerm.toLowerCase()))
  );

  const pendingConcreteTests = allConcreteTests.filter(
    (test: any) =>
      test.status === "pending" &&
      (safeLower(test.projectName).includes(concreteSearchTerm.toLowerCase()) ||
        safeLower(test.permitNo).includes(concreteSearchTerm.toLowerCase()))
  );

  const handleOpenApprovalDialog = (
    type: "daily" | "concrete",
    id: number,
    title: string,
    employeeName: string
  ) => {
    setSelectedForm({ type, id, title, employeeName });
    setApprovalDialogOpen(true);
  };

  const handleApprovalComplete = () => {
    dailyReportsQuery.refetch();
    concreteTestsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve pending forms from employees
        </p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">
            Daily Reports ({pendingDailyReports.length})
          </TabsTrigger>
          <TabsTrigger value="concrete">
            Concrete Tests ({pendingConcreteTests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Input
            placeholder="Search by project or job number..."
            value={dailySearchTerm}
            onChange={(e) => setDailySearchTerm(e.target.value)}
          />

          {pendingDailyReports.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No pending daily field reports
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingDailyReports.map((report: any) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">{report.projectName}</h3>
                          <StatusBadge status={report.status} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Job:</span> {report.jobNo}
                          </div>
                          <div>
                            <span className="font-medium">Permit:</span> {report.permitNo}
                          </div>
                          <div>
                            <span className="font-medium">Client:</span> {report.client}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{" "}
                            {safeFormatDate(report.date)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Location:</span> {report.location}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Employee:</span> {report.employeeName || "Unknown"}
                        </div>
                      </div>
                      <Button
                        onClick={() =>
                          handleOpenApprovalDialog("daily", report.id, report.projectName, report.employeeName || "Unknown")
                        }
                      >
                        Review
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/edit-daily/${report.id}`)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concrete" className="space-y-4">
          <Input
            placeholder="Search by project or permit number..."
            value={concreteSearchTerm}
            onChange={(e) => setConcreteSearchTerm(e.target.value)}
          />

          {pendingConcreteTests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No pending concrete test data
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingConcreteTests.map((test: any) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">{test.projectName}</h3>
                          <StatusBadge status={test.status} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Permit:</span> {test.permitNo}
                          </div>
                          <div>
                            <span className="font-medium">File:</span> {test.fileNo}
                          </div>
                          <div>
                            <span className="font-medium">Contractor:</span> {test.contractor}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{" "}
                            {safeFormatDate(test.dateSampled ?? test.sampleDate)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Avg Strength:</span> {test.averageStrength} PSI
                          </div>
                          <div>
                            <span className="font-medium">Specified:</span> {test.specifiedStrength} PSI
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Employee:</span> {test.employeeName || "Unknown"}
                        </div>
                      </div>
                      <Button
                        onClick={() =>
                          handleOpenApprovalDialog("concrete", test.id, test.projectName, test.employeeName || "Unknown")
                        }
                      >
                        Review
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/edit-concrete/${test.id}`)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedForm && (
        <ApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          formType={selectedForm.type}
          formId={selectedForm.id}
          formTitle={selectedForm.title}
          employeeName={selectedForm.employeeName}
          onApprovalComplete={handleApprovalComplete}
        />
      )}
    </div>
  );
}
