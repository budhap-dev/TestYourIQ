/** Whole years between a date of birth (YYYY-MM-DD) and today. The date itself is never sent. */
export function ageFromDateOfBirth(dob: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d)
    return null;
  if (birth > today) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() < mo - 1 || (today.getMonth() === mo - 1 && today.getDate() < d)) age -= 1;
  return age;
}

export const MIN_AGE = 8;
export const MAX_AGE = 110;
export const ADULT_AGE = 16;
