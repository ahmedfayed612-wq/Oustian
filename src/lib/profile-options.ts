/**
 * Profile pickers.
 *
 * ⚠️ OUST does not publish a machine-readable faculty list, so this is the
 * starting set. Confirm it with the university and edit it here — the signup
 * form, the profile editor and any future filters all read from this file, so a
 * single edit keeps the whole product consistent.
 */
export const facultyOptions = [
  { value: "engineering", nameEn: "Engineering", nameAr: "الهندسة" },
  {
    value: "computer-science",
    nameEn: "Computer Science & IT",
    nameAr: "علوم الحاسب وتقنية المعلومات",
  },
  {
    value: "artificial-intelligence",
    nameEn: "Artificial Intelligence",
    nameAr: "الذكاء الاصطناعي",
  },
  {
    value: "business",
    nameEn: "Business Administration",
    nameAr: "إدارة الأعمال",
  },
  {
    value: "economics",
    nameEn: "Economics & Management",
    nameAr: "الاقتصاد والإدارة",
  },
  { value: "pharmacy", nameEn: "Pharmacy", nameAr: "الصيدلة" },
  {
    value: "dentistry",
    nameEn: "Oral & Dental Medicine",
    nameAr: "طب الفم والأسنان",
  },
  {
    value: "physical-therapy",
    nameEn: "Physical Therapy",
    nameAr: "العلاج الطبيعي",
  },
  { value: "nursing", nameEn: "Nursing", nameAr: "التمريض" },
  {
    value: "media",
    nameEn: "Media & Communication",
    nameAr: "الإعلام والاتصال",
  },
  {
    value: "languages",
    nameEn: "Languages & Translation",
    nameAr: "اللغات والترجمة",
  },
  { value: "other", nameEn: "Other", nameAr: "أخرى" },
] as const;

export type FacultyValue = (typeof facultyOptions)[number]["value"];

export const facultyValues = facultyOptions.map((option) => option.value);

/** Four-year programmes plus a little slack for five-year ones. */
export function graduationYearOptions(now = new Date()) {
  const start = now.getFullYear();

  return Array.from({ length: 8 }, (_, index) => start + index);
}

export const graduationYearRange = { min: 2000, max: 2100 } as const;
