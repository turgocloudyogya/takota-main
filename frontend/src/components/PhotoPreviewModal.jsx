import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@gravity-ui/uikit'
import { Xmark, ArrowDownToLine } from '@gravity-ui/icons'
import { downloadFile } from '../lib/download.js'

// Preview popup for a single gallery photo. Reuses the same
// bg-black/40 + backdrop-blur-sm overlay treatment as AttendanceSheet,
// just centered instead of anchored to the bottom.
export default function PhotoPreviewModal({ photo, onClose }) {
  function handleDownload() {
    if (!photo?.url) return
    const filename = photo.url.split('/').pop() || 'photo'
    downloadFile(photo.url, filename)
  }

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[280px] sm:max-w-sm"
          >
            <div className="relative">
              <div className="overflow-hidden rounded-xl bg-white shadow-xl dark:bg-neutral-900">
                <img src={photo.url} alt="" className="w-full object-contain" />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute -right-2 -top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-900 shadow-md transition active:scale-[0.94] dark:bg-neutral-800 dark:text-neutral-100"
              >
                <Icon data={Xmark} size={14} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-white px-4 py-2.5 text-center shadow-lg dark:bg-neutral-800">
                <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  {photo.date ? (() => {
                    const d = new Date(photo.date)
                    const month = d.getMonth() + 1
                    const day = d.getDate()
                    const year = d.getFullYear().toString().slice(-2)
                    const hours = d.getHours()
                    const minutes = d.getMinutes().toString().padStart(2, '0')
                    return `${month}/${day}/${year} ${hours}:${minutes}`
                  })() : ''} • by @{photo.username || 'user'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                aria-label="Download photo"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg transition active:scale-[0.94] dark:bg-neutral-800 dark:text-neutral-100"
              >
                <Icon data={ArrowDownToLine} size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}