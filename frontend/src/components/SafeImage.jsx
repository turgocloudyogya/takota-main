import { useState } from 'react'
import { Icon } from '@gravity-ui/uikit'
import { Picture } from '@gravity-ui/icons'

export default function SafeImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  eager = false,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const displaySrc = failed || !src ? null : retryKey ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryKey}` : src

  return (
    <div className={`relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${className}`}>
      {!failed && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Loading...</p>
        </div>
      )}
      {failed || !src ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
          <Icon data={Picture} size={20} className="text-neutral-400 dark:text-neutral-500" />
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Image unavailable</p>
          {src && (
            <button
              type="button"
              onClick={() => { setFailed(false); setLoaded(false); setRetryKey((k) => k + 1) }}
              className="cursor-pointer text-[11px] font-semibold text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <img
          src={displaySrc}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150 ${imgClassName}`}
        />
      )}
    </div>
  )
}
