import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { DAILY_REQUIRED_INSPECTION_TYPES } from "@shared/inspection-types";

const weatherOptions = [
  "Sunny", "Cloudy", "Rainy", "Snowy", "Windy", "Foggy", "Partly Cloudy",
];

const inspectionTypes: string[] = DAILY_REQUIRED_INSPECTION_TYPES;

const schema = z.object({
  jobNo: z.string().min(1, "Job number is required"),
  permitNo: z.string().min(1, "Permit number is required"),
  projectName: z.string().min(1, "Project name is required"),
  client: z.string().min(1, "Client name is required"),
  location: z.string().min(1, "Location is required"),
  contractor: z.string().min(1, "Contractor is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  weather: z.string().optional(),
  inspectionTypes: z.array(z.string()).min(1, "Select at least one inspection type"),
  workConformance: z.enum(["met", "not_met"]),
  workRequirements: z.enum(["met", "not_met"]),
  materialSampling: z.enum(["performed", "not_performed"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditDailyFieldReport() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const formId = parseInt(id || "0");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [customInspectionTypeOptions, setCustomInspectionTypeOptions] = useState<string[]>([]);
  const [customInspectionTypeInput, setCustomInspectionTypeInput] = useState("");

  const { data: report, isLoading } = trpc.dailyReport.getById.useQuery(formId);
  const editMutation = trpc.dailyReport.edit.useMutation();
  const downloadDailyPDF = trpc.dailyReport.downloadPDF.useMutation();



  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      jobNo: "", permitNo: "", projectName: "", client: "",
      location: "", contractor: "",
      date: "", time: "", weather: "",
      inspectionTypes: [],
      workConformance: "met",
      workRequirements: "met",
      materialSampling: "performed",
      notes: "",
    },
  });

  // Populate form once data loads — this is the fix for the blank form bug
  useEffect(() => {
    if (!report) return;
    const dateStr = report.date
      ? (typeof report.date === "string"
          ? report.date.slice(0, 10)
          : new Date(report.date).toISOString().slice(0, 10))
      : "";
    const selectedFromReport = (report.inspectionTypes as string[]) ?? [];
    const additional = Array.from(new Set(selectedFromReport.filter((t) => !inspectionTypes.includes(t))));
    setCustomInspectionTypeOptions(additional);
    setCustomInspectionTypeInput("");

    form.reset({
      jobNo: report.jobNo ?? "",
      permitNo: report.permitNo ?? "",
      projectName: report.projectName ?? "",
      client: report.client ?? "",
      location: report.location ?? "",
      contractor: report.contractor ?? "",
      date: dateStr,
      time: report.time ?? "",
      weather: report.weather ?? "",
      inspectionTypes: selectedFromReport,
      workConformance: report.workConformance ?? "met",
      workRequirements: report.workRequirements ?? report.workConformance ?? "met",
      materialSampling: report.materialSampling ?? "performed",
      notes: report.notes ?? "",
    });
  }, [report]);

  const selectedTypes = form.watch("inspectionTypes");
  const allInspectionTypeOptions = [...inspectionTypes, ...customInspectionTypeOptions];

  const toggleType = (t: string) => {
    const current = form.getValues("inspectionTypes");
    const updated = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    form.setValue("inspectionTypes", updated, { shouldValidate: form.formState.isSubmitted });
  };

  const addCustomInspectionTypes = () => {
    const raw = customInspectionTypeInput.trim();
    if (!raw) return;

    const parts = raw
      .split(/[,\\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!parts.length) return;

    const uniqueParts = Array.from(new Set(parts));
    const toAddCustomOptions = uniqueParts.filter((t) => !inspectionTypes.includes(t));

    if (toAddCustomOptions.length) {
      setCustomInspectionTypeOptions((prev) => Array.from(new Set([...prev, ...toAddCustomOptions])));
    }

    const current = form.getValues("inspectionTypes");
    const updatedSelected = Array.from(new Set([...current, ...uniqueParts]));
    form.setValue("inspectionTypes", updatedSelected, { shouldValidate: form.formState.isSubmitted });

    setCustomInspectionTypeInput("");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await editMutation.mutateAsync({
        id: formId,
        ...values,
        time: values.time || null,
        weather: values.weather || null,
      });
      toast.success("Report updated successfully!");
      setLocation(isAdmin ? "/admin/approvals" : "/employee/submissions");
    } catch (error: any) {
      const message =
        error?.data?.code === "UNAUTHORIZED"
          ? "Your session expired. Please sign in again and retry."
          : error?.message || "Failed to update report";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <Card><CardContent className="pt-6"><p>Report not found.</p></CardContent></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit Daily Field Report</CardTitle>
            <CardDescription>Update your field inspection report</CardDescription>
          </CardHeader>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">

            {/* ── SECTION 1 · JOB INFORMATION ─────────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="jobNo" render={({ field }) => (
                    <FormItem><FormLabel>Job No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="permitNo" render={({ field }) => (
                    <FormItem><FormLabel>Permit No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="projectName" render={({ field }) => (
                    <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="client" render={({ field }) => (
                    <FormItem><FormLabel>Client</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contractor" render={({ field }) => (
                  <FormItem><FormLabel>Contractor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ── SECTION 2 · DATE, TIME & WEATHER ────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Date, Time & Weather</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="weather" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weather</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {weatherOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* ── SECTION 3 · TYPE OF INSPECTION ──────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-lg font-semibold">Type of Inspection</h3>
                <p className="text-sm text-muted-foreground">Select all applicable inspection types</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {allInspectionTypeOptions.map((type) => (
                    <FormItem key={type} className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          id={`edit-${type}`}
                          checked={selectedTypes.includes(type)}
                          onCheckedChange={() => toggleType(type)}
                        />
                      </FormControl>
                      <FormLabel htmlFor={`edit-${type}`} className="font-normal cursor-pointer">{type}</FormLabel>
                    </FormItem>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Add additional inspection types (optional, comma-separated)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={customInspectionTypeInput}
                      onChange={(e) => setCustomInspectionTypeInput(e.target.value)}
                      placeholder="e.g., EIFS, Crack Monitoring"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={addCustomInspectionTypes}>
                      Add
                    </Button>
                  </div>
                </div>
                {form.formState.isSubmitted && form.formState.errors.inspectionTypes && (
                  <p className="text-sm text-red-500">{form.formState.errors.inspectionTypes.message}</p>
                )}
              </CardContent>
            </Card>

            {/* ── SECTION 4 · CONFORMANCE ──────────────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Conformance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-1/2">Statement</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                      <td className="border border-gray-300 px-3 py-2 bg-gray-50">
                        <p className="font-medium">The Work WAS / WAS NOT in conformance.</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          The work subject to inspection, to the best of the inspection’s knowledge, conforms to the approved plans, specifications, and code required workmanship.
                        </p>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        <FormField control={form.control} name="workConformance" render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="met">WAS in conformance</SelectItem>
                                <SelectItem value="not_met">WAS NOT in conformance</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </td>
                      </tr>
                      <tr>
                      <td className="border border-gray-300 px-3 py-2 bg-gray-50">
                        <p className="font-medium">The Work Inspected MET / DID NOT MEET requirements.</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Based on the inspection findings for the work inspected during this report.
                        </p>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        <FormField control={form.control} name="workRequirements" render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="met">MET requirements</SelectItem>
                                <SelectItem value="not_met">DID NOT MEET requirements</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 bg-gray-50">
                        <p className="font-medium">Material Sampling WAS / WAS NOT performed.</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Performed in accordance with approved documents.
                        </p>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        <FormField control={form.control} name="materialSampling" render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="performed">WAS performed</SelectItem>
                                <SelectItem value="not_performed">WAS NOT performed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── SECTION 5 · NOTES ────────────────────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Notes</h3>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormControl><Textarea placeholder="Enter any observations or comments..." className="min-h-24" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ── SECTION 6 · ATTACHMENTS ─────────────────────────────── */}
            <Card>
              <CardContent className="pt-6">
                <AttachmentGallery formType="daily" formId={formId} />
              </CardContent>
            </Card>

            </div>

            {/* ── ACTIONS ──────────────────────────────────────────────── */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation(isAdmin ? "/admin/reports" : "/employee/submissions")}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={downloadDailyPDF.isPending}
                onClick={async () => {
                  try {
                    const result = await downloadDailyPDF.mutateAsync(formId);
                    const binaryString = atob(result.pdf);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/pdf" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch {
                    toast.error("Failed to download PDF");
                  }
                }}
              >
                Download PDF
              </Button>
              <Button type="submit" disabled={editMutation.isPending} className="flex-1">
                {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isAdmin ? "Update Report (Admin)" : "Update Report"}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
