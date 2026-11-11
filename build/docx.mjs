import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import { convertImage } from './images.mjs';

const XML_ESC = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const unescapeXml = s => s.replace(/&(amp|lt|gt|quot|apos);/g, m => XML_ESC[m]);

async function extractRunFormatting(docxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(docxPath));
  const xml = await zip.file('word/document.xml').async('string');
  const runs = [];
  for (const match of xml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const run = match[0];
    const text = [...run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => unescapeXml(m[1])).join('');
    if (!text.trim()) continue;
    const color = run.match(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/i)?.[1];
    const highlight = run.match(/<w:highlight\b[^>]*w:val="([^"]+)"/i)?.[1];
    if (color || highlight) runs.push({ text, color, highlight });
  }
  return runs;
}

function applyRunFormatting(html, formats) {
  const $ = cheerio.load(`<main id="doc">${html}</main>`, null, false);
  const highlightMap = { yellow:'#fff59d', green:'#b9f6ca', cyan:'#b2ebf2', magenta:'#f8bbd0', blue:'#bbdefb', red:'#ffcdd2', darkBlue:'#90caf9', darkRed:'#ef9a9a', darkYellow:'#ffe082', darkGreen:'#a5d6a7', darkCyan:'#80deea', darkMagenta:'#ce93d8', lightGray:'#eeeeee', darkGray:'#bdbdbd', black:'#9e9e9e' };
  for (const fmt of formats) {
    let applied = false;
    $('#doc').find('*').contents().filter((_, n) => n.type === 'text').each((_, n) => {
      if (applied || !n.data.includes(fmt.text)) return;
      const i = n.data.indexOf(fmt.text);
      const before = n.data.slice(0, i), after = n.data.slice(i + fmt.text.length);
      const style = [fmt.color && `color:#${fmt.color}`, fmt.highlight && `background:${highlightMap[fmt.highlight] || fmt.highlight}`].filter(Boolean).join(';');
      $(n).replaceWith(`${escapeHtml(before)}<span style="${style}">${escapeHtml(fmt.text)}</span>${escapeHtml(after)}`);
      applied = true;
    });
  }
  $('#doc table').wrap('<div class="table-scroll"></div>');
  $('#doc img').attr('loading', 'lazy');
  return $('#doc').html();
}

function escapeHtml(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function convertDocx(input, { assetDir, assetUrlBase }) {
  let imageNo = 0;
  const result = await mammoth.convertToHtml({ path: input }, {
    styleMap: ["u => u", "strike => s"],
    includeDefaultStyleMap: true,
    convertImage: mammoth.images.imgElement(async image => {
      const ext = image.contentType.split('/').pop().replace('jpeg','jpg');
      const raw = path.join(assetDir, `embedded-${++imageNo}.${ext}`);
      const webp = path.join(assetDir, `embedded-${imageNo}.webp`);
      await fs.mkdir(assetDir, { recursive: true });
      await fs.writeFile(raw, await image.read('buffer'));
      await convertImage(raw, webp);
      await fs.rm(raw);
      return { src: `${assetUrlBase}/embedded-${imageNo}.webp`, alt: '' };
    })
  });
  const formats = await extractRunFormatting(input);
  return { html: applyRunFormatting(result.value, formats), warnings: result.messages };
}
