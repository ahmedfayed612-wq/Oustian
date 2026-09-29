/**
 * Profile pickers.
 *
 * Confirmed OUST faculty list — exactly these four. The signup form, the
 * profile editor, the admin approval queue and every profile screen read from
 * this file, so a single edit keeps the whole product consistent.
 */
export const facultyOptions = [
  { value: "engineering", nameEn: "Engineering", nameAr: "الهندسة" },
  { value: "pharmacy", nameEn: "Pharmacy", nameAr: "الصيدلة" },
  {
    value: "business-entrepreneurship",
    nameEn: "Business & Entrepreneurship",
    nameAr: "إدارة الأعمال وريادة الأعمال",
  },
  {
    value: "computer-science-ai",
    nameEn: "Computer Science & AI",
    nameAr: "علوم الحاسب والذكاء الاصطناعي",
  },
] as const;

export type FacultyValue = (typeof facultyOptions)[number]["value"];

export const facultyValues = facultyOptions.map((option) => option.value);

/** Four-year programmes plus a little slack for five-year ones. */
export function graduationYearOptions(now = new Date()) {
  const start = now.getFullYear();

  return Array.from({ length: 8 }, (_, index) => start + index);
}

export const graduationYearRange = { min: 2000, max: 2100 } as const;

/**
 * "Engineering · 2027" — the one-line identity every member-facing surface
 * shows (the chrome's profile card, a suggestion card). Built in one place so
 * the wording cannot drift between them, and null when the member has filled
 * in neither picker.
 */
export function headlineForMember(
  faculty: string | null | undefined,
  graduationYear: number | null | undefined,
  locale: string,
): string | null {
  const option = facultyOptions.find((item) => item.value === faculty);

  const parts = [
    option ? (locale === "ar" ? option.nameAr : option.nameEn) : null,
    graduationYear ? String(graduationYear) : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}
