// Minimal store-only (uncompressed) ZIP writer. PNGs are already compressed, so
// deflating them again buys almost nothing — which means a ~70-line writer does
// the job of a zip dependency.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// A fixed 1980-01-01 DOS timestamp keeps archives byte-identical between runs;
// nothing downstream reads the mtime.
const DOS_TIME = 0;
const DOS_DATE = 33;

// files: [{ name, data: Uint8Array }] -> Blob
export function zipStore(files) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const name = encoder.encode(f.name);
    return { name, data: f.data, crc: crc32(f.data) };
  });

  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const buffer = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  const u16 = (v) => {
    view.setUint16(offset, v, true);
    offset += 2;
  };
  const u32 = (v) => {
    view.setUint32(offset, v >>> 0, true);
    offset += 4;
  };
  const bytes = (b) => {
    buffer.set(b, offset);
    offset += b.length;
  };

  for (const entry of entries) {
    entry.offset = offset;
    u32(0x04034b50); // local file header
    u16(20); // version needed
    u16(0x0800); // UTF-8 filename
    u16(0); // stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.name.length);
    u16(0); // extra length
    bytes(entry.name);
    bytes(entry.data);
  }

  const centralStart = offset;
  for (const entry of entries) {
    u32(0x02014b50); // central directory header
    u16(20); // version made by
    u16(20); // version needed
    u16(0x0800);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk number
    u16(0); // internal attrs
    u32(0); // external attrs
    u32(entry.offset);
    bytes(entry.name);
  }

  // Capture the directory's size before the trailer starts moving `offset`.
  const centralEnd = offset;
  u32(0x06054b50); // end of central directory
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(centralEnd - centralStart);
  u32(centralStart);
  u16(0); // comment length

  return new Blob([buffer], { type: "application/zip" });
}
