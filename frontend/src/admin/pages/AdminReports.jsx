import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Input, Label, ListBox, Select, TextField, DatePicker, DateField } from '@heroui/react'
import { Calendar } from '@heroui/react'
import { parseDate as parseCalDate } from '@internationalized/date'
import { Icon } from '@gravity-ui/uikit'
import { FileArrowDown } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { formatShortDate, countWorkingDays, estimatePageCount } from '../lib/dateWindow.js'
import { downloadBlob } from '../lib/download.js'
import { downloadAttendanceReportPdf } from '../lib/attendanceReportHtml.js'
import PageHeader from '../components/PageHeader.jsx'

// Backend expects an English month name (e.g. "august") in the ?month query
// and a numeric ?year, defaulting to the current month/year.
const CURRENT_YEAR = new Date().getFullYear()

const MONTHS = [
  { id: 'january', label: 'January' },
  { id: 'february', label: 'February' },
  { id: 'march', label: 'March' },
  { id: 'april', label: 'April' },
  { id: 'may', label: 'May' },
  { id: 'june', label: 'June' },
  { id: 'july', label: 'July' },
  { id: 'august', label: 'August' },
  { id: 'september', label: 'September' },
  { id: 'october', label: 'October' },
  { id: 'november', label: 'November' },
  { id: 'december', label: 'December' },
]

const YEARS = []
for (let y = CURRENT_YEAR - 5; y <= CURRENT_YEAR; y += 1) YEARS.push(y)

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'id', label: 'Indonesia' },
  { id: 'params', label: 'Params_Database' },
  { id: 'json', label: 'JSON Structure' },
]

function toIsoDate(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function todayIsoDate() {
  return toIsoDate(new Date())
}

function startOfMonthIsoDate() {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return toIsoDate(d)
}

export default function AdminReports() {
  // 'csv' keeps the existing month/year/lang server export (CSV or JSON).
  // 'pdf' generates the "Daftar Hadir Peserta Didik" recap client-side,
  // using the same template/markup as takota-app's absensi_template.html.
  const [method, setMethod] = useState('csv')

  // --- CSV / JSON export state ---
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()].id)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [lang, setLang] = useState('en')
  const [buildingCsv, setBuildingCsv] = useState(false)

  const monthLabel = MONTHS.find((m) => m.id === month)?.label || month
  const formatLabel = lang === 'json' ? 'JSON' : 'CSV'

  async function handleExportCsv() {
    setBuildingCsv(true)
    try {
      const { blob, filename } = await api.exportAttendanceServer({ month, year, lang })
      downloadBlob(blob, filename)
      toast.success(`Report for ${monthLabel} ${year} downloaded successfully.`)
    } catch (err) {
      toast.error(err.message || `Failed to download the ${formatLabel} report.`)
    } finally {
      setBuildingCsv(false)
    }
  }

  // --- PDF recap state ---
  // No student picker: every non-admin student is always included, the
  // same default the backend already applies when student_ids is omitted.
  const [startDate, setStartDate] = useState(startOfMonthIsoDate())
  const [endDate, setEndDate] = useState(todayIsoDate())
  const [duName, setDuName] = useState('')
  const [duAddress, setDuAddress] = useState('')
  const [buildingPdf, setBuildingPdf] = useState(false)

  const rangeIsValid = Boolean(startDate) && Boolean(endDate) && startDate <= endDate
  const workingDays = useMemo(
    () => (rangeIsValid ? countWorkingDays(startDate, endDate) : 0),
    [startDate, endDate, rangeIsValid]
  )
  const pageEstimate = useMemo(() => estimatePageCount(workingDays), [workingDays])

  async function handleBuildPdf() {
    if (!startDate || !endDate) {
      toast.error('Set the recap start and end date.')
      return
    }
    if (startDate > endDate) {
      toast.error('End date must not be before start date.')
      return
    }

    setBuildingPdf(true)
    try {
      const payload = { startDate, endDate, duName, duAddress }
      const filename = `Rekap-Presensi_${startDate}_${endDate}.pdf`
      const doc = await api.fetchAttendanceReportData(payload)
      await downloadAttendanceReportPdf(doc, filename)
      toast.success('PDF attendance recap downloaded successfully.')
    } catch (err) {
      toast.error(err.message || 'Failed to build the PDF recap.')
    } finally {
      setBuildingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileArrowDown}
        eyebrow="Reports"
        title="Reports & Export"
        description="Download the attendance summary as a CSV/JSON file, or generate the printable PDF recap (Daftar Hadir Peserta Didik)."
      />

      {/* Method switcher */}
      <div data-guide="reports-export" className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Export method</span>
        <div className="flex gap-2">
          <Button
            variant={method === 'csv' ? 'primary' : 'outline'}
            onPress={() => setMethod('csv')}
            className="min-w-[96px]"
          >
            CSV
          </Button>
          <Button
            variant={method === 'pdf' ? 'primary' : 'outline'}
            onPress={() => setMethod('pdf')}
            className="min-w-[96px]"
          >
            PDF
          </Button>
        </div>
      </div>

      {method === 'csv' ? (
        <Card className="flex flex-col gap-4 p-4 shadow-none dark:border-neutral-800">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Download Monthly Report</p>
            <p className="text-sm text-neutral dark:text-neutral-400">
              CSV files use semicolons (;) as separators so they open easily in spreadsheet applications
              such as Microsoft Excel or Google Sheets. The JSON format exports an array of items using
              the same snake_case field names as Params_Database.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              selectedKey={month}
              onSelectionChange={(key) => setMonth(String(key))}
              fullWidth
            >
              <Label>Month</Label>
              <Select.Trigger className="shadow-none border border-neutral-100 dark:border-neutral-800">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {MONTHS.map((m) => (
                    <ListBox.Item key={m.id} id={m.id} textValue={m.label}>
                      <Label>{m.label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              selectedKey={year}
              onSelectionChange={(key) => setYear(Number(key))}
              fullWidth
            >
              <Label>Year</Label>
              <Select.Trigger className="shadow-none border border-neutral-100 dark:border-neutral-800">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {YEARS.map((y) => (
                    <ListBox.Item key={y} id={y} textValue={String(y)}>
                      <Label>{y}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              selectedKey={lang}
              onSelectionChange={(key) => setLang(String(key))}
              fullWidth
            >
              <Label>Language</Label>
              <Select.Trigger className="shadow-none border border-neutral-100 dark:border-neutral-800">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {LANGUAGES.map((l) => (
                    <ListBox.Item key={l.id} id={l.id} textValue={l.label}>
                      <Label>{l.label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <Button
            variant="primary"
            onPress={handleExportCsv}
            isDisabled={buildingCsv}
            className="self-start"
          >
            <Icon data={FileArrowDown} size={15} />
            {buildingCsv ? 'Building report…' : `Download ${formatLabel} ${monthLabel} ${year}`}
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-4 shadow-none dark:border-neutral-800">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Build PDF Attendance Recap
            </p>
            <p className="text-sm text-neutral dark:text-neutral-400">
              Fill in the DU/DI (workplace) details below and pick a date range. All students are included
              automatically. Name, dates, attendance status (√/S/I/A), and the sick/permission/absent totals
              per student are filled in automatically from the attendance &amp; permission data. Ranges longer
              than 2 working weeks are automatically split across multiple pages using the exact same table
              layout (2 full tables per page).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker
              value={startDate ? parseCalDate(startDate) : null}
              onChange={(d) => setStartDate(d ? d.toString() : '')}
              maxValue={endDate ? parseCalDate(endDate) : undefined}
            >
              <Label>Recap start date</Label>
              <DateField.Group fullWidth className="shadow-none border border-neutral-100 dark:border-neutral-800" style={{ borderRadius: 'var(--field-radius)' }}>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar>
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(date) => <Calendar.Cell date={date} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>

            <DatePicker
              value={endDate ? parseCalDate(endDate) : null}
              onChange={(d) => setEndDate(d ? d.toString() : '')}
              minValue={startDate ? parseCalDate(startDate) : undefined}
            >
              <Label>Recap end date</Label>
              <DateField.Group fullWidth className="shadow-none border border-neutral-100 dark:border-neutral-800" style={{ borderRadius: 'var(--field-radius)' }}>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar>
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(date) => <Calendar.Cell date={date} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>

            <TextField value={duName} onChange={setDuName}>
              <Label>DU/DI name (optional)</Label>
              <Input placeholder="e.g. PT Sinar Abadi" className="shadow-none border border-neutral-100 dark:border-neutral-800" />
            </TextField>

            <TextField value={duAddress} onChange={setDuAddress}>
              <Label>DU/DI address (optional)</Label>
              <Input placeholder="e.g. Jl. Industri No. 12" className="shadow-none border border-neutral-100 dark:border-neutral-800" />
            </TextField>
          </div>

          <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm dark:bg-neutral-800/60">
            {rangeIsValid ? (
              <span className="text-neutral-700 dark:text-neutral-300">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatShortDate(new Date(`${startDate}T00:00:00`))} –{' '}
                  {formatShortDate(new Date(`${endDate}T00:00:00`))}
                </span>{' '}
                · {workingDays} working days (Mon–Sat) · estimated{' '}
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{pageEstimate} page(s)</span>
              </span>
            ) : (
              <span className="text-danger">End date must not be before start date.</span>
            )}
          </div>

          <Button
            variant="primary"
            onPress={handleBuildPdf}
            isDisabled={buildingPdf || !rangeIsValid}
            className="self-start"
          >
            <Icon data={FileArrowDown} size={15} />
            {buildingPdf ? 'Building PDF…' : 'Build & Download PDF'}
          </Button>
        </Card>
      )}
    </div>
  )
}
