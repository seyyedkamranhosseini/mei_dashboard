type NormalizeResult<T> = {
  items: T[];
  issue: string | null;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeCollection<T>(
  value: unknown,
  label: string
): NormalizeResult<T> {
  if (Array.isArray(value)) {
    return { items: value as T[], issue: null };
  }

  if (value == null) {
    return { items: [], issue: null };
  }

  if (isObjectRecord(value)) {
    if (Array.isArray(value.items)) {
      console.error(
        `[Data] ${label} returned an object with items[]. Normalizing to array.`,
        value
      );
      return {
        items: value.items as T[],
        issue: `Some ${label} data arrived in an unexpected format and was normalized automatically.`,
      };
    }

    if (Array.isArray(value.data)) {
      console.error(
        `[Data] ${label} returned an object with data[]. Normalizing to array.`,
        value
      );
      return {
        items: value.data as T[],
        issue: `Some ${label} data arrived in an unexpected format and was normalized automatically.`,
      };
    }

    const objectValues = Object.values(value);
    if (objectValues.every((item) => isObjectRecord(item) || Array.isArray(item))) {
      console.error(
        `[Data] ${label} returned an object map. Normalizing with Object.values().`,
        value
      );
      return {
        items: objectValues as T[],
        issue: `Some ${label} data arrived in an unexpected format and was normalized automatically.`,
      };
    }
  }
  console.error(`[Data] ${label} expected an array but received:`, value);
  return {
    items: [],
    issue: `We couldn't fully process ${label} data from the server. Showing available data only.`,
  };
}