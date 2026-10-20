(function () {
  const $ = (id) => document.getElementById(id);
  const home = $("home"), editor = $("editor"), status = $("status");
  const ids = ["nombre", "cedula", "celular", "ciudad", "direccion"];
  const fields = Object.fromEntries(ids.map((k) => [k, $("f-" + k)]));
  const DRAFT = "studiok-draft", COUNT = "studiok-count";

  function store(key, val) { try { val === undefined ? localStorage.removeItem(key) : localStorage.setItem(key, val); } catch (e) {} }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function showCount() {
    const n = parseInt(load(COUNT) || "0", 10);
    $("countMeta").textContent = n > 0 ? n + (n === 1 ? " guía creada en este dispositivo" : " guías creadas en este dispositivo") : "";
  }
  function bumpCount() { store(COUNT, String(parseInt(load(COUNT) || "0", 10) + 1)); }
  function setStatus(msg, kind) { status.textContent = msg; status.className = "status" + (kind ? " " + kind : ""); }
  function clearFields() {
    ids.forEach((k) => { fields[k].value = ""; fields[k].closest(".box").classList.remove("missing"); });
    store(DRAFT); setStatus("");
  }
  function openEditor(fresh) {
    if (fresh) clearFields();
    home.hidden = true; editor.hidden = false;
    window.scrollTo(0, 0);
    setTimeout(() => fields.nombre.focus(), 50);
  }
  function goHome() { editor.hidden = true; home.hidden = false; showCount(); }

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
  showCount();

  // Logo rasterized once for the PDF (high resolution for thermal printers)
  let logoPng = null;
  function getLogo() {
    if (logoPng) return Promise.resolve(logoPng);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 2080; c.height = Math.round(2080 * 2118 / 3468);
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
    const doc = new jsPDF({ unit: "pt", format: [288, 432], orientation: "portrait" });
    const logo = await getLogo();
    doc.addImage(logo, "PNG", 64, 12, 160, 160 * 2118 / 3468);
    doc.setDrawColor(0); doc.setLineWidth(1.2); doc.line(14, 119, 274, 119);

    const boxes = [
      ["NOMBRES COMPLETOS", v.nombre, 129.2, 37.8],
      ["CÉDULA DE IDENTIDAD", v.cedula, 173.9, 37.8],
      ["NÚMERO CELULAR", v.celular, 218.6, 37.8],
      ["CIUDAD", v.ciudad, 264, 37.8],
      ["DIRECCIÓN DE ENVÍO", v.direccion, 308.8, 66.2],
    ];
    boxes.forEach(([label, value, top, h]) => {
      doc.setLineWidth(1.3); doc.roundedRect(14, top, 260, h, 4, 4, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.6); doc.text(label, 21, top + 11.8);
      doc.setFont("helvetica", "normal");
      let size = 11;
      const maxLines = Math.max(1, Math.floor((h - 18) / 12.5));
      let lines;
      do {
        doc.setFontSize(size);
        lines = doc.splitTextToSize((value || "").trim(), 246);
        if (lines.length <= maxLines) break;
        size -= 0.5;
      } while (size > 7);
      doc.text(lines, 21, top + 26, { lineHeightFactor: 1.15 });
    });

    doc.setLineWidth(0.9); doc.line(54, 385.5, 234, 385.5);
    doc.setFont("times", "bolditalic"); doc.setFontSize(14);
    doc.text("¡Gracias por tu compra!", 144, 408, { align: "center" });
    return doc.output("blob");
  }

  function fileName(nombre) {
    const slug = (nombre || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase().slice(0, 40) || "cliente";
    return "guia_" + slug + ".pdf";
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
      await action(blob, fileName(v.nombre));
    } catch (e) {
      if (e && e.name === "AbortError") { setStatus(""); return; }
      setStatus(e && e.message === "jspdf_missing"
        ? "Necesitas internet la primera vez que abres la app. Conéctate y recarga."
        : "No se pudo generar el PDF. Recarga la app e inténtalo de nuevo.", "err");
    }
  }

  function done(msg) {
    bumpCount(); store(DRAFT);
    setStatus(msg + " Pulsa “Limpiar y crear otra” para el siguiente pedido.", "ok");
  }

  $("pdfBtn").addEventListener("click", () => withPdf(async (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    done("PDF descargado.");
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
    done("Guía enviada a imprimir.");
  }));

  // Share (WhatsApp, correo, etc.) where the device supports sharing files
  try {
    const probe = new File([new Blob(["x"], { type: "application/pdf" })], "x.pdf", { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) $("shareBtn").hidden = false;
  } catch (e) {}
  $("shareBtn").addEventListener("click", () => withPdf(async (blob, name) => {
    const file = new File([blob], name, { type: "application/pdf" });
    await navigator.share({ files: [file], title: "Guía de envío Studio K" });
    done("Guía compartida.");
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
