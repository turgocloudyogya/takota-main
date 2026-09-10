import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { MapPin, X } from '@gravity-ui/icons'

export default function PhotoDetailModal({ isOpen, onClose, photo }) {
  if (!photo) return null

  const timestamp = photo.timestamp ? new Date(photo.timestamp).toLocaleString() : '—'
  const userName = photo.user?.username || photo.userUsername || 'Unknown'

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" backdrop="blur">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center justify-between gap-2">
              <span>Attendance Photo</span>
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition"
              >
                <Icon data={X} size={20} />
              </button>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* Photo */}
                {photo.photoUrl && (
                  <div className="w-full rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={photo.photoUrl}
                      alt="Attendance photo"
                      className="w-full h-auto object-contain max-h-96"
                    />
                  </div>
                )}

                {/* Location Info */}
                <div className="space-y-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-4">
                  <div className="flex items-start gap-2">
                    <Icon data={MapPin} size={18} className="text-neutral-600 dark:text-neutral-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Location</p>
                      <p className="text-sm text-neutral-900 dark:text-neutral-100 mt-1">
                        {photo.displayAddress || 'Location not available'}
                      </p>
                      {photo.gmapsEmbed && (
                        <a
                          href={photo.gmapsEmbed}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                        >
                          View on Google Maps →
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Time</p>
                    <p className="mt-1 text-neutral-900 dark:text-neutral-100">{timestamp}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Submitted By</p>
                    <p className="mt-1 text-neutral-900 dark:text-neutral-100">{userName}</p>
                  </div>
                </div>

                {/* Coordinates */}
                {photo.latitude && photo.longitude && (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-300 dark:border-neutral-700 pt-3">
                    <p className="font-medium">Coordinates</p>
                    <p className="mt-1 font-mono">
                      {photo.latitude}, {photo.longitude}
                    </p>
                  </div>
                )}

                <Button
                  onPress={onClose}
                  color="primary"
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
