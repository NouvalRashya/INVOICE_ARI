# Proforma Studio

A static Indonesian proforma invoice generator built with HTML, CSS, and vanilla JavaScript. It runs in a browser without a build step, server, account, or invoice database.

## Run it

Open `index.html` in a modern browser. You can also serve this folder with any static file server; no installation is needed.

The PDF and PNG buttons load `html2canvas` and `jsPDF` from public CDNs, so those exports need an internet connection the first time the libraries are loaded. Invoice data is rendered and exported in the browser; the app does not send or save it. Print works through the browser's print dialog and can be used as a PDF fallback.

## Create an invoice

1. Enter the company, invoice, buyer, sales, and bank details.
2. Add or remove item cards as needed. Separate roll quantities with commas, for example `104, 100`; the app adds them for Qty Total.
3. Enter unit price and discount. Each line's discount is calculated per unit, then multiplied by Qty Total. Pcs is shown as an additional item detail and does not change the total.
4. Choose a rounding rule. The adjustment is calculated after discounts and added to the grand total. Manual adjustments can be positive or negative.
5. Use **Unduh PDF**, **Unduh PNG**, or **Cetak**. Downloaded files use `PROFORMA-INVOICE-<invoice-number>` as their name. The PDF uses landscape A4 and places longer invoices across pages.

The form is reset when the page is reloaded. There is no draft, history, database, or local storage.

## Files

- `index.html` — app structure and CDN library references
- `style.css` — editor, responsive layout, invoice design, and print styles
- `script.js` — live calculations, preview, and file exports
- `README.md` — usage notes
