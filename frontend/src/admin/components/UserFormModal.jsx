import { useState } from 'react'
import { Button, Checkbox, Input, Label, ListBox, Select, TextField } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { Eye, EyeSlash } from '@gravity-ui/icons'
import { toast } from 'sonner'
import { AppModal } from '../../components/Modals.jsx'
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
  const [showPw, setShowPw] = useState(false)
  const typeLabel = form.type === 'admin' ? 'Admin' : 'Student'

  // Reset the form whenever the modal transitions from closed -> open, so a
  // freshly-opened "add" form is always blank and a freshly-opened "edit"
  // form always reflects the selected user. Adjusting state during render
  // (per React's guidance) instead of in an effect, since this component
  // stays mounted across opens/closes.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setShowPw(false)
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
      toast.error('Nickname is required.')
      return
    }
    if (!form.username.trim()) {
      console.error('Validation failed: username empty')
      toast.error('Username is required.')
      return
    }
    
    // Username validation: only alphanumeric and underscore
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(form.username.trim())) {
      console.error('Validation failed: username format invalid')
      toast.error('Username can only contain letters, numbers, and underscores (_).')
      return
    }
    
    // Password validation for new users
    if (!isEdit && !form.password.trim()) {
      console.error('Validation failed: password empty for new user')
      toast.error('Password is required for a new account.')
      return
    }
    
    // Password length validation if password is provided
    if (form.password.trim() && form.password.trim().length < 6) {
      console.error('Validation failed: password too short')
      toast.error('Password must be at least 6 characters.')
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
        toast.success(`Data for the ${typeLabel.toLowerCase()} was updated successfully.`)
      } else {
        console.log('Calling createUser API...')
        const result = await api.createUser(payload)
        console.log('createUser success:', result)
        toast.success(`New ${typeLabel.toLowerCase()} added successfully.`)
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
      const errorMsg = err.message || `Failed to save the ${typeLabel.toLowerCase()} data.`
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${typeLabel} Data` : `Add ${typeLabel}`}
      description={isEdit ? `Updating the account for ${user?.username}` : `Create a new ${typeLabel.toLowerCase()} account for attendance.`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onPress={() => onOpenChange(false)} isDisabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onPress={handleSubmit} isDisabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${typeLabel}`}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField fullWidth name="nickname" value={form.nickname} onChange={(v) => setField('nickname', v)}>
          <Label>Nickname</Label>
          <Input className="bg-neutral-100 shadow-none dark:bg-neutral-900" placeholder="e.g. Ahnaf" />
        </TextField>
        <TextField fullWidth name="callname" value={form.callname} onChange={(v) => setField('callname', v)}>
          <Label>Full Name</Label>
          <Input className="bg-neutral-100 shadow-none dark:bg-neutral-900" placeholder="e.g. Ahnaf Farras" />
        </TextField>
        <TextField fullWidth name="username" value={form.username} onChange={(v) => setField('username', v)}>
          <Label>Username</Label>
          <Input className="bg-neutral-100 shadow-none dark:bg-neutral-900" placeholder="e.g. user001" autoComplete="off" />
        </TextField>
        <TextField fullWidth name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={(v) => setField('password', v)}>
          <Label>{isEdit ? 'New Password (optional)' : 'Password'}</Label>
          <div className="relative">
            <Input
              className="bg-neutral-100 shadow-none dark:bg-neutral-900 pr-10"
              placeholder={isEdit ? 'Leave blank to keep unchanged' : 'Account password'}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-3 -translate-y-1/2 shrink-0 text-neutral dark:text-neutral-400"
            >
              <Icon data={showPw ? EyeSlash : Eye} size={16} />
            </button>
          </div>
        </TextField>
        <Select fullWidth value={form.type} onChange={(v) => setField('type', String(v))} placeholder="Select account type">
          <Label>Account Type</Label>
          <Select.Trigger className="bg-neutral-100 shadow-none dark:bg-neutral-900">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="user" textValue="Student">
                Student
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="admin" textValue="Admin">
                Admin
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <label className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-100">
          <Checkbox
            isSelected={form.changeAsLogin}
            onChange={(v) => setField('changeAsLogin', v)}
          >
            <Checkbox.Content>
              <Checkbox.Control className="bg-neutral-50 border border-neutral-200 size-4 rounded-sm before:rounded-sm dark:bg-neutral-800 dark:border-neutral-700">
                <Checkbox.Indicator />
              </Checkbox.Control>
              Require password change on first login
            </Checkbox.Content>
          </Checkbox>
        </label>
      </form>
    </AppModal>
  )
}