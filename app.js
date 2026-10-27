(function () {
  const $ = (id) => document.getElementById(id);
  const home = $("home"), editor = $("editor"), status = $("status");
  const ids = ["nombre", "cedula", "celular", "ciudad", "direccion"];
  const fields = Object.fromEntries(ids.map((k) => [k, $("f-" + k)]));
  const DRAFT = "studiok-draft", GUIDES = "studiok-guias";

  function store(key, val) { try { val === undefined ? localStorage.removeItem(key) : localStorage.setItem(key, val); } catch (e) {} }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  // Saved guides: [{ n, fecha (ISO), datos: {nombre, ...} }], numbered in creation order
  function loadGuides() { try { return JSON.parse(load(GUIDES) || "[]"); } catch (e) { return []; } }
  function saveGuides(list) { store(GUIDES, JSON.stringify(list)); }
  const pad = (n) => String(n).padStart(2, "0");
  const fmtFecha = (iso) => new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let current = null; // number of the saved guide open in the editor, or null for a new one

  function renderGuides() {
    const list = loadGuides();
    $("guidesSection").hidden = list.length === 0 || !editor.hidden;
    const ul = $("guidesList");
    ul.textContent = "";
    list.slice().reverse().forEach((g) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button"; b.className = "guide-row";
      const num = document.createElement("span"); num.className = "g-num"; num.textContent = "Guía " + pad(g.n);
      const when = document.createElement("span"); when.className = "g-when"; when.textContent = fmtFecha(g.fecha);
      const who = document.createElement("span"); who.className = "g-who"; who.textContent = g.datos.nombre || "";
      b.append(num, when, who);
      b.addEventListener("click", () => openGuide(g.n));
      li.appendChild(b); ul.appendChild(li);
    });
  }
  // Called after a print/download/share: the first one numbers and dates the guide
  function recordGuide(v) {
    const list = loadGuides();
    const existing = current && list.find((g) => g.n === current);
    if (existing) { existing.datos = v; }
    else {
      const n = list.reduce((m, g) => Math.max(m, g.n), 0) + 1;
      list.push({ n, fecha: new Date().toISOString(), datos: v });
      current = n;
    }
    saveGuides(list);
    showTitle();
    return current;
  }
  function showTitle() {
    const g = current && loadGuides().find((x) => x.n === current);
    $("editorTitle").textContent = g ? "Guía " + pad(g.n) : "Nueva guía";
    $("editorWhen").textContent = g ? "Creada el " + fmtFecha(g.fecha) : "";
  }
  function setStatus(msg, kind) { status.textContent = msg; status.className = "status" + (kind ? " " + kind : ""); }
  function clearFields() {
    ids.forEach((k) => { fields[k].value = ""; fields[k].closest(".box").classList.remove("missing"); });
    store(DRAFT); setStatus("");
    current = null; showTitle();
  }
  function openEditor(fresh) {
    if (fresh) clearFields();
    home.hidden = true; editor.hidden = false; $("guidesSection").hidden = true;
    window.scrollTo(0, 0);
    setTimeout(() => fields.nombre.focus(), 50);
  }
  function openGuide(n) {
    const g = loadGuides().find((x) => x.n === n);
    if (!g) return;
    clearFields();
    ids.forEach((k) => fields[k].value = g.datos[k] || "");
    current = n; showTitle();
    home.hidden = true; editor.hidden = false; $("guidesSection").hidden = true;
    window.scrollTo(0, 0);
  }
  function goHome() { editor.hidden = true; home.hidden = false; renderGuides(); }

  // Restore an unfinished draft, if any
  try {
    const d = JSON.parse(load(DRAFT) || "null");
    if (d && ids.some((k) => d[k])) ids.forEach((k) => fields[k].value = d[k] || "");
  } catch (e) {}
  ids.forEach((k) => fields[k].addEventListener("input", () => {
    fields[k].closest(".box").classList.remove("missing");
    store(DRAFT, JSON.stringify(Object.fromEntries(ids.map((j) => [j, fields[j].value]))));
  }));

  $("newBtn").addEventListener("click", () => openEditor(true));
  $("backBtn").addEventListener("click", goHome);
  $("clearBtn").addEventListener("click", () => { clearFields(); fields.nombre.focus(); });
  $("form").addEventListener("submit", (e) => e.preventDefault());
  renderGuides();

  // Logo rasterized once for the PDF (high resolution for thermal printers)
  let logoPng = null;
  function getLogo() {
    if (logoPng) return Promise.resolve(logoPng);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        // 1200 px across 110 pt is about 780 dpi, well above the printer's 203 dpi
        c.width = 1200; c.height = Math.round(1200 * 2118 / 3468);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        logoPng = c.toDataURL("image/png");
        resolve(logoPng);
      };
      img.onerror = reject;
      img.src = "logo.svg";
    });
  }

  async function buildPdf(v) {
    if (!window.jspdf) throw new Error("jspdf_missing");
    const { jsPDF } = window.jspdf;
    // Label 11.2 cm wide x 11 cm tall. The layout is drawn on a 284-unit square grid (same numbers
    // as the inline styles in index.html), scaled to the label height and centered across its width.
    const PAGE_W = 112 / 25.4 * 72, PAGE_H = 110 / 25.4 * 72;
    const K = PAGE_H / 284, OX = (PAGE_W - 284 * K) / 2;
    const X = (u) => OX + u * K, S = (u) => u * K;
    // jsPDF swaps the sides to match the orientation, so a page wider than tall must be "landscape"
    const doc = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], orientation: PAGE_W > PAGE_H ? "landscape" : "portrait" });
    const logo = await getLogo();
    doc.addImage(logo, "PNG", X(87), S(6), S(110), S(110 * 2118 / 3468), "logo", "FAST");
    doc.setDrawColor(0); doc.setLineWidth(S(1.1)); doc.line(X(10), S(78), X(274), S(78));

    // [label, value, x, y, width, height]
    const boxes = [
      ["NOMBRES COMPLETOS", v.nombre, 10, 84, 264, 34],
      ["CÉDULA DE IDENTIDAD", v.cedula, 10, 123, 129.5, 34],
      ["NÚMERO CELULAR", v.celular, 144.5, 123, 129.5, 34],
      ["CIUDAD", v.ciudad, 10, 162, 264, 34],
      ["DIRECCIÓN DE ENVÍO", v.direccion, 10, 201, 264, 52],
    ];
    boxes.forEach(([label, value, x, top, w, h]) => {
      doc.setLineWidth(S(1.2)); doc.roundedRect(X(x), S(top), S(w), S(h), S(4), S(4), "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(S(7)); doc.text(label, X(x + 6), S(top + 10.5));
      doc.setFont("helvetica", "normal");
      // Shrink the text until it fits the box (first baseline at top + 24), in grid units
      let size = 10.5, lines;
      do {
        doc.setFontSize(S(size));
        lines = doc.splitTextToSize((value || "").trim(), S(w - 12));
        const maxLines = Math.floor((h - 28) / (size * 1.15)) + 1;
        if (lines.length <= maxLines) break;
        size -= 0.5;
      } while (size > 6.5);
      doc.text(lines, X(x + 6), S(top + 24), { lineHeightFactor: 1.15 });
    });

    doc.setLineWidth(S(0.8)); doc.line(X(62), S(259.5), X(222), S(259.5));
    doc.setFont("times", "bolditalic"); doc.setFontSize(S(12));
    doc.text("¡Gracias por tu compra!", X(142), S(275), { align: "center" });
    return doc.output("blob");
  }

  function fileName(n, nombre) {
    const slug = (nombre || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase().slice(0, 40) || "cliente";
    return "guia_" + pad(n) + "_" + slug + ".pdf";
  }

  // Validates the form; returns the values or null
  function readValues() {
    const v = Object.fromEntries(ids.map((k) => [k, fields[k].value.trim()]));
    const empty = ids.filter((k) => !v[k]);
    ids.forEach((k) => fields[k].closest(".box").classList.toggle("missing", !v[k]));
    if (empty.length) {
      setStatus("Faltan " + empty.length + " dato(s). Los recuadros en rojo están vacíos.", "err");
      fields[empty[0]].focus();
      return null;
    }
    return v;
  }

  async function withPdf(action) {
    const v = readValues();
    if (!v) return;
    setStatus("Generando PDF…");
    try {
      const blob = await buildPdf(v);
      const n = current || loadGuides().reduce((m, g) => Math.max(m, g.n), 0) + 1;
      const msg = await action(blob, fileName(n, v.nombre));
      done(v, msg);
    } catch (e) {
      if (e && e.name === "AbortError") { setStatus(""); return; }
      setStatus(e && e.message === "jspdf_missing"
        ? "Necesitas internet la primera vez que abres la app. Conéctate y recarga."
        : "No se pudo generar el PDF. Recarga la app e inténtalo de nuevo.", "err");
    }
  }

  function done(v, msg) {
    const n = recordGuide(v);
    store(DRAFT);
    setStatus(msg + " Quedó guardada como Guía " + pad(n) + ". Pulsa “Limpiar y crear otra” para el siguiente pedido.", "ok");
  }

  $("pdfBtn").addEventListener("click", () => withPdf(async (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "PDF descargado.";
  }));

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  $("printBtn").addEventListener("click", () => withPdf(async (blob) => {
    const url = URL.createObjectURL(blob);
    if (isIOS) {
      // iOS cannot print a PDF from a hidden frame: open it so the share sheet offers Print
      window.open(url, "_blank");
    } else {
      const frame = $("printFrame");
      frame.onload = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { window.open(url, "_blank"); } };
      frame.src = url;
    }
    return "Guía enviada a imprimir.";
  }));

  // Share (WhatsApp, correo, etc.) where the device supports sharing files
  try {
    const probe = new File([new Blob(["x"], { type: "application/pdf" })], "x.pdf", { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) $("shareBtn").hidden = false;
  } catch (e) {}
  $("shareBtn").addEventListener("click", () => withPdf(async (blob, name) => {
    const file = new File([blob], name, { type: "application/pdf" });
    await navigator.share({ files: [file], title: "Guía de envío Studio K" });
    return "Guía compartida.";
  }));

  // Install as an app
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
  $("installBtn").addEventListener("click", async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null; $("installBtn").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
