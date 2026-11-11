import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
test('sample build produced required PWA files',async()=>{for(const f of ['dist/index.html','dist/sw.js','dist/version.json','dist/search-index.json','dist/manifest.webmanifest'])await assert.doesNotReject(()=>fs.access(f));});
