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
	googlePlaceId?: string;
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

// 評價類型
export interface Review {
	id?: string;
	shop_name: string;
	shop_id: string;
	user_id: string;
	user_name: string;
	user_avatar: string | null;
	user_role: string;
	visit_date: Date;
	people_count: string;
	reservation_type: string;
	wait_time?: string | null;
	ramen_items: Array<RamenItem>;
	side_menu: Array<SideMenuItem>;
	soup_score: number;
	noodle_score: number;
	topping_score: number;
	appearance_score: number;
	experience_score: number;
	value_score: number;
	overall_score: number;
	notes: string;
	created_at: Date;
	updated_at: Date;
	images: string[];
	searchTokens?: string[];
	source?: string;
	ig_post_data?: { content: string };
	order_method: "食券機" | "注文制";
	payment_method: Array<"現金" | "QR決済" | "交通系IC" | "クレジットカード">;
	tags: string[];
	nearest_station_name?: string | null;
	nearest_station_walking_time_minutes?: number | null;
	nearest_station_distance_meters?: number | null;
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

// Nearest Station Error Type
export interface StationError {
	message: string;
	stage?: string;
	googleStatus?: string;
	error?: any;
}
