import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function readBounded(file, limit) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Expected a regular input file within the size limit.');
    const chunks = []; let total = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, limit + 1 - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw new Error('Input file exceeds size limit.');
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks);
  } finally { await handle.close(); }
}
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Reviewed bill has missing or unexpected fields.');
}
function text(value, limit = 300) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid reviewed bill text.');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid invoice date.');
}
export function validateReviewedBill(record, pdfBytes) {
  object(record, ['document', 'review', 'bill']);
  object(record.document, ['sha256']);
  if (typeof record.document.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.document.sha256) || createHash('sha256').update(pdfBytes).digest('hex') !== record.document.sha256) throw new Error('PDF digest does not match the reviewed document.');
  object(record.review, ['reviewer', 'reviewedAt', 'confirmedFieldsMatchDocument']);
  text(record.review.reviewer);
  if (record.review.confirmedFieldsMatchDocument !== true || typeof record.review.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.review.reviewedAt) || !Number.isFinite(Date.parse(record.review.reviewedAt)) || new Date(record.review.reviewedAt).toISOString() !== record.review.reviewedAt || Date.parse(record.review.reviewedAt) > Date.now()) throw new Error('A completed, dated document review is required.');
  const bill = record.bill;
  object(bill, ['vendorName', 'vendorAddress', 'vendorEmail', 'invoiceNumber', 'amount', 'currency', 'issuedAt', 'dueAt', 'propertyAddress', 'parcelId', 'taxPeriod']);
  for (const field of ['vendorName', 'invoiceNumber', 'propertyAddress', 'parcelId', 'taxPeriod']) text(bill[field]);
  object(bill.vendorAddress, ['address_line_1', 'city', 'state', 'postal_code', 'country']);
  for (const value of Object.values(bill.vendorAddress)) text(value);
  if (bill.vendorAddress.country !== 'US' || !/^[A-Z]{2}$/.test(bill.vendorAddress.state) || !/^\d{5}(-\d{4})?$/.test(bill.vendorAddress.postal_code)) throw new Error('Expected a US vendor address.');
  if (typeof bill.vendorEmail !== 'string' || bill.vendorEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bill.vendorEmail)) throw new Error('Invalid vendor contact email.');
  if (bill.currency !== 'USD' || typeof bill.amount !== 'string' || !/^(0|[1-9]\d{0,9})\.\d{2}$/.test(bill.amount) || BigInt(bill.amount.replace('.', '')) <= 0n) throw new Error('Expected a positive USD amount with exactly two decimal places.');
  date(bill.issuedAt); date(bill.dueAt);
  if (bill.dueAt < bill.issuedAt) throw new Error('Due date precedes invoice date.');
  return structuredClone(bill);
}
export async function loadReviewedBill(pdfPath, recordPath) {
  if (!pdfPath || !recordPath) throw new Error('Provide both the PDF and its reviewed JSON record.');
  let record;
  try { record = JSON.parse((await readBounded(recordPath, 65536)).toString('utf8')); }
  catch { throw new Error('Cannot read a valid reviewed JSON record within 64 KiB.'); }
  const pdfBytes = await readBounded(pdfPath, 25 * 1024 * 1024);
  if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Selected file does not have a PDF header.');
  return { bill: validateReviewedBill(record, pdfBytes), pdfBytes };
}
