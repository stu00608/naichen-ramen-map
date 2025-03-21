"use client"

import { useParams } from "next/navigation"
import ReviewEditForm from "./ReviewEditForm"

export default function ReviewPage() {
  const params = useParams()
  const reviewId = params.id as string

  return <ReviewEditForm reviewId={reviewId} />
}