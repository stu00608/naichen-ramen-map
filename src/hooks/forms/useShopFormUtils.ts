import { z } from "zod"
import { DAYS_OF_WEEK } from "@/constants"
import { GeoPoint } from 'firebase/firestore'
import { Tag } from 'emblor'

// Shared types
export interface BusinessHourPeriod {
  open: string
  close: string
}

export interface DaySchedule {
  periods: BusinessHourPeriod[]
  isClosed: boolean
}

// Shared validation schema
export const shopSchema = z.object({
  name: z.string().min(1, "請輸入店名"),
  address: z.string().min(1, "請輸入地址"),
  country: z.string().min(1, "請選擇國家"),
  region: z.string().min(1, "請選擇區域"),
  shop_types: z.array(z.string()).min(1, "請選擇至少一種拉麵類型"),
  tags: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).default([]),
  business_hours: z.record(z.object({
    periods: z.array(z.object({
      open: z.string(),
      close: z.string()
    })),
    isClosed: z.boolean()
  })),
  closed_days: z.array(z.string()).optional(),
  google_place_id: z.string().optional()
})

export type ShopFormData = z.infer<typeof shopSchema>

// Add this interface at the top with other interfaces
export interface GeocodingResult {
  location: GeoPoint
  google_place_id: string | null
  googleMapsUri?: string
}

/**
 * A hook that provides shared utilities for shop forms
 */
export const useShopFormUtils = () => {
  // Default business hours setup
  const getDefaultBusinessHours = () => {
    return DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day]: { 
        periods: [{ open: "11:00", close: "21:00" }],
        isClosed: false 
      }
    }), {})
  }

  // Format form data for submission
  const formatFormDataForSubmission = (data: ShopFormData, excludeBusinessHours: boolean) => {
    const tags = data.tags.map(tag => tag.text)
    
    const google_place_id = data.google_place_id
      ? data.google_place_id : ""
    
    const business_hours = { ...data.business_hours }
    const closed_days = DAYS_OF_WEEK.filter(day => 
      business_hours?.[day]?.isClosed
    )

    return {
      name: data.name,
      address: data.address,
      country: data.country,
      region: data.region,
      shop_types: data.shop_types,
      business_hours,
      closed_days,
      tags,
      google_place_id,
      isBusinessHoursAvailable: !excludeBusinessHours
    }
  }

  // Business hours period management
  const addPeriod = (currentHours: Record<string, DaySchedule>, day: string) => {
    if (!currentHours?.[day] || currentHours[day].periods.length >= 5) {
      return currentHours
    }

    return {
      ...currentHours,
      [day]: {
        ...currentHours[day],
        periods: [...currentHours[day].periods, { open: "11:00", close: "21:00" }]
      }
    }
  }

  const removePeriod = (currentHours: Record<string, DaySchedule>, day: string, index: number) => {
    if (!currentHours?.[day] || currentHours[day].periods.length <= 1) {
      return currentHours
    }

    return {
      ...currentHours,
      [day]: {
        ...currentHours[day],
        periods: currentHours[day].periods.filter((_, i) => i !== index)
      }
    }
  }

  // Add this new function
  const geocodeAddress = async (address: string, country: string): Promise<GeocodingResult> => {
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: address, country }),
      })

      if (!response.ok) {
        throw new Error("地址搜尋失敗")
      }

      const data = await response.json()
      if (Array.isArray(data.results) && data.results.length > 0) {
        const firstResult = data.results[0]
        return {
          location: new GeoPoint(
            firstResult.location.latitude,
            firstResult.location.longitude
          ),
          google_place_id: firstResult.id,
          googleMapsUri: firstResult.googleMapsUri
        }
      }
      throw new Error("找不到此地址的位置資訊")
    } catch (err) {
      throw new Error("地址搜尋失敗，請確認地址是否正確")
    }
  }

  return {
    getDefaultBusinessHours,
    formatFormDataForSubmission,
    addPeriod,
    removePeriod,
    geocodeAddress
  }
} 