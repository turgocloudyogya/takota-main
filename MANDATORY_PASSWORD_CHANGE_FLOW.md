# Mandatory Password Change Flow

## Tanggal: 12 Juli 2026

## 🎯 Feature Overview

Implementasi **mandatory password change** untuk user baru yang dibuat dengan flag `change_as_login = true`. User harus mengganti password default mereka sebelum bisa mengakses aplikasi.

---

## 🔄 Flow Diagram

```
┌─────────────────┐
│  Admin creates  │
│  new user with  │
│ "Wajib ganti    │
│  password" ☑️   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User login     │
│  dengan default │
│  password       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Backend cek    │ YES  │  Redirect to    │
│ change_as_login?├─────>│ /change-password│
└────────┬────────┘      └────────┬────────┘
         │ NO                     │
         │                        ▼
         │               ┌─────────────────┐
         │               │  User MUST      │
         │               │  change password│
         │               └────────┬────────┘
         │                        │
         │                        ▼
         │               ┌─────────────────┐
         │               │  Password       │
         │               │  changed,       │
         │               │  change_as_login│
         │               │  = false        │
         │               └────────┬────────┘
         ▼                        │
┌─────────────────┐              │
│  Redirect to    │◄─────────────┘
│  dashboard/main │
└─────────────────┘
```

---

## 🔧 Implementation Details

### 1. Backend (Already Implemented)

**File**: `internal/controllers/auth_controller.go`

#### Login Response
```go
// If change_as_login is true, redirect to /chpw
redirect := "/main"
if user.Type == "admin" {
    redirect = "/dash"
}
if user.ChangeAsLogin {
    redirect = "/chpw"
}

return LoginResponse{
    Token:    token,
    LoginAs:  user.Type,
    Redirect: redirect,
}
```

#### Change Password
```go
// After password changed, set change_as_login to false
user.Password = hashedPassword
user.ChangeAsLogin = false // ✅ Reset flag

// Generate new token with updated flag
token, _ := jwtpkg.GenerateToken(..., user.ChangeAsLogin, ...)

// Redirect to dashboard based on role
redirect := "/main"
if user.Type == "admin" {
    redirect = "/dash"
}

return LoginResponse{
    Token:    token,
    Redirect: redirect,
}
```

---

### 2. Frontend Implementation

#### A. Login.jsx

**File**: `web/src/pages/Login.jsx`

**Key Changes**:
```javascript
// Check redirect field from backend response
const redirectPath = data.redirect || (data.login_as === 'admin' ? '/dash' : '/main')

if (redirectPath === '/chpw') {
  // Password change required
  toast.info('Anda harus mengganti password terlebih dahulu.')
  navigate('/change-password', { replace: true })
} else {
  // Normal login flow
  toast.success(`Selamat datang, ${username}!`)
  navigate(redirectPath, { replace: true })
}
```

**Flow**:
1. User login dengan credentials
2. Backend return `redirect: "/chpw"` jika `change_as_login = true`
3. Frontend detect dan redirect ke `/change-password`
4. User **tidak bisa** skip - harus change password dulu

---

#### B. ChangePassword.jsx

**File**: `web/src/pages/ChangePassword.jsx`

**Key Changes**:
```javascript
// Call real backend API
const data = await changePasswordAPI(oldPassword, newPassword, confirmPassword)

// Update token with new one (change_as_login now false)
localStorage.setItem('takota_admin_token', data.token)
localStorage.setItem('takota_token', data.token)

// Redirect based on response
const redirectPath = data.redirect || '/main'
const userRole = localStorage.getItem('takota-role')

if (userRole === 'admin') {
  navigate('/admin/dashboard', { replace: true })
} else {
  navigate(redirectPath, { replace: true })
}
```

**Validations**:
- ✅ All fields required
- ✅ New password minimum 6 characters
- ✅ New password ≠ old password
- ✅ New password = confirm password

---

## 🧪 Testing Checklist

### Test 1: Create User with Mandatory Password Change

1. ✅ Login sebagai admin
2. ✅ Buka `/admin/users`
3. ✅ Klik "Tambah Siswa"
4. ✅ Isi form:
   - Nama Panggilan: `TestUser`
   - Username: `testuser001`
   - Password: `default123`
   - **☑️ Centang "Wajib ganti password saat login pertama"**
5. ✅ Klik "Tambah Siswa"
6. ✅ User created successfully

---

### Test 2: First Login - Redirected to Change Password

1. ✅ Logout dari admin
2. ✅ Login sebagai user baru:
   - Username: `testuser001`
   - Password: `default123`
3. ✅ **Expected**: 
   - Toast: "Anda harus mengganti password terlebih dahulu."
   - Redirect ke `/change-password` (NOT `/main`)
   - Cannot skip - no way to access `/main`

---

### Test 3: Change Password

1. ✅ Di halaman `/change-password`:
   - Password Lama: `default123`
   - Password Baru: `newpassword123` (min 6 chars)
   - Konfirmasi: `newpassword123`
2. ✅ Klik "Ubah Password"
3. ✅ **Expected**:
   - Toast: "Password berhasil diubah!"
   - New token saved to localStorage
   - Redirect to `/main` (for user) or `/admin/dashboard` (for admin)

---

### Test 4: Validation Errors

#### 4a. New Password Too Short
- Password Baru: `pass` (< 6 chars)
- **Expected**: Toast error "Password baru minimal 6 karakter."

#### 4b. New Password Same as Old
- Password Lama: `default123`
- Password Baru: `default123`
- **Expected**: Toast error "Password baru harus berbeda dari password lama."

#### 4c. Passwords Don't Match
- Password Baru: `newpassword123`
- Konfirmasi: `different123`
- **Expected**: Toast error "Password baru dan konfirmasi password tidak cocok."

#### 4d. Wrong Old Password
- Password Lama: `wrongpassword`
- **Expected**: Backend error "Incorrect current password"

---

### Test 5: Login After Password Changed

1. ✅ Logout
2. ✅ Login lagi dengan:
   - Username: `testuser001`
   - Password: `newpassword123` (NEW password)
3. ✅ **Expected**:
   - Toast: "Selamat datang, testuser001!"
   - Redirect to `/main` directly (NO change password prompt)
   - Can access dashboard normally

---

### Test 6: Old Password No Longer Works

1. ✅ Try login dengan password lama:
   - Username: `testuser001`
   - Password: `default123` (OLD password)
2. ✅ **Expected**:
   - Error: "Incorrect password"
   - Cannot login

---

## 🔒 Security Features

### 1. Cannot Skip Password Change
- User **cannot** manually navigate to `/main` without changing password
- Backend middleware will reject requests with `change_as_login = true`
- Frontend redirect enforced via `replace: true` (no back button)

### 2. Token Refresh
- New JWT token generated after password change
- Old token with `change_as_login = true` invalidated
- New token has `change_as_login = false`

### 3. Password Validation
- Minimum 6 characters (backend enforced)
- Must be different from old password
- Frontend + backend validation

### 4. Auth ID Rotation
- Backend generates new `auth_id` after password change
- Forces re-authentication on all devices
- Prevents session hijacking

---

## 📊 Backend Response Examples

### Login Response (Password Change Required)
```json
{
  "token": "eyJhbGc...",
  "login_as": "user",
  "redirect": "/chpw"  // ← Indicates password change required
}
```

### Login Response (Normal)
```json
{
  "token": "eyJhbGc...",
  "login_as": "user",
  "redirect": "/main"  // ← Normal user dashboard
}
```

### Change Password Response
```json
{
  "token": "eyJhbGc...",  // ← New token with change_as_login = false
  "login_as": "user",
  "redirect": "/main"
}
```

---

## 🐛 Troubleshooting

### Issue: User stuck in change password loop

**Symptoms**: After changing password, still redirected to `/change-password`

**Possible Causes**:
1. Backend didn't set `change_as_login = false`
2. Old token still in use (not updated)
3. Browser cache issue

**Solution**:
```sql
-- Check user in database
SELECT id, username, change_as_login FROM users WHERE username = 'testuser001';

-- Manually fix if needed
UPDATE users SET change_as_login = false WHERE username = 'testuser001';
```

```javascript
// Frontend: Clear old tokens
localStorage.removeItem('takota_admin_token')
localStorage.removeItem('takota_token')
// Then login again
```

---

### Issue: Cannot access /change-password (401 error)

**Cause**: Token expired or invalid

**Solution**:
- Change password endpoint requires valid JWT
- If user can't login at all, admin must reset their password
- Or create new user

---

## 📁 Files Modified

1. ✅ `web/src/pages/Login.jsx` - Check redirect field, handle `/chpw`
2. ✅ `web/src/pages/ChangePassword.jsx` - Real API integration, proper redirect
3. ✅ Backend already implemented (no changes needed)

---

## ✅ Success Criteria

- [x] Admin can create user with "Wajib ganti password" checkbox
- [x] User forced to change password on first login
- [x] User cannot skip password change
- [x] Password validations work correctly
- [x] After password change, user can login normally
- [x] Old password no longer works after change
- [x] Token properly refreshed with new flag
- [x] User redirected to correct dashboard based on role

---

## 🎉 Conclusion

Flow mandatory password change sudah fully implemented dan integrated dengan backend. User baru dengan flag `change_as_login = true` akan dipaksa mengganti password sebelum bisa mengakses aplikasi.

**Feature ready for production!** 🚀
