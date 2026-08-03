import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Label, ListBox, Select } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { FileArrowDown } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { downloadBlob } from '../lib/download.js'
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

export default function AdminReports() {
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()].id)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [lang, setLang] = useState('en')
  const [building, setBuilding] = useState(false)

  const monthLabel = MONTHS.find((m) => m.id === month)?.label || month
  const formatLabel = lang === 'json' ? 'JSON' : 'CSV'

  async function handleExport() {
    setBuilding(true)
    try {
      const { blob, filename } = await api.exportAttendanceServer({ month, year, lang })
      downloadBlob(blob, filename)
      toast.success(`Report for ${monthLabel} ${year} downloaded successfully.`)
    } catch (err) {
      toast.error(err.message || `Failed to download the ${formatLabel} report.`)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileArrowDown}
        eyebrow="Reports"
        title="Reports & Export"
        description="Download the attendance summary for a selected month and year as a CSV file or a JSON array."
      />

      <Card className="flex flex-col gap-4 p-4">
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
            <Select.Trigger className="border border-neutral-100 dark:border-neutral-800">
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
            <Select.Trigger className="border border-neutral-100 dark:border-neutral-800">
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
            <Select.Trigger className="border border-neutral-100 dark:border-neutral-800">
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
          onPress={handleExport}
          isDisabled={building}
          className="self-start"
        >
          <Icon data={FileArrowDown} size={15} />
          {building ? 'Building report…' : `Download ${formatLabel} ${monthLabel} ${year}`}
        </Button>
      </Card>
    </div>
  )
}
