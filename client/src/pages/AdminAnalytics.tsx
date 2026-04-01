import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { trpc } from "@/lib/trpc";
import { normalizeCollection } from "@/lib/normalize-collection";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status,
      groupBy,
    }),
    [dateFrom, dateTo, status, groupBy]
  );

  const { data, isLoading } = trpc.analytics.getDashboardData.useQuery(filters, {
    enabled: user?.role === "admin",
  });

  const dailyStats = data?.dailyStats ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
  const concreteStats = data?.concreteStats ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
  const { items: strengthByProject, issue: strengthIssue } = normalizeCollection<any>(
    data?.strengthByProject,
    "strength analytics"
  );
  const { items: dailyTrend, issue: dailyTrendIssue } = normalizeCollection<any>(
    data?.dailyTrend,
    "daily trend analytics"
  );
  const { items: concreteTrend, issue: concreteTrendIssue } = normalizeCollection<any>(
    data?.concreteTrend,
    "concrete trend analytics"
  );
  const { items: inspectorStats, issue: inspectorStatsIssue } = normalizeCollection<any>(
    data?.inspectorStats,
    "inspector analytics"
  );

  const totalDailyReports = dailyStats.total;
  const totalConcreteTests = concreteStats.total;
  const totalSubmissions = totalDailyReports + totalConcreteTests;
  const approvedSubmissions = dailyStats.approved + concreteStats.approved;
  const pendingSubmissions = dailyStats.pending + concreteStats.pending;
  const rejectedSubmissions = dailyStats.rejected + concreteStats.rejected;
  const approvalRate = totalSubmissions > 0 ? Math.round((approvedSubmissions / totalSubmissions) * 100) : 0;

  const statusData = [
    { name: "Approved", value: approvedSubmissions },
    { name: "Pending", value: pendingSubmissions },
    { name: "Rejected", value: rejectedSubmissions },
  ].filter((item) => item.value > 0);

  const combinedTrend = useMemo(() => {
    const map = new Map<string, { date: string; daily: number; concrete: number; total: number }>();

    for (const item of dailyTrend) {
      map.set(item.date, {
        date: item.date,
        daily: item.count,
        concrete: map.get(item.date)?.concrete ?? 0,
        total: item.count + (map.get(item.date)?.concrete ?? 0),
      });
    }

    for (const item of concreteTrend) {
      const existing = map.get(item.date) ?? { date: item.date, daily: 0, concrete: 0, total: 0 };
      existing.concrete = item.count;
      existing.total = existing.daily + existing.concrete;
      map.set(item.date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyTrend, concreteTrend]);

  if (!authLoading && user?.role !== "admin") {
    return <div>Access denied</div>;
  }

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {(strengthIssue || dailyTrendIssue || concreteTrendIssue || inspectorStatsIssue) && (
          <Alert>
            <AlertDescription>
              {strengthIssue || dailyTrendIssue || concreteTrendIssue || inspectorStatsIssue}
            </AlertDescription>
          </Alert>
        )}

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Accurate submission counts, trends, and approval metrics</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-gray-600 font-medium">Total Submissions</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalSubmissions}</p>
            <p className="text-xs text-gray-500 mt-1">{totalDailyReports} daily, {totalConcreteTests} concrete</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600 font-medium">Approval Rate</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{approvalRate}%</p>
            <p className="text-xs text-gray-500 mt-1">{approvedSubmissions} approved</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600 font-medium">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingSubmissions}</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-gray-600 font-medium">Avg Concrete Strength</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {strengthByProject.length > 0
                ? Math.round(strengthByProject.reduce((sum, project) => sum + project.avgStrength, 0) / strengthByProject.length)
                : 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">PSI</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="daily" stroke="#3b82f6" name="Daily Reports" />
                <Line type="monotone" dataKey="concrete" stroke="#10b981" name="Concrete Tests" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {strengthByProject.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Average Concrete Strength by Project</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={strengthByProject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="projectName" angle={-35} textAnchor="end" height={90} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgStrength" fill="#3b82f6" name="Average Strength (PSI)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {inspectorStats.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inspector Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Inspector</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Submissions</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Approval Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectorStats.map((inspector) => (
                    <tr key={inspector.inspectorName} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{inspector.inspectorName}</td>
                      <td className="text-right py-3 px-4 text-gray-600">{inspector.submissionCount}</td>
                      <td className="text-right py-3 px-4">
                        <span
                          className={`font-semibold ${
                            inspector.approvalRate >= 80
                              ? "text-green-600"
                              : inspector.approvalRate >= 60
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {inspector.approvalRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
