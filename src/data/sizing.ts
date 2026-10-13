/* Precision size finder (v2).
   Accuracy ladder (industry standard):
   - Tape measurements (chest + waist, gender-specific tables) → HIGH accuracy
   - Height + weight only → MEDIUM estimate
   Body tables below are standard adult body measurements in cm
   (Finatex / US apparel charts), midpoints as upper bounds.
   Category weighting: tops are driven by chest, pants by waist.
   Everything tunable here — components stay untouched. */

export type FitPref = 'slim' | 'regular' | 'oversized';
export type Gender = 'male' | 'female';

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type StdSize = (typeof SIZE_ORDER)[number];

type Band = { max: number; size: StdSize };

const MALE_CHEST: Band[] = [
  { max: 91, size: 'XS' },
  { max: 97, size: 'S' },
  { max: 103, size: 'M' },
  { max: 109, size: 'L' },
  { max: 115, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];
const MALE_WAIST: Band[] = [
  { max: 79, size: 'XS' },
  { max: 85, size: 'S' },
  { max: 91, size: 'M' },
  { max: 97, size: 'L' },
  { max: 103, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];
const FEMALE_BUST: Band[] = [
  { max: 85, size: 'XS' },
  { max: 90, size: 'S' },
  { max: 95, size: 'M' },
  { max: 100, size: 'L' },
  { max: 105, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];
const FEMALE_WAIST: Band[] = [
  { max: 67, size: 'XS' },
  { max: 72, size: 'S' },
  { max: 77, size: 'M' },
  { max: 82, size: 'L' },
  { max: 87, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];
const FEMALE_HIPS: Band[] = [
  { max: 92, size: 'XS' },
  { max: 98, size: 'S' },
  { max: 103, size: 'M' },
  { max: 108, size: 'L' },
  { max: 113, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];

const MALE_WEIGHT: Band[] = [
  { max: 54, size: 'XS' },
  { max: 64, size: 'S' },
  { max: 79, size: 'M' },
  { max: 94, size: 'L' },
  { max: 109, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];
const FEMALE_WEIGHT: Band[] = [
  { max: 50, size: 'XS' },
  { max: 58, size: 'S' },
  { max: 68, size: 'M' },
  { max: 78, size: 'L' },
  { max: 88, size: 'XL' },
  { max: Number.POSITIVE_INFINITY, size: 'XXL' },
];

export const HEIGHT_TALL = 188;
export const HEIGHT_PETITE = 165;
/** Within this many cm below a band boundary → flagged as between sizes. */
const BETWEEN_CM = 2;

export type SizeAdvice = {
  size: string;
  steps: string[];
  accuracy: 'high' | 'medium';
  between: [string, string] | null;
};

const idx = (s: string) => SIZE_ORDER.indexOf(s as StdSize);

function bandOf(table: Band[], v: number): { size: StdSize; between: [StdSize, StdSize] | null } {
  const i = table.findIndex((b) => v <= b.max);
  const size = table[i].size;
  let between: [StdSize, StdSize] | null = null;
  if (i < table.length - 1 && table[i].max - v <= BETWEEN_CM) {
    between = [size, table[i + 1].size];
  }
  return { size, between };
}

export type FinderInput = {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  chestCm?: number; // bust for female
  waistCm?: number;
  hipsCm?: number; // female only
  fit: FitPref;
  available: string[];
  category: string;
};

export function recommendSizeV2(input: FinderInput): SizeAdvice {
  const { gender, fit, available, category } = input;
  const usable = available.filter((s) => s !== 'ONE SIZE');
  if (usable.length === 0) {
    return {
      size: available[0] ?? 'M',
      steps: ['This piece comes in one universal size.'],
      accuracy: 'high',
      between: null,
    };
  }
  if (usable.length === 1) {
    return {
      size: usable[0],
      steps: [`Only ${usable[0]} left in this piece — grab it.`],
      accuracy: 'high',
      between: null,
    };
  }

  const h = Math.min(220, Math.max(140, Math.round(input.heightCm) || 0));
  const w = Math.min(200, Math.max(35, Math.round(input.weightKg) || 0));
  const chest = input.chestCm ? Math.min(200, Math.max(60, Math.round(input.chestCm))) : undefined;
  const waist = input.waistCm ? Math.min(200, Math.max(50, Math.round(input.waistCm))) : undefined;
  const hips =
    gender === 'female' && input.hipsCm
      ? Math.min(200, Math.max(70, Math.round(input.hipsCm)))
      : undefined;

  const steps: string[] = [];
  const isBottom = category === 'pants';
  let best = 0;
  let between: [string, string] | null = null;
  let measured = 0;

  const consider = (label: string, value: number | undefined, table: Band[], primary: boolean) => {
    if (value == null) return;
    measured += 1;
    const r = bandOf(table, value);
    steps.push(`${label} ${value}cm → ${r.size}${primary ? ' (primary)' : ''}`);
    if (idx(r.size) > best) best = idx(r.size);
    if (r.between && !between) between = [r.between[0], r.between[1]];
  };

  if (isBottom) {
    // Pants: waist drives, height sets length
    consider('Waist', waist, gender === 'male' ? MALE_WAIST : FEMALE_WAIST, true);
    consider(gender === 'male' ? 'Chest' : 'Bust', chest, gender === 'male' ? MALE_CHEST : FEMALE_BUST, false);
    if (measured === 0) {
      const r = bandOf(gender === 'male' ? MALE_WEIGHT : FEMALE_WEIGHT, w);
      steps.push(`Weight ${w}kg → base ${r.size} (estimate — add waist for precision)`);
      best = idx(r.size);
      if (r.between && !between) between = [r.between[0], r.between[1]];
    }
  } else {
    // Tops: chest/bust drives, waist is the comfort check
    consider(gender === 'male' ? 'Chest' : 'Bust', chest, gender === 'male' ? MALE_CHEST : FEMALE_BUST, true);
    consider('Waist', waist, gender === 'male' ? MALE_WAIST : FEMALE_WAIST, false);
    if (gender === 'female') consider('Hips', hips, FEMALE_HIPS, false);
    if (measured === 0) {
      const r = bandOf(gender === 'male' ? MALE_WEIGHT : FEMALE_WEIGHT, w);
      steps.push(`Weight ${w}kg → base ${r.size} (estimate — add chest for precision)`);
      best = idx(r.size);
      if (r.between && !between) between = [r.between[0], r.between[1]];
    }
  }

  // Length check from height
  if (h >= HEIGHT_TALL && best < SIZE_ORDER.length - 1) {
    best += 1;
    steps.push(`Height ${h}cm runs long → up to ${SIZE_ORDER[best]}`);
  } else if (h <= HEIGHT_PETITE && best > 0) {
    best -= 1;
    steps.push(`Height ${h}cm runs short → down to ${SIZE_ORDER[best]}`);
  }

  // Fit intent
  if (fit === 'slim' && best > 0) {
    best -= 1;
    steps.push(`Slim fit → down to ${SIZE_ORDER[best]}`);
  } else if (fit === 'oversized' && best < SIZE_ORDER.length - 1) {
    best += 1;
    steps.push(`Oversized look → up to ${SIZE_ORDER[best]}`);
  }

  let size: string = SIZE_ORDER[best];
  if (!usable.includes(size)) {
    let pick = usable[0];
    let dist = Infinity;
    for (const cand of usable) {
      const d = Math.abs(idx(cand) - best);
      if (d < dist) {
        dist = d;
        pick = cand;
      }
    }
    steps.push(`${size} isn't stocked — nearest available is ${pick}`);
    size = pick;
    between = null;
  }

  const accuracy: 'high' | 'medium' = measured >= 2 ? 'high' : 'medium';
  if (accuracy === 'medium') {
    steps.push('Medium confidence — add tape measurements for max accuracy.');
  }
  return { size, steps, accuracy, between };
}

/* Back-compat: old quick signature now routes through v2 (male bands). */
export function recommendSize(
  heightCm: number,
  weightKg: number,
  fit: 'slim' | 'regular' | 'oversized',
  available: string[],
) {
  const r = recommendSizeV2({
    gender: 'male',
    heightCm,
    weightKg,
    fit,
    available,
    category: 'hoodies',
  });
  return { size: r.size, steps: r.steps };
}
