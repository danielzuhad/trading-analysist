const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

export function parseProviderDateTime(value: string, timeZone: string): string {
  if (looksLikeIso(value)) {
    return new Date(value).toISOString();
  }

  const match = localDateTimePattern.exec(value);

  if (!match) {
    throw new Error(`Unsupported provider datetime format: ${value}`);
  }

  const [
    ,
    rawYear,
    rawMonth,
    rawDay,
    rawHour = "00",
    rawMinute = "00",
    rawSecond = "00",
  ] = match;

  const utcGuess = new Date(
    Date.UTC(
      Number(rawYear),
      Number(rawMonth) - 1,
      Number(rawDay),
      Number(rawHour),
      Number(rawMinute),
      Number(rawSecond),
    ),
  );

  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function looksLikeIso(value: string) {
  return (
    value.includes("T") &&
    (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value))
  );
}
