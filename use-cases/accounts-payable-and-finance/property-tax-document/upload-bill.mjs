#!/usr/bin/env node
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadReviewedBill } from './reviewed-bill.mjs';

export async function uploadBill({ pdfPath, recordPath, env = process.env, fetchImpl = fetch }) {
  const mode = env.AP_BILL_MODE || 'draft';
  const environment = env.AP_ENV || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) throw new Error('AP_ENV must be sandbox or production.');
  if (!['draft', 'bill'].includes(mode)) throw new Error('AP_BILL_MODE must be draft or bill.');
  if (mode === 'bill' && env.AP_ALLOW_SUBMIT_BILL !== 'true') throw new Error('Submitted bill mode requires AP_ALLOW_SUBMIT_BILL=true.');
  // Validate document identity and all reviewed fields before authentication or writes.
  const { bill, pdfBytes } = await loadReviewedBill(pdfPath, recordPath);
  const base = env.AP_API_BASE_URL;
  if (!base) throw new Error('Provide AP_API_BASE_URL for the target accounts-payable API.');
  async function request(path, options) {
    const response = await fetchImpl(`${base}${path}`, { ...options, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Accounts-payable request failed (HTTP ${response.status}); inspect the account before retrying.`);
    try { return await response.json(); }
    catch { throw new Error('Invalid accounts-payable response; inspect the account before retrying.'); }
  }
  let token = env.AP_ACCESS_TOKEN;
  if (!token) {
    if (!env.AP_CLIENT_ID || !env.AP_CLIENT_SECRET) throw new Error('Provide an AP access token or client credentials.');
    const response = await request('/developer/v1/token', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.AP_CLIENT_ID}:${env.AP_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'bills:read bills:write vendors:read vendors:write entities:read' }),
    });
    token = response.access_token;
  }
  if (typeof token !== 'string' || !token.trim()) throw new Error('Missing AP access token.');
  async function api(method, path, json, form) {
    return request(path, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: form || (json ? JSON.stringify(json) : undefined) });
  }
  const entities = await api('GET', '/developer/v1/entities');
  if (!Array.isArray(entities.data)) throw new Error('Invalid entity response.');
  const entityId = (entities.data.find(entity => entity.is_primary) || entities.data[0])?.id;
  const found = await api('GET', `/developer/v1/vendors?name=${encodeURIComponent(bill.vendorName)}&page_size=5`);
  if (!Array.isArray(found.data)) throw new Error('Invalid vendor response.');
  const matches = found.data.filter(vendor => typeof vendor.name === 'string' && vendor.name.toLowerCase() === bill.vendorName.toLowerCase());
  if (matches.length > 1) throw new Error('Ambiguous vendor match; resolve duplicates before uploading.');
  const vendor = matches[0] || await api('POST', '/developer/v1/vendors', { name: bill.vendorName, country: bill.vendorAddress.country, state: bill.vendorAddress.state, address: bill.vendorAddress, business_vendor_contacts: { email: bill.vendorEmail } });
  if (typeof vendor.id !== 'string' || !vendor.id) throw new Error('Missing vendor identity.');
  const memo = `Property tax: ${bill.propertyAddress}; parcel ${bill.parcelId}; ${bill.taxPeriod}`;
  const endpoint = mode === 'bill' ? '/developer/v1/bills' : '/developer/v1/bills/drafts';
  const created = await api('POST', endpoint, {
    vendor_id: vendor.id, invoice_number: bill.invoiceNumber, invoice_currency: bill.currency,
    issued_at: bill.issuedAt, due_at: bill.dueAt, memo,
    line_items: [{ amount: bill.amount, memo }], ...(entityId ? { entity_id: entityId } : {}),
  });
  if (typeof created.id !== 'string' || !created.id) throw new Error('Bill creation response has no identity; inspect the account before retrying.');
  const form = new FormData();
  form.append('attachment_type', 'INVOICE');
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), basename(pdfPath));
  try { await api('POST', `${endpoint}/${encodeURIComponent(created.id)}/attachments`, undefined, form); }
  catch { throw new Error(`Bill ${created.id} was created, but attachment completion is unconfirmed. Inspect it before retrying; do not create a duplicate.`); }
  return { id: created.id, environment, mode };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  uploadBill({ pdfPath: process.argv[2], recordPath: process.argv[3] })
    .then(result => console.log(`Attached reviewed PDF to ${result.environment} ${result.mode} ${result.id}.`))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Upload failed.'); process.exitCode = 1; });
}
