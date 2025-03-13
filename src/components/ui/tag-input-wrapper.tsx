'use client'

import { Tag, TagInput as EmblorTagInput, type TagInputProps as EmblorTagInputProps } from 'emblor'
import { forwardRef } from 'react'

type TagInputProps = Omit<EmblorTagInputProps, 'ref'>

const TagInput = forwardRef<HTMLInputElement, TagInputProps>((props, ref) => {
  // @ts-expect-error Server Component
  return <EmblorTagInput ref={ref} {...props} />
})

TagInput.displayName = 'TagInput'

export { TagInput }
export type { TagInputProps, Tag } 