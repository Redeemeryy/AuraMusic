// One vector source for the web brand, launcher, themed and notification icons.
// Run from any directory: node scripts/generate-icons.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const res = 'app/src/main/res';
const ink = '#52778F';
const paper = '#F6F9FC';
// A single continuous rounded stroke. No shadows, textures or lettering.
const note = 'M43 62 C37 59 27 62 27 69 C27 77 43 73 43 66 L43 36 L70 29 L70 59 C70 66 54 70 54 62 C54 55 64 52 70 55';
const stroke = 4.6;
const backup = path.join(root, 'artifacts', 'icon-backups', new Date().toISOString().replace(/[:.]/g, '-'));
function write(relative, data) {
  const file = path.join(root, relative);
  if (fs.existsSync(file)) {
    const old = path.join(backup, relative);
    fs.mkdirSync(path.dirname(old), { recursive: true });
    fs.copyFileSync(file, old);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}
function svg({ background = true, round = false, mono = false, compact = false } = {}) {
  const viewBox = compact ? '20 23 58 58' : '0 0 100 100';
  const bg = !background ? '' : round
    ? `<circle cx="50" cy="50" r="50" fill="${paper}"/>`
    : `<rect width="100" height="100" rx="22" fill="${paper}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${bg}<path d="${note}" fill="none" stroke="${mono ? '#FFFFFF' : ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function vector({ mono = false, notification = false } = {}) {
  // The foreground fits inside the adaptive icon's 66/108 safe circle.
  const group = notification ? 'android:translateX="-8.276" android:translateY="-9.517" android:scaleX="0.413793" android:scaleY="0.413793"' : 'android:translateX="4" android:translateY="4"';
  const size = notification ? 24 : 108;
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${size}dp" android:height="${size}dp"
    android:viewportWidth="${size}" android:viewportHeight="${size}">
    <group ${group}>
        <path android:fillColor="#00000000" android:strokeColor="${mono ? '#FFFFFFFF' : ink}"
            android:strokeWidth="${stroke}" android:strokeLineCap="round" android:strokeLineJoin="round"
            android:pathData="${note}" />
    </group>
</vector>
`;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    async function render(source, size, file) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${source}`);
      write(file, await page.screenshot({ omitBackground: true }));
    }
    write('design/app-icon-line.svg', svg());
    write('design/notification-icon-line.svg', svg({ background: false, mono: true, compact: true }));
    for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
      await render(svg(), size, `${res}/mipmap-${density}/ic_launcher.png`);
      await render(svg({ round: true }), size, `${res}/mipmap-${density}/ic_launcher_round.png`);
    }
    for (const [file, size] of [['design/app-icon-light.png', 1024], ['art/logo.png', 512], ['app/src/main/assets/web/logo.png', 512], ['app/src/main/assets/web/favicon.png', 64], [`${res}/drawable/ic_launcher.png`, 192]]) {
      await render(svg(), size, file);
    }
    write(`${res}/drawable/ic_brand_foreground.xml`, vector());
    write(`${res}/drawable/ic_brand_monochrome.xml`, vector({ mono: true }));
    write(`${res}/drawable/ic_notification_music.xml`, vector({ mono: true, notification: true }));
    write(`${res}/values/icon_colors.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_brand_background">${paper}</color>\n</resources>\n`);
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      for (const version of [26, 33]) {
        write(`${res}/mipmap-anydpi-v${version}/${name}.xml`, `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_brand_background" />
    <foreground android:drawable="@drawable/ic_brand_foreground" />${version === 33 ? '\n    <monochrome android:drawable="@drawable/ic_brand_monochrome" />' : ''}
</adaptive-icon>
`);
      }
    }
    // Actual-size contact sheet, including dark and light notification surfaces.
    const icon = svg();
    const notification = svg({ background: false, mono: true, compact: true });
    await page.setViewportSize({ width: 840, height: 400 });
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#EAF0F5;color:#33495B;font:15px system-ui;padding:28px}h1{font-size:18px;margin:0 0 28px}.row{display:flex;gap:28px;align-items:center}.sample{text-align:center}.tile{display:flex;align-items:center;justify-content:center;height:210px;min-width:100px}.label{margin-top:12px;font-size:13px}.dark{background:#253543;color:white;padding:18px;border-radius:18px}.light{background:white;padding:18px;border-radius:18px}.light svg path{stroke:#52778F}svg{display:block}</style><h1>Lingyin · continuous line mark</h1><div class="row"><div class="sample"><div class="tile">${icon.replace('<svg ', '<svg width="192" height="192" ')}</div><div class="label">Launcher 192 px</div></div><div class="sample"><div class="tile">${icon.replace('<svg ', '<svg width="48" height="48" ')}</div><div class="label">Launcher 48 px</div></div><div class="sample"><div class="tile dark">${notification.replace('<svg ', '<svg width="24" height="24" ')}</div><div class="label">Notification 24 px</div></div><div class="sample"><div class="tile light">${notification.replace('<svg ', '<svg width="24" height="24" ')}</div><div class="label">Light surface 24 px</div></div><div class="sample"><div class="tile dark">${notification.replace('<svg ', '<svg width="48" height="48" ')}</div><div class="label">Notification 48 px</div></div></div>`);
    write('design/icon-line-preview.png', await page.screenshot());
    // Check transparent notification raster pixels: no colored or opaque background.
    for (const size of [24, 48]) {
      await render(notification, size, `artifacts/notification-${size}.png`);
      const pixels = await page.evaluate(async () => {
        const raw = new XMLSerializer().serializeToString(document.querySelector('svg'));
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(raw);
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, innerWidth, innerHeight);
        const data = ctx.getImageData(0, 0, innerWidth, innerHeight).data;
        let visible = 0, colored = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { visible++; if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) colored++; }
        return { visible, colored, cornerAlpha: data[3], coverage: visible / (innerWidth * innerHeight) };
      });
      if (pixels.colored || pixels.cornerAlpha || pixels.coverage > 0.45 || pixels.coverage < 0.1) throw new Error(`Invalid notification alpha: ${JSON.stringify(pixels)}`);
      console.log(`PASS notification ${size}px: ${JSON.stringify(pixels)}`);
    }
    console.log('Generated launcher densities, adaptive/themed vectors, web assets and design/icon-line-preview.png');
    console.log(`Prior resources backed up at ${backup}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
