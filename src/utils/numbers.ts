/* Digit handling for Egyptian users: Arabic keyboards often produce
   Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) or Persian digits (۰۱۲۳۴۵۶۷۸۹),
   which JS `\d` does NOT match — naive stripping deletes everything
   the user types. Normalize them to ASCII first. */

const AR_INDIC = '٠١٢٣٤٥٦٧٨٩';
const FA_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(v: string): string {
  return v
    .replace(/[٠-٩]/g, (d) => String(AR_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_INDIC.indexOf(d)));
}

/** Keep ASCII digits only (after normalization), capped at `max` chars. */
export function onlyDigits(v: string, max = 12): string {
  return normalizeDigits(v)
    .replace(/\D/g, '')
    .slice(0, max);
}

/** Phone-field characters: digits (any locale), plus and spaces. */
export function onlyPhoneChars(v: string): string {
  return normalizeDigits(v).replace(/[^\d+\s]/g, '');
}
