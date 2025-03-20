import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

type BlockHandler = (targetPath: string) => Promise<boolean>

export function useUnsavedChangesWarning(isDirty: boolean) {
  const router = useRouter()
  const blockHandlerRef = useRef<BlockHandler | null>(null)
  const pendingNavigationRef = useRef<string | null>(null)

  const registerBlockHandler = useCallback((handler: BlockHandler) => {
    blockHandlerRef.current = handler
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
      return undefined
    }

    // For browser navigation
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Intercept navigation attempts
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin)) {
        const path = anchor.href.slice(window.location.origin.length)
        
        if (isDirty && blockHandlerRef.current) {
          e.preventDefault()
          pendingNavigationRef.current = path
          await blockHandlerRef.current(path)
        }
      }
    }

    window.addEventListener('click', handleClick, true)

    // Clean up
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', handleClick, true)
    }
  }, [isDirty])

  const shouldBlock = useCallback(() => {
    return isDirty
  }, [isDirty])

  const proceedWithNavigation = useCallback((path: string) => {
    if (path) {
      router.push(path)
      pendingNavigationRef.current = null
    }
  }, [router])

  return { shouldBlock, registerBlockHandler, proceedWithNavigation }
}