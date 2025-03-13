import { useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export const useUnsavedChangesWarning = (
  isDirty: boolean,
  message: string = '你有未儲存的變更，確定要離開嗎？'
) => {
  const router = useRouter()
  const pathname = usePathname()

  const shouldBlockNavigation = useCallback(() => {
    return isDirty && !window.confirm(message)
  }, [isDirty, message])

  useEffect(() => {
    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      return (e.returnValue = message)
    }

    const handleBrowseAway = (e: PopStateEvent) => {
      if (shouldBlockNavigation()) {
        // Prevent navigation
        window.history.pushState(null, '', pathname)
        e.preventDefault()
      }
    }

    // Intercept all click events on links
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      
      if (!link) return
      
      const href = link.getAttribute('href')
      if (!href || href === pathname) return
      
      if (shouldBlockNavigation()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleWindowClose)
    window.addEventListener('popstate', handleBrowseAway)
    document.addEventListener('click', handleLinkClick, { capture: true })

    // Push the current state to enable back button detection
    window.history.pushState(null, '', pathname)

    return () => {
      window.removeEventListener('beforeunload', handleWindowClose)
      window.removeEventListener('popstate', handleBrowseAway)
      document.removeEventListener('click', handleLinkClick, { capture: true })
    }
  }, [pathname, shouldBlockNavigation])

  // Return a function to check if navigation should be blocked
  return {
    shouldBlock: shouldBlockNavigation
  }
} 