"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { GeoPoint, Timestamp } from "firebase/firestore"
import { useFirestore } from "@/hooks/useFirestore"
import { COUNTRIES, REGIONS, RAMEN_TYPES, DAYS_OF_WEEK } from "@/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { useSearchParams as useNextSearchParams } from 'next/navigation'
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning"
import { useGooglePlaceIdValidation } from "@/hooks/forms/useGooglePlaceIdValidation"
import { useShopFormUtils, shopSchema, type ShopFormData } from "@/hooks/forms/useShopFormUtils"
import { Tag, TagInput } from "@/components/ui/tag-input-wrapper"
import { Search } from "lucide-react"
import { ShopPreviewCard } from "@/components/shop-preview-card"
import { url } from "inspector"

interface BusinessHourPeriod {
  open: string
  close: string
}

interface DaySchedule {
  periods: BusinessHourPeriod[]
  isClosed: boolean
}

export default function NewShopPage() {
  const { addDocument, loading, error, checkDocumentExists } = useFirestore("shops")
  const validateGooglePlaceId = useGooglePlaceIdValidation()
  const { getDefaultBusinessHours, formatFormDataForSubmission, addPeriod, removePeriod, geocodeAddress, prepareShopSearchFields } = useShopFormUtils()
  const [geoError, setGeoError] = useState<string | null>(null)
  const router = useRouter()
  const [selectedCountry, setSelectedCountry] = useState<keyof typeof REGIONS>("JP")
  const locationRef = useRef<GeoPoint | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [showPlacesResults, setShowPlacesResults] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [excludeBusinessHours, setExcludeBusinessHours] = useState(false)
  const googleMapsUriRef = useRef<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null)
  const [returnToReviews, setReturnToReviews] = useState(false)
  const searchParams = useNextSearchParams()
  const returnTo = searchParams.get('returnTo')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const { control, register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<ShopFormData>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      country: "JP",
      business_hours: getDefaultBusinessHours(),
      closed_days: [],
      shop_types: [],
      tags: []
    }
  })

  const [confirmationTarget, setConfirmationTarget] = useState<string | null>(null);
  const { shouldBlock, registerBlockHandler, proceedWithNavigation } = useUnsavedChangesWarning(isDirty);
  
  useEffect(() => {
    registerBlockHandler(async (targetPath: string) => {
      setConfirmationTarget(targetPath);
      setCancelDialogOpen(true);
      return true;
    });
  }, [registerBlockHandler]);

  const nameValue = watch('name');
  const countryValue = watch('country');
  const businessHours = watch('business_hours');

  // Add this with your other refs
  const navigationProcessedRef = useRef(false);

  // Update the useEffect for navigation handling
  useEffect(() => {
    registerBlockHandler(async (targetPath: string) => {
      if (isDirty) {
        setConfirmationTarget(targetPath);
        setCancelDialogOpen(true);
        return true; // Block the navigation initially
      }
      return false; // Allow navigation if no unsaved changes
    });

    // Also intercept router.push/replace calls
    const handleRouteChangeStart = async (url: string) => {
      if (isDirty) {
        setConfirmationTarget(url);
        setCancelDialogOpen(true);
      }
    };

    window.addEventListener('popstate', (e) => {
      if (isDirty) {
        e.preventDefault();
        setConfirmationTarget(window.location.pathname);
        setCancelDialogOpen(true);
      }
    });

    return () => {
      window.removeEventListener('popstate', (e) => {
        if (isDirty) {
          e.preventDefault();
          setConfirmationTarget(window.location.pathname);
          setCancelDialogOpen(true);
        }
      });
    };
  }, [isDirty, registerBlockHandler]);

  useEffect(() => {
    // Only process navigation source once
    if (navigationProcessedRef.current) return;
    navigationProcessedRef.current = true;
  
    // Check the navigation source from sessionStorage
    const navigationSource = sessionStorage.getItem('navigation_source');
    const isFromReviews = navigationSource === 'reviews_new';
  
    // Only clear after we've used the value and only if it exists
    if (navigationSource) {
      sessionStorage.removeItem('navigation_source');
    }
  
    // Set the returnToReviews state directly based on navigation source
    if (isFromReviews) {
      setReturnToReviews(true);
      localStorage.setItem('return_to_reviews', 'true');
    } else if (localStorage.getItem('return_to_reviews') === 'true') {
      // Only clear if it's set to true but not coming directly from reviews
      localStorage.setItem('return_to_reviews', 'false');
      setReturnToReviews(false);
    } else {
      setReturnToReviews(false);
    }
  }, []);

  useEffect(() => {
    if (countryValue !== selectedCountry) {
      setValue("region", "")
      setSelectedCountry(countryValue as keyof typeof REGIONS)
    }
  }, [countryValue, selectedCountry, setValue])

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

  const confirmNavigation = () => {
    setCancelDialogOpen(false)
    router.push("/dashboard/shops")
  }

  const searchPlaces = async () => {
    if (!searchQuery.trim()) return
    
    try {
      setIsSearching(true)
      
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, country: countryValue }),
      })

      if (!response.ok) {
        throw new Error("搜尋失敗")
      }

      const data = await response.json()
      if (Array.isArray(data.results)) {
        setSearchResults(data.results)
        setShowPlacesResults(true)
      } else {
        setSearchResults([])
        toast.info("沒有找到符合的店家")
      }
    } catch (err) {
      console.error("Places search error:", err)
      setSearchResults([])
      toast.error("搜尋店家時發生錯誤")
    } finally {
      setIsSearching(false)
    }
  }

  // Handle Enter key press for search
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      searchPlaces()
    }
  }

  const handlePlaceSelect = async (e: React.MouseEvent, place: any) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if this Google Place ID is already registered
    if (place.id) {
      try {
        const exists = await checkDocumentExists('google_place_id', place.id)
        if (exists) {
          toast.error("此店家已經在資料庫中註冊了")
          return
        }
      } catch (err) {
        console.error("Error checking place existence:", err)
      }
    }

    setValue("name", place.displayName?.text || place.name || "")

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

      // Transform the place object to match ShopPreviewCard expected structure
      const transformedPlace = {
        id: place.id,
        name: place.displayName?.text || place.name || "",
        address: cleanAddress || "",
        country: countryValue,
        googleMapsUri: place.googleMapsUri || "",
      }
      // Set selectedPlace state with transformed object
      setSelectedPlace(transformedPlace)

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
    setSearchQuery("") // Clear the search query after selection
  }

  // Function to handle place unlink/removing selection
  const handlePlaceUnlink = () => {
    setSelectedPlace(null)
    setValue("name", "")
    setValue("address", "")
    setValue("google_place_id", "")
    setSearchQuery("")
    toast.info("已取消店家選擇")
  }

  const onSubmit = async (data: ShopFormData) => {
    try {
      setGeoError(null)

      if (data.google_place_id) {
        const validationResult = await validateGooglePlaceId(data.google_place_id)
        if (typeof validationResult === "string") {
          setGeoError(validationResult)
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
          return
        }
      }
      
      const formattedData = formatFormDataForSubmission(data, excludeBusinessHours)
      const { name_lower, searchTokens } = prepareShopSearchFields(data.name)
      const shopData = {
        ...formattedData,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        location: locationRef.current || new GeoPoint(0, 0),
        googleMapsUri: googleMapsUriRef.current,
        name_lower,
        searchTokens
      }
      
      const result = await addDocument(shopData)
      
      if (result) {
        const returnFlag = localStorage.getItem('return_to_reviews');
        console.log('At submission success, return flag is:', returnFlag);
  
        if (returnFlag === 'true') {
          console.log('Redirecting back to reviews page with shop ID:', result.id);
          localStorage.removeItem('return_to_reviews');
          localStorage.setItem('pending_shop_selection', result.id);
          router.push('/dashboard/reviews/new');
        } else {
          console.log('Redirecting to shops list')
          router.push('/dashboard/shops');
        }
      }
    } catch (err: any) {
      setGeoError(err.message)
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

  // Update the confirmation handler to use proceedWithNavigation
  const handleConfirmNavigation = () => {
    setCancelDialogOpen(false);
    if (confirmationTarget) {
      proceedWithNavigation(confirmationTarget);
      setConfirmationTarget(null);
    }
  };

  const handleCancel = () => {
    if (shouldBlock()) {
      setConfirmationTarget("/dashboard/shops");
      setCancelDialogOpen(true);
    } else {
      router.push("/dashboard/shops");
    }
  };


  const handleClearForm = () => {
    if (isDirty) {
      setConfirmationTarget('clear')
      setCancelDialogOpen(true)
      return
    }
    clearFormData()
  }

  const clearFormData = () => {
    const defaultBusinessHours = getDefaultBusinessHours()
    setValue("name", "")
    setValue("country", "JP")
    setValue("region", "")
    setValue("address", "")
    setValue("google_place_id", "")
    setValue("shop_types", [])
    setValue("tags", [])
    setValue("business_hours", defaultBusinessHours)
    setTags([])
    setExcludeBusinessHours(false)
    locationRef.current = null
    googleMapsUriRef.current = null
    setSelectedPlace(null)
    toast.success("已清除所有資料")
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold mt-4 max-h-[30px]">新增店家</h1>
      
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
              {selectedPlace ? (
                <div>
                  <ShopPreviewCard 
                    shop={selectedPlace} 
                    onUnlink={handlePlaceUnlink} 
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      placeholder={isSearching ? "搜尋店家中..." : "輸入店名搜尋..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleSearchKeyPress}
                      className="flex-1 h-10"
                      disabled={isSearching}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={searchPlaces}
                      disabled={isSearching}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      搜尋
                    </Button>
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
                </>
              )}
            </div>
          </div>

          {/* Hidden Input for name field */}
          <input type="hidden" {...register("name")} />

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

          <div className="col-span-4 flex justify-start space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearForm}
            >
              清除
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </div>
      </form>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmationTarget === 'clear' ? '確認清除' : '確認離開頁面'}
            </DialogTitle>
            <DialogDescription>
              {confirmationTarget === 'clear' 
                ? '確定要清除所有已填寫的資料嗎？此操作無法復原。'
                : '您有未儲存的更改，確定要離開嗎？'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCancelDialogOpen(false)}
            >
              取消
            </Button>
            <Button 
              type="button"
              onClick={() => {
                if (confirmationTarget === 'clear') {
                  clearFormData()
                  setCancelDialogOpen(false)
                } else {
                  handleConfirmNavigation()
                }
              }}
            >
              {confirmationTarget === 'clear' ? '確認清除' : '確認離開'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}