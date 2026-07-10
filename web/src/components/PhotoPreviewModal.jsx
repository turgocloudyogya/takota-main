import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@gravity-ui/uikit'
import { Xmark } from '@gravity-ui/icons'

// Preview popup for a single gallery photo. Reuses the same
// bg-black/40 + backdrop-blur-sm overlay treatment as AttendanceSheet,
// just centered instead of anchored to the bottom.
export default function PhotoPreviewModal({ photo, onClose }) {
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
              <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
                <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md transition active:scale-[0.94]"
              >
                <Icon data={Xmark} size={14} />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-white px-4 py-2.5 text-center shadow-lg">
              <p className="text-xs font-medium text-neutral-900">
                {photo.date} {photo.time} • By @{photo.username}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}