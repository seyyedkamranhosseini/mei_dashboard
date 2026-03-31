import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { AttachmentGallery, uploadStagedFiles } from "@/components/AttachmentGallery";

// ─── Specimen columns (7 columns like the PDF table) ─────────────────────────
const NUM_SPECIMENS = 7;

const specimenSchema = z.object({
  specimenNo: z.string().optional(),
  setNo: z.string().optional(),
  agedDays: z.string().optional(),
  dateTested: z.string().optional(),
  dimensions: z.string().optional(),
  areaSquareIn: z.string().optional(),
  ultimateLoadLbs: z.string().optional(),
  compressiveStrengthPsi: z.string().optional(),
  averageStrengthPsi: z.string().optional(),
  labTechnician: z.string().optional(),
  labManager: z.string().optional(),
});

const SPECIMEN_REQUIRED_FIELDS: Array<keyof z.infer<typeof specimenSchema>> = [
  "specimenNo",
  "setNo",
  "agedDays",
  "dateTested",
  "dimensions",
  "areaSquareIn",
  "ultimateLoadLbs",
  "compressiveStrengthPsi",
  "averageStrengthPsi",
  "labTechnician",
  "labManager",
];

const normalizeSpecimenRow = (row: z.infer<typeof specimenSchema>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
  ) as z.infer<typeof specimenSchema>;

const isBlankSpecimen = (row: z.infer<typeof specimenSchema>) =>
  SPECIMEN_REQUIRED_FIELDS.every((field) => !row[field]);

const validateConcreteSpecimens = (
  specimens: z.infer<typeof specimenSchema>[],
  ctx: z.RefinementCtx
) => {
  specimens.forEach((row, index) => {
    const normalized = normalizeSpecimenRow(row);
    const blank = isBlankSpecimen(normalized);

    if (index === 0 || !blank) {
      for (const field of SPECIMEN_REQUIRED_FIELDS) {
        if (!normalized[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Required",
            path: [index, field],
          });
        }
      }
    }
  });
};

const concreteTestSchema = z.object({
  // Project Info
  permitNo: z.string().min(1, "Permit No. is required"),
  fileNo: z.string().optional(),
  meiProjectNoName: z.string().min(1, "MEI Project No. & Name is required"),
  contractor: z.string().min(1, "Contractor is required"),
  subContractor: z.string().optional(),
  buildingNo: z.string().optional(),
  floorDeck: z.string().optional(),
  other: z.string().optional(),
  specificLocation: z.string().optional(),

  // Placement Type (checkboxes)
  footing: z.boolean().default(false),
  postTension: z.boolean().default(false),
  masonryWall: z.boolean().default(false),
  columns: z.boolean().default(false),
  walls: z.boolean().default(false),
  masonryColumns: z.boolean().default(false),
  slabOnGrade: z.boolean().default(false),
  beams: z.boolean().default(false),
  masonryPrisms: z.boolean().default(false),

  // Sample Info
  supplier: z.string().optional(),
  material: z.string().optional(),
  sampledBy: z.string().optional(),
  ticketNo: z.string().optional(),
  dateSampled: z.string().optional(),
  time: z.string().optional(),
  loadNo: z.string().optional(),
  dateReceived: z.string().optional(),
  setNo: z.string().optional(),
  truckNo: z.string().optional(),
  weather: z.string().optional(),
  mixDesignNo: z.string().optional(),
  cementFactorSkCy: z.string().optional(),
  maxSizeAggIn: z.string().optional(),
  admixture: z.string().optional(),
  specifiedStrengthPsi: z.string().optional(),

  // Specified / Measured
  slumpInSpecified: z.string().optional(),
  slumpInMeasured: z.string().optional(),
  mixTempFSpecified: z.string().optional(),
  mixTempFMeasured: z.string().optional(),
  airTempFSpecified: z.string().optional(),
  airTempFMeasured: z.string().optional(),
  airContentSpecified: z.string().optional(),
  airContentMeasured: z.string().optional(),

  // Specimens (array of 7)
  specimens: z.array(specimenSchema)
    .length(NUM_SPECIMENS)
    .transform((rows) => rows.map(normalizeSpecimenRow))
    .superRefine(validateConcreteSpecimens)
    .transform((rows) => rows.filter((row, index) => index === 0 || !isBlankSpecimen(row))),

  // Bottom
  comments: z.string().optional(),
});

type FormInputValues = z.input<typeof concreteTestSchema>;
type FormValues = z.output<typeof concreteTestSchema>;

const emptySpecimen = {
  specimenNo: "", setNo: "", agedDays: "", dateTested: "",
  dimensions: "", areaSquareIn: "", ultimateLoadLbs: "",
  compressiveStrengthPsi: "", averageStrengthPsi: "",
  labTechnician: "", labManager: "",
};

const placementTypes: { field: keyof FormInputValues; label: string }[] = [
  { field: "footing", label: "Footing" },
  { field: "postTension", label: "Post-tension" },
  { field: "masonryWall", label: "Masonry Wall" },
  { field: "columns", label: "Columns" },
  { field: "walls", label: "Walls" },
  { field: "masonryColumns", label: "Masonry Columns" },
  { field: "slabOnGrade", label: "Slab-on-grade" },
  { field: "beams", label: "Beams" },
  { field: "masonryPrisms", label: "Masonry Prisms" },
];

const specimenRows: { field: keyof typeof emptySpecimen; label: string; type?: string }[] = [
  { field: "specimenNo", label: "Specimen No." },
  { field: "setNo", label: "Set No." },
  { field: "agedDays", label: "Aged, Days", type: "number" },
  { field: "dateTested", label: "Date Tested", type: "date" },
  { field: "dimensions", label: "Dimensions, in × in" },
  { field: "areaSquareIn", label: "Area, Square In.", type: "number" },
  { field: "ultimateLoadLbs", label: "Ultimate Load, Lbs", type: "number" },
  { field: "compressiveStrengthPsi", label: "Compressive Strength (PSI)", type: "number" },
  { field: "averageStrengthPsi", label: "Average Strength (PSI)", type: "number" },
  { field: "labTechnician", label: "Lab Technician" },
  { field: "labManager", label: "Lab Manager" },
];

export default function ConcreteTestForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formId, setFormId] = useState<number | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const createMutation = trpc.concreteTest.create.useMutation();
  const uploadMutation = trpc.attachment.uploadAttachment.useMutation();

  const form = useForm<FormInputValues, unknown, FormValues>({
    resolver: zodResolver(concreteTestSchema),
    defaultValues: {
      permitNo: "", fileNo: "", meiProjectNoName: "", contractor: "",
      subContractor: "", buildingNo: "", floorDeck: "", other: "",
      specificLocation: "",
      footing: false, postTension: false, masonryWall: false,
      columns: false, walls: false, masonryColumns: false,
      slabOnGrade: false, beams: false, masonryPrisms: false,
      supplier: "", material: "", sampledBy: "",
      ticketNo: "", dateSampled: "", time: "",
      loadNo: "", dateReceived: "", setNo: "",
      truckNo: "", weather: "", mixDesignNo: "",
      cementFactorSkCy: "", maxSizeAggIn: "", admixture: "",
      specifiedStrengthPsi: "",
      slumpInSpecified: "", slumpInMeasured: "",
      mixTempFSpecified: "", mixTempFMeasured: "",
      airTempFSpecified: "", airTempFMeasured: "",
      airContentSpecified: "", airContentMeasured: "",
      specimens: Array(NUM_SPECIMENS).fill(null).map(() => ({ ...emptySpecimen })),
      comments: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createMutation.mutateAsync(values as any);
      const newFormId = (result as any).id;
      setFormId(newFormId);
      if (stagedFiles.length > 0) {
        await uploadStagedFiles(stagedFiles, "concrete", newFormId, (args) => uploadMutation.mutateAsync(args));
        setStagedFiles([]);
      }
      toast.success("Concrete test data submitted successfully!");
      setIsSubmitted(true);
      form.reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    }
  };

  const handleClear = () => {
    form.reset();
    setStagedFiles([]);
    setFormId(null);
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-green-800 font-medium">Concrete test data submitted successfully!</p>
            </div>
            {formId && (
              <AttachmentGallery formType="concrete" formId={formId} />
            )}
            <Button variant="outline" className="w-full" onClick={() => setIsSubmitted(false)}>
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

          {/* ── PROJECT INFORMATION ───────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Concrete Compression Test Data</CardTitle>
              <CardDescription>Material Engineering Inspection, Inc. — 1900 Camden Avenue, Suite 101, San Jose, CA 95124</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-semibold">Project Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="permitNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permit No.</FormLabel>
                    <FormControl><Input placeholder="e.g., PERMIT-2024-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fileNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>File No.</FormLabel>
                    <FormControl><Input placeholder="e.g., FILE-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="meiProjectNoName" render={({ field }) => (
                <FormItem>
                  <FormLabel>MEI Project No. &amp; Name</FormLabel>
                  <FormControl><Input placeholder="e.g., 2024-001 — Downtown Office Complex" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contractor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contractor</FormLabel>
                    <FormControl><Input placeholder="e.g., ABC Construction" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subContractor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Contractor</FormLabel>
                    <FormControl><Input placeholder="e.g., XYZ Sub Inc." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="buildingNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building No.</FormLabel>
                    <FormControl><Input placeholder="e.g., B-1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="floorDeck" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor Deck</FormLabel>
                    <FormControl><Input placeholder="e.g., Level 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="other" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other</FormLabel>
                    <FormControl><Input placeholder="e.g., Walls" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="specificLocation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Specific Location (grid)</FormLabel>
                  <FormControl><Input placeholder="e.g., Grid A3 – Column Line 4" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── PLACEMENT TYPE ────────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="text-lg font-semibold">Placement Type</h3>
              <p className="text-sm text-muted-foreground">Select all that apply</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {placementTypes.map(({ field, label }) => (
                  <FormField key={field} control={form.control} name={field as keyof FormValues} render={({ field: f }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={f.value as boolean} onCheckedChange={f.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── SAMPLE INFORMATION ───────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Sample Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="supplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="material" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="sampledBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sampled By</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="ticketNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dateSampled" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Sampled</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="loadNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Load No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dateReceived" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Received</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="setNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Set No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="truckNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Truck No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="weather" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weather</FormLabel>
                    <FormControl><Input placeholder="e.g., Sunny, 72°F" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="mixDesignNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mix Design No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cementFactorSkCy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cement Factor, Sk/CY</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxSizeAggIn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Size Agg., In.</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="admixture" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admixture</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="specifiedStrengthPsi" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specified Strength, PSI</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── SPECIFIED vs MEASURED ─────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Specified vs. Measured</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-1/2">Measurement</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Specified</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Measured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Slump, In.", specField: "slumpInSpecified", measField: "slumpInMeasured" },
                      { label: "Mix Temp., °F", specField: "mixTempFSpecified", measField: "mixTempFMeasured" },
                      { label: "Air Temp., °F", specField: "airTempFSpecified", measField: "airTempFMeasured" },
                      { label: "Air Content, %", specField: "airContentSpecified", measField: "airContentMeasured" },
                    ].map(({ label, specField, measField }) => (
                      <tr key={label}>
                        <td className="border border-gray-300 px-3 py-1.5 font-medium bg-gray-50">{label}</td>
                        <td className="border border-gray-300 px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            {...form.register(specField as keyof FormValues)}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            {...form.register(measField as keyof FormValues)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── SPECIMEN DATA TABLE ───────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="text-lg font-semibold">Specimen Data</h3>
              <p className="text-sm text-muted-foreground">Enter data for up to {NUM_SPECIMENS} specimens</p>
              <div className="overflow-x-auto">
                <table className="text-xs border border-gray-300 min-w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-2 text-left font-semibold whitespace-nowrap w-44">Field</th>
                      {Array.from({ length: NUM_SPECIMENS }, (_, i) => (
                        <th key={i} className="border border-gray-300 px-2 py-2 text-center font-semibold w-24">
                          #{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {specimenRows.map(({ field, label, type }) => (
                      <tr key={field} className="even:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 font-medium whitespace-nowrap bg-gray-50">{label}</td>
                        {Array.from({ length: NUM_SPECIMENS }, (_, i) => (
                          <td key={i} className="border border-gray-300 px-1 py-1">
                            <Input
                              type={type || "text"}
                              step={type === "number" ? "0.01" : undefined}
                              className="h-7 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 min-w-0"
                              {...form.register(`specimens.${i}.${field}` as any)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── COMPLIANCE + COMMENTS ─────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Additional Notes</h3>
              <FormField control={form.control} name="comments" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional observations or notes..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── ATTACHMENTS ─────────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6">
              <AttachmentGallery
                formType="concrete"
                formId={null}
                onStagedFilesChange={setStagedFiles}
              />
            </CardContent>
          </Card>

          {/* ── ACTIONS ──────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClear}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
