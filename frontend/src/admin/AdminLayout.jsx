import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
import { ConfirmDialog } from '../components/Modals.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import GuideOverlay from './components/GuideOverlay.jsx'
import { isGuideDone } from './lib/guide.js'

// Same icon everywhere a sidebar-toggle affordance is needed (desktop
// collapse/expand button, mobile "open menu" button) - one glyph from the
// app's existing icon set, not a one-off hand-drawn SVG.
function SidebarToggleButton({ collapsed, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary dark:text-neutral-400 dark:hover:bg-neutral-800 ${className}`}
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
        <IconTooltip>Preview Mode · Sample Data</IconTooltip>
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
      Preview Mode · Sample Data
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
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
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
  { to: '/admin/attendance', label: 'Attendance', icon: Clock },
  { to: '/admin/absence', label: 'Leave & Sick', icon: FileCheck },
  { to: '/admin/photos', label: 'Photo Gallery', icon: Picture },
  { to: '/admin/reports', label: 'Reports & Export', icon: FileArrowDown },
]

function NavList({ onNavigate, collapsed = false }) {
  return (
    <nav className="flex flex-col gap-1">
      {!collapsed && (
        <p className="mb-1 px-3.5 text-[10px] font-semibold tracking-[0.12em] text-neutral/70 uppercase dark:text-neutral-400">Menu</p>
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
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
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
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(() => !isGuideDone())
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
    setLogoutOpen(true)
  }

  async function handleConfirmLogout() {
    await api.logout()
    toast.info('Logged out successfully!')
    navigate('/', { replace: true })
  }

  const initial = session.username?.[0]?.toUpperCase() || 'A'

  return (
    <div className="min-h-screen w-full bg-neutral-50/50 dark:bg-neutral-950">
      {/* Desktop sidebar. z-40 makes sure it (and anything inside it, like
          the collapsed-state tooltips) always paints above the main
          content, regardless of DOM order. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-app-border/15 bg-white py-6 transition-[width] duration-300 ease-in-out lg:flex dark:border-white/10 dark:bg-neutral-900 ${
          collapsed ? 'w-20 px-2' : 'w-64 px-4'
        }`}
      >
        {/* Expanded: toggle sits at the end of the brand row - the top-right
            of the sidebar, inline with the title, not straddling the border. */}
        {!collapsed && (
          <div className="mb-6 flex items-center justify-between px-1">
            <p className="min-w-0 truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Takota Admin</p>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <SidebarToggleButton collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
            </div>
          </div>
        )}

        {/* Collapsed: the toggle and the theme switch stack in a centered
            column - same center line as the nav icons below, instead of
            being pinned off to a corner. */}
        {collapsed && (
          <div className="mb-6 flex flex-col items-center gap-4">
            <SidebarToggleButton collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
            <ThemeToggle />
          </div>
        )}

        {api.isMockMode() && (
          <PreviewBadge className={collapsed ? 'mb-5 self-center' : 'mb-5 self-start'} collapsed={collapsed} />
        )}

        <NavList collapsed={collapsed} />

        <div className={`mt-auto flex flex-col gap-2 border-t border-app-border/15 pt-4 dark:border-white/10 ${collapsed ? 'items-center' : ''}`}>
          <div
            className={`group relative flex items-center rounded-xl bg-neutral-100 dark:bg-neutral-800 ${
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-3.5 py-2.5'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initial}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{session.username}</p>
                <p className="text-xs text-neutral dark:text-neutral-400">Administrator</p>
              </div>
            )}
            {collapsed && <IconTooltip>{session.username} · Administrator</IconTooltip>}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={collapsed ? 'Logout' : undefined}
            className={`group cursor-pointer relative flex items-center rounded-xl text-sm font-medium text-danger transition hover:bg-danger/10 ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            }`}
          >
            <Icon data={ArrowRightFromLine} size={17} className="shrink-0" />
            {!collapsed && 'Logout'}
            {collapsed && <IconTooltip>Logout</IconTooltip>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-app-border/15 bg-white px-4 py-3 lg:hidden dark:border-white/10 dark:bg-neutral-900">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Takota Admin</p>
        </div>
        <div className="flex items-center gap-2">
          {api.isMockMode() && <PreviewBadge />}
          <ThemeToggle className="h-9 w-9 rounded-lg" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 dark:bg-neutral-900">
            <div className="mb-6 flex items-center justify-between px-1">
              <p className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Takota Admin</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
              Logout
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

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Are you sure you want to log out?"
        description="Your session will be ended and you'll return to the login page."
        confirmLabel="Logout"
        cancelLabel="Cancel"
        danger
        onConfirm={handleConfirmLogout}
      />

      {showGuide && <GuideOverlay onComplete={() => setShowGuide(false)} />}
    </div>
  )
}