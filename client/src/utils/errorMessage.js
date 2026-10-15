export function errorMessage(value, fallback = "Something went wrong. Please try again.") {
  if (typeof value === "string") return value || fallback;
  if (Array.isArray(value)) return value.map((item) => errorMessage(item, "")).filter(Boolean).join(" ") || fallback;
  if (value && typeof value === "object") return Object.values(value).map((item) => errorMessage(item, "")).filter(Boolean).join(" ") || fallback;
  return fallback;
}
