// Suspension: replaces the app's offline copy with the notice, online and offline
const NOTICE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Servicio suspendido</title>
<style>
:root{--bg:#f3f2ef;--card:#fff;--ink:#111;--muted:#5f5c57;--line:#d9d6d0;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#161514;--card:#1f1e1c;--ink:#f1efea;--muted:#a29e96;--line:#34312e;color-scheme:dark}}
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;display:grid;place-items:center;padding:24px 16px}
.notice{max-width:460px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:32px 28px;display:flex;flex-direction:column;gap:14px}
.tag{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:28px;line-height:1.2;margin:0}
p{margin:0;line-height:1.6;font-size:16px}
.muted{color:var(--muted);font-size:14px;border-top:1px solid var(--line);padding-top:14px}
</style></head><body>
<main class="notice" role="alert">
<span class="tag">Aviso</span>
<h1>Servicio suspendido</h1>
<p>El creador de esta aplicación ha decidido suspender su uso de manera definitiva.</p>
<p>A partir de este momento ya no es posible utilizarla para crear, imprimir, descargar ni consultar guías de envío.</p>
<p class="muted">Para cualquier consulta sobre esta decisión, comuníquese directamente con el creador de la aplicación.</p>
</main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

// Delete every cached copy of the app, take over open windows and reload them onto the notice
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.clients.claim();
    for (const client of await self.clients.matchAll({ type: "window" })) {
      try { client.navigate(client.url); } catch (err) {}
    }
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Every page of the app shows the notice, with or without internet
  if (e.request.mode === "navigate") {
    e.respondWith(new Response(NOTICE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
    return;
  }
  // The app's code and the PDF library are blocked
  if (url.pathname.endsWith("/app.js") || url.href.includes("jspdf")) {
    e.respondWith(new Response("", { status: 410 }));
  }
});
