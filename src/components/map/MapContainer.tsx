// src/components/map/MapContainer.tsx
"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { db } from "@/lib/firebase";
import { COUNTRY_DEFAULTS, getUserLocation } from "@/lib/geolocation";
import { getBoundingViewport, getMarkerColor, mapStyle } from "@/lib/mapbox";
import type { Shop } from "@/types";
import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
	Marker,
	Popup,
	NavigationControl,
	type ViewStateChangeEvent,
} from "react-map-gl/mapbox";
import MapControls from "./MapControls";
import SearchResults from "./SearchResults";
import UserLocationMarker from "./UserLocationMarker";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

// Define sidebar width for desktop view
const SIDEBAR_WIDTH = 450;

// Helper function to adjust map center coordinates for sidebar
const adjustCenterForSidebar = (
	longitude: number,
	latitude: number,
	isResultsOpen: boolean,
	isMobile: boolean,
	windowWidth: number,
	zoom: number,
): [number, number] => {
	// Only apply offset on desktop and when sidebar is open
	if (isResultsOpen && !isMobile) {
		// Calculate what percentage of the viewport width is occupied by the sidebar
		const sidebarWidthPercent = SIDEBAR_WIDTH / windowWidth;

		// The longitude offset needs to account for:
		// 1. The percentage of screen taken by sidebar
		// 2. The current zoom level (higher zoom = smaller world area visible)
		// 3. The map's mercator projection (longitude changes aren't linear)

		// Calculate offset based on zoom level (exponential relationship)
		// At higher zoom levels, a smaller longitude difference covers more pixels
		const zoomFactor = 2 ** zoom / 512;

		// Calculate the longitude offset
		// This formula approximates the relationship between screen pixels and longitude at the given zoom level
		const lngOffset = sidebarWidthPercent / 2 / zoomFactor;

		return [longitude + lngOffset, latitude];
	}
	return [longitude, latitude];
};

interface Review {
	id: string;
	title: string;
	content: string;
	rating: number;
	shopId: string;
	shopName: string;
	userId: string;
	userName: string;
	createdAt: any;
}

interface SearchCache {
	query: string;
	shops: Shop[];
	reviews: Review[];
	timestamp: number;
}

const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds

const MapContainer = () => {
	const [shops, setShops] = useState<Shop[]>([]);
	const [reviews, setReviews] = useState<Review[]>([]);
	const [loading, setLoading] = useState(true);
	const [initialLocationLoading, setInitialLocationLoading] = useState(true);
	const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
	const [viewport, setViewport] = useState(COUNTRY_DEFAULTS.JP); // Default to Japan, will be updated
	const [userLocation, setUserLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [windowWidth, setWindowWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1200,
	);
	const [isResultsOpen, setIsResultsOpen] = useState(false);
	const mapRef = useRef<any>(null);
	const isMobile = useIsMobile();

	// Add state to track whether we need to process URL param and if map is ready
	const [shopIdFromUrl, setShopIdFromUrl] = useState<string | null>(null);
	const [isMapReady, setIsMapReady] = useState(false);

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState({
		shops: [] as Shop[],
		reviews: [] as Review[],
	});

	// Search cache for storing previous searches
	const [searchCache, setSearchCache] = useState<SearchCache[]>([]);

	// Handle map load event
	const handleMapLoad = useCallback(() => {
		setIsMapReady(true);
	}, []);

	// Handle window resize
	useEffect(() => {
		const handleResize = () => {
			setWindowWidth(window.innerWidth);
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Determine initial map location using our enhanced geolocation system
	useEffect(() => {
		const getInitialLocation = async () => {
			try {
				setInitialLocationLoading(true);
				const location = await getUserLocation();
				setViewport(location);
			} catch (error) {
				console.error("Failed to get initial location:", error);
				// Fallback to Japan if all location methods fail
				setViewport(COUNTRY_DEFAULTS.JP);
			} finally {
				setInitialLocationLoading(false);
			}
		};

		getInitialLocation();
	}, []);

	// Extract shopId from URL on initial load
	useEffect(() => {
		if (typeof window !== "undefined") {
			const urlParams = new URLSearchParams(window.location.search);
			const shopIdParam = urlParams.get("shopId");
			if (shopIdParam) {
				setShopIdFromUrl(shopIdParam);
			}
		}
	}, []);

	// 獲取店家資料 - just focus on fetching data
	useEffect(() => {
		const fetchShops = async () => {
			try {
				console.log("Fetching shops data...");
				const q = query(collection(db, "shops"));
				const querySnapshot = await getDocs(q);

				const shopsData: Shop[] = [];
				querySnapshot.forEach((doc) => {
					shopsData.push({ id: doc.id, ...doc.data() } as Shop);
				});

				console.log(`Loaded ${shopsData.length} shops`);
				setShops(shopsData);
			} catch (error) {
				console.error("Error fetching shops:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchShops();
	}, []);

	// Process URL shop ID when all necessary conditions are met
	useEffect(() => {
		// Only process when shops are loaded, map is ready, and we have a shopId to process
		if (
			shops.length > 0 &&
			isMapReady &&
			shopIdFromUrl &&
			!selectedShop &&
			!loading &&
			!initialLocationLoading
		) {
			try {
				console.log(`Processing shopId from URL: ${shopIdFromUrl}`);

				// Find the shop with matching ID
				const shop = shops.find((s) => s.id === shopIdFromUrl);
				console.log("Found shop for ID:", shop ? shop.name : "none");

				if (shop) {
					console.log("Selecting shop:", shop.name);
					// Select the shop directly here
					setSelectedShop(shop);

					// Open the sidebar if it's closed
					setIsResultsOpen(true);

					// Use requestAnimationFrame for the flyTo operation
					requestAnimationFrame(() => {
						if (mapRef.current?.flyTo) {
							// Always adjust for the sidebar since we know it will be open
							const [adjustedLng, adjustedLat] = adjustCenterForSidebar(
								shop.location.longitude,
								shop.location.latitude,
								true, // sidebar will be open
								isMobile,
								windowWidth,
								16, // zoom level for single shop view
							);

							mapRef.current.flyTo({
								center: [adjustedLng, adjustedLat],
								zoom: 16, // Higher zoom level for single shop view
								duration: 1000,
							});

							// Clear the URL param after processing
							setShopIdFromUrl(null);
						}
					});
				}
			} catch (error) {
				console.error("Error handling URL shop ID:", error);
				setShopIdFromUrl(null); // Clear on error
			}
		}
	}, [
		shops,
		loading,
		initialLocationLoading,
		isMapReady,
		shopIdFromUrl,
		selectedShop,
		isMobile,
		windowWidth,
	]);

	// 獲取評論資料
	useEffect(() => {
		const fetchReviews = async () => {
			try {
				const q = query(
					collection(db, "reviews"),
					orderBy("createdAt", "desc"),
					limit(100),
				);
				const querySnapshot = await getDocs(q);

				const reviewsData: Review[] = [];
				querySnapshot.forEach((doc) => {
					reviewsData.push({ id: doc.id, ...doc.data() } as Review);
				});

				setReviews(reviewsData);
			} catch (error) {
				console.error("Error fetching reviews:", error);
			}
		};
		fetchReviews();
	}, []);

	// 處理使用者位置更新
	const handleLocationUpdate = useCallback(
		(location: { latitude: number; longitude: number }) => {
			setUserLocation(location);

			// If we're still using the default location, update to user's location
			if (initialLocationLoading) {
				setViewport({
					latitude: location.latitude,
					longitude: location.longitude,
					zoom: 15, // 使用者位置通常使用較高的縮放級別
				});
				setInitialLocationLoading(false);
			}
		},
		[initialLocationLoading],
	);

	// Check cache for existing search results
	const checkCache = (
		query: string,
	): { shops: Shop[]; reviews: Review[] } | null => {
		const now = Date.now();
		const cachedSearch = searchCache.find(
			(cache) =>
				cache.query.toLowerCase() === query.toLowerCase() &&
				now - cache.timestamp < CACHE_EXPIRY,
		);

		return cachedSearch
			? { shops: cachedSearch.shops, reviews: cachedSearch.reviews }
			: null;
	};

	// Add results to cache
	const addToCache = (query: string, shops: Shop[], reviews: Review[]) => {
		// Remove old cache entries first
		const now = Date.now();
		const updatedCache = searchCache
			.filter((cache) => now - cache.timestamp < CACHE_EXPIRY)
			.filter((cache) => cache.query.toLowerCase() !== query.toLowerCase());

		// Add new entry
		setSearchCache([
			...updatedCache,
			{ query, shops, reviews, timestamp: now },
		]);
	};

	// Simplified fitMapToShops function that centers the map on selected shops
	const fitMapToShops = (shopsToShow: Shop[], toggleSidebar = true) => {
		if (!shopsToShow.length) return;

		// If toggleSidebar is true and sidebar is closed, open it
		if (toggleSidebar && !isResultsOpen) {
			setIsResultsOpen(true);
		}

		// Calculate the center point of all shops
		const sumLat = shopsToShow.reduce(
			(sum, shop) => sum + shop.location.latitude,
			0,
		);
		const sumLng = shopsToShow.reduce(
			(sum, shop) => sum + shop.location.longitude,
			0,
		);
		const centerLat = sumLat / shopsToShow.length;
		const centerLng = sumLng / shopsToShow.length;

		// Calculate appropriate zoom level based on the number of shops
		const zoom = shopsToShow.length === 1 ? 15 : 13;

		// Update viewport state
		setViewport({
			latitude: centerLat,
			longitude: centerLng,
			zoom: zoom,
		});

		// Use smooth transition with flyTo
		if (mapRef.current?.flyTo) {
			// Adjust center coordinates for sidebar if it's open
			const [adjustedLng, adjustedLat] = adjustCenterForSidebar(
				centerLng,
				centerLat,
				isResultsOpen,
				isMobile,
				windowWidth,
				viewport.zoom, // Get current zoom from viewport
			);

			mapRef.current.flyTo({
				center: [adjustedLng, adjustedLat],
				zoom: zoom,
				duration: 1200,
			});
		}
	};

	// 處理店家選擇
	const handleSelectShop = (shop: Shop | null) => {
		setSelectedShop(shop);

		if (!shop) return;

		// If sidebar is closed, open it
		if (!isResultsOpen) {
			setIsResultsOpen(true);
		}

		// Update URL with the shopID (enabling browser back/forward navigation)
		if (shop?.id) {
			const url = new URL(window.location.href);
			url.searchParams.set("shopId", shop.id);
			window.history.pushState({}, "", url.toString());
		} else {
			const url = new URL(window.location.href);
			url.searchParams.delete("shopId");
			window.history.pushState({}, "", url.toString());
		}

		// Use requestAnimationFrame to ensure DOM has updated before map animation
		requestAnimationFrame(() => {
			if (mapRef.current?.flyTo) {
				// Adjust center coordinates for sidebar
				const [adjustedLng, adjustedLat] = adjustCenterForSidebar(
					shop.location.longitude,
					shop.location.latitude,
					true, // Always use true here since we know sidebar will be open
					isMobile,
					windowWidth,
					16, // Using the zoom level we'll set for this view
				);

				mapRef.current.flyTo({
					center: [adjustedLng, adjustedLat],
					zoom: 16, // Higher zoom level for single shop view
					duration: 1000,
				});
			}
		});
	};

	// 搜尋功能
	const handleSearch = (query: string) => {
		setSearchQuery(query);

		if (!query.trim()) {
			setSearchResults({ shops: [], reviews: [] });
			return;
		}

		// Check cache first
		const cachedResults = checkCache(query);
		if (cachedResults) {
			setSearchResults(cachedResults);

			// Always ensure sidebar is open
			if (!isResultsOpen) {
				setIsResultsOpen(true);
			}

			// Adjust map to show results
			if (cachedResults.shops.length > 0) {
				fitMapToShops(cachedResults.shops, false);
			}

			return;
		}

		const lowerQuery = query.toLowerCase();

		// 搜尋店家
		const matchedShops = shops.filter(
			(shop) =>
				shop.name.toLowerCase().includes(lowerQuery) ||
				shop.address.toLowerCase().includes(lowerQuery) ||
				shop.region.toLowerCase().includes(lowerQuery) ||
				shop.shop_types.some((type) => type.toLowerCase().includes(lowerQuery)),
		);

		// 搜尋評論
		const matchedReviews = reviews.filter(
			(review) =>
				review.title?.toLowerCase().includes(lowerQuery) ||
				review.content?.toLowerCase().includes(lowerQuery) ||
				review.shopName?.toLowerCase().includes(lowerQuery),
		);

		const results = {
			shops: matchedShops,
			reviews: matchedReviews,
		};

		setSearchResults(results);

		// Add to cache
		addToCache(query, matchedShops, matchedReviews);

		// Always ensure sidebar is open
		if (!isResultsOpen) {
			setIsResultsOpen(true);
		}

		// 當有搜尋結果時，自動調整地圖視圖以顯示所有結果
		if (matchedShops.length > 0) {
			fitMapToShops(matchedShops, false);
		}
	};

	// 處理搜尋結果視窗的切換 - 做成非同步操作避免使用setTimeout
	const toggleResults = () => {
		// 先取得反轉的狀態
		const newIsOpen = !isResultsOpen;

		// Update state
		setIsResultsOpen(newIsOpen);

		// 如果側邊欄現在是打開的，且有選中的店家或搜尋結果，重新調整地圖視圖
		if (newIsOpen) {
			// 使用 requestAnimationFrame 進行非同步操作，等待瀏覽器渲染完成側邊欄再調整地圖
			requestAnimationFrame(() => {
				if (selectedShop) {
					// 直接調用，不需要setTimeout
					if (mapRef.current?.flyTo) {
						// Adjust center coordinates for sidebar
						const [adjustedLng, adjustedLat] = adjustCenterForSidebar(
							selectedShop.location.longitude,
							selectedShop.location.latitude,
							true, // We know sidebar is open here since newIsOpen is true
							isMobile,
							windowWidth,
							16, // Using the zoom level we'll set for this view
						);

						mapRef.current.flyTo({
							center: [adjustedLng, adjustedLat],
							zoom: 16,
							duration: 1000,
						});
					}
				} else if (searchResults.shops.length > 0) {
					fitMapToShops(searchResults.shops, false);
				}
			});
		}

		// 如果側邊欄關閉，且有URL參數，清除URL參數
		if (!newIsOpen && window.location.search.includes("shopId")) {
			const url = new URL(window.location.href);
			url.searchParams.delete("shopId");
			window.history.pushState({}, "", url.toString());
		}
	};

	// 處理地圖移動
	const handleMapMove = (evt: ViewStateChangeEvent) => {
		setViewport({
			latitude: evt.viewState.latitude,
			longitude: evt.viewState.longitude,
			zoom: evt.viewState.zoom,
		});
	};

	// Calculate map container style based on mobile mode and sidebar state
	const getMapContainerStyle = (): React.CSSProperties => {
		if (isMobile && isResultsOpen) {
			// For mobile with sidebar open, map has 1/3 of the height at the bottom
			return {
				width: "100%",
				height: "34vh",
				position: "absolute" as const,
				bottom: 0,
			};
		}
		if (!isMobile && isResultsOpen) {
			// For desktop with sidebar open, map takes the full height but with a margin
			return {
				width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
				height: "100%",
				marginLeft: `${SIDEBAR_WIDTH}px`,
			};
		}
		// Default case: full screen
		return { width: "100%", height: "100%", position: "absolute" as const };
	};

	return (
		<div className="h-screen w-full relative bg-background">
			{loading || initialLocationLoading ? (
				<div className="h-full flex items-center justify-center">
					<p className="text-foreground">載入資料中...</p>
				</div>
			) : (
				<>
					<Map
						ref={mapRef}
						mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
						initialViewState={viewport}
						onMove={handleMapMove}
						onLoad={handleMapLoad}
						style={getMapContainerStyle()}
						mapStyle={mapStyle}
						attributionControl={false}
					>
						<NavigationControl
							position="bottom-right"
							style={{ margin: "1.25rem" }}
							showCompass={false}
							visualizePitch={false}
						/>

						{/* 顯示用戶位置 */}
						<UserLocationMarker onLocationUpdate={handleLocationUpdate} />

						{/* 顯示店家標記 */}
						{shops.map((shop) => (
							<Marker
								key={shop.id}
								latitude={shop.location.latitude}
								longitude={shop.location.longitude}
								color={"#F44336"} // Default color instead of using rating
								onClick={(e) => {
									e.originalEvent.stopPropagation();
									handleSelectShop(shop);
								}}
							/>
						))}

						{/* 顯示選中店家的詳細信息 */}
						{selectedShop && (
							<Popup
								latitude={selectedShop.location.latitude}
								longitude={selectedShop.location.longitude}
								closeOnClick={false}
								onClose={() => setSelectedShop(null)}
								anchor="bottom"
								className="rounded-xl overflow-hidden shadow-lg z-10 p-0 max-w-[250px]"
								closeButton={false}
								offset={[0, -5]}
							>
								<div className="relative border-0">
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											// Only close the popup, don't affect the sidebar
											setSelectedShop(null);

											// Remove shopId parameter from URL
											const url = new URL(window.location.href);
											url.searchParams.delete("shopId");
											window.history.pushState({}, "", url.toString());
										}}
										className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/30 hover:bg-background/50 text-muted-foreground hover:text-foreground p-0.5 z-10"
									>
										<XIcon className="h-3 w-3" />
									</Button>

									<div className="p-2 bg-sidebar border-0 text-sidebar-foreground">
										<h3 className="font-bold text-sm leading-tight">
											{selectedShop.name}
										</h3>
										<p className="text-xs text-sidebar-foreground/80 mt-0.5 leading-tight">
											{selectedShop.address}
										</p>
										<div className="flex flex-wrap gap-1 mt-1">
											{selectedShop.shop_types.map((type, idx) => (
												<span
													key={idx}
													className="text-[10px] bg-sidebar-accent/80 text-sidebar-accent-foreground px-1.5 py-0.5 rounded-full"
												>
													{type}
												</span>
											))}
											<span className="text-[10px] bg-sidebar-accent/80 text-sidebar-accent-foreground px-1.5 py-0.5 rounded-full">
												{selectedShop.region}
											</span>
										</div>
									</div>
								</div>
							</Popup>
						)}
					</Map>

					{/* Map Controls - Collapse button and Search Bar */}
					<MapControls
						onSearch={handleSearch}
						onToggleResults={toggleResults}
						isResultsOpen={isResultsOpen}
					/>

					{/* Search Results Sidebar */}
					<SearchResults
						isOpen={isResultsOpen}
						onClose={() => setIsResultsOpen(false)}
						shopResults={searchResults.shops}
						reviewResults={searchResults.reviews}
						selectedShop={selectedShop}
						onSelectShop={handleSelectShop}
						searchQuery={searchQuery}
					/>
				</>
			)}
		</div>
	);
};

export default MapContainer;
