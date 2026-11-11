import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import * as cheerio from 'cheerio';
import { generateSW } from 'workbox-build';
import { convertDocx } from './docx.mjs';
import { convertImage, makeThumbnail } from './images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.resolve(process.argv[2] || path.join(ROOT, 'content'));
const DIST = path.join(ROOT, 'dist');
const CONFIG = { wideAt: 3, largeAt: 6, siteTitle: 'Emergency Information' };
const IMAGE_RE = /\.(jpe?g|png)$/i, DOC_RE = /\.docx$/i;
const ignored = name => name.startsWith('_') || name.startsWith('~$') || name.startsWith('.');
const cleanName = name => name.replace(/^\d{2}\s+/, '').replace(/\.[^.]+$/, '');
const orderNo = name => Number(name.match(/^(\d{2})\s+/)?.[1] ?? 999);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'item';
const hue = s => [...s].reduce((n,c)=>n+c.charCodeAt(0),0)%360;
const updated = new Date().toISOString();
let shell;
const pages = [], searchDocs = [], warnings = [];

async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function scan(dir, rel='') {
  const entries = (await fs.readdir(dir,{withFileTypes:true})).filter(e=>!ignored(e.name)).sort((a,b)=>orderNo(a.name)-orderNo(b.name)||a.name.localeCompare(b.name));
  const node={type:'folder',name:rel?cleanName(path.basename(dir)):CONFIG.siteTitle,rel,source:dir,folders:[],docs:[],images:[]};
  for(const e of entries){const p=path.join(dir,e.name); if(e.isDirectory())node.folders.push(await scan(p,path.join(rel,e.name))); else if(DOC_RE.test(e.name))node.docs.push({type:'doc',name:cleanName(e.name),file:e.name,source:p,rel:path.join(rel,e.name)}); else if(IMAGE_RE.test(e.name))node.images.push({name:e.name,source:p});}
  return node;
}
function idFor(prefix,rel){return `${prefix}-${slug(rel)}-${crypto.createHash('sha1').update(rel).digest('hex').slice(0,7)}`}
function tileSize(n){return n>=CONFIG.largeAt?'large':n>=CONFIG.wideAt?'wide':''}
function page(html,{title,breadcrumb='',base='../'}){return shell.replaceAll('{{TITLE}}',esc(title)).replaceAll('{{BASE}}',base).replaceAll('{{BREADCRUMB}}',esc(breadcrumb)).replaceAll('{{CONTENT}}',html).replaceAll('{{UPDATED}}',updated)}
async function writePage(file,html){const out=path.join(DIST,file);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,html);pages.push(file.replaceAll('\\','/'))}
function directTarget(folder){return folder.folders.length===0&&folder.docs.length===1?folder.docs[0].url:folder.url}
async function prep(node,crumbs=[]) {
  node.id=idFor('folder',node.rel||'home'); node.url=node.rel?`pages/${node.id}.html`:'index.html'; node.crumbs=[...crumbs,node.name];
  for(const d of node.docs){d.id=idFor('doc',d.rel);d.url=`pages/${d.id}.html`;d.crumbs=[...node.crumbs,d.name]}
  const cover=node.images.find(i=>/^cover\.(jpe?g|png)$/i.test(i.name));
  if(cover){node.cover=`assets/content/${node.id}-cover.webp`;await makeThumbnail(cover.source,path.join(DIST,node.cover));}
  node.gallery=[];
  for(const img of node.images.filter(i=>!/^cover\.(jpe?g|png)$/i.test(i.name))){const out=`assets/content/${node.id}-${slug(img.name)}.webp`;await convertImage(img.source,path.join(DIST,out));node.gallery.push(out)}
  for(const child of node.folders)await prep(child,node.crumbs);
}
function tile(item){const isFolder=item.type==='folder', count=isFolder?item.folders.length:0, cls=isFolder?tileSize(count):'';const target=isFolder?directTarget(item):item.url;const cover=isFolder&&item.cover?`<img src="../${item.cover}" alt="">`:'';const style=`--tile:hsl(${hue(item.name)} 45% 35%)`;return `<a class="tile ${cls}" style="${style}" href="../${target}">${cover}<span class="title">${esc(item.name)}</span>${isFolder?`<span class="count">${count} ${count===1?'topic':'topics'}</span>`:''}</a>`}
function gallery(node){return node.gallery.length?`<section><h2>Images</h2><div class="gallery">${node.gallery.map((u,i)=>`<img src="../${u}" alt="${esc(node.name)} image ${i+1}" loading="lazy">`).join('')}</div></section>`:''}
async function renderFolder(node){
  if(!node.rel)return;
  const items=[...node.folders,...node.docs];
  const content=`<h1>${esc(node.name)}</h1>${items.length?`<div class="bento">${items.map(tile).join('')}</div>`:'<p>No published information is in this section yet.</p>'}${gallery(node)}`;
  await writePage(node.url,page(content,{title:node.name,breadcrumb:node.crumbs.join(' / ')}));
  for(const child of node.folders)await renderFolder(child);
}
function enhanceDoc(html){const $=cheerio.load(`<article class="doc">${html}</article>`,null,false);const links=[];$('h2,h3').each((i,e)=>{const id=`section-${i+1}-${slug($(e).text())}`;$(e).attr('id',id);links.push({id,text:$(e).text(),level:e.tagName})});const jump=links.length?`<nav class="jump" aria-label="Jump to section"><strong>On this page</strong><ul>${links.map(x=>`<li class="${x.level}"><a href="#${x.id}">${esc(x.text)}</a></li>`).join('')}</ul></nav>`:'';return {html:`${jump}${$.html()}`,text:$('article').text().replace(/\s+/g,' ').trim()}}
async function renderDocs(node){
  for(const d of node.docs){const assetDir=path.join(DIST,'assets','docs',d.id);const result=await convertDocx(d.source,{assetDir,assetUrlBase:`../assets/docs/${d.id}`});warnings.push(...result.warnings.map(w=>`${d.file}: ${w.message}`));const enhanced=enhanceDoc(result.html);await writePage(d.url,page(`<h1>${esc(d.name)}</h1>${enhanced.html}`,{title:d.name,breadcrumb:d.crumbs.join(' / ')}));searchDocs.push({id:d.id,title:d.name,text:enhanced.text,url:d.url,breadcrumb:d.crumbs.slice(0,-1).join(' / ')})}
  for(const child of node.folders)await renderDocs(child);
}
async function makeHome(root){const content=`<h1>${esc(CONFIG.siteTitle)}</h1><p class="lead">Public emergency information saved on this device for use when mobile service is unavailable.</p><form id="search-form" class="search" role="search"><label class="skip" for="search-input">Search emergency information</label><input id="search-input" type="search" placeholder="Search all information" autocomplete="off"><button type="submit">Search</button></form><section id="search-results" class="search-results" hidden aria-live="polite"></section><div class="bento">${root.folders.map(tile).join('').replaceAll('../','')}</div>`;await writePage('index.html',page(content,{title:CONFIG.siteTitle,breadcrumb:CONFIG.siteTitle,base:'./'}))}
async function main(){
  if(!await exists(CONTENT))throw new Error(`Content folder not found: ${CONTENT}`);
  await fs.rm(DIST,{recursive:true,force:true});await fs.mkdir(path.join(DIST,'assets'),{recursive:true});
  shell=await fs.readFile(path.join(ROOT,'src/templates/shell.html'),'utf8');
  await fs.copyFile(path.join(ROOT,'src/style.css'),path.join(DIST,'assets/style.css'));await fs.copyFile(path.join(ROOT,'src/app.js'),path.join(DIST,'assets/app.js'));
  await fs.copyFile(path.join(ROOT,'node_modules/minisearch/dist/umd/index.min.js'),path.join(DIST,'assets/minisearch.js'));
  for(const size of [192,512]){const src=path.join(ROOT,'src',`icon-${size}.png`);if(await exists(src))await fs.copyFile(src,path.join(DIST,'assets',`icon-${size}.png`));}
  const root=await scan(CONTENT);await prep(root);await makeHome(root);for(const child of root.folders)await renderFolder(child);await renderDocs(root);
  const mini=new MiniSearch({fields:['title','text'],storeFields:['title','url','breadcrumb']});mini.addAll(searchDocs);await fs.writeFile(path.join(DIST,'search-index.json'),JSON.stringify({index:JSON.stringify(mini)}));
  const hash=crypto.createHash('sha256');for(const d of searchDocs)hash.update(JSON.stringify(d));const version=hash.digest('hex').slice(0,16);await fs.writeFile(path.join(DIST,'version.json'),JSON.stringify({version,updated},null,2));
  await fs.copyFile(path.join(ROOT,'src/manifest.template.json'),path.join(DIST,'manifest.webmanifest'));
  await generateSW({globDirectory:DIST,globPatterns:['**/*.{html,js,css,json,webmanifest,png,webp}'],swDest:path.join(DIST,'sw.js'),clientsClaim:true,skipWaiting:false,navigateFallback:'index.html',runtimeCaching:[{urlPattern:/version\.json$/,handler:'NetworkFirst',options:{cacheName:'version-check',networkTimeoutSeconds:4}}]});
  await fs.writeFile(path.join(DIST,'build-report.json'),JSON.stringify({version,updated,pages:pages.length,documents:searchDocs.length,warnings},null,2));console.log(`Built ${pages.length} pages (${searchDocs.length} documents), version ${version}`);if(warnings.length)console.warn(warnings.join('\n'));
}
main().catch(e=>{console.error(e);process.exit(1)});
