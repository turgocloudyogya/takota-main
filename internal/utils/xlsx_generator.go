package utils

import (
	"bytes"
	"fmt"

	"github.com/carakan/takota/internal/models"
	"github.com/xuri/excelize/v2"
)

// dayColumns are the 12 spreadsheet columns used for the "Hari dan Tanggal"
// block, matching the colgroup in absensi_template.html (col.hari x12).
var dayColumns = []string{"C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"}

func xlsxIntPtr(i int) *int             { return &i }
func xlsxStringPtr(s string) *string    { return &s }
func xlsxFloat64Ptr(f float64) *float64 { return &f }

func cellRef(col string, row int) string {
	return fmt.Sprintf("%s%d", col, row)
}

// xlsxStyles bundles the reusable style IDs built once per workbook.
type xlsxStyles struct {
	header   int // bold, centered, bordered, wrapped (table header rows)
	cell     int // centered, bordered (mark/total cells)
	cellLeft int // left aligned, bordered (student name cells)
	label    int // bold, no border (info labels like "Nama DU/DI :")
}

func newXLSXStyles(f *excelize.File) (xlsxStyles, error) {
	thinBorder := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "top", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "bottom", Color: "000000", Style: 1},
	}

	headerID, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Font:      &excelize.Font{Bold: true},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return xlsxStyles{}, err
	}

	cellID, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	if err != nil {
		return xlsxStyles{}, err
	}

	cellLeftID, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return xlsxStyles{}, err
	}

	labelID, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	if err != nil {
		return xlsxStyles{}, err
	}

	return xlsxStyles{header: headerID, cell: cellID, cellLeft: cellLeftID, label: labelID}, nil
}

// GenerateAttendanceXLSX builds the attendance recap workbook from the same
// Doc structure used to render the PDF, so both outputs are always
// structurally identical (one worksheet per Page, two full tables per
// sheet, A4 landscape print layout).
func GenerateAttendanceXLSX(doc models.PDFTemplateData) (*bytes.Buffer, error) {
	f := excelize.NewFile()
	defer func() {
		_ = f.Close()
	}()

	styles, err := newXLSXStyles(f)
	if err != nil {
		return nil, err
	}

	firstSheet := "Sheet1"
	if len(doc.Pages) == 0 {
		// Still produce a valid, empty workbook rather than erroring.
		buf, werr := f.WriteToBuffer()
		return buf, werr
	}

	for pIdx, page := range doc.Pages {
		sheetName := fmt.Sprintf("Halaman %d", pIdx+1)
		if pIdx == 0 {
			if err := f.SetSheetName(firstSheet, sheetName); err != nil {
				return nil, err
			}
		} else {
			if _, err := f.NewSheet(sheetName); err != nil {
				return nil, err
			}
		}

		if err := writeAttendancePage(f, sheetName, page, styles); err != nil {
			return nil, err
		}

		if err := applyPageLayout(f, sheetName); err != nil {
			return nil, err
		}
	}

	if len(doc.Pages) > 0 {
		firstIdx, err := f.GetSheetIndex(fmt.Sprintf("Halaman %d", 1))
		if err == nil {
			f.SetActiveSheet(firstIdx)
		}
	}

	return f.WriteToBuffer()
}

// writeAttendancePage renders one Page (DU/DI info + 2 stacked tables + ttd
// block) into the given sheet, mirroring absensi_template.html.
func writeAttendancePage(f *excelize.File, sheet string, page models.PDFPage, styles xlsxStyles) error {
	// Column widths: No, Nama, 12x Hari, S/I/A -- matching the col.no/nama/
	// hari/jumlah percentages in the HTML template.
	_ = f.SetColWidth(sheet, "A", "A", 5)
	_ = f.SetColWidth(sheet, "B", "B", 26)
	_ = f.SetColWidth(sheet, "C", "N", 6.5)
	_ = f.SetColWidth(sheet, "O", "Q", 5)

	row := 1

	_ = f.SetCellValue(sheet, cellRef("A", row), "Nama DU/DI :")
	_ = f.SetCellStyle(sheet, cellRef("A", row), cellRef("A", row), styles.label)
	_ = f.SetCellValue(sheet, cellRef("C", row), page.NamaDUDI)
	_ = f.MergeCell(sheet, cellRef("C", row), cellRef("H", row))
	row++

	_ = f.SetCellValue(sheet, cellRef("A", row), "Alamat DU/DI :")
	_ = f.SetCellStyle(sheet, cellRef("A", row), cellRef("A", row), styles.label)
	_ = f.SetCellValue(sheet, cellRef("C", row), page.AlamatDUDI)
	_ = f.MergeCell(sheet, cellRef("C", row), cellRef("H", row))
	row += 2 // blank spacer row before the first table

	for _, block := range page.Blocks {
		var err error
		row, err = writeAttendanceBlock(f, sheet, block, row, styles)
		if err != nil {
			return err
		}
		row++ // blank spacer row between/after tables
	}

	_ = f.SetCellValue(sheet, cellRef("A", row), "Mengesahkan,")
	row++
	_ = f.SetCellValue(sheet, cellRef("A", row), "Instruktur DU/DI :")
	row += 3
	_ = f.SetCellValue(sheet, cellRef("F", row), "..............................")

	return nil
}

// writeAttendanceBlock renders a single 12-day / N-student table (3 header
// rows + 1 data row per student) starting at startRow, and returns the row
// immediately after the table.
func writeAttendanceBlock(f *excelize.File, sheet string, block models.PDFBlock, startRow int, styles xlsxStyles) (int, error) {
	headerRow1 := startRow
	headerRow2 := startRow + 1
	headerRow3 := startRow + 2
	dataStartRow := startRow + 3

	// "No" -- merged across all 3 header rows.
	_ = f.SetCellValue(sheet, cellRef("A", headerRow1), "No")
	_ = f.MergeCell(sheet, cellRef("A", headerRow1), cellRef("A", headerRow3))
	_ = f.SetCellStyle(sheet, cellRef("A", headerRow1), cellRef("A", headerRow3), styles.header)

	// "Nama Peserta Didik" -- merged across all 3 header rows.
	_ = f.SetCellValue(sheet, cellRef("B", headerRow1), "Nama Peserta Didik")
	_ = f.MergeCell(sheet, cellRef("B", headerRow1), cellRef("B", headerRow3))
	_ = f.SetCellStyle(sheet, cellRef("B", headerRow1), cellRef("B", headerRow3), styles.header)

	// "Hari dan Tanggal" -- merged across the 12 day columns, row 1 only.
	_ = f.SetCellValue(sheet, cellRef("C", headerRow1), "Hari dan Tanggal")
	_ = f.MergeCell(sheet, cellRef("C", headerRow1), cellRef("N", headerRow1))
	_ = f.SetCellStyle(sheet, cellRef("C", headerRow1), cellRef("N", headerRow1), styles.header)

	// "Jumlah" -- merged across S/I/A columns, row 1 only.
	_ = f.SetCellValue(sheet, cellRef("O", headerRow1), "Jumlah")
	_ = f.MergeCell(sheet, cellRef("O", headerRow1), cellRef("Q", headerRow1))
	_ = f.SetCellStyle(sheet, cellRef("O", headerRow1), cellRef("Q", headerRow1), styles.header)

	// Row 2: constant day-name labels, one per day column (never merged).
	for i, col := range dayColumns {
		label := ""
		if i < len(block.HariLabel) {
			label = block.HariLabel[i]
		}
		_ = f.SetCellValue(sheet, cellRef(col, headerRow2), label)
		_ = f.SetCellStyle(sheet, cellRef(col, headerRow2), cellRef(col, headerRow2), styles.header)
	}

	// S / I / A -- merged across rows 2-3 each.
	for _, sp := range []struct{ col, label string }{{"O", "S"}, {"P", "I"}, {"Q", "A"}} {
		_ = f.SetCellValue(sheet, cellRef(sp.col, headerRow2), sp.label)
		_ = f.MergeCell(sheet, cellRef(sp.col, headerRow2), cellRef(sp.col, headerRow3))
		_ = f.SetCellStyle(sheet, cellRef(sp.col, headerRow2), cellRef(sp.col, headerRow3), styles.header)
	}

	// Row 3: date-of-month labels, one per day column (never merged).
	for i, col := range dayColumns {
		date := ""
		if i < len(block.Tanggal) {
			date = block.Tanggal[i]
		}
		_ = f.SetCellValue(sheet, cellRef(col, headerRow3), date)
		_ = f.SetCellStyle(sheet, cellRef(col, headerRow3), cellRef(col, headerRow3), styles.header)
	}

	// Data rows: one per student, numbering restarts at 1 for every block.
	r := dataStartRow
	for idx, s := range block.Siswa {
		_ = f.SetCellValue(sheet, cellRef("A", r), idx+1)
		_ = f.SetCellStyle(sheet, cellRef("A", r), cellRef("A", r), styles.cell)

		_ = f.SetCellValue(sheet, cellRef("B", r), s.Nama)
		_ = f.SetCellStyle(sheet, cellRef("B", r), cellRef("B", r), styles.cellLeft)

		for i, col := range dayColumns {
			mark := ""
			if i < len(s.Marks) {
				mark = s.Marks[i]
			}
			_ = f.SetCellValue(sheet, cellRef(col, r), mark)
			_ = f.SetCellStyle(sheet, cellRef(col, r), cellRef(col, r), styles.cell)
		}

		_ = f.SetCellValue(sheet, cellRef("O", r), s.S)
		_ = f.SetCellValue(sheet, cellRef("P", r), s.I)
		_ = f.SetCellValue(sheet, cellRef("Q", r), s.A)
		_ = f.SetCellStyle(sheet, cellRef("O", r), cellRef("Q", r), styles.cell)

		r++
	}

	return r, nil
}

// applyPageLayout sets the A4 landscape, fit-to-page print setup with the
// same margins as the PDF export (2.5cm left / 1cm right -- the book-binding
// side, matching §4 of the export backend contract).
func applyPageLayout(f *excelize.File, sheet string) error {
	if err := f.SetPageLayout(sheet, &excelize.PageLayoutOptions{
		Size:        xlsxIntPtr(9), // 9 = A4
		Orientation: xlsxStringPtr("landscape"),
		FitToWidth:  xlsxIntPtr(1),
		FitToHeight: xlsxIntPtr(1),
	}); err != nil {
		return err
	}

	const cmToInch = 1.0 / 2.54
	return f.SetPageMargins(sheet, &excelize.PageLayoutMarginsOptions{
		Left:   xlsxFloat64Ptr(2.5 * cmToInch),
		Right:  xlsxFloat64Ptr(1 * cmToInch),
		Top:    xlsxFloat64Ptr(2.2 * cmToInch),
		Bottom: xlsxFloat64Ptr(1 * cmToInch),
		Header: xlsxFloat64Ptr(0.3 * cmToInch),
		Footer: xlsxFloat64Ptr(0.3 * cmToInch),
	})
}