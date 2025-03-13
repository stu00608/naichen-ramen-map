"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { GeoPoint, Timestamp } from "firebase/firestore"
import { useFirestore } from "@/hooks/useFirestore"
import { COUNTRIES, REGIONS, RAMEN_TYPES, DAYS_OF_WEEK } from "@/constants"
import { Shop } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface BusinessHourPeriod {
  open: string
  close: string
}

interface DaySchedule {
  periods: BusinessHourPeriod[]
  isClosed: boolean
}

const shopSchema = z.object({
  name: z.string().min(1, "請輸入店名"),
  address: z.string().min(1, "請輸入地址"),
  country: z.string().min(1, "請選擇國家"),
  region: z.string().min(1, "請選擇區域"),
  shop_types: z.array(z.string()).min(1, "請選擇至少一種拉麵類型"),
  tags: z.string().optional(),
  business_hours: z.record(z.object({
    periods: z.array(z.object({
      open: z.string(),
      close: z.string()
    })),
    isClosed: z.boolean()
  })).optional(),
  closed_days: z.array(z.string()).optional(),
  google_place_id: z.string().optional()
})

type ShopFormData = z.infer<typeof shopSchema>

interface ShopEditFormProps {
  shopId: string
}

export default function ShopEditForm({ shopId }: ShopEditFormProps) {
  const { getDocument, updateDocument, deleteDocument, loading, error } = useFirestore("shops")
  const [geoError, setGeoError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const [selectedCountry, setSelectedCountry] = useState<keyof typeof COUNTRIES>("JP")
  const locationRef = useRef<GeoPoint | null>(null)
  const [excludeBusinessHours, setExcludeBusinessHours] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [showPlacesResults, setShowPlacesResults] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  
  const defaultBusinessHours = DAYS_OF_WEEK.reduce((acc, day) => ({
    ...acc,
    [day]: { 
      periods: [{ open: "11:00", close: "21:00" }],
      isClosed: false 
    }
  }), {})

  const { control, register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<ShopFormData>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      country: "JP",
      business_hours: defaultBusinessHours,
      closed_days: [],
      shop_types: []
    }
  })

  const countryValue = watch("country")
  const nameValue = watch("name")

  useEffect(() => {
    const fetchShop = async () => {
      const shop = await getDocument(shopId) as Shop | null
      if (shop) {
        reset({
          name: shop.name,
          address: shop.address,
          country: shop.country,
          region: shop.region,
          shop_types: shop.shop_types,
          tags: shop.tags?.join(","),
          business_hours: shop.business_hours || defaultBusinessHours,
          google_place_id: shop.google_place_id
        })
        setSelectedCountry(shop.country as keyof typeof COUNTRIES)
        locationRef.current = shop.location
        setExcludeBusinessHours(!shop.business_hours)
      }
    }
    fetchShop()
  }, [shopId])

  useEffect(() => {
    if (countryValue !== selectedCountry) {
      setValue("region", "")
      setSelectedCountry(countryValue as keyof typeof COUNTRIES)
    }
  }, [countryValue, selectedCountry, setValue])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (nameValue && nameValue.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(nameValue, countryValue)
        setShowPlacesResults(true)
      }, 2000)
    } else {
      setShowPlacesResults(false)
      setSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [nameValue, countryValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowPlacesResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const searchPlaces = async (query: string, country: string) => {
    try {
      setSearchResults([])
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, country }),
      })

      if (!response.ok) {
        throw new Error("搜尋失敗")
      }

      const data = await response.json()
      if (Array.isArray(data.results)) {
        setSearchResults(data.results)
      } else {
        setSearchResults([])
      }
    } catch (err) {
      console.error("Places search error:", err)
      setSearchResults([])
    }
  }

  const handlePlaceSelect = (place: any) => {
    setValue("name", place.displayName.text)

    let cleanAddress = place.formattedAddress
    let region = ""
    
    if (countryValue === "JP") {
      cleanAddress = cleanAddress.replace(/^日本、/, "").replace(/〒\d{3}-\d{4}\s*/, "")
      
      const prefectureMatch = cleanAddress.match(/^([^都道府県]+[都道府県])/)
      if (prefectureMatch) {
        region = prefectureMatch[1]
        setValue("region", region)
      }
      
      cleanAddress = cleanAddress.replace(/[０-９]/g, (s: string) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
      })
    }

    setValue("address", cleanAddress)
    setValue("google_place_id", place.id)

    if (place.currentOpeningHours?.periods) {
      const dayMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const
      const businessHours: Record<string, DaySchedule> = DAYS_OF_WEEK.reduce((acc, day) => ({
        ...acc,
        [day]: { periods: [], isClosed: true }
      }), {})

      const periodsByDay = place.currentOpeningHours.periods.reduce((acc: Record<string, BusinessHourPeriod[]>, period: any) => {
        const dayIndex = parseInt(period.open.day)
        if (dayIndex >= 0 && dayIndex < dayMap.length) {
          const day = dayMap[dayIndex]
          if (!acc[day]) acc[day] = []
          acc[day].push({
            open: period.open.hour.toString().padStart(2, "0") + ":" + period.open.minute.toString().padStart(2, "0"),
            close: period.close.hour.toString().padStart(2, "0") + ":" + period.close.minute.toString().padStart(2, "0")
          })
        }
        return acc
      }, {})

      Object.entries(periodsByDay).forEach(([day, periods]) => {
        businessHours[day] = {
          periods: (periods as BusinessHourPeriod[]).sort((a: BusinessHourPeriod, b: BusinessHourPeriod) => a.open.localeCompare(b.open)),
          isClosed: false
        }
      })

      setValue("business_hours", businessHours)
      setExcludeBusinessHours(false)
    } else {
      setExcludeBusinessHours(true)
      setValue("business_hours", undefined)
    }

    locationRef.current = new GeoPoint(
      place.location.latitude,
      place.location.longitude
    )
    setShowPlacesResults(false)
    setSearchResults([])
  }

  const addPeriod = (day: string) => {
    const currentHours = watch("business_hours")
    if (!currentHours?.[day]) return
    
    if (currentHours[day].periods.length >= 5) {
      return
    }

    const newPeriods = [...currentHours[day].periods, { open: "11:00", close: "21:00" }]
    setValue(`business_hours.${day}.periods`, newPeriods)
  }

  const removePeriod = (day: string, index: number) => {
    const currentHours = watch("business_hours")
    if (!currentHours?.[day] || currentHours[day].periods.length <= 1) return

    const newPeriods = currentHours[day].periods.filter((_, i) => i !== index)
    setValue(`business_hours.${day}.periods`, newPeriods)
  }

  const onSubmit = async (data: ShopFormData) => {
    try {
      setIsSubmitting(true)
      setGeoError(null)
      
      const tags = data.tags 
        ? data.tags.split(",").map(tag => tag.trim()).filter(tag => tag)
        : []
      
      const business_hours = excludeBusinessHours ? undefined : { ...data.business_hours }
      const closed_days = !excludeBusinessHours ? DAYS_OF_WEEK.filter(day => 
        business_hours?.[day]?.isClosed
      ) : []
      
      const shopData = {
        name: data.name,
        address: data.address,
        country: data.country,
        region: data.region,
        shop_types: data.shop_types,
        business_hours,
        closed_days,
        tags,
        google_place_id: data.google_place_id,
        updated_at: Timestamp.now(),
        location: locationRef.current || new GeoPoint(0, 0)
      }
      
      const success = await updateDocument(shopId, shopData)
      
      if (success) {
        router.push("/dashboard/shops")
      }
    } catch (err: any) {
      setGeoError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsSubmitting(true)
      const success = await deleteDocument(shopId)
      if (success) {
        router.push("/dashboard/shops")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center mt-4 max-h-[30px]">
        <h1 className="text-2xl font-bold">編輯店家</h1>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">刪除店家</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除此店家嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作無法復原。所有與此店家相關的資料都將被永久刪除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                確定刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      {(error || geoError) && (
        <div className="bg-destructive/10 text-destructive p-4 rounded">
          {error || geoError}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-4 gap-8">
          {/* 店名 */}
          <div className="col-span-4 relative" ref={searchContainerRef}>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-lg">店名 <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="輸入店名搜尋..."
              />
            </div>
            {showPlacesResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover text-popover-foreground shadow-md">
                <div className="p-0">
                  <div className="max-h-[200px] overflow-auto">
                    {searchResults.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => handlePlaceSelect(place)}
                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground rounded-lg"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="font-medium">{place.displayName.text}</div>
                          <div className="text-sm text-muted-foreground">{place.formattedAddress}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {errors.name && (
              <p className="mt-2 text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* 國家 & 區域 */}
          <div className="col-span-2 space-y-2">
            <Label htmlFor="country" className="text-lg">國家 <span className="text-destructive">*</span></Label>
            <select
              id="country"
              {...register("country")}
              className="w-full px-3 py-2 border rounded-lg bg-background"
            >
              {Object.entries(COUNTRIES).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
            {errors.country && (
              <p className="mt-2 text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label htmlFor="region" className="text-lg">區域 <span className="text-destructive">*</span></Label>
            <select
              id="region"
              {...register("region")}
              className="w-full px-3 py-2 border rounded-lg bg-background"
              disabled={!selectedCountry}
            >
              <option value="">選擇區域</option>
              {selectedCountry && REGIONS[selectedCountry].map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            {errors.region && (
              <p className="mt-2 text-sm text-destructive">{errors.region.message}</p>
            )}
          </div>

          {/* 地址 */}
          <div className="col-span-4 space-y-2">
            <Label htmlFor="address" className="text-lg">地址 <span className="text-destructive">*</span></Label>
            <Input
              id="address"
              {...register("address")}
            />
            {errors.address && (
              <p className="mt-2 text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          {/* 拉麵類型 */}
          <div className="col-span-4 space-y-2">
            <Label className="text-lg">拉麵類型 <span className="text-destructive">*</span></Label>
            <Controller
              name="shop_types"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value[0] || ""}
                  onValueChange={(value: string) => {
                    const currentValues = new Set(field.value);
                    if (currentValues.has(value)) {
                      currentValues.delete(value);
                    } else {
                      currentValues.add(value);
                    }
                    field.onChange(Array.from(currentValues));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇拉麵類型">
                      {field.value.length > 0 
                        ? field.value.join(", ")
                        : "選擇拉麵類型"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {RAMEN_TYPES.map((type) => (
                      <SelectItem 
                        key={type} 
                        value={type}
                        className={field.value.includes(type) ? "bg-accent" : ""}
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.shop_types && (
              <p className="mt-2 text-sm text-destructive">{errors.shop_types.message}</p>
            )}
          </div>
          
          {/* 標籤 */}
          <div className="col-span-4 space-y-2">
            <Label htmlFor="tags" className="text-lg">標籤（以逗號分隔）</Label>
            <Input
              id="tags"
              {...register("tags")}
              placeholder="例如：濃厚豚骨,特製麵條,人氣店家"
            />
          </div>

          {/* 營業時間 */}
          <div className="col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">營業時間</h3>
              <label className="flex items-center space-x-2 mr-1">
                <Checkbox
                  checked={excludeBusinessHours}
                  onCheckedChange={(checked: boolean) => {
                    setExcludeBusinessHours(checked)
                    if (checked) {
                      setValue("business_hours", undefined)
                    } else {
                      setValue("business_hours", defaultBusinessHours)
                    }
                  }}
                />
                <span>無營業時間資料</span>
              </label>
            </div>
            
            {!excludeBusinessHours && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 border rounded-lg p-6 bg-card">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="w-16 font-medium">{day}</span>
                        <Controller
                          name={`business_hours.${day}.isClosed` as any}
                          control={control}
                          render={({ field }) => (
                            <label className="flex items-center space-x-2">
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                              <span>公休日</span>
                            </label>
                          )}
                        />
                        {watch(`business_hours.${day}.periods`)?.length < 5 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addPeriod(day)}
                            className="text-primary hover:text-primary/90"
                          >
                            新增時段
                          </Button>
                        )}
                      </div>
                    </div>

                    {!watch(`business_hours.${day}.isClosed`) && (
                      <div className="space-y-3">
                        {watch(`business_hours.${day}.periods`)?.map((_, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Controller
                              name={`business_hours.${day}.periods.${index}.open` as any}
                              control={control}
                              render={({ field }) => (
                                <Input 
                                  type="time" 
                                  value={field.value} 
                                  onChange={field.onChange}
                                  className="w-32"
                                />
                              )}
                            />
                            
                            <span className="mx-1">〜</span>
                            
                            <Controller
                              name={`business_hours.${day}.periods.${index}.close` as any}
                              control={control}
                              render={({ field }) => (
                                <Input 
                                  type="time" 
                                  value={field.value} 
                                  onChange={field.onChange}
                                  className="w-32"
                                />
                              )}
                            />

                            {watch(`business_hours.${day}.periods`)?.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePeriod(day, index)}
                                className="text-destructive hover:text-destructive/90 px-2"
                              >
                                刪除
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-4 flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/shops")}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}