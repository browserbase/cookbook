export type ExtractionAnswer = {
  epaRegistrationNumber?: string;
  revisionDate?: string;
  [key: string]: unknown;
};

export type ComplianceDecision = {
  status: 'APPROVED' | 'NEEDS_REVIEW';
  reasons: string[];
};

export function normalizeRegistrationNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s*-\s*/g, '-');
  // This demo compares numeric components without erasing their boundaries.
  return /^\d+(?:-\d+){1,2}$/.test(normalized) ? normalized : undefined;
}

function validRevisionDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isAnswer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decideCompliance(
  sds: unknown,
  label: unknown
): ComplianceDecision {
  const reasons: string[] = [];
  if (!isAnswer(sds) || !isAnswer(label)) {
    return { status: 'NEEDS_REVIEW', reasons: ['Both document extractions must be metadata objects.'] };
  }
  const sdsRegistration = normalizeRegistrationNumber(
    sds.epaRegistrationNumber
  );
  const labelRegistration = normalizeRegistrationNumber(
    label.epaRegistrationNumber
  );

  if (!sdsRegistration) {
    reasons.push('The SDS has a missing or malformed registration number.');
  }

  if (!labelRegistration) {
    reasons.push('The label has a missing or malformed registration number.');
  }

  if (
    sdsRegistration &&
    labelRegistration &&
    sdsRegistration !== labelRegistration
  ) {
    reasons.push(
      `EPA registration mismatch: SDS ${sdsRegistration}, label ${labelRegistration}.`
    );
  }

  if (!validRevisionDate(sds.revisionDate)) {
    reasons.push('The SDS needs a valid revision date in YYYY-MM-DD format.');
  }

  if (reasons.length > 0) {
    return { status: 'NEEDS_REVIEW', reasons };
  }

  return {
    status: 'APPROVED',
    reasons: ['The extracted registration components agree and the SDS revision date is a valid calendar date. These metadata checks do not establish product or regulatory compliance.'],
  };
}

export function metadataValues(
  values: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      if (value === undefined || value === null) {
        return [];
      }

      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      return serialized.length > 0 ? [[key, serialized]] : [];
    })
  );
}
