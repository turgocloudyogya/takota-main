import { Drawer } from 'vaul'


export default function AttendanceSheet({ open, onOpenChange, onPickAttendance, onPickAbsence, onPickPhotos }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-2xl bg-white p-5 pb-8 outline-none dark:bg-neutral-900">
          <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border/40" />
          <Drawer.Title className="mb-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Select option
          </Drawer.Title>

          <button
            type="button"
            onClick={onPickAttendance}
            className="mb-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Attendance
          </button>

          <button
            type="button"
            onClick={onPickAbsence}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Absence
          </button>

          <hr className="my-4 border-t-2 border-gray-200 rounded-md dark:border-neutral-800" />
          <button
            type="button"
            onClick={onPickPhotos}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Photos
          </button>

        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
