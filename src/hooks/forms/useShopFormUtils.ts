import { DAYS_OF_WEEK } from "@/constants";
import { generateSearchTokens } from "@/lib/utils";
import { Tag } from "emblor";
import { GeoPoint } from "firebase/firestore";
import { z } from "zod";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

// Shared types
export interface BusinessHourPeriod {
	open: string;
	close: string;
}

export interface DaySchedule {
	periods: BusinessHourPeriod[];
	isClosed: boolean;
}

// Shared validation schema
export const shopSchema = z.object({
	name: z.string().min(1, "請輸入店名"),
	address: z.string().min(1, "請輸入地址"),
	country: z.string().min(1, "請選擇國家"),
	region: z.string().min(1, "請選擇區域"),
	shop_types: z.array(z.string()).min(1, "請選擇至少一種拉麵類型"),
	tags: z.array(z.string()).default([]),
	googlePlaceId: z.string().optional(),
	business_hours: z.record(
		z.object({
			periods: z.array(
				z.object({
					open: z.string(),
					close: z.string(),
				}),
			),
			isClosed: z.boolean(),
		}),
	),
	closed_days: z.array(z.string()).default([]),
});

// Update the ShopFormData interface to use string[] for tags instead of Tag[]
export interface ShopFormData {
	name: string;
	country: string;
	region: string;
	address: string;
	googlePlaceId?: string;
	shop_types: string[];
	tags: string[];
	business_hours: Record<string, DaySchedule>;
	closed_days: string[];
}

// Add this interface at the top with other interfaces
export interface GeocodingResult {
	location: GeoPoint;
	googlePlaceId: string | null;
	googleMapsUri?: string;
}

/**
 * A hook that provides shared utilities for shop forms
 */
export const useShopFormUtils = () => {
	const { user } = useAuth();

	// Default business hours setup
	const getDefaultBusinessHours = () => {
		return DAYS_OF_WEEK.reduce(
			(acc, day) => ({
				...acc,
				[day]: {
					periods: [{ open: "11:00", close: "21:00" }],
					isClosed: false,
				},
			}),
			{},
		);
	};

	// Update the formatFormDataForSubmission function to handle string[] tags
	const formatFormDataForSubmission = (
		data: ShopFormData,
		excludeBusinessHours: boolean,
	) => {
		return {
			name: data.name,
			country: data.country,
			region: data.region,
			address: data.address,
			googlePlaceId: data.googlePlaceId || null,
			shop_types: data.shop_types || [],
			tags: data.tags || [], // Update to use the string array directly
			business_hours: excludeBusinessHours ? null : data.business_hours,
			isBusinessHoursAvailable: !excludeBusinessHours,
		};
	};

	// Business hours period management
	const addPeriod = (
		currentHours: Record<string, DaySchedule>,
		day: string,
	) => {
		if (!currentHours?.[day] || currentHours[day].periods.length >= 5) {
			return currentHours;
		}

		return {
			...currentHours,
			[day]: {
				...currentHours[day],
				periods: [
					...currentHours[day].periods,
					{ open: "11:00", close: "21:00" },
				],
			},
		};
	};

	const removePeriod = (
		currentHours: Record<string, DaySchedule>,
		day: string,
		index: number,
	) => {
		if (!currentHours?.[day] || currentHours[day].periods.length <= 1) {
			return currentHours;
		}

		return {
			...currentHours,
			[day]: {
				...currentHours[day],
				periods: currentHours[day].periods.filter((_, i) => i !== index),
			},
		};
	};

	// Add this new function
	const geocodeAddress = async (
		address: string,
		country: string,
	): Promise<GeocodingResult> => {
		if (!user) {
			throw new Error("User not authenticated.");
		}

		try {
			const idToken = await auth.currentUser?.getIdToken();

			if (!idToken) {
				throw new Error("Could not retrieve authentication token.");
			}

			const response = await fetch("/api/places/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({ query: address, country }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "地址搜尋失敗");
			}

			if (Array.isArray(data.results) && data.results.length > 0) {
				const firstResult = data.results[0];
				return {
					location: new GeoPoint(
						firstResult.location.latitude,
						firstResult.location.longitude,
					),
					googlePlaceId: firstResult.id,
					googleMapsUri: firstResult.googleMapsUri,
				};
			}
			throw new Error("找不到此地址的位置資訊");
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : "地址搜尋失敗，請確認地址是否正確");
		}
	};

	const prepareShopSearchFields = (name: string) => {
		return {
			name_lower: name.toLowerCase(),
			searchTokens: generateSearchTokens(name),
		};
	};

	return {
		getDefaultBusinessHours,
		formatFormDataForSubmission,
		addPeriod,
		removePeriod,
		geocodeAddress,
		prepareShopSearchFields,
	};
};
