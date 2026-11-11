(() => {
  const $ = s => document.querySelector(s);
  const connection = $('#connection');
  const setConnection = () => connection && (connection.textContent = navigator.onLine ? 'Online' : 'Offline - showing saved content');
  addEventListener('online', setConnection); addEventListener('offline', setConnection); setConnection();

  let waiting;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${document.body.dataset.base}sw.js`).then(reg => {
    const show = worker => { waiting = worker; $('#update-banner').hidden = false; };
    if (reg.waiting) show(reg.waiting);
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', e => {
      if (e.target.state === 'installed' && navigator.serviceWorker.controller) show(e.target);
    }));
  });
  $('#refresh-button')?.addEventListener('click', () => { waiting?.postMessage({type:'SKIP_WAITING'}); setTimeout(() => location.reload(), 300); });
  navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());

  const form = $('#search-form'), input = $('#search-input'), output = $('#search-results');
  if (form && window.MiniSearch) fetch(`${document.body.dataset.base}search-index.json`).then(r => r.json()).then(data => {
    const mini = MiniSearch.loadJSON(data.index, { fields:['title','text'], storeFields:['title','url','breadcrumb'] });
    form.addEventListener('submit', e => { e.preventDefault(); const q=input.value.trim(); if(!q){output.hidden=true;return;} const hits=mini.search(q,{prefix:true,fuzzy:.2}).slice(0,20); output.innerHTML = hits.length ? `<h2>Search results</h2><ul>${hits.map(h=>`<li><a href="${h.url}">${escapeHtml(h.title)}</a><br><small>${escapeHtml(h.breadcrumb||'')}</small></li>`).join('')}</ul>` : '<p>No matching information found.</p>'; output.hidden=false; });
  });
  function escapeHtml(v=''){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
})();
