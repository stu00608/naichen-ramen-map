"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { Search, SidebarClose, SidebarOpen, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface MapControlsProps {
	onSearch: (query: string) => void;
	onToggleResults: () => void;
	isResultsOpen: boolean;
}

export default function MapControls({
	onSearch,
	onToggleResults,
	isResultsOpen,
}: MapControlsProps) {
	const { user, logout, isAuthenticated } = useAuth();
	const [searchQuery, setSearchQuery] = useState("");
	const isMobile = useIsMobile();

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			onSearch(searchQuery);

			// Always open the sidebar on search
			if (!isResultsOpen) {
				onToggleResults();
			}
		}
	};

	return (
		<>
			{/* Left side controls: Sidebar toggle + Search */}
			<div
				className={`
        absolute z-10 
        ${
					isMobile
						? "top-4 left-4 flex gap-2 items-center"
						: "top-4 left-4 flex gap-2 items-center"
				}
      `}
			>
				{/* Sidebar Toggle Button */}
				<Button
					variant="ghost"
					className="rounded-full p-0 h-10 w-10 bg-background/80 backdrop-blur-sm shadow-md"
					onClick={onToggleResults}
					aria-label={isResultsOpen ? "關閉側邊欄" : "打開側邊欄"}
				>
					{isResultsOpen ? (
						<SidebarClose className="h-5 w-5 text-foreground" />
					) : (
						<SidebarOpen className="h-5 w-5 text-foreground" />
					)}
				</Button>

				{/* Search Bar - mobile view */}
				{isMobile && (
					<form onSubmit={handleSearch} className="relative flex-1">
						<div className="relative">
							<Input
								placeholder="搜尋拉麵店或評論..."
								className="bg-background/80 backdrop-blur-sm shadow-md h-10 w-full border-muted pr-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
							<button
								type="button"
								className="absolute right-3 top-3 h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
								onClick={handleSearch}
								aria-label="搜尋"
							>
								<Search className="h-4 w-4" />
							</button>
						</div>
					</form>
				)}

				{/* Search Bar - Only show in desktop view */}
				{!isMobile && (
					<form onSubmit={handleSearch} className="relative flex-1">
						<div className="relative">
							<Input
								placeholder="搜尋拉麵店或評論..."
								className="bg-background/80 backdrop-blur-sm shadow-md h-10 min-w-[240px] md:min-w-[360px] border-muted pr-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
							<button
								type="button"
								className="absolute right-3 top-3 h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
								onClick={handleSearch}
								aria-label="搜尋"
							>
								<Search className="h-4 w-4" />
							</button>
						</div>
					</form>
				)}
			</div>

			{/* Right side controls: User menu */}
			<div className="absolute z-10 top-4 right-4">
				{/* User Menu Button */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="rounded-full p-0 h-10 w-10 bg-background/80 backdrop-blur-sm shadow-md"
						>
							{isAuthenticated ? (
								<Avatar>
									<AvatarImage src={user?.photoURL || ""} />
									<AvatarFallback className="bg-primary text-primary-foreground">
										{user?.email?.charAt(0).toUpperCase() || "U"}
									</AvatarFallback>
								</Avatar>
							) : (
								<User className="h-5 w-5 text-foreground" />
							)}
						</Button>
					</DropdownMenuTrigger>

					<DropdownMenuContent
						align={isMobile ? "end" : "end"}
						className="w-56"
					>
						{isAuthenticated ? (
							<>
								<DropdownMenuLabel>
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium">
											{user?.displayName || "User"}
										</p>
										<p className="text-xs text-muted-foreground truncate">
											{user?.email}
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/dashboard/reviews/new">新增評論</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/dashboard/shops/new">新增店家</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/dashboard">主控台</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/dashboard/settings">帳號設定</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => logout()}>
									登出
								</DropdownMenuItem>
							</>
						) : (
							<>
								<DropdownMenuLabel>
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium">訪客</p>
										<p className="text-xs text-muted-foreground">
											登入以使用更多功能
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/login" className="w-full">
										登入
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/signup" className="w-full">
										註冊
									</Link>
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	);
}
