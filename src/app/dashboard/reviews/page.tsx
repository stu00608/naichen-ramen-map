"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/ui/star-rating";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { firestoreConstraints, useFirestore } from "@/hooks/useFirestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types";
import { format } from "date-fns";
import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	startAfter,
	where,
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import {
	Edit,
	Instagram,
	Plus,
	Search,
	Settings2,
	Star,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Define interfaces for the review data
interface RamenItem {
	name: string;
	price?: number;
	currency: string;
	preference?: string;
}

interface SideMenuItem {
	name: string;
	price?: number;
	currency: string;
}

interface Review {
	id: string;
	shop_id: string;
	shop_name?: string;
	visit_date: { toDate: () => Date };
	people_count: string;
	reservation_type: string;
	wait_time?: string;
	ramen_items: RamenItem[];
	side_menu: SideMenuItem[];
	soup_score: number;
	noodle_score: number;
	topping_score: number;
	appearance_score: number;
	experience_score: number;
	value_score: number;
	overall_score: number;
	notes?: string;
	images?: string[];
	created_at: { toDate: () => Date };
	updated_at: { toDate: () => Date };
	searchTokens?: string;
	source?: string;
	ig_post_data?: { content: string };
	tags?: string[];
	order_method?: string;
	payment_method?: string[];
	nearest_station_name?: string;
	nearest_station_walking_time_minutes?: number;
	nearest_station_distance_meters?: number;
}

export default function ReviewsPage() {
	const router = useRouter();
	const { getDocuments, deleteDocument, loading, error, updateDocument } =
		useFirestore("reviews");
	const [reviews, setReviews] = useState<Review[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalReviews, setTotalReviews] = useState(0);
	const [sortBy, setSortBy] = useState("created_at_desc");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [itemsPerPage, setItemsPerPage] = useState<number>(10);
	const [lastVisible, setLastVisible] =
		useState<QueryDocumentSnapshot<DocumentData> | null>(null);
	const [firstVisible, setFirstVisible] =
		useState<QueryDocumentSnapshot<DocumentData> | null>(null);
	const [pageSnapshots, setPageSnapshots] = useState<
		QueryDocumentSnapshot<DocumentData>[]
	>([]);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [shopData, setShopData] = useState<{
		[key: string]: Record<string, unknown>;
	}>({});
	const { getDocument } = useFirestore("shops");

	// Add debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchQuery);
		}, 300);

		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Add keyboard shortcut for search
	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				!["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
			) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleKeyPress);
		return () => document.removeEventListener("keydown", handleKeyPress);
	}, []);

	// Fetch reviews when search term or items per page changes
	useEffect(() => {
		fetchReviews(debouncedSearchTerm);
	}, [debouncedSearchTerm, itemsPerPage]);

	const fetchReviews = async (searchTerm = "") => {
		try {
			setIsLoading(true);
			const baseQuery = collection(db, "reviews");

			// Create query based on search term and sorting
			let q;
			if (searchTerm) {
				const searchLower = searchTerm.toLowerCase();
				q = query(
					baseQuery,
					where("searchTokens", "array-contains", searchLower),
					orderBy("created_at", "asc"),
					orderBy("__name__", "asc"),
					limit(itemsPerPage),
				);
			} else {
				q = query(
					baseQuery,
					orderBy("created_at", "desc"),
					limit(itemsPerPage),
				);
			}

			// Get total count
			const snapshot = await getDocs(baseQuery);
			const total = snapshot.size;
			setTotalReviews(total);
			setTotalPages(Math.ceil(total / itemsPerPage));

			const querySnapshot = await getDocs(q);
			if (!querySnapshot.empty) {
				const reviewsData: Review[] = [];
				for (const doc of querySnapshot.docs) {
					reviewsData.push({ id: doc.id, ...doc.data() } as Review);
				}

				setReviews(reviewsData);
				setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
				setFirstVisible(querySnapshot.docs[0]);
				// Store the last document of the first page
				setPageSnapshots([querySnapshot.docs[querySnapshot.docs.length - 1]]);
				setCurrentPage(1);
			} else {
				setReviews([]);
				setLastVisible(null);
				setFirstVisible(null);
				setPageSnapshots([]);
				setCurrentPage(1);
			}
		} catch (error) {
			console.error("Error fetching reviews:", error);
			toast.error("無法載入評價列表");
		} finally {
			setIsLoading(false);
		}
	};

	const handlePageClick = async (page: number) => {
		if (page === currentPage) return;

		try {
			setIsLoading(true);
			const baseQuery = collection(db, "reviews");

			if (page < currentPage) {
				// Going backwards - use the stored snapshot
				const snapshot = pageSnapshots[page - 2];
				let q;
				if (debouncedSearchTerm) {
					const searchLower = debouncedSearchTerm.toLowerCase();
					q = query(
						baseQuery,
						where("searchTokens", "array-contains", searchLower),
						orderBy("created_at", "asc"),
						orderBy("__name__", "asc"),
						snapshot ? startAfter(snapshot) : limit(itemsPerPage),
						limit(itemsPerPage),
					);
				} else {
					q = query(
						baseQuery,
						orderBy("created_at", "desc"),
						snapshot ? startAfter(snapshot) : limit(itemsPerPage),
						limit(itemsPerPage),
					);
				}

				const querySnapshot = await getDocs(q);
				if (!querySnapshot.empty) {
					const reviewsData: Review[] = [];
					for (const doc of querySnapshot.docs) {
						reviewsData.push({ id: doc.id, ...doc.data() } as Review);
					}

					setReviews(reviewsData);
					setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
					setFirstVisible(querySnapshot.docs[0]);
					setCurrentPage(page);
				}
			} else {
				// Going forwards - get new data
				const lastSnapshotToUse = pageSnapshots[page - 2];
				let q;
				if (debouncedSearchTerm) {
					const searchLower = debouncedSearchTerm.toLowerCase();
					q = query(
						baseQuery,
						where("searchTokens", "array-contains", searchLower),
						orderBy("created_at", "asc"),
						orderBy("__name__", "asc"),
						lastSnapshotToUse
							? startAfter(lastSnapshotToUse)
							: limit(itemsPerPage),
						limit(itemsPerPage),
					);
				} else {
					q = query(
						baseQuery,
						orderBy("created_at", "desc"),
						lastSnapshotToUse
							? startAfter(lastSnapshotToUse)
							: limit(itemsPerPage),
						limit(itemsPerPage),
					);
				}

				const querySnapshot = await getDocs(q);
				if (!querySnapshot.empty) {
					const reviewsData: Review[] = [];
					for (const doc of querySnapshot.docs) {
						reviewsData.push({ id: doc.id, ...doc.data() } as Review);
					}

					setReviews(reviewsData);
					setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
					setFirstVisible(querySnapshot.docs[0]);
					setCurrentPage(page);
					setPageSnapshots((prev) => {
						const newSnapshots = [...prev];
						newSnapshots[page - 1] =
							querySnapshot.docs[querySnapshot.docs.length - 1];
						return newSnapshots;
					});
				}
			}
		} catch (error) {
			console.error("Error fetching page:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleNextPage = async () => {
		if (!lastVisible || currentPage >= totalPages) return;
		handlePageClick(currentPage + 1);
	};

	const handlePreviousPage = async () => {
		if (currentPage <= 1) return;
		handlePageClick(currentPage - 1);
	};

	const clearSearch = () => {
		setSearchQuery("");
		setCurrentPage(1);
	};

	// Function to handle review deletion
	const handleDeleteReview = async () => {
		if (!reviewToDelete) return;

		try {
			const success = await deleteDocument(reviewToDelete);

			if (success) {
				toast.success("評價已成功刪除");
				setReviews(reviews.filter((review) => review.id !== reviewToDelete));
				setTotalReviews((prev) => prev - 1);
			} else {
				toast.error("刪除評價失敗");
			}
		} catch (err) {
			console.error("Error deleting review:", err);
			toast.error("刪除評價時發生錯誤");
		} finally {
			setShowDeleteConfirm(false);
			setReviewToDelete(null);
		}
	};

	// Function to format a date
	const formatDate = (date: Date) => {
		return format(date, "yyyy/MM/dd");
	};

	// Function to fetch shop data
	const fetchShopData = async (shopId: string) => {
		try {
			const shop = await getDocument(shopId);
			if (shop) {
				setShopData((prev) => ({ ...prev, [shopId]: shop }));
			}
		} catch (error) {
			console.error("Error fetching shop data:", error);
		}
	};

	// Fetch shop data for each review
	useEffect(() => {
		for (const review of reviews) {
			if (review.shop_id && !shopData[review.shop_id]) {
				fetchShopData(review.shop_id);
			}
		}
	}, [reviews, fetchShopData, shopData]);

	// Copy-to-clipboard utility (reuse from settings)
	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("已複製到剪貼簿");
		} catch (err) {
			toast.error("複製失敗");
			console.error("Failed to copy:", err);
		}
	};

	return (
		<div>
			<div className="flex items-center gap-4 mb-6 mt-4">
				<h1 className="text-2xl font-bold whitespace-nowrap">評價管理</h1>
				<div className="relative flex-1 max-w-xl mx-auto">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder='搜尋評價... (按 "/" 快速搜尋)'
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setCurrentPage(1);
						}}
						className="pl-8 pr-8"
					/>
					{searchQuery && (
						<button
							onClick={clearSearch}
							className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
				<Button asChild className="whitespace-nowrap">
					<Link href="/dashboard/reviews/new">新增評價</Link>
				</Button>
			</div>

			{loading ? (
				<div className="text-center py-10">
					<p>載入中...</p>
				</div>
			) : reviews.length === 0 ? (
				<div className="bg-card rounded-lg p-6 text-center">
					<p className="text-muted-foreground">
						{searchQuery
							? "沒有符合搜尋條件的評價。"
							: "尚未有評價資料。點擊「新增評價」開始添加。"}
					</p>
				</div>
			) : (
				<div className="space-y-4">
					<div className="bg-card shadow-sm rounded-lg">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>店家</TableHead>
									<TableHead>評分</TableHead>
									<TableHead>拉麵品項</TableHead>
									<TableHead>造訪日期</TableHead>
									<TableHead className="text-right">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{reviews.map((review) => (
									<TableRow key={review.id}>
										<TableCell>
											{review.shop_id && shopData[review.shop_id] ? (
												<HoverCard>
													<HoverCardTrigger>
														<span className="font-medium cursor-default hover:underline text-primary">
															{
																(shopData[review.shop_id] as unknown as Shop)
																	.name
															}
														</span>
													</HoverCardTrigger>
													<HoverCardContent className="w-80">
														<div className="space-y-2">
															<h4 className="text-sm font-semibold">
																{
																	(shopData[review.shop_id] as unknown as Shop)
																		.name
																}
																{(shopData[review.shop_id] as unknown as Shop)
																	.googleMapsUri && (
																	<a
																		href={String(
																			(
																				shopData[
																					review.shop_id
																				] as unknown as Shop
																			).googleMapsUri,
																		)}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-muted-foreground hover:text-primary ml-1"
																		title="在 Google Maps 查看"
																		onClick={(e) => e.stopPropagation()}
																	>
																		↗︎
																	</a>
																)}
															</h4>
															{(shopData[review.shop_id] as unknown as Shop)
																.address && (
																<p className="text-sm text-muted-foreground">
																	{String(
																		(
																			shopData[
																				review.shop_id
																			] as unknown as Shop
																		).address,
																	)}
																</p>
															)}
														</div>
													</HoverCardContent>
												</HoverCard>
											) : (
												<span className="text-muted-foreground">未知店家</span>
											)}
										</TableCell>
										<TableCell>
											<div className="flex items-center">
												<HoverCard>
													<HoverCardTrigger>
														<div className="flex ml-2 text-sm cursor-help gap-2">
															<StarRating
																value={review.overall_score}
																readonly
																size="sm"
															/>
															{review.overall_score.toFixed(1)}
														</div>
													</HoverCardTrigger>
													<HoverCardContent className="w-[200px]">
														<div className="space-y-2">
															<h4 className="text-sm font-semibold mb-2">
																詳細評分
															</h4>
															<div className="grid gap-2 text-sm">
																<div className="flex items-center justify-between">
																	<span>湯頭</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.soup_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.soup_score.toFixed(1)}
																		</span>
																	</div>
																</div>
																<div className="flex items-center justify-between">
																	<span>麵條</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.noodle_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.noodle_score.toFixed(1)}
																		</span>
																	</div>
																</div>
																<div className="flex items-center justify-between">
																	<span>配料</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.topping_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.topping_score.toFixed(1)}
																		</span>
																	</div>
																</div>
																<div className="flex items-center justify-between">
																	<span>外觀</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.appearance_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.appearance_score.toFixed(1)}
																		</span>
																	</div>
																</div>
																<div className="flex items-center justify-between">
																	<span>體驗</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.experience_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.experience_score.toFixed(1)}
																		</span>
																	</div>
																</div>
																<div className="flex items-center justify-between">
																	<span>性價比</span>
																	<div className="flex items-center">
																		<StarRating
																			value={review.value_score}
																			readonly
																			size="sm"
																		/>
																		<span className="ml-1 w-6 text-right tabular-nums">
																			{review.value_score.toFixed(1)}
																		</span>
																	</div>
																</div>
															</div>
														</div>
													</HoverCardContent>
												</HoverCard>
											</div>
										</TableCell>
										<TableCell>
											<div className="max-w-[200px] truncate">
												{review.ramen_items
													?.map((item) => item.name)
													.join(", ") || "無品項資料"}
											</div>
										</TableCell>
										<TableCell>
											{review.visit_date
												? formatDate(review.visit_date.toDate())
												: "未知日期"}
										</TableCell>
										<TableCell className="text-right">
											<Button variant="ghost" asChild>
												<Link href={`/dashboard/reviews/${review.id}`}>
													<Settings2 className="h-4 w-4" />
												</Link>
											</Button>
											<Button
												variant="ghost"
												className="text-pink-500 hover:text-pink-600"
												title="複製 IG 內容"
												onClick={async () => {
													const igContent = review.ig_post_data?.content;
													if (igContent) {
														await copyToClipboard(igContent);
													} else {
														toast.error("沒有可複製的 IG 內容");
													}
												}}
											>
												<Instagram className="h-4 w-4" />
											</Button>
											<AlertDialog
												open={reviewToDelete === review.id}
												onOpenChange={(open) =>
													!open && setReviewToDelete(null)
												}
											>
												<AlertDialogTrigger asChild>
													<Button
														variant="ghost"
														className="text-destructive hover:text-destructive/90"
														onClick={() => setReviewToDelete(review.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															確定要刪除此評價嗎？
														</AlertDialogTitle>
														<AlertDialogDescription>
															此操作無法復原。所有評價資料都將被永久刪除。
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel
															onClick={() => setReviewToDelete(null)}
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
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<div className="flex justify-between items-center gap-4">
						<div className="text-sm text-muted-foreground whitespace-nowrap">
							總共 {totalReviews} 則評價
						</div>
						<div className="flex-1 flex justify-center items-center gap-4">
							<Pagination>
								<PaginationContent>
									<PaginationItem>
										<PaginationPrevious
											onClick={handlePreviousPage}
											className={
												currentPage <= 1
													? "pointer-events-none opacity-50"
													: "cursor-pointer"
											}
										/>
									</PaginationItem>
									<PaginationItem>
										<PaginationLink isActive>{currentPage}</PaginationLink>
									</PaginationItem>
									{currentPage < totalPages && (
										<>
											{currentPage + 1 < totalPages && (
												<>
													<PaginationItem>
														<PaginationLink
															onClick={() => handlePageClick(currentPage + 1)}
														>
															{currentPage + 1}
														</PaginationLink>
													</PaginationItem>
													<PaginationEllipsis />
												</>
											)}
											<PaginationItem>
												<PaginationLink
													onClick={() => handlePageClick(totalPages)}
												>
													{totalPages}
												</PaginationLink>
											</PaginationItem>
										</>
									)}
									<PaginationItem>
										<PaginationNext
											onClick={handleNextPage}
											className={
												currentPage >= totalPages
													? "pointer-events-none opacity-50"
													: "cursor-pointer"
											}
										/>
									</PaginationItem>
								</PaginationContent>
							</Pagination>

							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									每頁顯示：
								</span>
								<Select
									value={itemsPerPage.toString()}
									onValueChange={(value) => {
										setItemsPerPage(Number(value));
										setCurrentPage(1);
										setPageSnapshots([]);
									}}
								>
									<SelectTrigger className="w-[70px]">
										<SelectValue placeholder="10" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="5">5</SelectItem>
										<SelectItem value="10">10</SelectItem>
										<SelectItem value="20">20</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
