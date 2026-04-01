import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { normalizeCollection } from "@/lib/normalize-collection";
import { Loader2, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
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

function formatInspectionTypes(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {
      // fall through
    }
    return value;
  }
  return "";
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

export default function AdminReports() {
  const [, navigate] = useLocation();
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [dailyStatusFilter, setDailyStatusFilter] = useState("all");
  const [concreteSearchTerm, setConcreteSearchTerm] = useState("");
  const [concreteStatusFilter, setConcreteStatusFilter] = useState("all");

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

  const { items: allDailyReports, issue: dailyReportsIssue } = normalizeCollection<any>(
    dailyReportsQuery.data,
    "daily report"
  );
  const { items: allConcreteTests, issue: concreteTestsIssue } = normalizeCollection<any>(
    concreteTestsQuery.data,
    "concrete test"
  );

  // Filter daily reports
  const filteredDailyReports = allDailyReports.filter((report: any) => {
    const matchesSearch =
      safeLower(report.projectName).includes(dailySearchTerm.toLowerCase()) ||
      safeLower(report.jobNo).includes(dailySearchTerm.toLowerCase()) ||
      safeLower(report.permitNo).includes(dailySearchTerm.toLowerCase()) ||
      safeLower(report.client).includes(dailySearchTerm.toLowerCase());

    const matchesStatus =
      dailyStatusFilter === "all" || report.status === dailyStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filter concrete tests
  const filteredConcreteTests = allConcreteTests.filter((test: any) => {
    const matchesSearch =
      safeLower(test.projectName).includes(concreteSearchTerm.toLowerCase()) ||
      safeLower(test.permitNo).includes(concreteSearchTerm.toLowerCase()) ||
      safeLower(test.fileNo).includes(concreteSearchTerm.toLowerCase()) ||
      safeLower(test.contractor).includes(concreteSearchTerm.toLowerCase());

    const matchesStatus =
      concreteStatusFilter === "all" || test.status === concreteStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {(dailyReportsIssue || concreteTestsIssue) && (
        <Alert>
          <AlertDescription>
            {dailyReportsIssue || concreteTestsIssue}
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-3xl font-bold">All Reports</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage all submitted forms from employees
        </p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">
            Daily Field Reports ({allDailyReports.length})
          </TabsTrigger>
          <TabsTrigger value="concrete">
            Concrete Tests ({allConcreteTests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by project, job, permit, or client..."
              value={dailySearchTerm}
              onChange={(e) => setDailySearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={dailyStatusFilter} onValueChange={setDailyStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredDailyReports.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No daily field reports found
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDailyReports.map((report: any) => (
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
                          <span className="font-medium">Inspection Types:</span>{" "}
                          {formatInspectionTypes(report.inspectionTypes)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Employee:</span> {report.employeeName || "Unknown"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/edit-daily/${report.id}`)}
                      >
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concrete" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by project, permit, file, or contractor..."
              value={concreteSearchTerm}
              onChange={(e) => setConcreteSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={concreteStatusFilter} onValueChange={setConcreteStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredConcreteTests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No concrete test data found
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredConcreteTests.map((test: any) => (
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
                            <span className="font-medium">Mix Design:</span> {test.mixDesignNo}
                          </div>
                          <div>
                            <span className="font-medium">Specified:</span> {test.specifiedStrength} PSI
                          </div>
                          <div>
                            <span className="font-medium">Average:</span> {test.averageStrength} PSI
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Employee:</span> {test.employeeName || "Unknown"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/edit-concrete/${test.id}`)}
                      >
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
