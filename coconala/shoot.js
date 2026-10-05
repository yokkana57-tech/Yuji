const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const mode = process.argv[2];
  if (mode === 'samples') {
    for (const n of ['teishoku', 'salon']) {
      const url = 'file://' + path.resolve('samples', n + '.html');
      for (const [tag, w, h, dpr] of [['pc', 1440, 900, 1], ['sp', 390, 844, 2]]) {
        const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
        await p.goto(url); await p.addStyleTag({ content: '.sample{display:none}' });
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: `images/src/${n}-${tag}.png` });
        if (tag === 'sp') await p.screenshot({ path: `images/src/${n}-${tag}-full.png`, fullPage: true });
        await p.close();
      }
    }
  } else {
    const fs = require('fs');
    for (const f of fs.readdirSync('images/src').filter(f => /^\d\d.*\.html$/.test(f)).sort()) {
      const p = await b.newPage({ viewport: { width: 1220, height: 1000 } });
      await p.goto('file://' + path.resolve('images/src', f));
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: 'images/' + f.replace('.html', '.png') });
      await p.close();
    }
  }
  await b.close();
})();
