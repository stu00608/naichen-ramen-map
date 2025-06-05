import { Button } from "@/components/ui/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { X } from "lucide-react";
import React from "react";

interface ShopPreviewCardProps {
	shop: {
		id: string;
		name: string;
		address?: string;
		description?: string;
		country?: string;
		googleMapsUri?: string;
	};
	onUnlink: () => void;
}

export function ShopPreviewCard({ shop, onUnlink }: ShopPreviewCardProps) {
	return (
		<div className="flex items-center justify-between p-2 border rounded-md bg-muted/20 h-10">
			<div className="flex-1 truncate ml-2">
				<HoverCard>
					<HoverCardTrigger asChild>
						<div className="flex items-center gap-1">
							<span className="font-medium cursor-pointer hover:underline text-primary truncate">
								{shop.name}
							</span>
						</div>
					</HoverCardTrigger>
					<HoverCardContent className="w-80">
						<div className="space-y-2">
							<h4 className="text-sm font-semibold">
								{shop.name}
								{shop.googleMapsUri && (
									<a
										href={shop.googleMapsUri}
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
							{shop.address && (
								<p className="text-sm text-muted-foreground">{shop.address}</p>
							)}
							{/* {shop.description && (
                <p className="text-sm text-muted-foreground">{shop.description}</p>
              )}
              {shop.country && (
                <p className="text-xs text-muted-foreground">
                  國家: {shop.country}
                </p>
              )} */}
						</div>
					</HoverCardContent>
				</HoverCard>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onUnlink}
				className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
				title="取消選擇店家"
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}
