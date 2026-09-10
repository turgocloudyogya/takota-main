// Bottom drawer with attendance record details: photo, time, location and
// an embedded Google Map. Opened by tapping an item in the /main history.

import { Drawer } from 'vaul'

function formatFull(timestamp) {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function AttendanceDetailDrawer({ open, onOpenChange, item }) {
  const address = item?.displayAddress || null
  const coords =
    item?.latitude && item?.longitude ? `${item.latitude}, ${item.longitude}` : null
  const mapSrc =
    item?.latitude && item?.longitude
      ? `https://maps.google.com/maps?q=${encodeURIComponent(item.latitude)},${encodeURIComponent(item.longitude)}&z=15&output=embed`
      : null

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-md flex-col overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 outline-none dark:bg-neutral-900 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-app-border/40" />
          <Drawer.Title className="mb-4 text-base font-bold text-neutral-900 dark:text-neutral-100">
            Attendance Detail
          </Drawer.Title>

          {item?.photoUrl && (
            <img
              src={item.photoUrl}
              alt="Attendance"
              className="w-full rounded-xl object-cover"
            />
          )}

          <p className="mt-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {formatFull(item?.timestamp)}
          </p>
          <p className="mt-1 text-sm text-neutral dark:text-neutral-400">
            {address || coords || 'Location not available'}
          </p>
          {address && coords && (
            <p className="mt-1 font-mono text-xs text-neutral dark:text-neutral-500">{coords}</p>
          )}

          {mapSrc && (
            <iframe
              title="Attendance location map"
              src={mapSrc}
              className="mt-4 h-56 w-full rounded-xl border-0 bg-gray-100 dark:bg-neutral-800"
              loading="lazy"
            />
          )}

          {item?.gmapsEmbed && (
            <a
              href={item.gmapsEmbed}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center text-sm font-medium text-primary"
            >
              Open in Google Maps
            </a>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
