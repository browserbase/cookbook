import type { DownloadedFile } from './downloads.js';

const metadataKeys = ['statementDate', 'billingPeriod', 'dueDate', 'amountDue', 'previousBalance', 'paymentsReceived', 'electricityCharges', 'gasCharges', 'electricityUsage', 'gasUsage', 'ratePlan'] as const;
type MetadataKey = typeof metadataKeys[number];
type ExtractionAnswer = Partial<Record<MetadataKey, string>>;

export type BoxFile = {
  id: string;
  name: string;
};

export type BoxAiAskResponse = {
  answer: string;
};

export type BoxAiExtractResponse = {
  answer: ExtractionAnswer;
};

async function responseError(response: Response, action: string) {
  throw new Error(
    `${action} failed (HTTP ${response.status}).`
  );
}

function field(
  key: string,
  displayName: string,
  prompt: string,
  type = 'string'
) {
  return { key, displayName, prompt: prompt + (['amountDue', 'previousBalance', 'paymentsReceived', 'electricityCharges', 'gasCharges'].includes(key) ? ' Return a decimal amount without grouping commas, optionally prefixed by USD or $, or null if unavailable.' : ''), type };
}

export const DOCUMENT_FIELDS = [
  field(
    'statementDate',
    'Statement date',
    'The statement date as YYYY-MM-DD, or null if unavailable.',
    'date'
  ),
  field(
    'billingPeriod',
    'Billing period',
    'The billing period as YYYY-MM-DD to YYYY-MM-DD, or null if unavailable.'
  ),
  field('dueDate', 'Due date', 'The due date as YYYY-MM-DD, or null if unavailable.', 'date'),
  field('amountDue', 'Amount due', 'The total amount currently due.'),
  field('previousBalance', 'Previous balance', 'The previous balance.'),
  field(
    'paymentsReceived',
    'Payments received',
    'Payments or credits received during this billing period.'
  ),
  field(
    'electricityCharges',
    'Electricity charges',
    'The current electricity charges.'
  ),
  field('gasCharges', 'Gas charges', 'The current natural gas charges.'),
  field(
    'electricityUsage',
    'Electricity usage',
    'Electricity usage as a decimal number followed by kWh, or null if unavailable.'
  ),
  field(
    'gasUsage',
    'Gas usage',
    'Natural gas usage as a decimal number followed by therms, or null if unavailable.'
  ),
  field('ratePlan', 'Rate plan', 'The uppercase tariff code, using only letters, digits, and hyphens; or null if unavailable.'),
];

export async function boxAccessToken(): Promise<string> {
  const response = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.BOX_CLIENT_ID as string,
      client_secret: process.env.BOX_CLIENT_SECRET as string,
      box_subject_type: 'enterprise',
      box_subject_id: process.env.BOX_ENTERPRISE_ID as string,
    }),
  });

  if (!response.ok) {
    await responseError(response, 'Authenticating with Box');
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('Box did not return an access token.');
  }
  return body.access_token;
}

export async function uploadToBox(
  token: string,
  file: DownloadedFile
): Promise<BoxFile> {
  const extensionIndex = file.filename.lastIndexOf('.');
  const extension =
    extensionIndex >= 0 ? file.filename.slice(extensionIndex) : '';
  const name = `browserbase-agent-utility-bill-${Date.now()}${extension}`;
  const form = new FormData();
  form.append(
    'attributes',
    JSON.stringify({
      name,
      parent: { id: process.env.BOX_FOLDER_ID as string },
    })
  );
  form.append('file', new Blob([file.bytes], { type: file.mimeType }), name);

  const response = await fetch('https://upload.box.com/api/2.0/files/content', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    await responseError(response, 'Uploading the utility bill to Box');
  }

  const body = (await response.json()) as { entries: BoxFile[] };
  const uploaded = body.entries[0];
  if (!uploaded) {
    throw new Error('Box did not return an uploaded utility bill.');
  }

  console.log('Private utility bill uploaded to Box.');
  return uploaded;
}

async function boxAiRequest<T>(
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`https://api.box.com/2.0${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const retryable =
      response.status === 400 ||
      response.status === 412 ||
      response.status === 429 ||
      response.status >= 500;
    if (attempt < maxAttempts && retryable) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter =
        retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter * 1_000
          : Math.min(2 ** attempt * 1_000, 30_000);
      console.log(
        `Box AI is not ready yet; retrying in ${Math.ceil(delayMs / 1_000)}s ` +
          `(${attempt}/${maxAttempts})...`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
      continue;
    }

    await responseError(response, `Calling Box AI ${path}`);
  }

  throw new Error(`Calling Box AI ${path} exhausted all retries.`);
}

export function askBox(token: string, file: BoxFile) {
  return boxAiRequest<BoxAiAskResponse>(token, '/ai/ask', {
    mode: 'single_item_qa',
    prompt:
      'Return exactly one sentence containing only the billing period, amount due, due date, electricity usage, and gas usage. Do not include the customer name, service address, account number, meter number, payment method, or any other identifying information.',
    items: [{ type: 'file', id: file.id }],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function validValue(key: MetadataKey, value: string): boolean {
  if (value.length > 64 || /[\r\n\x00-\x1f\x7f]/.test(value)) return false;
  if (key === 'statementDate' || key === 'dueDate') return validDate(value);
  if (key === 'billingPeriod') {
    const dates = value.split(' to ');
    return dates.length === 2 && dates.every(validDate) && dates[0] <= dates[1];
  }
  if (key === 'electricityUsage') return /^\d{1,9}(?:\.\d{1,3})? kWh$/.test(value);
  if (key === 'gasUsage') return /^\d{1,9}(?:\.\d{1,3})? therms?$/.test(value);
  if (key === 'ratePlan') return /^[A-Z][A-Z0-9-]{0,23}$/.test(value);
  return /^(?:USD |\$)?-?\d{1,9}(?:\.\d{1,2})?$/.test(value);
}

export function parseExtractionResponse(value: unknown, requested: readonly MetadataKey[]): BoxAiExtractResponse {
  if (!isRecord(value) || !isRecord(value.answer)) throw new Error('Box returned invalid structured metadata.');
  const answer: ExtractionAnswer = {};
  for (const key of metadataKeys) {
    if (!requested.includes(key) || !Object.hasOwn(value.answer, key)) continue;
    const raw = value.answer[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string' || !validValue(key, raw.trim())) throw new Error('Box returned an invalid billing metadata value.');
    answer[key] = raw.trim();
  }
  return { answer };
}

export async function extractBoxMetadata(
  token: string,
  file: BoxFile,
  fields: ReturnType<typeof field>[]
): Promise<BoxAiExtractResponse> {
  const requested = fields.map(item => item.key);
  if (requested.length === 0 || new Set(requested).size !== requested.length || requested.some(key => !metadataKeys.includes(key as MetadataKey))) {
    throw new Error('Only the supported billing metadata fields may be requested.');
  }
  const response = await boxAiRequest<unknown>(token, '/ai/extract_structured', {
    items: [{ type: 'file', id: file.id }],
    fields,
    include_confidence_score: false,
  });
  return parseExtractionResponse(response, requested as MetadataKey[]);
}

export async function applyGlobalProperties(
  token: string,
  file: BoxFile,
  properties: Record<string, unknown>
) {
  const response = await fetch(
    `https://api.box.com/2.0/files/${file.id}/metadata/global/properties`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries(properties).flatMap(([key, value]) => {
            if (value === undefined || value === null) {
              return [];
            }
            return [
              [key, typeof value === 'string' ? value : JSON.stringify(value)],
            ];
          })
        )
      ),
    }
  );

  if (!response.ok) {
    await responseError(response, 'Applying Box metadata');
  }
}
