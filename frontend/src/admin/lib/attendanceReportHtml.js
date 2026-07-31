// Client-side renderer for the attendance recap PDF.
//
// This replaces the old server-side chromedp/Chromium pipeline: the backend
// now only returns the assembled recap as JSON (see api.js ->
// fetchAttendanceReportData, hitting GET /api/admin/export/report-data), and
// this module renders that JSON into the *exact same markup and CSS* as
// templates/absensi_template.html, then converts that live DOM node to a PDF
// in the browser using html2pdf.js (html2canvas + jsPDF under the hood).
//
// Keeping the HTML/CSS below byte-for-byte in sync with
// templates/absensi_template.html is what guarantees the PDF still looks
// identical to the old server-rendered template.

const REPORT_STYLE_ID = 'attendance-report-print-style'

// Copied from templates/absensi_template.html <style> block. The @page rule
// is harmless to keep (ignored during on-screen/canvas rendering); actual
// PDF margins/paper size are applied via html2pdf's own `margin`/`jsPDF`
// options below (F4 landscape, same cm values as this @page rule).
const REPORT_CSS = `
.attendance-report-root {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9.5pt;
  color: #000;
}
.attendance-report-root .page {
  page-break-after: always;
  background: #fff;
}
.attendance-report-root .page:last-child { page-break-after: auto; }

.attendance-report-root .info { margin-bottom: 10pt; }
.attendance-report-root .info-row { display: flex; margin-bottom: 2pt; }
.attendance-report-root .info-label { width: 3.6cm; }
.attendance-report-root .info-colon { width: 0.4cm; }
.attendance-report-root .info-value { flex: 1; }

.attendance-report-root table.absensi {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 10pt;
}
.attendance-report-root table.absensi + table.absensi { margin-top: 0; }

.attendance-report-root table.absensi col.no      { width: 4%; }
.attendance-report-root table.absensi col.nama    { width: 20%; }
.attendance-report-root table.absensi col.hari    { width: 5.5%; }
.attendance-report-root table.absensi col.jumlah  { width: 3.34%; }

/* All cells: vertically centered top-to-bottom. The !important is needed
   because rowspan'd header cells (No, Nama Peserta Didik, S, I, A) are
   the ones most likely to get pushed to the top by the renderer if any
   other rule (or the renderer's own default) wins the tie. */
.attendance-report-root table.absensi th,
.attendance-report-root table.absensi td {
  border: 1px solid #000;
  padding: 6pt 3pt;
  text-align: center;
  vertical-align: middle !important;
  overflow: hidden;
}
.attendance-report-root table.absensi thead th { font-weight: bold; }

/* Nama Peserta Didik column: left-aligned text, still vertically centered
   via the rule above. */
.attendance-report-root table.absensi td.nama-cell {
  text-align: left;
}

/* Header rows (Hari dan Tanggal / Jumlah S I A + the day-name row) get
   less vertical padding so they sit "gepeng" (flatter/shorter) compared
   to the taller data rows underneath them. */
.attendance-report-root table.absensi thead th {
  padding: 3pt 3pt;
}
.attendance-report-root table.absensi thead tr.tanggal-row td {
  padding: 2pt 3pt;
  font-weight: normal;
}

.attendance-report-root .ttd-block { margin-top: 10pt; }
.attendance-report-root .ttd-block p { margin-top: 1pt; margin-bottom: 1pt; }
.attendance-report-root .ttd-block p.ttd-signature { margin-left: 4cm; margin-top: 4pt; margin-bottom: 1pt; }
.attendance-report-root .ttd-line { margin-left: 4cm; margin-top: 34pt; border-bottom: 1px dotted #000; width: 6cm; }
`

function ensureStyleInjected() {
  if (document.getElementById(REPORT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = REPORT_STYLE_ID
  style.textContent = REPORT_CSS
  document.head.appendChild(style)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

function renderBlock(block) {
  const hariCols = '<col class="hari">'.repeat(12)
  const hariHeader = (block.hariLabel || []).map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const tanggalRow = (block.tanggal || []).map((t) => `<td>${escapeHtml(t)}</td>`).join('')
  const rows = (block.siswa || [])
    .map((s, idx) => {
      const marks = (s.marks || []).map((m) => `<td>${escapeHtml(m)}</td>`).join('')
      return `
      <tr>
        <td>${idx + 1}</td>
        <td class="nama-cell">${escapeHtml(s.nama)}</td>
        ${marks}
        <td>${s.s}</td><td>${s.i}</td><td>${s.a}</td>
      </tr>`
    })
    .join('')

  return `
  <table class="absensi">
    <colgroup>
      <col class="no"><col class="nama">
      ${hariCols}
      <col class="jumlah"><col class="jumlah"><col class="jumlah">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="3">No</th>
        <th rowspan="3">Nama Peserta Didik</th>
        <th colspan="12">Hari dan Tanggal</th>
        <th colspan="3">Jumlah</th>
      </tr>
      <tr>
        ${hariHeader}
        <th rowspan="2">S</th><th rowspan="2">I</th><th rowspan="2">A</th>
      </tr>
      <tr class="tanggal-row">
        ${tanggalRow}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
}

function renderPage(page) {
  const blocks = (page.blocks || []).map(renderBlock).join('')
  return `
  <div class="page">
    <div class="info">
      <div class="info-row">
        <span class="info-label">Nama DU/DI</span><span class="info-colon">:</span>
        <span class="info-value">${escapeHtml(page.namaDudi)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Alamat DU/DI</span><span class="info-colon">:</span>
        <span class="info-value">${escapeHtml(page.alamatDudi)}</span>
      </div>
    </div>

    ${blocks}

    <div class="ttd-block">
      <p>Mengesahkan,</p>
      <p>Instruktur DU/DI :</p>
      <p class="ttd-signature">ttd</p>
      <div class="ttd-line"></div>
    </div>
  </div>`
}

function buildPagesHtml(doc) {
  return (doc?.pages || []).map(renderPage).join('')
}

/**
 * Renders the recap JSON (from fetchAttendanceReportData) into the same
 * markup as absensi_template.html, then converts it to a PDF and triggers a
 * download -- entirely in the browser, no server-side Chromium involved.
 */
export async function downloadAttendanceReportPdf(doc, filename) {
  ensureStyleInjected()

  // Note: this element is intentionally *not* attached to document.body.
  // html2pdf.js clones whatever we pass to .from() into its own hidden
  // overlay container (position/visibility handled internally) -- cloneNode
  // preserves inline styles, so giving this element its own
  // position:fixed/offset here would leak into that clone and push the
  // content outside the area actually captured, producing a blank PDF.
  const container = document.createElement('div')
  container.className = 'attendance-report-root'
  container.style.width = '100%'
  container.style.background = '#fff'
  container.innerHTML = buildPagesHtml(doc)

  const { default: html2pdf } = await import('html2pdf.js')
  await html2pdf()
    .set({
      filename,
      // [top, left, bottom, right] in mm -- matches the reference template's
      // @page margins (1cm top / 2.5cm left / 1cm bottom / 1cm right), so
      // the table sits much closer to the top of the page than before.
      margin: [8, 25, 8, 10],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        // html2canvas clones the *entire* document (not just our
        // container) to compute layout/styles. If the app's global CSS
        // uses modern color functions (e.g. Tailwind v4's oklch() theme
        // variables), html2canvas's own color parser chokes on them with
        // "unsupported color function oklch" even though our report
        // template itself never uses anything but plain black/white.
        // Fix: before it rasterizes, strip every other stylesheet from
        // the clone and leave only our own plain-color REPORT_CSS.
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
          clonedDoc.querySelectorAll('style').forEach((el) => {
            if (el.id !== REPORT_STYLE_ID) el.remove()
          })
          clonedDoc.body.style.backgroundColor = '#ffffff'
          clonedDoc.body.style.color = '#000000'
        },
      },
      // F4 (215mm x 330mm) isn't one of jsPDF's built-in named formats, so
      // it's passed as an explicit [width, height] pair in mm; jsPDF swaps
      // them to landscape automatically based on the `orientation` option.
      jsPDF: { unit: 'mm', format: [215, 330], orientation: 'landscape' },
      // '.page' already carries page-break-after: always in REPORT_CSS,
      // so the default 'css' pagebreak mode splits pages automatically.
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(container)
    .save()
}