// Client-side renderer for the attendance recap PDF.
//
// The backend only returns the assembled recap as JSON (see api.js ->
// fetchAttendanceReportData, hitting GET /api/admin/export/report-data);
// this module renders that JSON into the *exact same markup and CSS* as
// templates/absensi_template.html, then rasterizes it into a PDF in the
// browser using html2canvas + jsPDF directly (see the big comment on
// downloadAttendanceReportPdf below for why it's html2canvas/jsPDF directly
// and not the html2pdf.js wrapper).
//
// Keeping the HTML/CSS below in sync with templates/absensi_template.html
// (visually) is what guarantees the PDF still looks like the old
// server-rendered template.

const REPORT_STYLE_ID = 'attendance-report-print-style'

// Pixel width each logical page is laid out and measured at, and the width
// we force html2canvas to capture at (via its `width`/`windowWidth`
// options) so the two always match -- if they didn't, cell heights measured
// at one width could mismatch text wrapping at a different capture width.
const REPORT_WIDTH_PX = 1600

// F4 landscape paper size, in mm -- same physical page this recap has
// always used (F4 isn't a named jsPDF format, so it's passed as an explicit
// [width, height] pair; jsPDF swaps them to landscape based on
// `orientation`).
const PDF_FORMAT_MM = [215, 330]
const PDF_ORIENTATION = 'landscape'

// [top, left, bottom, right] mm margins -- matches the reference template's
// @page margins (1cm top / 2.5cm left / 1cm bottom / 1cm right), so the
// table sits much closer to the top of the page than a naive default would.
const PDF_MARGIN_MM = { top: 8, left: 25, bottom: 8, right: 10 }

// Adapted from templates/absensi_template.html <style> block. The @page rule
// is harmless to keep (ignored during on-screen/canvas rendering); actual
// PDF margins/paper size are applied when placing each page's image into
// the jsPDF document (see downloadAttendanceReportPdf below).
//
// IMPORTANT: every table cell's text content is centered using an inner
// `.cell-inner` flex wrapper (see cellTag() below) instead of the CSS
// `vertical-align` property. html2canvas -- which rasterizes the DOM into
// the PDF -- does not reliably honor `vertical-align` on <td>/<th>,
// especially on rowspan'd cells (No, Nama Peserta Didik, S, I, A), which
// made every cell's text render pinned to the bottom of the cell instead of
// vertically centered. Flexbox centering is measured from real layout
// boxes, so it renders correctly.
//
// Note there's no `.page { page-break-after: ... }` rule here (unlike
// earlier versions of this file): each logical page is now rendered and
// captured into its own canvas and placed on its own jsPDF page (see
// downloadAttendanceReportPdf), so no page-break CSS is needed at all.
const REPORT_CSS = `
.attendance-report-root {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11.5pt;
  color: #000;
}
.attendance-report-root .page { background: #fff; }

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

/* Cells themselves carry no padding/vertical-align anymore -- all of that
   moved to .cell-inner below, so centering is explicit and not dependent
   on table vertical-align support. */
.attendance-report-root table.absensi th,
.attendance-report-root table.absensi td {
  border: 1px solid #000;
  padding: 0;
  text-align: center;
  overflow: hidden;
}
.attendance-report-root table.absensi thead th { font-weight: bold; }

/* Percentage heights on a table cell's child resolve against the cell's
   own used height (which the browser already computed, including summed
   rowspan height) -- this is what makes height:100% + flex reliably center
   the content top-to-bottom, unlike vertical-align. */
.attendance-report-root table.absensi th .cell-inner,
.attendance-report-root table.absensi td .cell-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 11pt 3pt;
}

/* Nama Peserta Didik column: left-aligned text, still vertically centered
   via the flex rule above. */
.attendance-report-root table.absensi td.nama-cell .cell-inner {
  justify-content: flex-start;
  text-align: left;
}

/* Header rows (Hari dan Tanggal / Jumlah S I A + the day-name row) get
   less vertical padding so they sit "gepeng" (flatter/shorter) compared
   to the taller data rows underneath them. */
.attendance-report-root table.absensi thead th .cell-inner {
  padding: 6pt 3pt;
}
.attendance-report-root table.absensi thead tr.tanggal-row td .cell-inner {
  padding: 4pt 3pt;
  font-weight: normal;
}

.attendance-report-root .ttd-block { margin-top: 10pt; }
.attendance-report-root .ttd-block p { margin-top: 1pt; margin-bottom: 1pt; }
.attendance-report-root .ttd-block p.ttd-signature { margin-left: 4cm; margin-top: 4pt; margin-bottom: 1pt; }
.attendance-report-root .ttd-line { margin-left: 4cm; margin-top: 40pt; border-bottom: 2px dotted #000; width: 6cm; }
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

// Renders a single <th>/<td>, wrapping its content in a .cell-inner flex box
// so vertical centering is explicit (see REPORT_CSS comment above) instead
// of relying on `vertical-align`, which html2canvas does not honor
// reliably -- this was the cause of text rendering pinned to the bottom of
// every cell in the exported PDF.
function cellTag(tag, innerHtml, { rowspan, colspan, className } = {}) {
  const attrs =
    (rowspan ? ` rowspan="${rowspan}"` : '') +
    (colspan ? ` colspan="${colspan}"` : '') +
    (className ? ` class="${className}"` : '')
  return `<${tag}${attrs}><div class="cell-inner">${innerHtml}</div></${tag}>`
}

function renderBlock(block) {
  // Column count is fully driven by the data (hariLabel/tanggal length),
  // matching the backend's flexible work-day pattern (e.g. 8, 10, 12, ...
  // day-columns) instead of a hardcoded 12.
  const dayColumnCount = (block.hariLabel || block.tanggal || []).length
  // col.no (4%) + col.nama (20%) + 3x col.jumlah (3.34% each, 10.02%) are
  // fixed; whatever's left is split evenly across however many day-columns
  // this block actually has, so the table layout adapts to any work-day
  // count (8, 10, 12, ...) instead of assuming a fixed 12 columns.
  const hariColWidthPct = dayColumnCount > 0 ? (100 - 4 - 20 - 3.34 * 3) / dayColumnCount : 0
  const hariCols = `<col class="hari" style="width:${hariColWidthPct}%">`.repeat(dayColumnCount)
  const hariHeader = (block.hariLabel || []).map((h) => cellTag('th', escapeHtml(h))).join('')
  const tanggalRow = (block.tanggal || []).map((t) => cellTag('td', escapeHtml(t))).join('')
  const rows = (block.siswa || [])
    .map((s, idx) => {
      const marks = (s.marks || []).map((m) => cellTag('td', escapeHtml(m))).join('')
      return `
      <tr>
        ${cellTag('td', idx + 1)}
        ${cellTag('td', escapeHtml(s.nama), { className: 'nama-cell' })}
        ${marks}
        ${cellTag('td', s.s)}${cellTag('td', s.i)}${cellTag('td', s.a)}
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
        ${cellTag('th', 'No', { rowspan: 3 })}
        ${cellTag('th', 'Nama Peserta Didik', { rowspan: 3 })}
        ${cellTag('th', 'Hari dan Tanggal', { colspan: dayColumnCount })}
        ${cellTag('th', 'Jumlah', { colspan: 3 })}
      </tr>
      <tr>
        ${hariHeader}
        ${cellTag('th', 'S', { rowspan: 2 })}${cellTag('th', 'I', { rowspan: 2 })}${cellTag('th', 'A', { rowspan: 2 })}
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

// Renders a single logical page's markup -- the info block, its 1-2
// attendance tables, and the ttd (signature) block.
function renderPageHtml(page) {
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

// Builds one logical page's DOM (off-screen), bakes in real cell heights
// (see the .cell-inner comment on REPORT_CSS above), captures it with
// html2canvas, and cleans up after itself. Returns the resulting canvas.
async function renderPageToCanvas(page, html2canvas) {
  const container = document.createElement('div')
  container.className = 'attendance-report-root'
  container.style.background = '#fff'
  container.style.width = `${REPORT_WIDTH_PX}px`
  container.innerHTML = renderPageHtml(page)

  // Attach off-screen (opacity:0 + fixed position, not display:none) so the
  // browser computes real layout/box sizes -- including the height of
  // rowspan'd cells (No, Nama Peserta Didik, S, I, A) -- while nothing is
  // visibly painted on screen. html2canvas needs the element to actually be
  // part of the live document to read accurate computed styles/geometry.
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '0'
  host.style.opacity = '0'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.appendChild(container)
  document.body.appendChild(host)

  try {
    container.querySelectorAll('table.absensi th, table.absensi td').forEach((cell) => {
      const inner = cell.querySelector(':scope > .cell-inner')
      if (inner) inner.style.height = `${cell.clientHeight}px`
    })

    return await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      // Force the capture width to match the width we measured cell
      // heights at (REPORT_WIDTH_PX) -- otherwise html2canvas may render at
      // a different width than what we laid out and measured, causing text
      // to wrap differently than the baked-in pixel heights above expect.
      width: REPORT_WIDTH_PX,
      windowWidth: REPORT_WIDTH_PX,
      // html2canvas clones the *entire* document (not just our container)
      // to compute layout/styles. If the app's global CSS uses modern
      // color functions (e.g. Tailwind v4's oklch() theme variables),
      // html2canvas's own color parser chokes on them with "unsupported
      // color function oklch" even though our report template itself never
      // uses anything but plain black/white. Fix: before it rasterizes,
      // strip every other stylesheet from the clone and leave only our own
      // plain-color REPORT_CSS.
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
        clonedDoc.querySelectorAll('style').forEach((el) => {
          if (el.id !== REPORT_STYLE_ID) el.remove()
        })
        clonedDoc.body.style.backgroundColor = '#ffffff'
        clonedDoc.body.style.color = '#000000'
      },
    })
  } finally {
    host.remove()
  }
}

/**
 * Renders the recap JSON (from fetchAttendanceReportData) into the same
 * markup as absensi_template.html, then converts it to a PDF and triggers a
 * download -- entirely in the browser, no server-side Chromium involved.
 *
 * This renders and captures each logical page (each entry in doc.pages)
 * into its own canvas via html2canvas, then places each one on its own
 * jsPDF page directly -- rather than handing html2pdf.js one giant
 * multi-page canvas plus CSS `page-break-after` hints, which is what a
 * previous version of this function did.
 *
 * That previous approach produced a large blank gap starting from the 2nd
 * PDF page onward. Root cause: html2pdf.js's pagebreak plugin decides where
 * to insert page breaks by comparing each `.page` element's real
 * `getBoundingClientRect()` (measured while our DOM is laid out at
 * REPORT_WIDTH_PX = 1600px, chosen deliberately for crisp captured text)
 * against a fixed "1 page = N px" threshold that the plugin derives purely
 * from the PDF's physical paper size/margins assuming ~96dpi -- i.e.
 * assuming the content is laid out at the *physical* page width (roughly
 * 1114px for this F4 landscape size + margins), not 1600px. Because our
 * report is intentionally laid out ~44% wider than that assumption, the
 * plugin's math no longer lines up with where the content actually ends,
 * so the padding it inserts to "finish off" each page overshoots -- landing
 * mid-page instead of exactly at the page boundary, and leaving a large
 * blank strip before the next page's real content begins.
 *
 * Capturing and placing one full logical page at a time sidesteps that
 * calculation entirely: there is no cross-page measurement to get wrong,
 * because each canvas simply *becomes* one whole PDF page, scaled to fit.
 */
export async function downloadAttendanceReportPdf(doc, filename) {
  ensureStyleInjected()

  const pages = doc?.pages || []
  if (pages.length === 0) {
    throw new Error('No attendance data to render.')
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const pdf = new jsPDF({ unit: 'mm', format: PDF_FORMAT_MM, orientation: PDF_ORIENTATION })
  const pageWidthMm = pdf.internal.pageSize.getWidth()
  const pageHeightMm = pdf.internal.pageSize.getHeight()
  const innerWidthMm = pageWidthMm - PDF_MARGIN_MM.left - PDF_MARGIN_MM.right
  const innerHeightMm = pageHeightMm - PDF_MARGIN_MM.top - PDF_MARGIN_MM.bottom

  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await renderPageToCanvas(pages[i], html2canvas)

    // Fit the captured page into the printable area, preserving aspect
    // ratio (uniform scale, no distortion). In the normal case this block
    // was designed to fit (backend caps each page at 2 tables), so width
    // stays at the full innerWidthMm and no letterboxing happens; the
    // height-clamp branch is just a safety net against a page overflowing
    // its printable area.
    let imgWidthMm = innerWidthMm
    let imgHeightMm = (canvas.height / canvas.width) * imgWidthMm
    if (imgHeightMm > innerHeightMm) {
      imgHeightMm = innerHeightMm
      imgWidthMm = (canvas.width / canvas.height) * imgHeightMm
    }

    if (i > 0) pdf.addPage(PDF_FORMAT_MM, PDF_ORIENTATION)
    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    pdf.addImage(imgData, 'JPEG', PDF_MARGIN_MM.left, PDF_MARGIN_MM.top, imgWidthMm, imgHeightMm)
  }

  pdf.save(filename)
}