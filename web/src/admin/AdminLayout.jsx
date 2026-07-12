import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import {
  House,
  Persons,
  Clock,
  FileCheck,
  FileArrowDown,
  Picture,
  ArrowRightFromLine,
  LayoutSideContentLeft,
  Xmark,
} from '@gravity-ui/icons'
import { getSession, isAdminSession } from './lib/session.js'
import * as api from './lib/api.js'

// Signature mark: a location pin with a check — the app's whole job is
// "confirm this person is here, right now," so the brand mark says exactly
// that. The small pulsing dot echoes a live GPS check-in.
function BrandMark({ size = 'md' }) {
  const dims = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'
  return (
    <span className={`relative flex ${dims} shrink-0 items-center justify-center rounded-xl bg-primary text-white`}>
      <svg viewBox="0 0 20 20" className={glyph} fill="none" aria-hidden="true">
        <path
          d="M10 2.2c-3.04 0-5.5 2.42-5.5 5.62C4.5 11.94 10 17.4 10 17.4s5.5-5.46 5.5-9.58C15.5 4.62 13.04 2.2 10 2.2Z"
          fill="currentColor"
          fillOpacity="0.32"
        />
        <path
          d="M7.25 8.15l1.85 1.85 3.65-3.75"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
        <span className="presence-pulse absolute inset-0 rounded-full bg-success" />
        <span className="relative h-full w-full rounded-full bg-success ring-2 ring-white" />
      </span>
    </span>
  )
}

// Same icon everywhere a sidebar-toggle affordance is needed (desktop
// collapse/expand button, mobile "open menu" button) — one glyph from the
// app's existing icon set, not a one-off hand-drawn SVG.
function SidebarToggleButton({ collapsed, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
      title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary ${className}`}
    >
      <Icon data={LayoutSideContentLeft} size={16} />
    </button>
  )
}

function PreviewBadge({ className = '', collapsed = false }) {
  if (collapsed) {
    return (
      <span className={`group relative flex ${className}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="presence-pulse absolute inset-0 rounded-full bg-warning" />
          <span className="relative h-full w-full rounded-full bg-warning" />
        </span>
        <IconTooltip>Mode Pratinjau · Data Contoh</IconTooltip>
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="presence-pulse absolute inset-0 rounded-full bg-warning" />
        <span className="relative h-full w-full rounded-full bg-warning" />
      </span>
      Mode Pratinjau · Data Contoh
    </span>
  )
}

// Tooltip shown next to an icon when the sidebar is collapsed. The parent
// element must carry `group relative` so the hover state + positioning
// resolve correctly. z-50 (plus the sidebar's own z-40) keeps it painted
// above the page content instead of being tucked behind it.
function IconTooltip({ children }) {
  return (
    <span
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
      role="tooltip"
    >
      {children}
      <span className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-neutral-900" />
    </span>
  )
}

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: House },
  { to: '/admin/users', label: 'Users', icon: Persons },
  { to: '/admin/attendance', label: 'Presensi', icon: Clock },
  { to: '/admin/absence', label: 'Izin & Sakit', icon: FileCheck },
  { to: '/admin/photos', label: 'Galeri Foto', icon: Picture },
  { to: '/admin/reports', label: 'Rekap & Unduh', icon: FileArrowDown },
]

function NavList({ onNavigate, collapsed = false }) {
  return (
    <nav className="flex flex-col gap-1">
      {!collapsed && (
        <p className="mb-1 px-3.5 text-[10px] font-semibold tracking-[0.12em] text-neutral/70 uppercase">Menu</p>
      )}
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          aria-label={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            `group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
              collapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'
            } ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon data={item.icon} size={17} className="shrink-0" />
              {!collapsed && item.label}
              {collapsed && <IconTooltip>{item.label}</IconTooltip>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

export default function AdminLayout() {
  const navigate = useNavigate()
  const [session] = useState(() => getSession())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore write failures (e.g. storage disabled)
    }
  }, [collapsed])

  if (!isAdminSession(session)) {
    return <Navigate to="/" replace />
  }

  function handleLogout() {
    api.logout()
    navigate('/', { replace: true })
  }

  const initial = session.username?.[0]?.toUpperCase() || 'A'

  return (
    <div className="min-h-screen w-full bg-neutral-50/50">
      {/* Desktop sidebar. z-40 makes sure it (and anything inside it, like
          the collapsed-state tooltips) always paints above the main
          content, regardless of DOM order. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-app-border/15 bg-white py-6 transition-[width] duration-300 ease-in-out lg:flex ${
          collapsed ? 'w-20 px-2' : 'w-64 px-4'
        }`}
      >
        {/* Expanded: toggle sits at the end of the brand row — the top-right
            of the sidebar, inline with the logo, not straddling the border. */}
        {!collapsed && (
          <div className="mb-6 flex items-center justify-between px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandMark />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-neutral-900">Takota Admin</p>
                <p className="truncate text-xs text-neutral">Manajemen Presensi Siswa</p>
              </div>
            </div>
            <SidebarToggleButton collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
          </div>
        )}

        {/* Collapsed: no room in the row for both logo and label, so the
            toggle and the logo stack in a centered column — same center
            line as the nav icons below, instead of being pinned off to a
            corner. */}
        {collapsed && (
          <div className="mb-6 flex flex-col items-center gap-4">
            <SidebarToggleButton collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
            <BrandMark size="sm" />
          </div>
        )}

        {api.isMockMode() && (
          <PreviewBadge className={collapsed ? 'mb-5 self-center' : 'mb-5 self-start'} collapsed={collapsed} />
        )}

        <NavList collapsed={collapsed} />

        <div className={`mt-auto flex flex-col gap-2 border-t border-app-border/15 pt-4 ${collapsed ? 'items-center' : ''}`}>
          <div
            className={`group relative flex items-center rounded-xl bg-neutral-100 ${
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-3.5 py-2.5'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initial}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{session.username}</p>
                <p className="text-xs text-neutral">Administrator</p>
              </div>
            )}
            {collapsed && <IconTooltip>{session.username} · Administrator</IconTooltip>}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={collapsed ? 'Keluar' : undefined}
            className={`group relative flex items-center rounded-xl text-sm font-medium text-danger transition hover:bg-danger/10 ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            }`}
          >
            <Icon data={ArrowRightFromLine} size={17} className="shrink-0" />
            {!collapsed && 'Keluar'}
            {collapsed && <IconTooltip>Keluar</IconTooltip>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-app-border/15 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <BrandMark size="sm" />
          <p className="text-sm font-bold tracking-tight text-neutral-900">Takota Admin</p>
        </div>
        <div className="flex items-center gap-2">
          {api.isMockMode() && <PreviewBadge />}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
          >
            <Icon data={LayoutSideContentLeft} size={18} />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <BrandMark size="sm" />
                <p className="text-sm font-bold tracking-tight text-neutral-900">Takota Admin</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <Icon data={Xmark} size={16} />
              </button>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
            >
              <Icon data={ArrowRightFromLine} size={17} />
              Keluar
            </button>
          </div>
        </div>
      )}

      <main
        className={`px-4 py-6 transition-[margin] duration-300 ease-in-out sm:px-6 lg:px-8 lg:py-8 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}