import { Modal, Button, useOverlayState } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { TriangleExclamation } from '@gravity-ui/icons'

/**
 * Controlled modal shell: pass `open` + `onOpenChange` (same contract as any
 * controlled boolean), it wires those into HeroUI's overlay state under the
 * hood.
 */
export function AppModal({ open, onOpenChange, size = 'md', title, description, children, footer }) {
  const state = useOverlayState({ isOpen: open, onOpenChange })

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size={size} placement="center">
          <Modal.Dialog aria-label={title || 'Dialog'}>
            {(title || description) && (
              <Modal.Header>
                {title && <Modal.Heading>{title}</Modal.Heading>}
                {description && (
                  <p className="mt-1 text-sm text-neutral dark:text-neutral-400">{description}</p>
                )}
                <Modal.CloseTrigger />
              </Modal.Header>
            )}
            <Modal.Body>{children}</Modal.Body>
            {footer && <Modal.Footer>{footer}</Modal.Footer>}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmation',
  description,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
}) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onPress={() => onOpenChange(false)} isDisabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onPress={onConfirm}
            isDisabled={loading}
          >
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        {danger && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Icon data={TriangleExclamation} size={18} />
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</p>
          {description && <p className="mt-1 text-sm text-neutral dark:text-neutral-400">{description}</p>}
        </div>
      </div>
    </AppModal>
  )
}
