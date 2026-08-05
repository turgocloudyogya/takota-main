import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import { ArrowRight, ArrowLeft, Xmark } from '@gravity-ui/icons'
import { markGuideDone } from '../lib/guide.js'

const STEPS = [
  {
    page: '/admin/dashboard',
    target: '[data-guide="stat-cards"]',
    title: 'Dashboard Overview',
    description: 'Here you can see the key stats at a glance: Total Students, Present Today, Pending Leave, and Not Checked In Today.',
    placement: 'bottom',
  },
  {
    page: '/admin/dashboard',
    target: '[data-guide="charts"]',
    title: 'Attendance Charts',
    description: 'View the attendance trend over the last 14 days and today\'s status breakdown with interactive charts.',
    placement: 'bottom',
  },
  {
    page: '/admin/dashboard',
    target: '[data-guide="recent-activity"]',
    title: 'Recent Activity',
    description: 'See the latest attendance and leave submissions from students here.',
    placement: 'top',
  },
  {
    page: '/admin/users',
    target: '[data-guide="add-user-btn"]',
    title: 'Add New Users',
    description: 'Click this button to add a new student or admin account to the system.',
    placement: 'bottom',
  },
  {
    page: '/admin/attendance',
    target: '[data-guide="attendance-table"]',
    title: 'Attendance Timeline',
    description: 'View who has checked in today and their attendance history. You can search and filter by name.',
    placement: 'bottom',
  },
  {
    page: '/admin/absence',
    target: '[data-guide="absence-table"]',
    title: 'Leave & Sick Requests',
    description: 'Review and manage leave and sick submissions from students. Approve or reject requests here.',
    placement: 'bottom',
  },
  {
    page: '/admin/photos',
    target: '[data-guide="photo-gallery"]',
    title: 'Photo Gallery',
    description: 'Browse attendance photos submitted by students for verification.',
    placement: 'bottom',
  },
  {
    page: '/admin/reports',
    target: '[data-guide="reports-export"]',
    title: 'Reports & Export',
    description: 'Download attendance reports as CSV or generate printable PDF recaps for documentation.',
    placement: 'bottom',
  },
]

const GAP = 8

function getTargetEl(selector) {
  return document.querySelector(selector)
}

let cachedInsets = null
function getSafeAreaInsets() {
  if (cachedInsets) return cachedInsets
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  document.body.appendChild(el)
  const cs = getComputedStyle(el)
  cachedInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  }
  document.body.removeChild(el)
  return cachedInsets
}

function computeTooltipPos(targetRect, placement) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const sa = getSafeAreaInsets()
  const pad = 16
  const minLeft = pad + sa.left
  const maxRight = vw - pad - sa.right
  const minTop = pad + sa.top
  const maxBottom = vh - pad - sa.bottom
  const tooltipW = Math.min(260, maxRight - minLeft)
  let top, left, transform

  switch (placement) {
    case 'top':
      top = targetRect.top - GAP - 180
      left = targetRect.left + targetRect.width / 2
      transform = 'translate(-50%, 0)'
      break
    case 'bottom':
      top = targetRect.bottom + GAP
      left = targetRect.left + targetRect.width / 2
      transform = 'translate(-50%, 0)'
      break
    case 'left':
      top = targetRect.top + targetRect.height / 2
      left = targetRect.left - GAP - tooltipW
      transform = 'translate(0, -50%)'
      break
    case 'right':
      top = targetRect.top + targetRect.height / 2
      left = targetRect.right + GAP
      transform = 'translate(0, -50%)'
      break
    default:
      top = targetRect.bottom + GAP
      left = targetRect.left + targetRect.width / 2
      transform = 'translate(-50%, 0)'
  }

  if (left < minLeft) left = minLeft
  if (left + tooltipW > maxRight) left = maxRight - tooltipW
  if (top + 180 > maxBottom) top = maxBottom - 180
  if (top < minTop) top = minTop

  return { top, left, transform, tooltipW }
}

function measureTarget(target) {
  const el = getTargetEl(target)
  if (!el) return null
  el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' })
  return el.getBoundingClientRect()
}

export default function GuideOverlay({ onComplete }) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const tooltipRef = useRef(null)

  const currentStep = STEPS[stepIndex]
  const totalSteps = STEPS.length

  // Navigate to the correct page when step changes
  useEffect(() => {
    if (!currentStep) return
    const currentPath = window.location.pathname
    if (currentPath !== currentStep.page) {
      navigate(currentStep.page, { replace: true })
    }
  }, [stepIndex, currentStep, navigate])

  // Wait for page render then find target
  useEffect(() => {
    if (!currentStep) return
    const currentPath = window.location.pathname
    if (currentPath !== currentStep.page) return

    let cancelled = false
    let retryCount = 0
    let timer

    function tryFind() {
      if (cancelled) return
      const rect = measureTarget(currentStep.target)
      if (!rect) {
        if (retryCount < 10) {
          retryCount++
          timer = setTimeout(tryFind, 500)
        }
        return
      }
      requestAnimationFrame(() => {
        if (cancelled) return
        setTargetRect(rect)
        setVisible(true)
        // Start animating after first render
        setTimeout(() => setAnimating(true), 50)
      })
    }

    timer = setTimeout(tryFind, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stepIndex, currentStep])

  useEffect(() => {
    if (!visible || !currentStep) return
    const handler = () => {
      const rect = measureTarget(currentStep.target)
      if (rect) setTargetRect(rect)
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [visible, currentStep])

  if (!currentStep || !visible || !targetRect) return null

  const tooltipPos = computeTooltipPos(targetRect, currentStep.placement)

  function handleNext() {
    if (stepIndex < totalSteps - 1) {
      setStepIndex(stepIndex + 1)
    } else {
      markGuideDone()
      onComplete?.()
    }
  }

  function handlePrev() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1)
    }
  }

  function handleSkip() {
    markGuideDone()
    onComplete?.()
  }

  const SPOTLIGHT_PAD = 8
  const spotlight = {
    top: targetRect.top - SPOTLIGHT_PAD,
    left: targetRect.left - SPOTLIGHT_PAD,
    width: targetRect.width + SPOTLIGHT_PAD * 2,
    height: targetRect.height + SPOTLIGHT_PAD * 2,
  }

  const transitionClass = animating ? 'transition-all duration-500 ease-in-out' : ''

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50" />

      <div
        className={`absolute rounded-xl ring-4 ring-primary/60 ${transitionClass}`}
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        }}
      />

      <div
        ref={tooltipRef}
        className={`absolute z-10 rounded-lg bg-white p-3 shadow-2xl dark:bg-neutral-800 ${transitionClass}`}
        style={{ ...tooltipPos, width: tooltipPos.tooltipW }}
      >
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-primary">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700"
            aria-label="Skip guide"
          >
            <Icon data={Xmark} size={12} />
          </button>
        </div>
        <h3 className="mb-1 text-sm font-bold text-neutral-900 dark:text-neutral-100">
          {currentStep.title}
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          {currentStep.description}
        </p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={stepIndex === 0}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-700"
          >
            <Icon data={ArrowLeft} size={12} />
            Back
          </button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-200 ${
                  i === stepIndex ? 'w-4 bg-primary' : 'w-1 bg-neutral-300 dark:bg-neutral-600'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white transition hover:bg-primary/90 active:scale-[0.97]"
          >
            {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
            {stepIndex < totalSteps - 1 && <Icon data={ArrowRight} size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
}
