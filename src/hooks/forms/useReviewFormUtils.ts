import { useState, useEffect } from "react";
import { z } from "zod";
import { GeoPoint, Timestamp } from "firebase/firestore";
import { useFirestore } from "@/hooks/useFirestore";

// Define Shop data interface
interface ShopData {
  id: string;
  name: string;
  country: string;
  region?: string;
  address?: string;
  shop_types?: string[];
  // Add other fields as needed
}

// Define types for ramen items and side menu items
export interface RamenItem {
  name: string;
  price?: number;
  currency: string;
  preference?: string;
}

export interface SideMenuItem {
  name: string;
  price?: number;
  currency: string;
}

// Schema for the review form data
export const reviewSchema = z.object({
  shop_id: z.string().min(1, { message: "店家資訊必填" }),
  shop_name: z.string().optional(),
  visit_date: z.date({ required_error: "造訪日期必填" }),
  people_count: z.string().min(1, { message: "用餐人數必填" }),
  reservation_type: z.string().min(1, { message: "預約狀態必填" }),
  wait_time: z.string().optional(), // Only required if reservation_type is "lined up"
  ramen_items: z.array(
    z.object({
      name: z.string().min(1, { message: "品項名稱必填" }),
      price: z.coerce.number().optional(),
      currency: z.string().min(1, { message: "幣別必填" }),
      preference: z.string().optional(),
    })
  ).min(1, { message: "至少填寫一個拉麵品項" }),
  side_menu: z.array(
    z.object({
      name: z.string().min(1, { message: "副餐名稱必填" }),
      price: z.coerce.number().optional(),
      currency: z.string().min(1, { message: "幣別必填" }),
    })
  ).optional(),
  soup_score: z.number().min(0).max(5),
  noodle_score: z.number().min(0).max(5),
  topping_score: z.number().min(0).max(5),
  appearance_score: z.number().min(0).max(5),
  experience_score: z.number().min(0).max(5),
  value_score: z.number().min(0).max(5),
  overall_score: z.number().min(0).max(5),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;

export function useReviewFormUtils() {
  const { getDocument } = useFirestore("shops");
  const [isShopLoading, setIsShopLoading] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

  // Function to fetch shop data when a shop is selected
  const fetchShopData = async (shopId: string): Promise<ShopData | null> => {
    try {
      setIsShopLoading(true);
      setShopError(null);
      
      const shopData = await getDocument(shopId);
      
      if (!shopData) {
        throw new Error("店家資料不存在");
      }
      
      // Use type assertion to tell TypeScript the expected shape
      const typedShopData = shopData as any;
      
      return {
        id: shopId,
        name: typedShopData.name || "",
        country: typedShopData.country || "JP",
        region: typedShopData.region,
        address: typedShopData.address,
        shop_types: typedShopData.shop_types
      };
    } catch (error) {
      console.error("Error fetching shop data:", error);
      setShopError(typeof error === 'string' ? error : (error instanceof Error ? error.message : "發生錯誤"));
      return null;
    } finally {
      setIsShopLoading(false);
    }
  };

  // Function to get default currency based on shop country
  const getDefaultCurrency = (country: string): string => {
    switch (country) {
      case "JP":
        return "JPY";
      case "TW":
        return "TWD";
      default:
        return "JPY";
    }
  };

  // Add ramen and side menu item limits
  const RAMEN_ITEM_LIMIT = 5;
  const SIDE_MENU_ITEM_LIMIT = 10;

  // Function to add a new ramen item to the form
  const addRamenItem = (
    ramenItems: RamenItem[],
    defaultCurrency: string
  ): RamenItem[] => {
    if (ramenItems.length >= RAMEN_ITEM_LIMIT) return ramenItems;
    return [
      ...ramenItems,
      { name: "", price: undefined, currency: defaultCurrency, preference: "" }
    ];
  };

  // Function to add a new side menu item to the form
  const addSideMenuItem = (
    sideMenu: SideMenuItem[],
    defaultCurrency: string
  ): SideMenuItem[] => {
    if (sideMenu.length >= SIDE_MENU_ITEM_LIMIT) return sideMenu;
    return [
      ...sideMenu,
      { name: "", price: undefined, currency: defaultCurrency }
    ];
  };

  // Function to remove a ramen item from the form
  const removeRamenItem = (
    ramenItems: RamenItem[],
    index: number
  ): RamenItem[] => {
    return ramenItems.filter((_, i) => i !== index);
  };

  // Function to remove a side menu item from the form
  const removeSideMenuItem = (
    sideMenu: SideMenuItem[],
    index: number
  ): SideMenuItem[] => {
    return sideMenu.filter((_, i) => i !== index);
  };

  // Function to prepare the form data for submission
  const formatFormDataForSubmission = (data: ReviewFormData) => {
    // Filter out empty items before submission
    const validRamenItems = data.ramen_items.filter(item => item.name.trim() !== '');
    const validSideMenuItems = (data.side_menu || []).filter(item => item.name.trim() !== '');

    // Calculate the overall score if not provided
    let overall = data.overall_score;
    if (!overall) {
      const scores = [
        data.soup_score,
        data.noodle_score,
        data.topping_score,
        data.appearance_score,
        data.experience_score,
        data.value_score
      ].filter(score => typeof score === 'number' && score > 0);
      
      if (scores.length > 0) {
        overall = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        // Round to the nearest 0.5
        overall = Math.round(overall * 2) / 2;
      }
    }

    // Create search content for searching
    const searchContent = [
      data.shop_name,
      ...validRamenItems.map(item => item.name),
      ...validSideMenuItems.map(item => item.name),
      data.notes
    ].filter(Boolean).join(" ");

    return {
      shop_id: data.shop_id,
      visit_date: Timestamp.fromDate(data.visit_date),
      people_count: data.people_count,
      reservation_type: data.reservation_type,
      wait_time: data.wait_time || "",
      ramen_items: validRamenItems,
      side_menu: validSideMenuItems,
      soup_score: data.soup_score,
      noodle_score: data.noodle_score,
      topping_score: data.topping_score,
      appearance_score: data.appearance_score,
      experience_score: data.experience_score,
      value_score: data.value_score,
      overall_score: overall,
      notes: data.notes || "",
      images: data.images || [],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      search_content: searchContent,
      source: "自建" // Default source is self-created
    };
  };

  return {
    fetchShopData,
    getDefaultCurrency,
    addRamenItem,
    addSideMenuItem,
    removeRamenItem,
    removeSideMenuItem,
    formatFormDataForSubmission,
    isShopLoading,
    shopError
  };
}
