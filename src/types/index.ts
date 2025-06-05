// src/types/index.ts
import type { GeoPoint, Timestamp } from "firebase/firestore";

// 營業時間類型
export interface BusinessHours {
	[key: string]: {
		open: string;
		close: string;
		isClosed?: boolean;
	};
}

// 店家類型
export interface Shop {
	id?: string;
	name: string;
	address: string;
	location: GeoPoint;
	business_hours: BusinessHours;
	closed_days: string[];
	country: string;
	region: string;
	shop_types: string[];
	created_at: Timestamp;
	updated_at: Timestamp;
	tags: string[];
	google_place_id?: string;
	isBusinessHoursAvailable: boolean;
	googleMapsUri?: string;
}

// 個人喜好設定類型
export interface Preference {
	spiciness?: number;
	saltiness?: number;
	richness?: number;
	noodle_firmness?: string;
}

// 評價類型
export interface Review {
	id?: string;
	shop_name: string;
	shop_id: string;
	user_id: string;
	user_name: string;
	user_avatar: string | null;
	user_role: string;
	visit_date: Timestamp;
	people_count: string;
	reservation_type: string;
	wait_time?: string;
	ramen_items: Array<{
		name: string;
		price?: number;
		currency: string;
		preference?: string;
	}>;
	side_menu: Array<{
		name: string;
		price?: number;
		currency: string;
	}>;
	soup_score: number;
	noodle_score: number;
	topping_score: number;
	appearance_score: number;
	experience_score: number;
	value_score: number;
	overall_score: number;
	notes: string;
	created_at: Timestamp;
	updated_at: Timestamp;
	images: string[];
	searchTokens?: string[];
	source?: string;
	order_method: "食券機" | "注文制";
	payment_method: Array<"現金" | "QR決済" | "交通系IC" | "クレジットカード">;
}

// 標籤類型
export interface Tag {
	id?: string;
	name: string;
	count: number;
	created_at: Timestamp;
}

// 圖片類型
export interface Image {
	id?: string;
	review_id: string | null;
	shop_id: string;
	storage_path: string;
	thumbnail_path: string;
	url: string;
	thumbnail_url: string;
	is_primary: boolean;
	width: number;
	height: number;
	size: number;
	created_at: Timestamp;
}
