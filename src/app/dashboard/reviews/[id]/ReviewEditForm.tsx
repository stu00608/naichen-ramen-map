"use client";

import MultipleSelector, { Option } from "@/components/multi-selector";
import { ShopPreviewCard } from "@/components/shop-preview-card";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/ui/star-rating";
import {
	MAX_RAMEN_ITEMS,
	MAX_SIDE_MENU_ITEMS,
	ORDER_METHOD_OPTIONS,
	PAYMENT_METHOD_OPTIONS,
	RESERVATION_TYPES,
	WAIT_TIME_OPTIONS,
} from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import {
	type RamenItem,
	type ReviewFormData,
	type SideMenuItem,
	reviewSchema,
	useReviewFormUtils,
} from "@/hooks/forms/useReviewFormUtils";
import type { ShopData } from "@/hooks/forms/useReviewFormUtils";
import { useFirestore } from "@/hooks/useFirestore";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { auth, db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { generateIgPostContent } from "@/lib/utils";
import type { Review } from "@/types";
import type { StationError } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	where,
} from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { CalendarDays, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

interface ReviewEditFormProps {
	reviewId: string;
}

interface LegacyReviewData extends Omit<Review, "side_menu" | "ramen_items"> {
	ramen_item?: string;
	price?: number;
	preference?: string;
	side_menu?: any; // Allow any type for side_menu in legacy data
	shop_country?: string;
	shop_address?: string;
	shop_google_maps_uri?: string;
	wait_time?: string;
	nearest_station_name?: string | null;
	nearest_station_walking_time_minutes?: number | null;
	nearest_station_distance_meters?: number | null;
	ramen_items?: any; // Allow any type for ramen_items in legacy data
}

/**
 * Recursively removes undefined values from an object.
 * Useful before sending data to Firestore, which doesn't allow undefined.
 */
function removeUndefined<T extends object>(obj: T): T {
	const newObj: { [key: string]: any } = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			if (obj[key] !== undefined) {
				// If it's an object and not null, recurse
				if (typeof obj[key] === "object" && obj[key] !== null) {
					newObj[key] = removeUndefined(obj[key]);
				} else {
					newObj[key] = obj[key];
				}
			}
		}
	}
	return newObj as T;
}

// Helper to safely convert Firestore Timestamp to Date
function safeToDate(timestamp: any): Date {
	return timestamp && typeof timestamp.toDate === "function"
		? timestamp.toDate()
		: new Date(); // Fallback to a new Date if not a valid Timestamp
}

// Helper to safely convert raw data to a single RamenItem
function safeToRamenItem(item: any, defaultCurrency: string): RamenItem {
	const name = typeof item?.name === "string" ? item.name : "";
	const price = typeof item?.price === "number" ? item.price : undefined;
	const currency =
		typeof item?.currency === "string" ? item.currency : defaultCurrency;
	const preference =
		typeof item?.preference === "string" ? item.preference : undefined;

	return {
		name,
		price,
		currency,
		preference,
	};
}

// Helper to safely convert raw data to a single SideMenuItem
function safeToSideMenuItem(item: any, defaultCurrency: string): SideMenuItem {
	const name = typeof item?.name === "string" ? item.name : "";
	const price = typeof item?.price === "number" ? item.price : undefined;
	const currency =
		typeof item?.currency === "string" ? item.currency : defaultCurrency;

	return {
		name,
		price,
		currency,
	};
}

export default function ReviewEditForm({ reviewId }: ReviewEditFormProps) {
	const router = useRouter();
	const { getDocument, updateDocument, deleteDocument, loading, error } =
		useFirestore("reviews");
	const { user } = useAuth();
	const {
		fetchShopData,
		getDefaultCurrency,
		addRamenItem,
		addSideMenuItem,
		removeRamenItem,
		removeSideMenuItem,
		formatFormDataForSubmission,
		tagsToOptions,
		optionsToTags,
		isShopLoading,
		shopError,
	} = useReviewFormUtils();

	const [searchQuery, setSearchQuery] = useState("");
	const [shopSearchResults, setShopSearchResults] = useState<any[]>([]);
	const [selectedShop, setSelectedShop] = useState<{
		id: string;
		name: string;
		country: string;
		address?: string;
		googleMapsUri?: string;
	} | null>(null);
	const [nearestStations, setNearestStations] = useState<any[]>([]);
	const [selectedStationIdx, setSelectedStationIdx] = useState<number>(0);
	const [stationLoading, setStationLoading] = useState(false);
	const [stationError, setStationError] = useState<StationError | null>(null);
	const [showWaitTime, setShowWaitTime] = useState(false);
	const [defaultCurrency, setDefaultCurrency] = useState("JPY");
	const [isSearching, setIsSearching] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
	const [confirmationTarget, setConfirmationTarget] = useState<string | null>(
		null,
	);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// Form initialization with react-hook-form and zod validation
	const form = useForm<ReviewFormData>({
		resolver: zodResolver(reviewSchema),
		defaultValues: {
			shop_id: "",
			shop_name: "",
			user_id: user?.uid || "",
			user_name: user?.displayName || "",
			user_avatar: user?.avatar || null,
			user_role: user?.role || "NORMAL",
			visit_date: new Date(),
			people_count: "1",
			reservation_type: "no_line",
			ramen_items: [
				{
					name: "",
					price: undefined,
					currency: defaultCurrency,
					preference: "",
				},
			],
			side_menu: [],
			tags: [],
			soup_score: 0,
			noodle_score: 0,
			topping_score: 0,
			appearance_score: 0,
			experience_score: 0,
			value_score: 0,
			overall_score: 0,
			notes: "",
			images: [],
			order_method: ORDER_METHOD_OPTIONS[0],
			payment_method: [],
		},
	});

	// Access form state and hooks
	const {
		control,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors, isDirty },
	} = form;

	// Initialize unsaved changes warning after form setup
	const { shouldBlock, registerBlockHandler, proceedWithNavigation } =
		useUnsavedChangesWarning(isDirty);

	const {
		fields: ramenFields,
		append: appendRamenItem,
		remove: removeRamenItemField,
	} = useFieldArray({ control, name: "ramen_items" });
	const {
		fields: sideMenuFields,
		append: appendSideMenuItem,
		remove: removeSideMenuItemField,
	} = useFieldArray({ control, name: "side_menu" });

	// Get values from form
	const reservationType = watch("reservation_type");

	// Show/hide wait time based on reservation type
	useEffect(() => {
		setShowWaitTime(reservationType === "lined_up");
	}, [reservationType]);

	// Unsaved changes warning
	useEffect(() => {
		registerBlockHandler(async (targetPath: string) => {
			if (isDirty) {
				setConfirmationTarget(targetPath);
				setCancelDialogOpen(true);
				return true;
			}
			return false;
		});
	}, [isDirty, registerBlockHandler]);

	// Fetch review data
	useEffect(() => {
		const fetchReview = async () => {
			try {
				setIsLoading(true);
				const docRef = doc(db, "reviews", reviewId);
				const docSnap = await getDoc(docRef);

				if (!docSnap.exists()) {
					toast.error("評價不存在");
					router.push("/dashboard/reviews");
					return;
				}

				const data = docSnap.data() as LegacyReviewData;

				// Check if user has permission to edit
				if (data.user_id !== user?.uid && user?.role !== "ADMIN") {
					toast.error("您沒有權限編輯此評價");
					router.push("/dashboard/reviews");
					return;
				}

				// Convert legacy format to new format if needed
				const ramenItems: RamenItem[] = [];

				// Handle ramen_items (plural) - ensure it's an array or convert from object with numeric keys
				let rawRamenItemsSource: any[] = [];
				if (Array.isArray(data.ramen_items)) {
					rawRamenItemsSource = data.ramen_items;
				} else if (data.ramen_items && typeof data.ramen_items === "object") {
					// Assume it's an object with numeric keys representing an array
					for (const key in data.ramen_items) {
						if (
							Object.prototype.hasOwnProperty.call(data.ramen_items, key) &&
							!Number.isNaN(Number(key))
						) {
							rawRamenItemsSource.push(data.ramen_items[key]);
						}
					}
				}

				ramenItems.push(
					...(rawRamenItemsSource as any[])
						.filter((item) => item && typeof item === "object") // Ensure only objects are mapped
						.map((item: any) => {
							const ramenItem = safeToRamenItem(
								item,
								getDefaultCurrency(data.shop_country || "JP"),
							);
							return ramenItem;
						}),
				);

				// Handle singular ramen_item for legacy data
				if (data.ramen_item) {
					ramenItems.push(
						safeToRamenItem(
							{
								name: data.ramen_item,
								price: typeof data.price === "number" ? data.price : undefined,
								preference:
									typeof data.preference === "string"
										? data.preference
										: undefined,
							},
							getDefaultCurrency(data.shop_country || "JP"),
						),
					);
				}

				const sideMenuItems: SideMenuItem[] = [];

				// Handle side_menu - ensure it's an array or convert from object with numeric keys
				let rawSideMenuSource: any[] = [];
				if (Array.isArray(data.side_menu)) {
					rawSideMenuSource = data.side_menu;
				} else if (data.side_menu && typeof data.side_menu === "object") {
					// Assume it's an object with numeric keys representing an array
					for (const key in data.side_menu) {
						if (
							Object.prototype.hasOwnProperty.call(data.side_menu, key) &&
							!Number.isNaN(Number(key))
						) {
							rawSideMenuSource.push(data.side_menu[key]);
						}
					}
				}

				sideMenuItems.push(
					...(rawSideMenuSource as any[])
						.filter((item) => item && typeof item === "object") // Ensure only objects are mapped
						.map((item: any) => {
							const sideMenuItem = safeToSideMenuItem(
								item,
								getDefaultCurrency(data.shop_country || "JP"),
							);
							return sideMenuItem;
						}),
				);

				// Reset form with fetched data
				const formData: ReviewFormData = {
					shop_id: data.shop_id,
					shop_name: data.shop_name,
					user_id: data.user_id,
					user_name: data.user_name,
					user_avatar: data.user_avatar,
					user_role: data.user_role,
					visit_date: safeToDate(data.visit_date),
					people_count: data.people_count,
					reservation_type: data.reservation_type,
					ramen_items: ramenItems,
					side_menu: sideMenuItems,
					tags: Array.isArray((data as any).tags) ? (data as any).tags : [],
					wait_time: WAIT_TIME_OPTIONS.find(
						(option) => option.value === data.wait_time,
					)?.value as ReviewFormData["wait_time"],
					// Ensure nearest station fields are null if not present in legacy data
					nearest_station_name: (data as any).nearest_station_name || null,
					nearest_station_walking_time_minutes:
						(data as any).nearest_station_walking_time_minutes || null,
					nearest_station_distance_meters:
						(data as any).nearest_station_distance_meters || null,
					soup_score: data.soup_score,
					noodle_score: data.noodle_score,
					topping_score: data.topping_score,
					appearance_score: data.appearance_score,
					experience_score: data.experience_score,
					value_score: data.value_score,
					overall_score: data.overall_score,
					notes: data.notes || "",
					images: Array.isArray(data.images) ? data.images : [],
					order_method: (data as any).order_method || ORDER_METHOD_OPTIONS[0],
					payment_method: Array.isArray((data as any).payment_method)
						? (data as any).payment_method
						: [],
				};

				reset(formData);

				// Set selected shop data
				if (data.shop_id) {
					setSelectedShop({
						id: data.shop_id,
						name: data.shop_name,
						country: data.shop_country || "JP",
						address: data.shop_address || "",
						googleMapsUri: data.shop_google_maps_uri || "",
					});
				}

				// Initialize nearest station data if available from review
				if (data.nearest_station_name) {
					setNearestStations([
						{
							name: data.nearest_station_name,
							walking_time_minutes:
								data.nearest_station_walking_time_minutes || 0,
							distance_meters: data.nearest_station_distance_meters || 0,
							walking_time_text: `${data.nearest_station_walking_time_minutes || 0}分`,
							distance_text: `${data.nearest_station_distance_meters || 0}m`,
						},
					]);
					setSelectedStationIdx(0);
				} else {
					setNearestStations([]);
					setSelectedStationIdx(0);
				}

				setDefaultCurrency(getDefaultCurrency(data.shop_country || "JP"));
				setIsLoading(false);
			} catch (error) {
				console.error("Error fetching review:", error);
				toast.error("讀取評價時發生錯誤");
				setIsLoading(false);
			}
		};

		fetchReview();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reviewId]);

	const handleNavigateToNewShop = () => {
		if (selectedShop) {
			toast.info("請先取消目前選擇的店家");
			return;
		}

		if (shouldBlock()) {
			setConfirmationTarget("/dashboard/shops/new");
			setCancelDialogOpen(true);
			return;
		}
		sessionStorage.setItem("navigation_source", "reviews_edit");
		localStorage.setItem("return_to_reviews", "true");
		router.push("/dashboard/shops/new");
	};

	// Check for pending shop selection from shop creation
	useEffect(() => {
		const pendingShopId = localStorage.getItem("pending_shop_selection");
		if (pendingShopId) {
			handleShopSelect(pendingShopId);
			localStorage.removeItem("pending_shop_selection");
		}
	}, []);

	const handleSearchShop = async () => {
		if (!searchQuery.trim()) return;

		try {
			setIsSearching(true);

			const shopsCol = collection(db, "shops");
			const searchLower = searchQuery.toLowerCase();

			// Use searchTokens for flexible matching
			const q = query(
				shopsCol,
				where("searchTokens", "array-contains", searchLower),
				orderBy("created_at", "desc"),
				limit(10),
			);

			const querySnapshot = await getDocs(q);
			const results = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			setShopSearchResults(results);

			// Show no results toast if no matches found
			if (results.length === 0) {
				toast.info("沒有找到符合的店家");
			}
		} catch (error) {
			console.error("Error searching shops:", error);
			toast.error("搜尋店家時發生錯誤");
		} finally {
			setIsSearching(false);
		}
	};

	// Function to handle shop selection
	const handleShopSelect = async (shopId: string) => {
		try {
			const shopData = await fetchShopData(shopId);

			if (shopData) {
				setSelectedShop({
					id: shopData.id,
					name: shopData.name,
					country: shopData.country,
					address: shopData.address,
					googleMapsUri: shopData.googleMapsUri,
				});
				setValue("shop_id", shopData.id);
				setValue("shop_name", shopData.name);

				// Fetch nearest station info when a shop is selected
				if (shopData.location?.latitude && shopData.location?.longitude) {
					setStationLoading(true);
					setNearestStations([]);
					setSelectedStationIdx(0);
					setStationError(null);
					try {
						if (!user) {
							setIsSearching(false);
							return;
						}

						const idToken = await auth.currentUser?.getIdToken();

						if (!idToken) {
							setIsSearching(false);
							return;
						}

						const res = await fetch("/api/places/nearest-station", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${idToken}`,
							},
							body: JSON.stringify({
								latitude: shopData.location.latitude,
								longitude: shopData.location.longitude,
								country: shopData.country,
								destinationPlaceId: shopData.googlePlaceId,
							}),
						});
						if (!res.ok) {
							const errData = await res.json();
							console.log("Nearest station API error:", errData);
							setStationError(errData);
						} else {
							const data = await res.json();
							setNearestStations(data.stations || []);
							setSelectedStationIdx(0);
						}
					} catch (err: any) {
						setStationError({
							message: err.message || "找不到最近車站",
							stage: "fetch-catch",
						});
					} finally {
						setStationLoading(false);
					}
				}

				// Set default currency based on shop country
				const currency = getDefaultCurrency(shopData.country);
				setDefaultCurrency(currency);

				// Update currency for all ramen and side menu items
				const currentRamenItems = watch("ramen_items");
				currentRamenItems.forEach((item, index) => {
					setValue(`ramen_items.${index}.currency`, currency);
				});

				const currentSideMenuItems = watch("side_menu") || [];
				currentSideMenuItems.forEach((item, index) => {
					setValue(`side_menu.${index}.currency`, currency);
				});

				// Hide search results after selection
				setShopSearchResults([]);

				// Show success toast instead of banner
				toast.success(`已選擇店家：${shopData.name}`);
			}
		} catch (error) {
			console.error("Error selecting shop:", error);
			toast.error("選擇店家時發生錯誤");
		}
	};

	// Add click outside handler
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(event.target as Node)
			) {
				setShopSearchResults([]);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Handle Enter key press for search
	const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSearchShop();
		}
	};

	// Function to handle adding a new ramen item
	const handleAddRamenItem = () => {
		appendRamenItem({
			name: "",
			price: undefined,
			currency: defaultCurrency,
			preference: "",
		});
	};

	// Function to handle adding a new side menu item
	const handleAddSideMenuItem = () => {
		appendSideMenuItem({
			name: "",
			price: undefined,
			currency: defaultCurrency,
		});
	};

	// Handle form submission
	const onSubmit = async (data: ReviewFormData) => {
		try {
			const formattedData = formatFormDataForSubmission(data);

			// Include selected nearest station data in submission
			const selectedStation = nearestStations[selectedStationIdx];

			// Data for Firestore submission (using formattedData)
			const submitDataForFirestore = {
				...formattedData,
				updated_at: Timestamp.now(),
				nearest_station_name: selectedStation?.name
					? selectedStation.name
					: null,
				nearest_station_walking_time_minutes:
					selectedStation?.walking_time_minutes
						? selectedStation.walking_time_minutes
						: null,
				nearest_station_distance_meters: selectedStation?.distance_meters
					? selectedStation.distance_meters
					: null,
			};

			// Data for IG post content generation (using original 'data' for Date objects)
			const igContentReviewData = {
				...data, // `data` has visit_date as Date
				nearest_station_name: selectedStation?.name,
				nearest_station_walking_time_minutes:
					selectedStation?.walking_time_minutes,
				nearest_station_distance_meters: selectedStation?.distance_meters,
			};

			// Fetch shop data for IG post (use original data's shop_id)
			const shopDataForIG = igContentReviewData.shop_id
				? await fetchShopData(igContentReviewData.shop_id)
				: undefined;
			const shopForIG = shopDataForIG || undefined;

			// Generate IG post content
			const igContent = generateIgPostContent(igContentReviewData, shopForIG);

			// Add update timestamp and ig_post_data
			const finalSubmitData = {
				...submitDataForFirestore,
				ig_post_data: { content: igContent },
			};

			// Clean up undefined values before sending to Firestore
			const cleanedData = removeUndefined(finalSubmitData);

			const result = await updateDocument(reviewId, cleanedData);
			if (result) {
				toast.success("評價已成功更新！");
				router.push("/dashboard/reviews");
			}
		} catch (error) {
			console.error("Error updating review:", error);
			toast.error("更新評價時發生錯誤");
		}
	};

	const handleDeleteReview = async () => {
		try {
			setIsDeleting(true);
			const success = await deleteDocument(reviewId);

			if (success) {
				toast.success("評價已成功刪除");
				router.push("/dashboard/reviews");
			} else {
				toast.error("刪除評價失敗");
				setDeleteDialogOpen(false);
			}
		} catch (error) {
			console.error("Error deleting review:", error);
			toast.error("刪除評價時發生錯誤");
			setDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDateSelect = (date: Date | undefined) => {
		if (date) {
			setValue("visit_date", date);
		}
	};

	const handleTimeChange = (type: "hour" | "minute", value: string) => {
		const currentDate = watch("visit_date") || new Date();
		const newDate = new Date(currentDate);

		if (type === "hour") {
			const hour = Number.parseInt(value, 10);
			newDate.setHours(hour);
		} else if (type === "minute") {
			newDate.setMinutes(Number.parseInt(value, 10));
		}

		setValue("visit_date", newDate);
	};

	// Add helper function to check if form contains meaningful data
	const isFormNotEmpty = () => {
		const formValues = form.getValues();

		// Check if shop is selected
		if (formValues.shop_id) return true;

		// Check if any ramen items have names
		if (formValues.ramen_items?.some((item) => item.name.trim() !== ""))
			return true;

		// Check if any side menu items have names
		if (formValues.side_menu?.some((item) => item.name.trim() !== ""))
			return true;

		// Check if any scores are set (greater than 0)
		if (formValues.soup_score > 0) return true;
		if (formValues.noodle_score > 0) return true;
		if (formValues.topping_score > 0) return true;
		if (formValues.appearance_score > 0) return true;
		if (formValues.experience_score > 0) return true;
		if (formValues.value_score > 0) return true;
		if (formValues.overall_score > 0) return true;

		// Check if notes is not empty
		if (formValues.notes?.trim() !== "") return true;

		return false;
	};

	// Add clear form handler
	const handleClearForm = () => {
		if (isDirty || isFormNotEmpty()) {
			setConfirmationTarget("clear");
			setCancelDialogOpen(true);
			return;
		}
		clearFormData();
	};

	// Add helper function to clear form data
	const clearFormData = () => {
		form.reset({
			shop_id: "",
			shop_name: "",
			user_id: user?.uid || "",
			user_name: user?.displayName || "",
			user_avatar: user?.avatar || null,
			user_role: user?.role || "NORMAL",
			visit_date: new Date(),
			people_count: "1",
			reservation_type: "no_line",
			ramen_items: [
				{
					name: "",
					price: undefined,
					currency: defaultCurrency,
					preference: "",
				},
			],
			side_menu: [],
			tags: [],
			soup_score: 0,
			noodle_score: 0,
			topping_score: 0,
			appearance_score: 0,
			experience_score: 0,
			value_score: 0,
			overall_score: 0,
			notes: "",
			images: [],
			order_method: ORDER_METHOD_OPTIONS[0],
			payment_method: [],
		});

		// Clear selected shop
		setSelectedShop(null);
		setShopSearchResults([]);
		setSearchQuery("");

		toast.success("已清除所有資料");
	};

	// Handle cancel button
	const handleCancel = () => {
		if (shouldBlock()) {
			setConfirmationTarget("/dashboard/reviews");
			setCancelDialogOpen(true);
		} else {
			router.push("/dashboard/reviews");
		}
	};

	// Add confirmation handler
	const handleConfirmNavigation = () => {
		setCancelDialogOpen(false);
		if (confirmationTarget) {
			proceedWithNavigation(confirmationTarget);
			setConfirmationTarget(null);
		}
	};

	// Function to handle shop unlink/removing selection
	const handleShopUnlink = () => {
		setSelectedShop(null);
		setValue("shop_id", "");
		setValue("shop_name", "");
		setSearchQuery("");
		toast.info("已取消店家選擇");
	};

	if (isLoading) {
		return (
			<div className="flex justify-center items-center py-10">
				<p>載入評價資料中...</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-bold mt-4">編輯拉麵評價</h1>

			{(error || shopError) && (
				<div className="bg-destructive/10 text-destructive p-4 rounded">
					{error || shopError}
				</div>
			)}

			<Form {...form}>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
					{/* Shop Information Section */}
					<h2 className="text-xl font-semibold mb-5">店家資訊</h2>
					<Card>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								{/* Conditionally render either search box or selected shop preview */}
								{selectedShop ? (
									<div className="col-span-3 space-y-2">
										<Label>已選擇店家</Label>
										<ShopPreviewCard
											shop={selectedShop}
											onUnlink={handleShopUnlink}
										/>
									</div>
								) : (
									<div
										className="col-span-3 space-y-2 relative"
										ref={searchContainerRef}
									>
										<Label>搜尋店家</Label>
										<div className="flex gap-2">
											<Input
												placeholder={
													isSearching ? "搜尋店家中..." : "輸入店名搜尋..."
												}
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												onKeyPress={handleSearchKeyPress}
												className="flex-1 h-10"
												disabled={isSearching}
											/>
											<Button
												type="button"
												variant="outline"
												onClick={handleSearchShop}
												disabled={isSearching}
											>
												<Search className="h-4 w-4 mr-2" />
												搜尋
											</Button>
										</div>

										{/* Search Results Dropdown */}
										{shopSearchResults.length > 0 && (
											<div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover text-popover-foreground shadow-md">
												<div className="max-h-[200px] overflow-auto">
													{shopSearchResults.map((place: any) => (
														<button
															key={place.id}
															onClick={() => handleShopSelect(place.id)}
															type="button"
															className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground rounded-lg flex flex-col gap-1"
														>
															<div className="font-medium">
																{place.displayName?.text || place.name}
															</div>
															<div className="text-sm text-muted-foreground">
																{place.formattedAddress}
															</div>
														</button>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{/* Create Shop Button */}
								<div className="col-span-1 space-y-2">
									<Label>&nbsp;</Label>
									<Button
										type="button"
										className="w-full"
										onClick={handleNavigateToNewShop}
										disabled={!!selectedShop}
									>
										新增店家
									</Button>
								</div>

								{/* Visit Date */}
								<div className="col-span-2 space-y-2">
									<FormField
										control={control}
										name="visit_date"
										render={({ field }) => (
											<FormItem className="flex flex-col">
												<FormLabel>造訪日期</FormLabel>
												<Popover>
													<PopoverTrigger asChild>
														<FormControl>
															<Button
																variant={"outline"}
																className={cn(
																	"w-full pl-3 text-left font-normal",
																	!field.value && "text-muted-foreground",
																)}
															>
																{field.value ? (
																	format(field.value, "MM/dd/yyyy HH:mm")
																) : (
																	<span>MM/DD/YYYY HH:mm</span>
																)}
																<CalendarDays className="ml-auto h-4 w-4 opacity-50" />
															</Button>
														</FormControl>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-0">
														<div className="sm:flex">
															<Calendar
																mode="single"
																selected={field.value}
																onSelect={handleDateSelect}
																initialFocus
															/>
															<div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
																<ScrollArea className="w-64 sm:w-auto">
																	<div className="flex sm:flex-col p-2">
																		{Array.from({ length: 24 }, (_, i) => i)
																			.reverse()
																			.map((hour) => (
																				<Button
																					key={hour}
																					size="icon"
																					variant={
																						field.value &&
																						field.value.getHours() === hour
																							? "default"
																							: "ghost"
																					}
																					className="sm:w-full shrink-0 aspect-square"
																					onClick={() =>
																						handleTimeChange(
																							"hour",
																							hour.toString(),
																						)
																					}
																				>
																					{hour}
																				</Button>
																			))}
																	</div>
																	<ScrollBar
																		orientation="horizontal"
																		className="sm:hidden"
																	/>
																</ScrollArea>
																<ScrollArea className="w-64 sm:w-auto">
																	<div className="flex sm:flex-col p-2">
																		{Array.from(
																			{ length: 12 },
																			(_, i) => i * 5,
																		).map((minute) => (
																			<Button
																				key={minute}
																				size="icon"
																				variant={
																					field.value &&
																					field.value.getMinutes() === minute
																						? "default"
																						: "ghost"
																				}
																				className="sm:w-full shrink-0 aspect-square"
																				onClick={() =>
																					handleTimeChange(
																						"minute",
																						minute.toString(),
																					)
																				}
																			>
																				{minute.toString().padStart(2, "0")}
																			</Button>
																		))}
																	</div>
																	<ScrollBar
																		orientation="horizontal"
																		className="sm:hidden"
																	/>
																</ScrollArea>
															</div>
														</div>
													</PopoverContent>
												</Popover>
												<FormDescription>選擇入店日期與時間</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* People Count */}
								<div className="col-span-1 space-y-2">
									<FormField
										control={control}
										name="people_count"
										render={({ field }) => (
											<FormItem>
												<FormLabel>用餐人數</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger className="w-full h-10">
															<SelectValue placeholder="選擇用餐人數" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{[...Array(10)].map((_, i) => (
															<SelectItem
																key={i + 1}
																value={(i + 1).toString()}
															>
																{i + 1} 人
															</SelectItem>
														))}
														<SelectItem value="10+">超過10人</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Reservation Type */}
								<div className="col-span-1 space-y-2">
									<FormField
										control={control}
										name="reservation_type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>預約狀態</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger className="w-full h-10">
															<SelectValue placeholder="選擇預約狀態" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{Object.entries(RESERVATION_TYPES).map(
															([value, label]) => (
																<SelectItem key={value} value={value}>
																	{label}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Wait Time (only shown when reservation_type is lined_up) */}
								{showWaitTime && (
									<div className="col-span-2 space-y-2">
										<FormField
											control={control}
											name="wait_time"
											render={({ field }) => (
												<FormItem>
													<FormLabel>等待時間</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger className="w-full h-10">
																<SelectValue placeholder="選擇等待時間" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{WAIT_TIME_OPTIONS.map((option) => (
																<SelectItem
																	key={option.value}
																	value={option.value}
																>
																	{option.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
								)}

								{/* Order Method */}
								<div className="col-span-1 space-y-2">
									<FormField
										control={control}
										name="order_method"
										render={({ field }) => (
											<FormItem>
												<FormLabel>點餐方式</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger className="w-full h-10">
															<SelectValue placeholder="選擇點餐方式" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{ORDER_METHOD_OPTIONS.map((option) => (
															<SelectItem key={option} value={option}>
																{option}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Payment Method */}
								<div className="col-span-2 space-y-2">
									<FormField
										control={control}
										name="payment_method"
										render={({ field }) => (
											<FormItem>
												<FormLabel>付款方式</FormLabel>
												<MultipleSelector
													value={field.value.map((v: string) => ({
														value: v,
														label: v,
													}))}
													onChange={(selected) =>
														field.onChange(selected.map((s: any) => s.value))
													}
													options={PAYMENT_METHOD_OPTIONS.map((option) => ({
														value: option,
														label: option,
													}))}
													placeholder="選擇付款方式"
													className="w-full"
												/>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Photos Section (Placeholder) */}
					<h2 className="text-xl font-semibold mb-5">照片</h2>
					<div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
						<p className="text-muted-foreground">
							上傳照片功能將在未來版本中推出
						</p>
					</div>

					{/* Your Order Section */}
					{/* Ramen Items */}
					<div className="space-y-4 mb-5">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-medium">拉麵品項</h2>
						</div>

						{ramenFields.map((field, index) => (
							<div key={field.id} className="grid grid-cols-12 gap-4">
								{/* Add a border and background to visually group items */}
								<div className="col-span-12 bg-muted/30 rounded-lg p-4 grid grid-cols-12 gap-4">
									{/* First row: Name, Price, Currency */}
									<div className="col-span-6">
										<FormField
											control={control}
											name={`ramen_items.${index}.name`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>品項名稱</FormLabel>
													<FormControl>
														<Input {...field} placeholder="例：豚骨拉麵" />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="col-span-3">
										<FormField
											control={control}
											name={`ramen_items.${index}.price`}
											render={({ field }) => (
												<FormItem>
													{/* TODO: Don't allow the minus number */}
													<FormLabel>價格</FormLabel>
													<FormControl>
														<Input
															type="number"
															{...field}
															onChange={(e) =>
																field.onChange(
																	e.target.value
																		? Number.parseFloat(e.target.value)
																		: undefined,
																)
															}
															value={field.value ?? ""}
															placeholder="輸入價格"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="col-span-2">
										<FormField
											control={control}
											name={`ramen_items.${index}.currency`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>幣別</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="幣別" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="JPY">JPY</SelectItem>
															<SelectItem value="TWD">TWD</SelectItem>
															<SelectItem value="USD">USD</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									{/* Second row: Preference */}
									<div className="col-span-11 pt-2">
										<FormField
											control={control}
											name={`ramen_items.${index}.preference`}
											render={({ field }: { field: any }) => (
												<FormItem>
													<FormLabel>偏好設定</FormLabel>
													<FormControl>
														<Input
															{...field}
															placeholder="例：硬麵、少油、重鹽..."
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									{/* Action button to remove this item */}
									<div className="col-span-1 flex items-end justify-center">
										{index > 0 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => removeRamenItemField(index)}
												className="h-9 w-9 text-destructive hover:text-destructive/90"
											>
												<X className="h-5 w-5" />
											</Button>
										)}
									</div>
								</div>
							</div>
						))}

						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleAddRamenItem}
							className="mt-2"
							disabled={ramenFields.length >= MAX_RAMEN_ITEMS}
						>
							<Plus className="h-4 w-4 mr-2" />
							新增拉麵品項
						</Button>
					</div>

					<Separator className="my-6" />

					{/* Side Menu Items */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-medium">副餐</h2>
						</div>

						{sideMenuFields.map((field, index) => (
							<div key={field.id} className="grid grid-cols-12 gap-4">
								<div className="col-span-6">
									<FormField
										control={control}
										name={`side_menu.${index}.name`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>副餐名稱</FormLabel>
												<FormControl>
													<Input {...field} placeholder="例：煎餃" />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-3">
									<FormField
										control={control}
										name={`side_menu.${index}.price`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>價格</FormLabel>
												<FormControl>
													<Input
														type="number"
														{...field}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number.parseFloat(e.target.value)
																	: undefined,
															)
														}
														value={field.value ?? ""}
														placeholder="輸入價格"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-2">
									<FormField
										control={control}
										name={`side_menu.${index}.currency`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>幣別</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="幣別" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="JPY">JPY</SelectItem>
														<SelectItem value="TWD">TWD</SelectItem>
														<SelectItem value="USD">USD</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="col-span-1 flex items-end justify-center">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => removeSideMenuItemField(index)}
										className="h-9 w-9 text-destructive hover:text-destructive/90"
									>
										<X className="h-5 w-5" />
									</Button>
								</div>
							</div>
						))}

						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleAddSideMenuItem}
							className="mt-2"
							disabled={sideMenuFields.length >= MAX_SIDE_MENU_ITEMS}
						>
							<Plus className="h-4 w-4 mr-2" />
							新增副餐
						</Button>
					</div>

					{/* Tags Section */}
					<div className="space-y-4">
						<h2 className="text-lg font-medium">標籤</h2>
						<FormField
							control={control}
							name="tags"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<MultipleSelector
											placeholder="輸入標籤..."
											value={tagsToOptions(field.value)}
											onChange={(selectedOptions) => {
												field.onChange(optionsToTags(selectedOptions));
											}}
											className="w-full"
											emptyIndicator={
												<p className="text-center text-sm">尚未有標籤</p>
											}
											hidePlaceholderWhenSelected
											creatable
											hideSearch
											triggerSearchOnFocus={false}
										/>
									</FormControl>
									<FormDescription>
										可以添加多個標籤來幫助分類和搜尋，例如：特色、風格、服務等特點
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{/* Nearest Station UI */}
					<div className="col-span-4 space-y-2">
						<Label>最近車站 (步行20分鐘內)</Label>
						{stationLoading && (
							<div className="flex items-center gap-2 text-muted-foreground animate-pulse">
								<span className="w-4 h-4 rounded-full bg-primary/20 inline-block" />
								最近車站資訊載入中...
							</div>
						)}
						{stationError && nearestStations.length === 0 && (
							<div className="text-destructive text-sm mt-1">
								{typeof stationError === "string"
									? stationError
									: stationError.message}
								{typeof stationError === "object" && stationError.stage && (
									<span className="ml-2">[stage: {stationError.stage}]</span>
								)}
								{typeof stationError === "object" &&
									stationError.googleStatus && (
										<span className="ml-2">
											[google: {stationError.googleStatus}]
										</span>
									)}
								{typeof stationError === "object" && stationError.error && (
									<span className="ml-2">
										[error: {JSON.stringify(stationError.error)}]
									</span>
								)}
							</div>
						)}
						{nearestStations.length > 0 && !stationLoading && !stationError && (
							<div className="rounded-lg border bg-card p-3 flex flex-col gap-2 shadow-sm">
								<div className="font-semibold text-base mb-1">選擇最近車站</div>
								<div className="flex flex-col gap-1">
									{nearestStations.map((station, idx) => (
										<label
											key={idx}
											className="flex items-center gap-2 cursor-pointer"
										>
											<input
												type="radio"
												name="nearestStation"
												checked={selectedStationIdx === idx}
												onChange={() => setSelectedStationIdx(idx)}
												className="accent-primary"
											/>
											<span className="font-medium text-primary">
												{station.name}
											</span>
											<span className="text-xs text-muted-foreground">
												步行 {station.walking_time_text} (
												{station.walking_time_minutes} 分)・
												{station.distance_text} ({station.distance_meters} 公尺)
											</span>
										</label>
									))}
								</div>
								{/* Show selected station info in modern style */}
								<div className="mt-2 p-2 rounded border bg-muted">
									<div className="font-semibold">
										已選擇：{nearestStations[selectedStationIdx]?.name}
									</div>
									<div className="text-sm text-muted-foreground">
										步行{" "}
										{nearestStations[selectedStationIdx]?.walking_time_text} (
										{nearestStations[selectedStationIdx]?.walking_time_minutes}{" "}
										分)・ 距離{" "}
										{nearestStations[selectedStationIdx]?.distance_text} (
										{nearestStations[selectedStationIdx]?.distance_meters} 公尺)
									</div>
								</div>
							</div>
						)}
					</div>
					{/* End Nearest Station UI */}

					{/* Your Review Section */}
					<h2 className="text-xl font-semibold mb-5">您的評價</h2>
					<Card>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* Soup Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="soup_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>湯頭評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Noodle Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="noodle_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>麵條評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Topping Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="topping_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>配料評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Appearance Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="appearance_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>外觀評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Experience Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="experience_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>店家體驗評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Value Score */}
								<div className="space-y-2">
									<FormField
										control={control}
										name="value_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>性價比評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Overall Score */}
								<div className="col-span-1 md:col-span-2 space-y-2">
									<FormField
										control={control}
										name="overall_score"
										render={({ field }) => (
											<FormItem className="flex flex-col space-y-1">
												<FormLabel>綜合評分</FormLabel>
												<FormControl>
													<StarRating
														value={field.value}
														onChange={field.onChange}
														max={5}
														step={0.5}
														size="lg"
													/>
												</FormControl>
												<FormDescription>
													不填寫則會自動根據其他評分計算平均分數
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Text Review */}
								<div className="col-span-1 md:col-span-2 space-y-2">
									<FormField
										control={control}
										name="notes"
										render={({ field }) => (
											<FormItem>
												<FormLabel>文字評價</FormLabel>
												<FormControl>
													<textarea
														{...field}
														className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
														placeholder="輸入您對這家拉麵店的評價..."
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Action Buttons */}
					<div className="flex justify-start">
						<div className="flex justify-end space-x-3">
							<AlertDialog
								open={deleteDialogOpen}
								onOpenChange={setDeleteDialogOpen}
							>
								<AlertDialogTrigger asChild>
									<Button
										type="button"
										variant="destructive"
										disabled={isDeleting}
									>
										<Trash2 className="h-4 w-4" />
										{/* {isDeleting ? "刪除中..." : "刪除評價"} */}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>確定要刪除此評價嗎？</AlertDialogTitle>
										<AlertDialogDescription>
											此操作無法復原。所有評價資料都將被永久刪除。
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel
											onClick={() => setDeleteDialogOpen(false)}
										>
											取消
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={handleDeleteReview}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											確定刪除
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
							<Button type="button" variant="outline" onClick={handleClearForm}>
								清除
							</Button>
							<Button type="button" variant="outline" onClick={handleCancel}>
								取消
							</Button>
							<Button type="submit" disabled={loading}>
								{loading ? "儲存中..." : "更新評價"}
							</Button>
						</div>
					</div>
				</form>
			</Form>
			<Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{confirmationTarget === "clear" ? "確認清除" : "確認離開頁面"}
						</DialogTitle>
						<DialogDescription>
							{confirmationTarget === "clear"
								? "確定要清除所有已填寫的資料嗎？此操作無法復原。"
								: "您有未儲存的更改，確定要離開嗎？"}
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
								if (confirmationTarget === "clear") {
									clearFormData();
									setCancelDialogOpen(false);
								} else {
									handleConfirmNavigation();
								}
							}}
						>
							{confirmationTarget === "clear" ? "確認清除" : "確認離開"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
