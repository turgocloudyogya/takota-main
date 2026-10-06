import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Icon } from '@gravity-ui/uikit'
import {
  House,
  Persons,
  Clock,
  FileCheck,
  FileArrowDown,
  Picture,
  ArrowDownToLine,
  ArrowRightFromLine,
  LayoutSideContentLeft,
  Shield,
} from '@gravity-ui/icons'
import { getSession, isAdminSession } from './lib/session.js'
import * as api from './lib/api.js'
import { usePwaInstall } from '../lib/pwaInstall.js'
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
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-primary active:scale-90 dark:text-neutral-400 dark:hover:bg-neutral-800 ${className}`}
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

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: House }],
  },
  {
    label: 'People',
    items: [{ to: '/admin/users', label: 'Users', icon: Persons }],
  },
  {
    label: 'Attendance',
    items: [
      { to: '/admin/attendance', label: 'Attendance', icon: Clock },
      { to: '/admin/absence', label: 'Leave & Sick', icon: FileCheck },
      { to: '/admin/photos', label: 'Photo Gallery', icon: Picture },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/reports', label: 'Reports & Export', icon: FileArrowDown },
      { to: '/admin/settings', label: 'Settings', icon: Clock },
      { to: '/admin/security', label: 'Security', icon: Shield },
    ],
  },
]

function NavList({ onNavigate, collapsed = false }) {
  // Labels never unmount: they fade and collapse to zero width/height so
  // the sidebar resizes smoothly with no wrapping and no pop-in.
  const labelMotion = {
    initial: false,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  }
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <motion.p
            {...labelMotion}
            animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
            className="overflow-hidden whitespace-nowrap px-3.5 text-xs font-semibold leading-tight text-neutral/70 dark:text-neutral-400"
          >
            <span className="mb-1 block">{group.label}</span>
          </motion.p>
          <div className="flex flex-col gap-1">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center overflow-hidden rounded-xl py-2.5 text-sm font-medium transition ${
                  collapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'
                } ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                }`
              }
            >
              <Icon data={item.icon} size={17} className="shrink-0" />
              <motion.span
                {...labelMotion}
                animate={{ width: collapsed ? 0 : 'auto' }}
                className="overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
              {collapsed && <IconTooltip>{item.label}</IconTooltip>}
            </NavLink>
          ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

// Shown above Logout while the PWA is installable but not installed.
// Hidden when running inside the installed PWA or after installation.
function InstallAppButton({ collapsed = false, onDone }) {
  const { canInstall, promptInstall } = usePwaInstall()

  if (!canInstall) return null

  async function handleInstall() {
    const accepted = await promptInstall()
    if (accepted) onDone?.()
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      aria-label={collapsed ? 'Install as App' : undefined}
      className={`group cursor-pointer relative flex items-center rounded-xl text-sm font-medium text-primary transition hover:bg-primary/10 hover:scale-[1.02] active:scale-95 ${
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
      }`}
    >
      <Icon data={ArrowDownToLine} size={17} className="shrink-0" />
      <motion.span
        initial={false}
        animate={{ width: collapsed ? 0 : 'auto' }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden whitespace-nowrap"
      >
        Install as App
      </motion.span>
      {collapsed && <IconTooltip>Install as App</IconTooltip>}
    </button>
  )
}

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
        className={`fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col bg-gradient-to-r from-white to-transparent py-6 transition-[width] duration-300 ease-in-out lg:flex dark:from-neutral-900 dark:to-transparent ${
          collapsed ? 'w-20 px-2' : 'w-64 px-4'
        }`}
      >
        {/* Floating collapse toggle straddling the sidebar's right edge. */}
        <SidebarToggleButton
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          className="absolute top-6 -right-5 bg-white shadow-md dark:bg-neutral-800 dark:shadow-black/40"
        />

        {/* Brand row: title fades and collapses like nav labels. */}
        <div className={`mb-6 flex items-center px-1 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <motion.p
            initial={false}
            animate={{ width: collapsed ? 0 : 'auto' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 overflow-hidden whitespace-nowrap text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            Takota Admin
          </motion.p>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
          </div>
        </div>

        {api.isMockMode() && (
          <PreviewBadge className={collapsed ? 'mb-5 self-center' : 'mb-5 self-start'} collapsed={collapsed} />
        )}

        <NavList collapsed={collapsed} />

        <div className={`mt-auto flex flex-col gap-2 pt-4 ${collapsed ? 'items-center' : ''}`}>
          <div
            className={`group relative flex items-center rounded-xl bg-neutral-100 dark:bg-neutral-800 ${
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-3.5 py-2.5'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initial}
            </span>
            <motion.div
              initial={false}
              animate={{ width: collapsed ? 0 : 'auto' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 overflow-hidden whitespace-nowrap"
            >
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{session.username}</p>
              <p className="text-xs text-neutral dark:text-neutral-400">Administrator</p>
            </motion.div>
            {collapsed && <IconTooltip>{session.username} · Administrator</IconTooltip>}
          </div>
          <InstallAppButton collapsed={collapsed} />
          <button
            type="button"
            onClick={handleLogout}
            aria-label={collapsed ? 'Logout' : undefined}
            className={`group cursor-pointer relative flex items-center rounded-xl text-sm font-medium text-danger transition hover:bg-danger/10 hover:scale-[1.02] active:scale-95 ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            }`}
          >
            <Icon data={ArrowRightFromLine} size={17} className="shrink-0" />
            <motion.span
              initial={false}
              animate={{ width: collapsed ? 0 : 'auto' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden whitespace-nowrap"
            >
              Logout
            </motion.span>
            {collapsed && <IconTooltip>Logout</IconTooltip>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar: chromeless, floats over content on a fading
          white-to-transparent gradient with backdrop blur behind it. */}
      <header className="sticky top-0 z-[105] flex items-center justify-between px-4 py-3 lg:hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[200%] bg-gradient-to-b from-white via-white/10 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:from-neutral-900 dark:via-neutral-900/10"
        />
        <div className="relative flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-700 transition hover:bg-neutral-100 hover:scale-105 active:scale-90 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <span className="relative block h-4 w-4" aria-hidden="true">
              <span
                className={`absolute left-0 h-0.5 w-4 rounded bg-current transition-all duration-300 ease-out ${
                  mobileOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[3px]'
                }`}
              />
              <span
                className={`absolute left-0 h-0.5 w-4 rounded bg-current transition-all duration-300 ease-out ${
                  mobileOpen ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'top-[11px]'
                }`}
              />
            </span>
          </button>
          <p className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Takota Admin</p>
        </div>
        <div className="relative flex items-center gap-2">
          {api.isMockMode() && <PreviewBadge />}
          <ThemeToggle className="h-9 w-9 rounded-lg" />
        </div>
      </header>

      {/* Mobile nav drawer: panel slides left-right, overlay fades -
          both directions animated via framer-motion. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[101] lg:hidden">
            <motion.div
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-white/60 dark:bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 left-0 flex w-[calc(100%-20px)] max-w-[310px] flex-col bg-gradient-to-r from-white via-white/20 to-transparent p-4 dark:from-black dark:via-black/20 dark:to-transparent"
            >
            {/* Spacer matching the header above so links start below it. */}
            <div aria-hidden="true" className="mb-6 h-8" />
            <NavList onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto flex flex-col gap-1">
              <InstallAppButton onDone={() => setMobileOpen(false)} />
              <button
                type="button"
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10 hover:scale-[1.02] active:scale-95"
              >
                <Icon data={ArrowRightFromLine} size={17} />
                Logout
              </button>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </MotionConfig>

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