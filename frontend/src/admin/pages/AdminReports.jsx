import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Label, ListBox, Select } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { FileArrowDown } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { downloadBlob } from '../lib/download.js'
import PageHeader from '../components/PageHeader.jsx'

// Backend expects an English month name (e.g. "august") in the ?month query
// and always uses the current year. lang must be "id" or "en".
const MONTHS = [
  { id: 'january', label: 'Januari' },
  { id: 'february', label: 'Februari' },
  { id: 'march', label: 'Maret' },
  { id: 'april', label: 'April' },
  { id: 'may', label: 'Mei' },
  { id: 'june', label: 'Juni' },
  { id: 'july', label: 'Juli' },
  { id: 'august', label: 'Agustus' },
  { id: 'september', label: 'September' },
  { id: 'october', label: 'Oktober' },
  { id: 'november', label: 'November' },
  { id: 'december', label: 'Desember' },
]

const LANGUAGES = [
  { id: 'id', label: 'Bahasa Indonesia' },
  { id: 'en', label: 'English' },
]

export default function AdminReports() {
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()].id)
  const [lang, setLang] = useState('id')
  const [building, setBuilding] = useState(false)

  const monthLabel = MONTHS.find((m) => m.id === month)?.label || month

  async function handleExport() {
    setBuilding(true)
    try {
      const { blob, filename } = await api.exportAttendanceServer({ month, lang })
      downloadBlob(blob, filename)
      toast.success(`Rekap ${monthLabel} ${new Date().getFullYear()} berhasil diunduh.`)
    } catch (err) {
      toast.error(err.message || 'Gagal mengunduh rekap CSV.')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileArrowDown}
        eyebrow="Laporan"
        title="Rekap & Unduh"
        description="Unduh rekap kehadiran seluruh pengguna dalam satu bulan sebagai file CSV, dengan kolom No, Nama, Kehadiran, Waktu, Tanggal, Jenis Ketidakhadiran, dan Alasan Izin."
      />

      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Unduh Rekap Bulanan</p>
          <p className="text-sm text-neutral">
            File CSV dipisahkan tanda titik koma (;) sehingga mudah dibuka di aplikasi spreadsheet
            seperti Microsoft Excel atau Google Sheets.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            selectedKey={month}
            onSelectionChange={(key) => setMonth(String(key))}
            fullWidth
          >
            <Label>Bulan</Label>
            <Select.Trigger>
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
            selectedKey={lang}
            onSelectionChange={(key) => setLang(String(key))}
            fullWidth
          >
            <Label>Bahasa</Label>
            <Select.Trigger>
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
          {building ? 'Membuat rekap…' : `Unduh CSV ${monthLabel} ${new Date().getFullYear()}`}
        </Button>
      </Card>
    </div>
  )
}
