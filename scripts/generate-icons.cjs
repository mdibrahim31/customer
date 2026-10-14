const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}
const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  table[i] = c;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

function makePNG(width, height, getPixel) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = chunk('IDAT', zlib.deflateSync(rawData));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, iend]);
}

const apps = [
  { name: 'main', bg: [234, 88, 12], letter: 'FH', label: 'FoodHub' },
  { name: 'customer', bg: [234, 88, 12], letter: 'C', label: 'Customer' },
  { name: 'vendor', bg: [5, 150, 105], letter: 'V', label: 'Vendor' },
  { name: 'orders', bg: [225, 29, 72], letter: 'K', label: 'Orders' },
  { name: 'rider', bg: [217, 119, 6], letter: 'R', label: 'Rider' },
  { name: 'admin', bg: [190, 18, 60], letter: 'A', label: 'Admin' },
  { name: 'subadmin', bg: [79, 70, 229], letter: 'S', label: 'Sub-Admin' },
];

apps.forEach(app => {
  // Generate SVG icon
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgb(${app.bg[0]}, ${app.bg[1]}, ${app.bg[2]})" />
      <stop offset="100%" stop-color="rgb(${Math.max(0, app.bg[0] - 40)}, ${Math.max(0, app.bg[1] - 40)}, ${Math.max(0, app.bg[2] - 40)})" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.3" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="170" fill="rgba(255,255,255,0.15)" filter="url(#shadow)" />
  <text x="256" y="295" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${app.letter.length > 1 ? 160 : 200}" fill="#ffffff" text-anchor="middle" letter-spacing="-2">${app.letter}</text>
  <text x="256" y="440" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="34" fill="rgba(255,255,255,0.9)" text-anchor="middle" letter-spacing="2">${app.label.toUpperCase()}</text>
</svg>`;

  fs.writeFileSync(path.join(iconsDir, `icon-${app.name}.svg`), svgContent);

  // Generate 192x192 & 512x512 PNGs
  [192, 512].forEach(size => {
    const pngBuf = makePNG(size, size, (x, y, w, h) => {
      // Rounded rect mask: corner radius = size * 0.25
      const r = size * 0.25;
      let inBounds = true;
      if (x < r && y < r && Math.hypot(x - r, y - r) > r) inBounds = false;
      if (x > w - r && y < r && Math.hypot(x - (w - r), y - r) > r) inBounds = false;
      if (x < r && y > h - r && Math.hypot(x - r, y - (h - r)) > r) inBounds = false;
      if (x > w - r && y > h - r && Math.hypot(x - (w - r), y - (h - r)) > r) inBounds = false;

      if (!inBounds) return [0, 0, 0, 0];

      // Subtle gradient
      const factor = 1 - (y / h) * 0.2;
      const red = Math.round(app.bg[0] * factor);
      const green = Math.round(app.bg[1] * factor);
      const blue = Math.round(app.bg[2] * factor);

      // Inner circular badge
      const cx = w / 2;
      const cy = h / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < size * 0.35) {
        return [
          Math.min(255, red + 35),
          Math.min(255, green + 35),
          Math.min(255, blue + 35),
          255
        ];
      }

      return [red, green, blue, 255];
    });

    fs.writeFileSync(path.join(iconsDir, `icon-${app.name}-${size}.png`), pngBuf);
  });
});

console.log('Successfully generated all icons in /public/icons');
