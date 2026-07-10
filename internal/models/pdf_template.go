package models

// PDFTemplateData is the root structure for the attendance PDF template
type PDFTemplateData struct {
	Pages []PDFPage
}

// PDFPage represents a single page in the PDF
type PDFPage struct {
	NamaDUDI    string
	AlamatDUDI  string
	Blocks      []PDFBlock
}

// PDFBlock represents a table block (max 12 days x multiple students)
type PDFBlock struct {
	HariLabel []string  // Day names (e.g., "Sen", "Sel", ...)
	Tanggal   []string  // Dates (e.g., "01", "02", ...)
	Siswa     []PDFSiswa
}

// PDFSiswa represents a single student row in the attendance table
type PDFSiswa struct {
	Nama  string
	Marks []string // Attendance marks for each day: "V", "S", "I", "A", or empty
	S     int      // Total sick days
	I     int      // Total permission days
	A     int      // Total absent days
}
