import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { normalizeCollection } from "@/lib/normalize-collection";
import { Loader2, FileText, Eye, Edit2, Download } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

function safeFormatDate(value: unknown, fallback = "N/A") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, "MMM dd, yyyy");
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return <Badge className={config.className}>{config.label}</Badge>;
}

export default function MySubmissions() {
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [, navigate] = useLocation();

  const dailyReportsQuery = trpc.dailyReport.getUserReports.useQuery();
  const concreteTestsQuery = trpc.concreteTest.getUserTests.useQuery();
  const downloadDailyPDF = trpc.dailyReport.downloadPDF.useMutation();
  const downloadConcretePDF = trpc.concreteTest.downloadPDF.useMutation();

  const isLoading = dailyReportsQuery.isLoading || concreteTestsQuery.isLoading;

  const handleDownloadDailyPDF = async (reportId: number) => {
    try {
      const result = await downloadDailyPDF.mutateAsync(reportId);
      const binaryString = atob(result.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert("PDF downloaded successfully");
    } catch (error) {
      alert("Failed to download PDF");
    }
  };

  const handleDownloadConcretePDF = async (testId: number) => {
    try {
      const result = await downloadConcretePDF.mutateAsync(testId);
      const binaryString = atob(result.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert("PDF downloaded successfully");
    } catch (error) {
      alert("Failed to download PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { items: dailyReports, issue: dailyReportsIssue } = normalizeCollection<any>(
    dailyReportsQuery.data,
    "daily submission"
  );
  const { items: concreteTests, issue: concreteTestsIssue } = normalizeCollection<any>(
    concreteTestsQuery.data,
    "concrete submission"
  );

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
        <h1 className="text-3xl font-bold">My Submissions</h1>
        <p className="text-muted-foreground mt-2">
          View and track all your submitted forms and their approval status
        </p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">
            Daily Field Reports ({dailyReports.length})
          </TabsTrigger>
          <TabsTrigger value="concrete">
            Concrete Tests ({concreteTests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          {dailyReports.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No daily field reports submitted yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dailyReports.map((report: any) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">{report.projectName}</h3>
                          <StatusBadge status={report.status} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Job No:</span> {report.jobNo}
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
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/edit-daily/${report.id}`)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDailyPDF(report.id)}
                          disabled={downloadDailyPDF.isPending}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concrete" className="space-y-4">
          {concreteTests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No concrete test data submitted yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {concreteTests.map((test: any) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">{test.projectName}</h3>
                          <StatusBadge status={test.status} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Permit:</span> {test.permitNo}
                          </div>
                          <div>
                            <span className="font-medium">File No:</span> {test.fileNo}
                          </div>
                          <div>
                            <span className="font-medium">Contractor:</span> {test.contractor}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{" "}
                            {safeFormatDate(test.dateSampled)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Mix Design:</span> {test.mixDesignNo}
                          </div>
                          <div>
                            <span className="font-medium">Specified Strength:</span>{" "}
                            {test.specifiedStrength} PSI
                          </div>
                          <div>
                            <span className="font-medium">Avg Strength:</span>{" "}
                            {test.averageStrength} PSI
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/edit-concrete/${test.id}`)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadConcretePDF(test.id)}
                          disabled={downloadConcretePDF.isPending}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
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
