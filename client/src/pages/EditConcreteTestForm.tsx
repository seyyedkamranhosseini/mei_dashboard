import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
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
import DashboardLayout from "@/components/DashboardLayout";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_SPECIMENS = 7;

const placementTypes: { field: string; label: string }[] = [
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

const specimenRows: { field: string; label: string; type?: string }[] = [
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

const emptySpecimen = {
  specimenNo: "", setNo: "", agedDays: "", dateTested: "",
  dimensions: "", areaSquareIn: "", ultimateLoadLbs: "",
  compressiveStrengthPsi: "", averageStrengthPsi: "",
  labTechnician: "", labManager: "",
};

// ─── Schema (mirrors ConcreteTestForm) ────────────────────────────────────────

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

const normalizeSpecimensForForm = (rows?: z.infer<typeof specimenSchema>[]) => {
  const normalized = (rows || []).map((row) => ({ ...emptySpecimen, ...normalizeSpecimenRow(row) }));
  return Array.from({ length: NUM_SPECIMENS }, (_, index) => normalized[index] || { ...emptySpecimen });
};

const asString = (value: string | number | null | undefined) =>
  value == null ? "" : String(value);

const schema = z.object({
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
  // Placement Type
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
  // Specimens
  specimens: z.array(specimenSchema)
    .length(NUM_SPECIMENS)
    .transform((rows) => rows.map(normalizeSpecimenRow))
    .superRefine(validateConcreteSpecimens)
    .transform((rows) => rows.filter((row, index) => index === 0 || !isBlankSpecimen(row))),
  // Comments
  comments: z.string().optional(),
});

type FormInputValues = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditConcreteTestForm() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const testId = parseInt(id || "0");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: test, isLoading } = trpc.concreteTest.getById.useQuery(testId);
  const editMutation = trpc.concreteTest.edit.useMutation();
  const downloadConcretePDF = trpc.concreteTest.downloadPDF.useMutation();

  const form = useForm<FormInputValues, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      permitNo: asString(test?.permitNo),
      fileNo: asString(test?.fileNo),
      meiProjectNoName: asString(test?.meiProjectNoName),
      contractor: asString(test?.contractor),
      subContractor: asString(test?.subContractor),
      buildingNo: asString(test?.buildingNo),
      floorDeck: asString(test?.floorDeck),
      other: asString(test?.other),
      specificLocation: asString(test?.specificLocation),
      footing: test?.footing || false,
      postTension: test?.postTension || false,
      masonryWall: test?.masonryWall || false,
      columns: test?.columns || false,
      walls: test?.walls || false,
      masonryColumns: test?.masonryColumns || false,
      slabOnGrade: test?.slabOnGrade || false,
      beams: test?.beams || false,
      masonryPrisms: test?.masonryPrisms || false,
      supplier: asString(test?.supplier),
      material: asString(test?.material),
      sampledBy: asString(test?.sampledBy),
      ticketNo: asString(test?.ticketNo),
      dateSampled: test?.dateSampled ? new Date(test.dateSampled).toISOString().split("T")[0] : "",
      time: asString(test?.time),
      loadNo: asString(test?.loadNo),
      dateReceived: test?.dateReceived ? new Date(test.dateReceived).toISOString().split("T")[0] : "",
      setNo: asString(test?.setNo),
      truckNo: asString(test?.truckNo),
      weather: asString(test?.weather),
      mixDesignNo: asString(test?.mixDesignNo),
      cementFactorSkCy: asString(test?.cementFactorSkCy),
      maxSizeAggIn: asString(test?.maxSizeAggIn),
      admixture: asString(test?.admixture),
      specifiedStrengthPsi: asString(test?.specifiedStrengthPsi),
      slumpInSpecified: asString(test?.slumpInSpecified),
      slumpInMeasured: asString(test?.slumpInMeasured),
      mixTempFSpecified: asString(test?.mixTempFSpecified),
      mixTempFMeasured: asString(test?.mixTempFMeasured),
      airTempFSpecified: asString(test?.airTempFSpecified),
      airTempFMeasured: asString(test?.airTempFMeasured),
      airContentSpecified: asString(test?.airContentSpecified),
      airContentMeasured: asString(test?.airContentMeasured),
      specimens: normalizeSpecimensForForm(test?.specimens as z.infer<typeof specimenSchema>[] | undefined),
      comments: asString(test?.comments),
    },
  });

  useEffect(() => {
    if (!test) return;

    form.reset({
      permitNo: asString(test.permitNo),
      fileNo: asString(test.fileNo),
      meiProjectNoName: asString(test.meiProjectNoName),
      contractor: asString(test.contractor),
      subContractor: asString(test.subContractor),
      buildingNo: asString(test.buildingNo),
      floorDeck: asString(test.floorDeck),
      other: asString(test.other),
      specificLocation: asString(test.specificLocation),
      footing: test.footing || false,
      postTension: test.postTension || false,
      masonryWall: test.masonryWall || false,
      columns: test.columns || false,
      walls: test.walls || false,
      masonryColumns: test.masonryColumns || false,
      slabOnGrade: test.slabOnGrade || false,
      beams: test.beams || false,
      masonryPrisms: test.masonryPrisms || false,
      supplier: asString(test.supplier),
      material: asString(test.material),
      sampledBy: asString(test.sampledBy),
      ticketNo: asString(test.ticketNo),
      dateSampled: test.dateSampled ? new Date(test.dateSampled).toISOString().split("T")[0] : "",
      time: asString(test.time),
      loadNo: asString(test.loadNo),
      dateReceived: test.dateReceived ? new Date(test.dateReceived).toISOString().split("T")[0] : "",
      setNo: asString(test.setNo),
      truckNo: asString(test.truckNo),
      weather: asString(test.weather),
      mixDesignNo: asString(test.mixDesignNo),
      cementFactorSkCy: asString(test.cementFactorSkCy),
      maxSizeAggIn: asString(test.maxSizeAggIn),
      admixture: asString(test.admixture),
      specifiedStrengthPsi: asString(test.specifiedStrengthPsi),
      slumpInSpecified: asString(test.slumpInSpecified),
      slumpInMeasured: asString(test.slumpInMeasured),
      mixTempFSpecified: asString(test.mixTempFSpecified),
      mixTempFMeasured: asString(test.mixTempFMeasured),
      airTempFSpecified: asString(test.airTempFSpecified),
      airTempFMeasured: asString(test.airTempFMeasured),
      airContentSpecified: asString(test.airContentSpecified),
      airContentMeasured: asString(test.airContentMeasured),
      specimens: normalizeSpecimensForForm(test.specimens as z.infer<typeof specimenSchema>[] | undefined),
      comments: asString(test.comments),
    });
  }, [test, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await editMutation.mutateAsync({ id: testId, ...values } as any);
      toast.success("Concrete test data updated successfully!");
      setLocation(isAdmin ? "/admin/approvals" : "/employee/submissions");
    } catch (error: any) {
      const message =
        error?.data?.code === "UNAUTHORIZED"
          ? "Your session expired. Please sign in again and retry."
          : error?.message || "Failed to update concrete test";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!test) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6">
            <p>Test not found</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
            <div className="space-y-6">

            {/* ── SECTION 1 · PROJECT INFORMATION ──────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Concrete Compression Test Data</CardTitle>
                <CardDescription>
                  Material Engineering Inspection, Inc. — 1900 Camden Avenue, Suite 101, San Jose, CA 95124
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h3 className="text-lg font-semibold">Project Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="permitNo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit No.</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="fileNo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>File No.</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="meiProjectNoName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>MEI Project No. &amp; Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contractor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contractor</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subContractor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-Contractor</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="buildingNo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building No.</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="floorDeck" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Floor Deck</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="other" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="specificLocation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Location (grid)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ── SECTION 2 · PLACEMENT TYPE ────────────────────────────────── */}
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

            {/* ── SECTION 3 · SAMPLE INFORMATION ───────────────────────────── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Sample Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="supplier" render={({ field }) => (
                    <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="material" render={({ field }) => (
                    <FormItem><FormLabel>Material</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="sampledBy" render={({ field }) => (
                    <FormItem><FormLabel>Sampled By</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="ticketNo" render={({ field }) => (
                    <FormItem><FormLabel>Ticket No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="dateSampled" render={({ field }) => (
                    <FormItem><FormLabel>Date Sampled</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="loadNo" render={({ field }) => (
                    <FormItem><FormLabel>Load No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="dateReceived" render={({ field }) => (
                    <FormItem><FormLabel>Date Received</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="setNo" render={({ field }) => (
                    <FormItem><FormLabel>Set No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="truckNo" render={({ field }) => (
                    <FormItem><FormLabel>Truck No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="weather" render={({ field }) => (
                    <FormItem><FormLabel>Weather</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="mixDesignNo" render={({ field }) => (
                    <FormItem><FormLabel>Mix Design No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="cementFactorSkCy" render={({ field }) => (
                    <FormItem><FormLabel>Cement Factor, Sk/CY</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="maxSizeAggIn" render={({ field }) => (
                    <FormItem><FormLabel>Max. Size Agg., In.</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="admixture" render={({ field }) => (
                    <FormItem><FormLabel>Admixture</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="specifiedStrengthPsi" render={({ field }) => (
                    <FormItem><FormLabel>Specified Strength, PSI</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* ── SECTION 4 · SPECIFIED VS MEASURED ────────────────────────── */}
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

            {/* ── SECTION 5 · SPECIMEN DATA TABLE ──────────────────────────── */}
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

            {/* ── SECTION 6 · COMPLIANCE + COMMENTS ────────────────────────── */}
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

            {/* ── SECTION 7 · ATTACHMENTS ───────────────────────────────── */}
            <Card>
              <CardContent className="pt-6">
                <AttachmentGallery formType="concrete" formId={testId} />
              </CardContent>
            </Card>

            </div>

            {/* ── ACTIONS ──────────────────────────────────────────────────── */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setLocation(isAdmin ? "/admin/reports" : "/employee/submissions")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={downloadConcretePDF.isPending}
                onClick={async () => {
                  try {
                    const result = await downloadConcretePDF.mutateAsync(testId);
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
                {isAdmin ? "Update Concrete Test Data (Admin)" : "Update Concrete Test Data"}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
