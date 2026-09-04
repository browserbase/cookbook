import { inflateRawSync } from "node:zlib";

const MAX_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const bad = (): never => { throw new Error("Invalid or unsupported download ZIP"); };

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = {
  name: string;
  nameBytes: Buffer;
  directory: boolean;
  flags: number;
  method: number;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
  dataStart: number;
};

/** In-memory ZIP reader. Validates the whole archive before returning any file evidence. */
export function readDownloadZip(zip: Uint8Array): Array<{ name: string; data: Buffer }> {
  try {
    return readArchive(zip);
  } catch {
    return bad();
  }
}

function readArchive(input: Uint8Array): Array<{ name: string; data: Buffer }> {
  if (!(input instanceof Uint8Array) || input.byteLength < 22 || input.byteLength > MAX_ZIP_BYTES) bad();
  // Own the bytes so mutations by the caller cannot change validated offsets or file contents.
  const zip = Buffer.from(input);
  const need = (offset: number, size: number, limit = zip.length) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > limit) bad();
  };
  const u16 = (offset: number) => { need(offset, 2); return zip.readUInt16LE(offset); };
  const u32 = (offset: number) => { need(offset, 4); return zip.readUInt32LE(offset); };
  const extra = (start: number, length: number) => {
    const end = start + length;
    need(start, length);
    while (start < end) {
      need(start, 4, end);
      const tag = u16(start), size = u16(start + 2);
      // ZIP64 and alternate Unicode paths must not override the validated central name.
      if (tag === 0x0001 || tag === 0x7075) bad();
      start += 4;
      need(start, size, end);
      start += size;
    }
  };

  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 22 - 65535); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === zip.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) bad();
  const count = u16(eocd + 10), centralSize = u32(eocd + 12), centralOffset = u32(eocd + 16);
  if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0 || u16(eocd + 8) !== count || count === 0xffff || count > MAX_ENTRIES || centralSize === 0xffffffff || centralOffset === 0xffffffff) bad();
  if (centralOffset + centralSize !== eocd) bad();
  need(centralOffset, centralSize, eocd);

  const entries: Entry[] = [];
  const names = new Map<string, boolean>();
  let cursor = centralOffset, total = 0;
  for (let index = 0; index < count; index++) {
    need(cursor, 46, eocd);
    if (u32(cursor) !== 0x02014b50) bad();
    const version = u16(cursor + 6), flags = u16(cursor + 8), method = u16(cursor + 10);
    const crc = u32(cursor + 16), compressed = u32(cursor + 20), size = u32(cursor + 24);
    const nameSize = u16(cursor + 28), extraSize = u16(cursor + 30), commentSize = u16(cursor + 32);
    const disk = u16(cursor + 34), attributes = u32(cursor + 38), offset = u32(cursor + 42);
    if (version > 20 || (flags & ~0x080e) !== 0 || (method !== 0 && method !== 8) || (method === 0 && (flags & 6) !== 0) || disk !== 0 || compressed === 0xffffffff || size === 0xffffffff || offset === 0xffffffff || size > MAX_ENTRY_BYTES) bad();
    total += size;
    if (total > MAX_TOTAL_BYTES) bad();
    need(cursor + 46, nameSize + extraSize + commentSize, eocd);
    if (!nameSize) bad();
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameSize);
    if (!(flags & 0x0800) && nameBytes.some(byte => byte > 127)) bad();
    const name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    if (/^[\/]|^[A-Za-z]:|[\\\x00-\x1f\x7f]/.test(name)) bad();
    const directory = name.endsWith("/");
    const path = directory ? name.slice(0, -1) : name;
    if (!path || path.split("/").some(part => !part || part === "." || part === ".." || part.includes(":") || /[. ]$/.test(part))) bad();
    const canonical = path.normalize("NFC").toLowerCase();
    if (names.has(canonical)) bad();
    names.set(canonical, directory);
    const unixType = (attributes >>> 16) & 0xf000;
    if (unixType !== 0 && unixType !== (directory ? 0x4000 : 0x8000)) bad();
    if ((attributes & 0x10) !== 0 && !directory) bad();
    if (directory && (size !== 0 || crc !== 0)) bad();
    extra(cursor + 46 + nameSize, extraSize);
    entries.push({ name, nameBytes, directory, flags, method, crc, compressed, size, offset, dataStart: 0 });
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  if (cursor !== eocd) bad();
  for (const name of names.keys()) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) if (names.get(parts.slice(0, i).join("/")) === false) bad();
  }

  // Central ordering is arbitrary, but local records must neither overlap nor hide unlisted data.
  const ordered = [...entries].sort((a, b) => a.offset - b.offset);
  let localEnd = 0;
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!;
    const start = entry.offset, end = ordered[index + 1]?.offset ?? centralOffset;
    if (start !== localEnd) bad();
    need(start, 30, end);
    if (u32(start) !== 0x04034b50 || u16(start + 4) > 20 || u16(start + 6) !== entry.flags || u16(start + 8) !== entry.method) bad();
    const localCrc = u32(start + 14), localCompressed = u32(start + 18), localSize = u32(start + 22);
    const nameSize = u16(start + 26), extraSize = u16(start + 28);
    need(start + 30, nameSize + extraSize, end);
    if (!zip.subarray(start + 30, start + 30 + nameSize).equals(entry.nameBytes)) bad();
    extra(start + 30 + nameSize, extraSize);
    entry.dataStart = start + 30 + nameSize + extraSize;
    need(entry.dataStart, entry.compressed, end);
    const dataEnd = entry.dataStart + entry.compressed;
    if (entry.flags & 8) {
      if ((localCrc !== 0 && localCrc !== entry.crc) || (localCompressed !== 0 && localCompressed !== entry.compressed) || (localSize !== 0 && localSize !== entry.size)) bad();
      const descriptorSize = end - dataEnd;
      if (descriptorSize !== 12 && descriptorSize !== 16) bad();
      if (descriptorSize === 16 && u32(dataEnd) !== 0x08074b50) bad();
      const descriptor = dataEnd + (descriptorSize === 16 ? 4 : 0);
      if (u32(descriptor) !== entry.crc || u32(descriptor + 4) !== entry.compressed || u32(descriptor + 8) !== entry.size) bad();
    } else if (dataEnd !== end || localCrc !== entry.crc || localCompressed !== entry.compressed || localSize !== entry.size) bad();
    localEnd = end;
  }
  if (localEnd !== centralOffset) bad();

  const files: Array<{ name: string; data: Buffer }> = [];
  for (const entry of entries) {
    const compressed = zip.subarray(entry.dataStart, entry.dataStart + entry.compressed);
    let data: Buffer;
    if (entry.method === 0) {
      if (entry.compressed !== entry.size) bad();
      data = Buffer.from(compressed);
    } else {
      const inflated = inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.size), info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
      if (inflated.engine.bytesWritten !== compressed.length) bad();
      data = inflated.buffer;
    }
    if (data.length !== entry.size || crc32(data) !== entry.crc) bad();
    if (!entry.directory) files.push({ name: entry.name, data });
  }
  return files;
}
