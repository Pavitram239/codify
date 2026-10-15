export const formatDate = (value, options = {}) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
        ...options,
      }).format(new Date(value))
    : "Not scheduled";

export const formatTime = (value) =>
  formatDate(value, {
    day: undefined,
    month: undefined,
    year: undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const statusLabels = {
  upcoming: "Scheduled",
  ongoing: "In progress",
  completed: "Completed",
  draft: "Draft",
  rejected: "Partial marks",
};

const offsets = { "Asia/Kolkata": "+05:30", UTC: "+00:00" };

export function scheduleTimestamp(date, time, timezone) {
  if (!date || !time || !offsets[timezone]) return null;
  const timestamp = new Date(`${date}T${time}:00${offsets[timezone]}`);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
}

export function splitTimestamp(value, timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
