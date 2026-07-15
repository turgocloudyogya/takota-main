package models

// PDFTemplateData is the root structure for the attendance recap. It is
// shared by the XLSX export (rendered server-side with excelize) and the
// PDF export (returned as JSON here, then rendered into the
// absensi_template.html markup and turned into a PDF client-side in the
// browser -- no server-side browser/Chromium involved).
type PDFTemplateData struct {
	Pages []PDFPage `json:"pages"`
}

// PDFPage represents a single page in the recap (2 full Blocks per page).
type PDFPage struct {
	NamaDUDI   string     `json:"namaDudi"`
	AlamatDUDI string     `json:"alamatDudi"`
	Blocks     []PDFBlock `json:"blocks"`
}

// PDFBlock represents a table block (12 days x multiple students).
type PDFBlock struct {
	HariLabel []string   `json:"hariLabel"` // Constant day-name header, e.g. "Senin", "Selasa", ...
	Tanggal   []string   `json:"tanggal"`   // Dates, e.g. "01", "02", ...
	Siswa     []PDFSiswa `json:"siswa"`
}

// PDFSiswa represents a single student row in the attendance table.
type PDFSiswa struct {
	Nama  string   `json:"nama"`
	Marks []string `json:"marks"` // Attendance marks for each day: "√", "S", "I", "A", or ""
	S     int      `json:"s"`     // Total sick days (this block only)
	I     int      `json:"i"`     // Total permission days (this block only)
	A     int      `json:"a"`     // Total absent days (this block only)
}
