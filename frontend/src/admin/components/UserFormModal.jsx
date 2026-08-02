import { useState } from 'react'
import { Button } from '@heroui/react'
import { toast } from 'sonner'
import { AppModal } from '../../components/Modals.jsx'
import { TextInput, PasswordInput, SelectInput, ToggleField } from './FormField.jsx'
import * as api from '../lib/api.js'

const emptyForm = {
  nickname: '',
  callname: '',
  username: '',
  password: '',
  type: 'user',
  changeAsLogin: true,
}

export default function UserFormModal({ open, onOpenChange, user, onSaved, defaultType = 'user' }) {
  const isEdit = Boolean(user)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const typeLabel = form.type === 'admin' ? 'Admin' : 'Siswa'

  // Reset the form whenever the modal transitions from closed -> open, so a
  // freshly-opened "add" form is always blank and a freshly-opened "edit"
  // form always reflects the selected user. Adjusting state during render
  // (per React's guidance) instead of in an effect, since this component
  // stays mounted across opens/closes.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setForm(
        user
          ? {
              nickname: user.nickname || '',
              callname: user.callname || '',
              username: user.username || '',
              password: '',
              type: user.type || 'user',
              changeAsLogin: user.changeAsLogin ?? false,
            }
          : { ...emptyForm, type: defaultType }
      )
    }
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    // onPress from HeroUI Button doesn't pass standard event with preventDefault
    // Only call preventDefault if it exists (for form submit)
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }

    console.log('=== UserFormModal Submit ===')
    console.log('Form data:', form)
    console.log('Is Edit:', isEdit)

    // Detailed validation with specific error messages
    if (!form.nickname.trim()) {
      console.error('Validation failed: nickname empty')
      toast.error('Nama panggilan wajib diisi.')
      return
    }
    if (!form.username.trim()) {
      console.error('Validation failed: username empty')
      toast.error('Username wajib diisi.')
      return
    }
    
    // Username validation: only alphanumeric and underscore
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(form.username.trim())) {
      console.error('Validation failed: username format invalid')
      toast.error('Username hanya boleh berisi huruf, angka, dan underscore (_).')
      return
    }
    
    // Password validation for new users
    if (!isEdit && !form.password.trim()) {
      console.error('Validation failed: password empty for new user')
      toast.error('Password wajib diisi untuk akun baru.')
      return
    }
    
    // Password length validation if password is provided
    if (form.password.trim() && form.password.trim().length < 6) {
      console.error('Validation failed: password too short')
      toast.error('Password minimal 6 karakter.')
      return
    }

    const payload = {
      nickname: form.nickname.trim(),
      callname: form.callname.trim() || form.nickname.trim(),
      type: form.type,
      username: form.username.trim(),
      password: form.password.trim(),
      changeAsLogin: form.changeAsLogin,
    }

    // Don't send empty password for edit
    if (isEdit && !payload.password) {
      delete payload.password
    }

    console.log('Validation passed')
    console.log('Payload to send:', payload)
    console.log('Mock Mode:', api.isMockMode())

    setSaving(true)
    try {
      if (isEdit) {
        console.log('Calling updateUser API...')
        await api.updateUser(user.id, payload)
        console.log('updateUser success')
        toast.success(`Data ${typeLabel.toLowerCase()} berhasil diperbarui.`)
      } else {
        console.log('Calling createUser API...')
        const result = await api.createUser(payload)
        console.log('createUser success:', result)
        toast.success(`${typeLabel} baru berhasil ditambahkan.`)
      }
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      console.error('UserFormModal API error:', err)
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        stack: err.stack
      })
      // More detailed error message
      const errorMsg = err.message || `Gagal menyimpan data ${typeLabel.toLowerCase()}.`
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Ubah Data ${typeLabel}` : `Tambah ${typeLabel}`}
      description={isEdit ? `Memperbarui akun ${user?.username}` : `Buat akun ${typeLabel.toLowerCase()} baru untuk presensi.`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onPress={() => onOpenChange(false)} isDisabled={saving}>
            Batal
          </Button>
          <Button variant="primary" onPress={handleSubmit} isDisabled={saving}>
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : `Tambah ${typeLabel}`}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextInput
          label="Nama Panggilan"
          placeholder="cth. Ahnaf"
          value={form.nickname}
          onChange={(e) => setField('nickname', e.target.value)}
        />
        <TextInput
          label="Nama Lengkap"
          placeholder="cth. Ahnaf Farras"
          value={form.callname}
          onChange={(e) => setField('callname', e.target.value)}
        />
        <TextInput
          label="Username"
          placeholder="cth. user001"
          value={form.username}
          onChange={(e) => setField('username', e.target.value)}
          autoComplete="off"
        />
        <PasswordInput
          label={isEdit ? 'Password Baru (opsional)' : 'Password'}
          placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Password akun'}
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          autoComplete="new-password"
        />
        <SelectInput
          label="Tipe Akun"
          value={form.type}
          onChange={(e) => setField('type', e.target.value)}
        >
          <option value="user">Siswa</option>
          <option value="admin">Admin</option>
        </SelectInput>
        <ToggleField
          label="Wajib ganti password saat login pertama"
          checked={form.changeAsLogin}
          onChange={(v) => setField('changeAsLogin', v)}
        />
      </form>
    </AppModal>
  )
}