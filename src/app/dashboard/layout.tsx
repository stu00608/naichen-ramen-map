"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useFirestore } from "@/hooks/useFirestore";
import type { Shop } from "@/types";
import { Map as LucideMap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const pathMap: Record<string, string> = {
	"/dashboard": "主控台",
	"/dashboard/shops": "店家管理",
	"/dashboard/shops/new": "創建店家",
	// Add review paths
	"/dashboard/reviews": "評價管理",
	"/dashboard/reviews/new": "新增評價",
	"/dashboard/docs/how-to-add-record": "如何新增一篇紀錄",
	"/dashboard/settings": "帳號設定",
};

function getBreadcrumbItems(pathname: string, shopName?: string) {
	const paths = pathname.split("/").filter(Boolean);
	const items = [];
	let currentPath = "";

	for (const path of paths) {
		currentPath += `/${path}`;
		let label = pathMap[currentPath];

		// Handle shop edit page
		if (
			!label &&
			path !== "shops" &&
			currentPath.includes("/dashboard/shops/") &&
			shopName
		) {
			label = shopName;
		}

		// Handle review edit page (when we have the ID parameter)
		if (
			!label &&
			path !== "reviews" &&
			currentPath.includes("/dashboard/reviews/") &&
			path !== "new"
		) {
			label = "評價詳情";
		}

		if (label) {
			items.push({ path: currentPath, label });
		}
	}

	return items;
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, loading } = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const { getDocument } = useFirestore("shops");
	const [shopName, setShopName] = useState<string>();

	useEffect(() => {
		const fetchShopName = async () => {
			const match = pathname.match(/\/dashboard\/shops\/([^/]+)$/);
			if (match && match[1] !== "new") {
				const shopId = match[1];
				const shop = (await getDocument(shopId)) as Shop | null;
				if (shop) {
					setShopName(shop.name);
				}
			} else {
				setShopName(undefined);
			}
		};

		fetchShopName();
	}, [pathname, getDocument]);

	useEffect(() => {
		if (!loading && !user) {
			router.push("/login");
		}
	}, [user, loading, router]);

	if (loading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<p>Loading...</p>
			</div>
		);
	}

	if (!user) {
		return null;
	}

	const breadcrumbItems = getBreadcrumbItems(pathname, shopName);

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								{breadcrumbItems.map((item, index) => (
									<React.Fragment key={item.path}>
										<BreadcrumbItem className="hidden md:block">
											{index === breadcrumbItems.length - 1 ? (
												<BreadcrumbPage>{item.label}</BreadcrumbPage>
											) : (
												<Link
													href={item.path}
													className="hover:text-foreground transition-colors"
												>
													{item.label}
												</Link>
											)}
										</BreadcrumbItem>
										{index < breadcrumbItems.length - 1 && (
											<BreadcrumbSeparator className="hidden md:block" />
										)}
									</React.Fragment>
								))}
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex items-center px-4">
						<Link
							href="/"
							className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground"
						>
							<LucideMap />
						</Link>
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
