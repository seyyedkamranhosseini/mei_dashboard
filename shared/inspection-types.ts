export const DAILY_REQUIRED_INSPECTION_TYPES: string[] = [
  "Epoxy Observation",
  "Soil Compaction",
  "Metal Decking",
  "High Strength Bolting",
  "Pull Out/Torque Testing",
  "Masonry",
  "Concrete",
  "Shotcrete",
  "Field Welding",
  "Fireproofing",
  "Pre/Post Tensioning Tendon",
  "Reinforcing Steel",
  "Shop Welding",
  "Nailing",
  "UT",
  "Fire Stopping",
];

const LEGACY_LABEL_ALIASES: Record<string, string> = {
  "Pre-Post Tensioning Tendon": "Pre/Post Tensioning Tendon",
};

export function normalizeInspectionType(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return LEGACY_LABEL_ALIASES[trimmed] ?? trimmed;
}

export function normalizeInspectionTypes(values: string[]): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((v) => normalizeInspectionType(String(v)))
        .filter(Boolean)
    )
  );
}
