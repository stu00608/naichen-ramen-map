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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning"
import { useGooglePlaceIdValidation } from "@/hooks/forms/useGooglePlaceIdValidation"
import { useShopFormUtils, shopSchema, type ShopFormData } from "@/hooks/forms/useShopFormUtils"
import { Tag, TagInput } from "@/components/ui/tag-input-wrapper"

interface BusinessHourPeriod {
  open: string
  close: string
}

interface DaySchedule {
  periods: BusinessHourPeriod[]
  isClosed: boolean
}

interface ShopEditFormProps {
  shopId: string
}

export default function ShopEditForm({ shopId }: ShopEditFormProps) {
  const { getDocument, updateDocument, deleteDocument, loading, error } = useFirestore("shops")
  const validateGooglePlaceId = useGooglePlaceIdValidation(shopId)
  const { getDefaultBusinessHours, formatFormDataForSubmission, addPeriod, removePeriod, geocodeAddress, prepareShopSearchFields } = useShopFormUtils()
  const [geoError, setGeoError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const [selectedCountry, setSelectedCountry] = useState<keyof typeof REGIONS>("JP")
  const locationRef = useRef<GeoPoint | null>(null)
  const googleMapsUriRef = useRef<string | null>(null)
  const [lastSearchedValue, setLastSearchedValue] = useState("")
  const [showPlacesResults, setShowPlacesResults] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [excludeBusinessHours, setExcludeBusinessHours] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null)

  const { control, register, handleSubmit, setValue, watch, formState: { errors, isDirty }, reset } = useForm<ShopFormData>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      shop_types: [],
      country: "JP",
      tags: []
    }
  })

  const { shouldBlock } = useUnsavedChangesWarning(isDirty)

  const countryValue = watch("country")
  const nameValue = watch("name")
  const businessHours = watch("business_hours")

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
          tags: shop.tags?.map((tag, index) => ({ id: index.toString(), text: tag })) || [],
          business_hours: shop.business_hours || getDefaultBusinessHours(),
          closed_days: [],
          google_place_id: shop.google_place_id
        })
        setSelectedCountry(shop.country as keyof typeof REGIONS)
        locationRef.current = shop.location
        googleMapsUriRef.current = shop.googleMapsUri || null
        setExcludeBusinessHours(!shop.isBusinessHoursAvailable)
        setLastSearchedValue(shop.name)
      }
    }
    fetchShop()
  }, [shopId])

  useEffect(() => {
    if (countryValue !== selectedCountry) {
      setValue("region", "")
      setSelectedCountry(countryValue as keyof typeof REGIONS)
    }
  }, [countryValue, selectedCountry, setValue])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (isInputFocused && nameValue && nameValue.length >= 3 && nameValue !== lastSearchedValue) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(nameValue, countryValue)
        setShowPlacesResults(true)
        setLastSearchedValue(nameValue)
      }, 2000)
    } else if (!nameValue || nameValue.length < 3) {
      setShowPlacesResults(false)
      setSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [nameValue, countryValue, isInputFocused, lastSearchedValue])

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

  const handlePlaceSelect = (e: React.MouseEvent, place: any) => {
    e.preventDefault()
    e.stopPropagation()
    
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
      setValue("business_hours", getDefaultBusinessHours())
    }

    locationRef.current = new GeoPoint(
      place.location.latitude,
      place.location.longitude
    )
    googleMapsUriRef.current = place.googleMapsUri || null
    setShowPlacesResults(false)
    setSearchResults([])
  }

  const onSubmit = async (data: ShopFormData) => {
    try {
      setIsSubmitting(true)
      setGeoError(null)

      if (data.google_place_id) {
        const validationResult = await validateGooglePlaceId(data.google_place_id)
        if (typeof validationResult === "string") {
          setGeoError(validationResult)
          setIsSubmitting(false)
          return
        }
      }
      else if (!locationRef.current || (locationRef.current.latitude === 0 && locationRef.current.longitude === 0)) {
        try {
          const geoResult = await geocodeAddress(data.address, data.country)
          locationRef.current = geoResult.location
          if (geoResult.google_place_id) {
            data.google_place_id = geoResult.google_place_id
          }
          googleMapsUriRef.current = geoResult.googleMapsUri || null
        } catch (err: any) {
          setGeoError(err.message)
          setIsSubmitting(false)
          return
        }
      }
      
      const formattedData = formatFormDataForSubmission(data, excludeBusinessHours)
      const { name_lower, searchTokens } = prepareShopSearchFields(data.name)
      const shopData = {
        ...formattedData,
        updated_at: Timestamp.now(),
        location: locationRef.current || new GeoPoint(0, 0),
        googleMapsUri: googleMapsUriRef.current,
        name_lower,
        searchTokens
      }
      
      const success = await updateDocument(shopId, shopData)
      
      if (success) {
        router.push("/dashboard/shops")
      }
      setIsSubmitting(false)
    } catch (err: any) {
      setGeoError(err.message)
      setIsSubmitting(false)
    }
  }

  const handleAddPeriod = (day: string) => {
    if (!businessHours?.[day]) return
    const newHours = addPeriod(businessHours, day)
    setValue("business_hours", newHours)
  }

  const handleRemovePeriod = (day: string, index: number) => {
    if (!businessHours?.[day]) return
    const newHours = removePeriod(businessHours, day, index)
    setValue("business_hours", newHours)
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

  const handleCancel = () => {
    if (shouldBlock()) {
      return
    }
    router.push("/dashboard/shops")
  }

  const handleInputFocus = () => {
    setIsInputFocused(true)
    if (nameValue && nameValue.length >= 3) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(nameValue, countryValue)
        setShowPlacesResults(true)
      }, 2000)
    }
  }

  const handleInputBlur = () => {
    setIsInputFocused(false)
    setTimeout(() => {
      if (!searchContainerRef.current?.contains(document.activeElement)) {
        setShowPlacesResults(false)
      }
    }, 200)
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
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            {showPlacesResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover text-popover-foreground shadow-md">
                <div className="p-0">
                  <div className="max-h-[200px] overflow-auto">
                    {searchResults.map((place) => (
                      <button
                        key={place.id}
                        onClick={(e) => handlePlaceSelect(e, place)}
                        type="button"
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
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇國家" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COUNTRIES).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.country && (
              <p className="mt-2 text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label htmlFor="region" className="text-lg">區域 <span className="text-destructive">*</span></Label>
            <Controller
              name="region"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!selectedCountry}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選擇區域" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCountry && REGIONS[selectedCountry].map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
                  value={field.value?.[0] || ""}
                  onValueChange={(value: string) => {
                    const currentValues = new Set(field.value || []);
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
            <Label className="text-lg">標籤</Label>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <TagInput
                  {...field}
                  placeholder="輸入標籤..."
                  tags={field.value}
                  setTags={field.onChange}
                  activeTagIndex={activeTagIndex}
                  setActiveTagIndex={setActiveTagIndex}
                />
              )}
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
                      setValue("business_hours", getDefaultBusinessHours())
                    } else {
                      setValue("business_hours", getDefaultBusinessHours())
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
                            onClick={() => handleAddPeriod(day)}
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
                                onClick={() => handleRemovePeriod(day, index)}
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
              onClick={handleCancel}
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