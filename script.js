(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $('#invoice-form');
  const itemList = $('#item-list');
  const itemTemplate = $('#item-template');
  const paper = $('#invoice-paper');
  const paperFrame = $('#paper-frame');
  const paperViewport = $('.paper-viewport');
  const toast = $('#toast');
  const exportButtons = [$('#pdf-button'), $('#png-button'), $('#print-button')];
  let toastTimer;
  let zoomMultiplier = 1;

  const money = (value) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0))}`;
  const numberValue = (input) => {
    const value = parseIdNumber(input?.value ?? '0');
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  function parseIdNumber(raw) {
    let value = String(raw ?? '').trim().replace(/[^\d.,+-]/g, '');
    if (!value) return 0;
    const sign = value.startsWith('-') ? '-' : '';
    value = value.replace(/[+-]/g, '');
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      value = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
    } else if (comma >= 0 || dot >= 0) {
      const separator = comma >= 0 ? ',' : '.';
      const pieces = value.split(separator);
      const isGrouped = pieces.length > 2
        ? pieces.slice(1).every((piece) => piece.length === 3)
        : pieces[1]?.length === 3;
      if (isGrouped) value = pieces.join('');
      else value = `${pieces.slice(0, -1).join('')}.${pieces.at(-1)}`;
    }
    return Number(`${sign}${value}`);
  }
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  function showToast(message, duration = 3400) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), duration);
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function parseRolls(value) {
    return String(value ?? '')
      .split(/[,;\n]+/)
      .map((part) => Number(part.trim().replace(/\s/g, '').replace(',', '.')))
      .filter((part) => Number.isFinite(part) && part > 0);
  }

  function getItems() {
    return $$('.item-card', itemList).map((card) => {
      const field = (name) => $(`[data-field="${name}"]`, card)?.value.trim() ?? '';
      const rolls = parseRolls(field('rolls'));
      const quantity = rolls.reduce((sum, roll) => sum + roll, 0);
      const price = numberValue($('[data-field="price"]', card));
      const discountPerUnit = numberValue($('[data-field="discount"]', card));
      const discount = quantity * discountPerUnit;
      const subtotal = quantity * price;
      return {
        description: field('description'),
        color: field('color'),
        rolls,
        rollsText: field('rolls').replace(/[;\n]+/g, ', ').replace(/\s*,\s*/g, ', '),
        pcs: numberValue($('[data-field="pcs"]', card)),
        quantity,
        price,
        discountPerUnit,
        subtotal,
        discount,
        total: subtotal - discount,
        card,
      };
    });
  }

  function getRounding(netSubtotal) {
    const mode = $('#rounding-mode').value;
    if (mode === 'custom') return Number.parseFloat($('#rounding-custom').value) || 0;
    if (mode === 'none') return 0;
    const increment = Number(mode);
    if (!Number.isFinite(increment) || increment <= 0) return 0;
    return Math.round(netSubtotal / increment) * increment - netSubtotal;
  }

  function setText(id, value) {
    $(`#${id}`).textContent = value;
  }

  function renderPreview() {
    const items = getItems();
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = items.reduce((sum, item) => sum + item.discount, 0);
    const rounding = getRounding(subtotal - discount);
    const grandTotal = subtotal - discount + rounding;

    setText('preview-company', $('#company').value.trim() || 'Nama perusahaan');
    setText('preview-number', $('#invoice-number').value.trim() || '—');
    setText('preview-date', formatDate($('#invoice-date').value));
    setText('preview-sales', $('#sales-pic').value.trim() || '—');
    setText('preview-buyer', $('#buyer').value.trim() || '—');
    setText('preview-bank', $('#bank-name').value.trim() || '—');
    setText('preview-account', $('#account-number').value.trim() || '—');
    setText('preview-holder', $('#account-holder').value.trim() || '—');
    setText('preview-payment-note', $('#payment-note').value.trim() || '—');
    setText('preview-receipt-name', $('#receipt-name').value.trim() || 'Nama / tanda tangan penerima');
    setText('preview-subtotal', money(subtotal));
    setText('preview-discount', `− ${money(discount)}`);
    setText('preview-rounding', `${rounding > 0 ? '+ ' : rounding < 0 ? '− ' : ''}${money(Math.abs(rounding))}`);
    setText('preview-grand-total', money(grandTotal));

    $('#preview-items').innerHTML = items.map((item, index) => {
      if (item.quantity > 0) {
        item.card.querySelector('[data-qty-total]').textContent = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(item.quantity);
      } else {
        item.card.querySelector('[data-qty-total]').textContent = '0';
      }
      item.card.querySelector('[data-line-total]').textContent = money(item.total);
      return `<tr>
        <td>${String(index + 1).padStart(2, '0')}</td>
        <td class="description-cell">${escapeHTML(item.description || '—')}</td>
        <td>${escapeHTML(item.color || '—')}</td>
        <td class="roll-cell">${escapeHTML(item.rollsText || '—')}</td>
        <td>${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(item.pcs)}</td>
        <td class="qty-cell">${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(item.quantity)}</td>
        <td class="money-cell">${money(item.price)}</td>
        <td class="money-cell">${money(item.discountPerUnit)}<br /><span class="roll-cell">/ unit</span></td>
        <td class="money-cell net-cell">${money(item.total)}</td>
      </tr>`;
    }).join('');

    $('#item-count').textContent = `${String(items.length).padStart(2, '0')} BARIS`;
    $$('.remove-item', itemList).forEach((button) => { button.disabled = items.length <= 1; });
    $('#rounding-custom-field').classList.toggle('is-hidden', $('#rounding-mode').value !== 'custom');
    window.requestAnimationFrame(updatePaperScale);
  }

  function createItem({ description = '', color = '', rolls = '', pcs = '1', price = '0', discount = '0' } = {}) {
    const fragment = itemTemplate.content.cloneNode(true);
    const card = $('.item-card', fragment);
    $('[data-field="description"]', card).value = description;
    $('[data-field="color"]', card).value = color;
    $('[data-field="rolls"]', card).value = rolls;
    $('[data-field="pcs"]', card).value = pcs;
    $('[data-field="price"]', card).value = price;
    $('[data-field="discount"]', card).value = discount;
    itemList.append(fragment);
    updateItemNumbers();
    renderPreview();
  }

  function updateItemNumbers() {
    $$('.item-card', itemList).forEach((card, index) => {
      $('.item-number', card).textContent = `BARANG ${String(index + 1).padStart(2, '0')}`;
    });
  }

  function updatePaperScale() {
    if (!paperViewport || !paperFrame || !paper) return;
    const availableWidth = Math.max(0, paperViewport.clientWidth - 28);
    const fitScale = Math.max(0.3, Math.min(1, availableWidth / 1122));
    const scale = Math.min(2, fitScale * zoomMultiplier);
    paperFrame.style.setProperty('--paper-scale', String(scale));
    paperFrame.style.width = `${1122 * scale}px`;
    paperFrame.style.height = `${Math.max(793, paper.scrollHeight) * scale}px`;
    $('#zoom-percent').textContent = `${Math.round(scale * 100)}%`;
  }

  function safeFilename(extension) {
    const invoiceNumber = $('#invoice-number').value.trim() || 'INVOICE';
    const safeNumber = invoiceNumber.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'INVOICE';
    return `PROFORMA-INVOICE-${safeNumber}.${extension}`;
  }

  function setExportBusy(busy, label) {
    exportButtons.forEach((button) => { button.disabled = busy; });
    if (busy) {
      const button = $('#pdf-button');
      if (label) button.dataset.originalLabel = button.innerHTML;
      button.innerHTML = `<span class="button-icon" aria-hidden="true">◌</span><span>${label}</span>`;
    } else if ($('#pdf-button').dataset.originalLabel) {
      $('#pdf-button').innerHTML = $('#pdf-button').dataset.originalLabel;
      delete $('#pdf-button').dataset.originalLabel;
    }
  }

  async function capturePaper() {
    if (typeof window.html2canvas !== 'function') throw new Error('html2canvas belum tersedia');
    const stage = document.createElement('div');
    stage.setAttribute('aria-hidden', 'true');
    stage.style.cssText = 'position:fixed;left:-12000px;top:0;width:1122px;z-index:-1;background:#fff;pointer-events:none;';
    const clone = paper.cloneNode(true);
    clone.style.setProperty('--paper-scale', '1');
    clone.style.transform = 'none';
    clone.style.position = 'relative';
    clone.style.inset = 'auto';
    clone.style.width = '1122px';
    clone.style.minHeight = '793px';
    clone.style.margin = '0';
    stage.append(clone);
    document.body.append(stage);
    try {
      await document.fonts?.ready;
      const captureHeight = Math.max(793, clone.scrollHeight);
      const canvas = await window.html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: 1122,
        height: captureHeight,
        windowWidth: 1122,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        logging: false,
      });
      const paperRect = clone.getBoundingClientRect();
      const pixelScale = canvas.width / 1122;
      const rows = $$('.invoice-table tbody tr', clone).map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          top: Math.max(0, Math.round((rect.top - paperRect.top) * pixelScale)),
          bottom: Math.min(canvas.height, Math.round((rect.bottom - paperRect.top) * pixelScale)),
        };
      });
      const tableHead = $('.invoice-table thead', clone);
      const headRect = tableHead.getBoundingClientRect();
      const tableHeadCrop = {
        top: Math.max(0, Math.round((headRect.top - paperRect.top) * pixelScale)),
        height: Math.max(1, Math.round(headRect.height * pixelScale)),
      };
      return { canvas, rows, tableHeadCrop };
    } finally {
      stage.remove();
    }
  }

  function cropCanvas(source, top, bottom, repeatedHeader) {
    const headerHeight = repeatedHeader ? repeatedHeader.height : 0;
    const height = Math.max(1, bottom - top + headerHeight);
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = height;
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    let destinationY = 0;
    if (repeatedHeader) {
      context.drawImage(source, 0, repeatedHeader.top, source.width, repeatedHeader.height, 0, 0, source.width, repeatedHeader.height);
      destinationY = repeatedHeader.height;
    }
    context.drawImage(source, 0, top, source.width, Math.max(1, bottom - top), 0, destinationY, source.width, Math.max(1, bottom - top));
    return output;
  }

  function buildPdfPages(capture) {
    const { canvas, rows, tableHeadCrop } = capture;
    const pageHeightAtFullWidth = canvas.width * (194 / 281);
    const singlePageLimit = pageHeightAtFullWidth * 1.1;
    if (canvas.height <= singlePageLimit || rows.length === 0) return [canvas];

    const pages = [];
    let rowIndex = 0;
    let sourceStart = 0;
    let firstPage = true;
    let guard = 0;
    while (sourceStart < canvas.height && guard++ < rows.length + 4) {
      const repeatedHeader = firstPage || rowIndex >= rows.length ? null : tableHeadCrop;
      const headerHeight = repeatedHeader?.height ?? 0;
      const availableContent = pageHeightAtFullWidth - headerHeight;
      const remainingHeight = canvas.height - sourceStart + headerHeight;
      if (remainingHeight <= pageHeightAtFullWidth) {
        pages.push(cropCanvas(canvas, sourceStart, canvas.height, repeatedHeader));
        break;
      }
      if (rowIndex >= rows.length) {
        const end = Math.min(canvas.height, sourceStart + pageHeightAtFullWidth);
        pages.push(cropCanvas(canvas, sourceStart, end, null));
        sourceStart = end;
        firstPage = false;
        continue;
      }

      let lastFit = rowIndex - 1;
      for (let index = rowIndex; index < rows.length; index += 1) {
        if (rows[index].bottom - sourceStart <= availableContent) lastFit = index;
        else break;
      }
      if (lastFit < rowIndex) lastFit = rowIndex;
      const end = Math.max(sourceStart + 1, rows[lastFit]?.bottom ?? Math.min(canvas.height, sourceStart + availableContent));
      pages.push(cropCanvas(canvas, sourceStart, end, repeatedHeader));
      rowIndex = lastFit + 1;
      if (rowIndex >= rows.length) {
        sourceStart = end;
        if (sourceStart >= canvas.height) break;
      } else {
        sourceStart = rows[rowIndex].top;
      }
      firstPage = false;
    }
    if (pages.length === 0) pages.push(canvas);
    return pages;
  }

  function addPdfPage(pdf, pageCanvas, isFirst) {
    if (!isFirst) pdf.addPage('a4', 'landscape');
    const pageWidth = 297;
    const pageHeight = 210;
    const marginX = 8;
    const marginY = 8;
    const maxWidth = pageWidth - marginX * 2;
    const maxHeight = pageHeight - marginY * 2;
    const scale = Math.min(maxWidth / pageCanvas.width, maxHeight / pageCanvas.height);
    const imageWidth = pageCanvas.width * scale;
    const imageHeight = pageCanvas.height * scale;
    const x = (pageWidth - imageWidth) / 2;
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', x, marginY, imageWidth, imageHeight, undefined, 'FAST');
  }

  async function downloadPdf() {
    if (!window.jspdf?.jsPDF || typeof window.html2canvas !== 'function') {
      showToast('PDF export tidak tersedia saat ini. Dialog cetak dibuka sebagai pilihan Simpan ke PDF.');
      window.print();
      return;
    }
    setExportBusy(true, 'Menyiapkan PDF…');
    try {
      const capture = await capturePaper();
      const pages = buildPdfPages(capture);
      const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      pages.forEach((page, index) => addPdfPage(pdf, page, index === 0));
      pdf.save(safeFilename('pdf'));
      showToast(pages.length > 1 ? `Invoice diunduh sebagai PDF ${pages.length} halaman.` : 'Invoice diunduh sebagai PDF.');
    } catch (error) {
      console.error('PDF export gagal:', error);
      showToast('PDF belum berhasil dibuat. Dialog cetak dibuka sebagai fallback.');
      window.print();
    } finally {
      setExportBusy(false);
    }
  }

  async function downloadPng() {
    if (typeof window.html2canvas !== 'function') {
      showToast('Library PNG belum tersedia. Muat ulang halaman saat koneksi internet aktif.');
      return;
    }
    setExportBusy(true);
    try {
      const { canvas } = await capturePaper();
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG tidak dapat dibuat')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFilename('png');
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Invoice diunduh sebagai PNG.');
    } catch (error) {
      console.error('PNG export gagal:', error);
      showToast('PNG belum berhasil dibuat. Coba muat ulang halaman dan unduh kembali.');
    } finally {
      setExportBusy(false);
    }
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);
  itemList.addEventListener('click', (event) => {
    const button = event.target.closest('.remove-item');
    if (!button || $$('.item-card', itemList).length <= 1) return;
    button.closest('.item-card').remove();
    updateItemNumbers();
    renderPreview();
  });

  $('#add-item').addEventListener('click', () => createItem());
  $('#rounding-mode').addEventListener('change', renderPreview);
  $('#reset-form').addEventListener('click', () => {
    if (!window.confirm('Reset semua data invoice dan mulai lagi?')) return;
    form.reset();
    $('#invoice-date').value = todayISO();
    itemList.replaceChildren();
    createItem({ description: 'HARUKA OSLO COOPER SALUR 56', color: 'NAVY', rolls: '104, 100', pcs: '2', price: '27250', discount: '750' });
    zoomMultiplier = 1;
    renderPreview();
    showToast('Form dikembalikan ke contoh awal.');
  });

  $('#print-button').addEventListener('click', () => window.print());
  $('#pdf-button').addEventListener('click', downloadPdf);
  $('#png-button').addEventListener('click', downloadPng);
  $('#zoom-in').addEventListener('click', () => { zoomMultiplier = Math.min(2, zoomMultiplier * 1.2); updatePaperScale(); });
  $('#zoom-out').addEventListener('click', () => { zoomMultiplier = Math.max(.6, zoomMultiplier / 1.2); updatePaperScale(); });
  $('#zoom-fit').addEventListener('click', () => { zoomMultiplier = 1; updatePaperScale(); });

  if ('ResizeObserver' in window) new ResizeObserver(updatePaperScale).observe(paperViewport);
  else window.addEventListener('resize', updatePaperScale);

  $('#invoice-date').value = todayISO();
  createItem({ description: 'HARUKA OSLO COOPER SALUR 56', color: 'NAVY', rolls: '104, 100', pcs: '2', price: '27250', discount: '750' });
})();
