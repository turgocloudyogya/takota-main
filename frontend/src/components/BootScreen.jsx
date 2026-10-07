// Full-screen boot loader: centered app icon + "Loading..." text. Shown
// from HTML parse (see #boot-splash in index.html) through the first
// /api/all/info check, then fades out over 200ms on resolve or failure.
export default function BootScreen({ leaving }) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[2147483646] flex flex-col items-center justify-center gap-1.5 bg-white transition-opacity duration-200 dark:bg-[#0a0a0a] ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img src="/takota-chibi.png" alt="" className="h-16 w-16 rounded-md object-cover" />
      <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Loading...</p>
    </div>
  )
}
