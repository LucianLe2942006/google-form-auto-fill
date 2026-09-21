const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a PNG file using pure Node.js (crc32 + zlib deflate)
function createPNG(width, height, getRGBA) {
  const bytesPerPixel = 4;
  const rawData = Buffer.alloc(height * (1 + width * bytesPerPixel));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getRGBA(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let table = crc32.table;
    if (!table) {
      table = crc32.table = new Int32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
      }
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
  }

  function chunk(type, data) {
    const len = data ? data.length : 0;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    if (data) data.copy(buf, 8);
    const crcVal = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crcVal, 8 + len);
    return buf;
  }

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderIcon(x, y, w, h) {
  // Center coordinates normalized -1 to 1
  const nx = (x / (w - 1)) * 2 - 1;
  const ny = (y / (h - 1)) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Rounded rectangle background (radius ~ 0.8)
  const cornerR = 0.35;
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const dx = Math.max(0, ax - (1 - cornerR));
  const dy = Math.max(0, ay - (1 - cornerR));
  const cornerDist = Math.sqrt(dx * dx + dy * dy);

  if (cornerDist > cornerR) {
    return [0, 0, 0, 0]; // Transparent outside rounded rect
  }

  // Gradient background: Deep Indigo/Purple (top left #6366f1 to bottom right #a855f7)
  const grad = (nx + ny + 2) / 4;
  let r = Math.round(99 + grad * (168 - 99));
  let g = Math.round(102 + grad * (85 - 102));
  let b = Math.round(241 + grad * (247 - 241));

  // Sparkle / Lightning / Form symbol inside
  // Central lightning / checkmark
  const insideSymbol = 
    (Math.abs(nx + 0.1) < 0.35 && Math.abs(ny) < 0.5 && (nx - ny * 0.4 > -0.2 && nx - ny * 0.4 < 0.25)) ||
    (Math.abs(nx - 0.2) < 0.15 && Math.abs(ny + 0.2) < 0.15) ||
    (dist < 0.25);

  if (insideSymbol) {
    return [255, 255, 255, 255]; // Crisp white icon
  }

  // Slight subtle inner glow / border
  if (cornerDist > cornerR - 0.08) {
    return [Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40), 255];
  }

  return [r, g, b, 255];
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size, size, renderIcon);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
