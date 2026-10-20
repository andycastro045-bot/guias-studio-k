# Guías Studio K

App web para crear guías de envío 4×6 de Studio K.

1. Abre la app y pulsa **Crear nueva guía**.
2. Llena los datos del cliente directamente sobre la guía.
3. Pulsa **Imprimir**, **Descargar PDF** o **Compartir**.

Se puede instalar en el celular o en la computadora como app (botón **Instalar app** o, en iPhone, Compartir → *Agregar a inicio*). Después de abrirla una vez con internet, funciona sin conexión.

Los datos de los clientes no se envían a ningún servidor: todo se genera en el propio dispositivo.

## Archivos

- `index.html`: la pantalla de la app
- `app.js`: genera el PDF (con jsPDF), imprime, descarga y comparte
- `sw.js`: caché para que funcione sin internet
- `manifest.webmanifest` y los `*.png`: datos e íconos para instalarla como app
- `logo.svg`: logo de Studio K
