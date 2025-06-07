import type { ReviewFormData } from "@/hooks/forms/useReviewFormUtils";
import type { ShopData } from "@/hooks/forms/useReviewFormUtils";
import type { RamenItem, Review, SideMenuItem } from "@/types";
import type { StationError } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RAMEN_HASHTAGS, WAIT_TIME_OPTIONS, REGIONS } from "@/constants";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Generates search tokens for a given text, optimized for CJK (Chinese, Japanese, Korean) and Latin characters
 * @param text The text to generate tokens from
 * @returns Array of search tokens
 */
export function generateSearchTokens(text: string): string[] {
	const tokens = new Set<string>();
	const normalized = text.toLowerCase().trim();

	// Add full text for exact matches
	tokens.add(normalized);

	// Split by whitespace for word-level tokens
	const words = normalized.split(/\s+/).filter(Boolean);
	words.forEach((word) => {
		// Add each word
		tokens.add(word);

		// For non-CJK words longer than 3 characters, add partial matches
		if (
			!/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(
				word,
			) &&
			word.length > 3
		) {
			// Add prefixes for partial matching (e.g., "ramen" -> "ram", "rame")
			for (let i = 3; i < word.length; i++) {
				tokens.add(word.slice(0, i));
			}
		}
	});

	// Add consecutive word combinations
	for (let i = 0; i < words.length - 1; i++) {
		tokens.add(words[i] + words[i + 1]);
	}

	// For CJK characters
	const cjkText = words.join("");
	if (
		/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(
			cjkText,
		)
	) {
		// Single characters
		for (let i = 0; i < cjkText.length; i++) {
			tokens.add(cjkText[i]);
		}

		// Pairs of characters (useful for compound words)
		for (let i = 0; i < cjkText.length - 1; i++) {
			tokens.add(cjkText.slice(i, i + 2));
		}

		// Triplets of characters
		for (let i = 0; i < cjkText.length - 2; i++) {
			tokens.add(cjkText.slice(i, i + 3));
		}
	}

	return Array.from(tokens);
}

// Helper to generate prefecture-specific tags
function generatePrefectureTags(address: string): string {
	const japanesePrefectures = REGIONS.JP;
	const taiwaneseCities = REGIONS.TW;
	const baseTags = ["ラーメン", "美食", "拉麵", "旅遊", "自由行"];

	for (const prefecture of japanesePrefectures) {
		if (address.includes(prefecture)) {
			const tags = baseTags.map(tag => `#${prefecture.replace(/都|道|府|県/g, "")}${tag}`);
			return tags.join(" ");
		}
	}

	for (const city of taiwaneseCities) {
		if (address.includes(city)) {
			const tags = baseTags.map(tag => `#${city.replace(/市|縣/g, "")}${tag}`);
			return tags.join(" ");
		}
	}

	return "";
}

// Helper to format numbers with commas
function formatNumberWithCommas(num: number): string {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Prepares shop data for search functionality
 * @param name Shop name
 * @returns Object containing search-related fields
 */
export function prepareShopSearchFields(name: string) {
	return {
		name_lower: name.toLowerCase(),
		searchTokens: generateSearchTokens(name),
	};
}

export function generateRandomCode(length = 6): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// IG Post Content Generator
export function generateIgPostContent(
	review: ReviewFormData & {
		nearest_station_name?: string;
		nearest_station_walking_time_minutes?: number;
		nearest_station_distance_meters?: number;
		tags?: string[];
	},
	shop?: ShopData,
): string {
	// Helper: 全角to半角
	const toHalfWidth = (str: string) =>
		str.replace(/[！-～]/g, (c) =>
			String.fromCharCode(c.charCodeAt(0) - 0xfee0),
		);
	// Helper: remove whitespace
	const removeWhitespace = (str: string) => str.replace(/\s+/g, "");
	// Title and Content from notes
	let title = "";	
	let notesBlock = review.notes || "";
	if (review.notes) {
		const firstLine = review.notes.split("\n")[0];
		// remove the `#` and do strip, and make remain string as title
		if (firstLine.startsWith("#")) {
			title = firstLine.slice(1).trim();
			notesBlock = notesBlock.split("\n").slice(1).join("\n");
		}
	}
	// Shop name hashtag
	const shopTag = review.shop_name
		? `#${toHalfWidth(removeWhitespace(review.shop_name))}`
		: "";
	// 拉麵品項
	const ramenLine =
		review.ramen_items && review.ramen_items.length > 0
			? `拉麵🍜：${review.ramen_items.map((item: any) => `${item.name}${item.price ? ` ¥${formatNumberWithCommas(item.price)}` : ""}`).join(", ")}`
			: "";
	// 配菜
	const sideLine =
		review.side_menu && review.side_menu.length > 0
			? `配菜🍥：${review.side_menu.map((item: any) => `${item.name}${item.price ? ` ¥${formatNumberWithCommas(item.price)}` : ""}`).join(", ")}`
			: "";
	// 點餐/付款
	const orderLine = review.order_method
		? `點餐💁：${review.order_method}${review.payment_method && review.payment_method.length > 0 ? `・(${review.payment_method.join("、")})` : ""}`
		: "";
	// 客製
	const prefLine = review.ramen_items?.some((item: any) => item.preference)
		? `客製🆓：${review.ramen_items
				.filter((item: any) => item.preference)
				.map((item: any) => item.preference)
				.join(", ")}`
		: "";
	// Nearest Station (use numeric values)
	const stationLine =
		review.nearest_station_name &&
		review.nearest_station_walking_time_minutes !== undefined &&
		review.nearest_station_distance_meters !== undefined
			? `📍${review.nearest_station_name}徒歩${review.nearest_station_walking_time_minutes}分`
			: "";

	// Address
	const address = shop?.address || "";
	let prefectureTags = "";
	if (address) {
		prefectureTags = generatePrefectureTags(address);
	}

	// Date/time
	const visitDate = review.visit_date;
	const dateStr = visitDate
		? `${visitDate.getFullYear()}.${(visitDate.getMonth() + 1).toString().padStart(2, "0")}.${visitDate.getDate().toString().padStart(2, "0")}`
		: "";
	const timeStr = visitDate
		? `${visitDate.getHours().toString().padStart(2, "0")}:${visitDate.getMinutes().toString().padStart(2, "0")}`
		: "";
	// 人數/預約
	const people = review.people_count || "";

	let reservationType =
		review.reservation_type === "no_line"
			? "無排隊"
			: review.reservation_type === "lined_up"
				? "有排隊"
				: review.reservation_type;

	// Append wait_time if reservationType is "有排隊"
	if (review.reservation_type === "lined_up" && review.wait_time) {
		const waitTimeLabel = WAIT_TIME_OPTIONS.find(
			(option) => option.value === review.wait_time,
		)?.label;
		if (waitTimeLabel) {
			reservationType = `排隊${waitTimeLabel}`;
		}
	}

	// Tags
	const tags =
		review.tags && review.tags.length > 0
			? review.tags
					.map((t: string) => (t.startsWith("#") ? t : `#${t}`))
					.join(" ")
			: "";



	// Add conditional tag based on overall score
	let scoreTag = "";
	if (review.overall_score >= 3.5 && review.overall_score < 4.0) {
		scoreTag = "#好吃";
	} else if (review.overall_score >= 4.0 && review.overall_score < 4.5) {
		scoreTag = "#很好吃";
	} else if (review.overall_score >= 4.5 && review.overall_score < 5.0) {
		scoreTag = "#超好吃";
	} else if (review.overall_score == 5.0) {
		scoreTag = "#人生必吃";
	}

	// Combine existing tags and score tag
	let finalTags = tags ? `${tags}`.trim() : "";

	// Add shop tags
	if (shop?.tags && shop.tags.length > 0) {
		const shopFormattedTags = shop.tags
			.map((t: string) => (t.startsWith("#") ? t : `#${t}`))
			.join(" ");
		finalTags = finalTags ? `${finalTags} ${shopFormattedTags}`.trim() : shopFormattedTags;
	}

	// Add ramen type hashtags
	if (review.ramen_items && review.ramen_items.length > 0) {
		review.ramen_items.forEach((item: any) => {
			if (item.type && RAMEN_HASHTAGS[item.type as keyof typeof RAMEN_HASHTAGS]) {
				finalTags += ` ${RAMEN_HASHTAGS[item.type as keyof typeof RAMEN_HASHTAGS]}`;
			}
		});
	}
	
	finalTags = tags ? `${tags} ${scoreTag}`.trim() : scoreTag;

	// Compose
	return `${title ? `${title}\n` : ""}${shopTag}\n${stationLine ? `${stationLine}\n` : ""}\n${ramenLine ? `${ramenLine}\n` : ""}${sideLine ? `${sideLine}\n` : ""}${orderLine ? `${orderLine}\n` : ""}${prefLine ? `${prefLine}\n` : ""}・････━━━━━━━━━━━････・\n\n${notesBlock}\n\n・････━━━━━━━━━━━････・\n${address ? `🗾：${address}\n` : ""}🗓️：${dateStr} / ${timeStr}入店 / ${people}人${reservationType}\n・････━━━━━━━━━━━････・\n#在日台灣人 #ラーメン #ラーメン好き #奶辰吃拉麵 #日本拉麵 #日本美食 #日本旅遊 ${prefectureTags ? `${prefectureTags}` : ""} ${finalTags}`;
}

export function safeToDate(timestamp: any): Date {
	// If it's a Firestore Timestamp object, convert it
	console.log(timestamp);
	if (timestamp && typeof timestamp.toDate === "function") {
		return timestamp.toDate();
	}
	// If it's a plain object with seconds and nanoseconds, convert it
	if (
		timestamp &&
		typeof timestamp === "object" &&
		typeof timestamp.seconds === "number" &&
		typeof timestamp.nanoseconds === "number"
	) {
		return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
	}
	// Fallback to a new Date if not a valid Timestamp or object
	return new Date();
}


// Helper to safely convert raw data to RamenItem array
export function safeToRamenItems(items: any): RamenItem[] {
	let processedItems: any[] = [];
	if (Array.isArray(items)) {
		processedItems = items;
	} else if (items && typeof items === "object") {
		// Assume it's an object with numeric keys representing an array
		for (const key in items) {
			if (
				Object.prototype.hasOwnProperty.call(items, key) &&
				!Number.isNaN(Number(key))
			) {
				processedItems.push(items[key]);
			}
		}
	}

	return (processedItems as any[])
		.filter((item) => item && typeof item === "object")
		.map((item: any) => ({
			name: typeof item.name === "string" ? item.name : "",
			price: typeof item.price === "number" ? item.price : undefined,
			currency: typeof item.currency === "string" ? item.currency : "JPY", // Default currency
			preference:
				typeof item.preference === "string" ? item.preference : undefined, // Ensure preference exists
		}));
}

// Helper to safely convert raw data to SideMenuItem array
export function safeToSideMenuItems(items: any): SideMenuItem[] {
	let processedItems: any[] = [];
	if (Array.isArray(items)) {
		processedItems = items;
	} else if (items && typeof items === "object") {
		// Assume it's an object with numeric keys representing an array
		for (const key in items) {
			if (
				Object.prototype.hasOwnProperty.call(items, key) &&
				!Number.isNaN(Number(key))
			) {
				processedItems.push(items[key]);
			}
		}
	}

	return (processedItems as any[])
		.filter((item) => item && typeof item === "object")
		.map((item: any) => ({
			name: typeof item.name === "string" ? item.name : "",
			price: typeof item.price === "number" ? item.price : undefined,
			currency: typeof item.currency === "string" ? item.currency : "JPY", // Default currency
		}));
}