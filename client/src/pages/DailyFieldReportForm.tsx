import { useState, useRef } from "react";
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
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { AttachmentGallery, uploadStagedFiles } from "@/components/AttachmentGallery";
import { DAILY_REQUIRED_INSPECTION_TYPES } from "@shared/inspection-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const weatherOptions = [
  "Sunny", "Cloudy", "Rainy", "Snowy", "Windy", "Foggy", "Partly Cloudy",
];

const inspectionTypes: string[] = DAILY_REQUIRED_INSPECTION_TYPES;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // Job Information
  jobNo: z.string().min(1, "Job number is required"),
  permitNo: z.string().min(1, "Permit number is required"),
  projectName: z.string().min(1, "Project name is required"),
  client: z.string().min(1, "Client name is required"),
  location: z.string().min(1, "Location is required"),
  contractor: z.string().min(1, "Contractor is required"),

  // Date & Time
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  weather: z.string().optional(),

  // Inspection Types
  inspectionTypes: z.array(z.string()).min(1, "Select at least one inspection type"),

  // Conformance
  workConformance: z.enum(["met", "not_met"]),
  workRequirements: z.enum(["met", "not_met"]),
  materialSampling: z.enum(["performed", "not_performed"]),

  // Notes
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyFieldReportForm() {
  const [formId, setFormId] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [customInspectionTypeOptions, setCustomInspectionTypeOptions] = useState<string[]>([]);
  const [customInspectionTypeInput, setCustomInspectionTypeInput] = useState("");
  const createMutation = trpc.dailyReport.create.useMutation();
  const uploadMutation = trpc.attachment.uploadAttachment.useMutation();

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

    // Ensure whatever the employee typed is also marked as selected.
    const current = form.getValues("inspectionTypes");
    const updatedSelected = Array.from(new Set([...current, ...uniqueParts]));
    form.setValue("inspectionTypes", updatedSelected, { shouldValidate: form.formState.isSubmitted });

    setCustomInspectionTypeInput("");
  };

  const handleClear = () => {
    form.reset();
    setStagedFiles([]);
    setCustomInspectionTypeOptions([]);
    setCustomInspectionTypeInput("");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createMutation.mutateAsync({
        ...values,
        date: new Date(values.date),
        time: values.time || null,
        inspectionTypes: values.inspectionTypes,
      });
      const newFormId = (result as any).id;
      setFormId(newFormId);

      if (stagedFiles.length > 0) {
        const uploadResult = await uploadStagedFiles(
          stagedFiles,
          "daily",
          newFormId,
          (args) => uploadMutation.mutateAsync(args)
        );
        setStagedFiles([]);
        if (uploadResult.failedFiles.length > 0) {
          toast.error(
            `Report saved, but ${uploadResult.failedFiles.length} attachment(s) failed to upload: ${uploadResult.failedFiles.join(", ")}`
          );
        }
      }

      toast.success("Daily field report submitted successfully!");
      setIsSubmitted(true);
      form.reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-green-800 font-medium">Report submitted successfully!</p>
            </div>
            {formId && (
              <AttachmentGallery formType="daily" formId={formId} />
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setFormId(null); setIsSubmitted(false); setStagedFiles([]); }}
            >
              Submit Another Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">

          {/* ── SECTION 1 · JOB INFORMATION ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Special Inspection Report</CardTitle>
              <CardDescription>
                Material Engineering Inspection, Inc. — 1900 Camden Avenue, Suite 101, San Jose, CA 95124
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-semibold">Job Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="jobNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>MEI Job No.</FormLabel>
                    <FormControl><Input placeholder="e.g., JOB-2024-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="permitNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permit No.</FormLabel>
                    <FormControl><Input placeholder="e.g., PERMIT-2024-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="projectName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Downtown Office Complex" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="client" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl><Input placeholder="e.g., ABC Corp" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Location</FormLabel>
                    <FormControl><Input placeholder="e.g., 123 Main St, San Jose, CA" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="contractor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contractor</FormLabel>
                  <FormControl><Input placeholder="e.g., XYZ Contractors Inc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SECTION 2 · DATE, TIME & WEATHER ─────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Date, Time &amp; Weather</h3>
              <table className="w-full text-sm border border-gray-300">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold w-1/3">
                      Inspection Date
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem className="m-0">
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold w-1/3">
                      Inspection Time
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <FormField control={form.control} name="time" render={({ field }) => (
                        <FormItem className="m-0">
                          <FormControl><Input type="time" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold w-1/3">
                      Weather
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <FormField control={form.control} name="weather" render={({ field }) => (
                        <FormItem className="m-0">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select weather" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {weatherOptions.map((w) => (
                                <SelectItem key={w} value={w}>{w}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ── SECTION 3 · TYPE OF INSPECTION ───────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="text-lg font-semibold">Type of Inspection</h3>
              <p className="text-sm text-muted-foreground">Select all applicable inspection types</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allInspectionTypeOptions.map((type) => (
                  <FormItem key={type} className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        id={type}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={() => toggleType(type)}
                      />
                    </FormControl>
                    <FormLabel htmlFor={type} className="font-normal cursor-pointer">{type}</FormLabel>
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

          {/* ── SECTION 4 · WORK CONFORMANCE ─────────────────────────────── */}
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
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
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
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
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
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
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

          {/* ── SECTION 5 · ADDITIONAL NOTES ─────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Additional Notes</h3>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional observations or notes…"
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SECTION 6 · INSPECTION PHOTOS ────────────────────────────── */}
          <Card>
            <CardContent className="pt-6">
              <AttachmentGallery
                formType="daily"
                formId={null}
                onStagedFilesChange={setStagedFiles}
              />
            </CardContent>
          </Card>

          {/* ── ACTIONS ──────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClear}>
              Clear Form
            </Button>
            <Button type="submit" disabled={createMutation.isPending || uploadMutation.isPending} className="flex-1">
              {(createMutation.isPending || uploadMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadMutation.isPending ? "Uploading attachments…" : "Submit Daily Field Report"}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
