"use client";

import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface StarRatingProps {
	value: number;
	onChange?: (value: number) => void;
	readonly?: boolean;
	max?: number;
	step?: number;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function StarRating({
	value,
	onChange,
	readonly = false,
	max = 5,
	step = 0.5,
	size = "md",
	className,
}: StarRatingProps) {
	const [rating, setRating] = useState(value || 0);
	const [hoverValue, setHoverValue] = useState<number | null>(null);

	// Update internal state when external value changes
	useEffect(() => {
		setRating(value || 0);
	}, [value]);

	// Size classes mapping
	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-5 h-5",
		lg: "w-7 h-7",
	}[size];

	// Container size adjustment
	const containerSizeClasses = {
		sm: "gap-0.5",
		md: "gap-1",
		lg: "gap-1.5",
	}[size];

	// Calculate the display value (either hover value or actual rating)
	const displayValue = hoverValue !== null ? hoverValue : rating;

	// Get star value based on position (handles both hover and click)
	const getStarValueAtPosition = (
		starIndex: number,
		event: React.MouseEvent<HTMLDivElement>,
	) => {
		const starValue = starIndex + 1;

		if (step === 0.5) {
			const { left, width } = event.currentTarget.getBoundingClientRect();
			const isLeftHalf = event.clientX - left < width / 2;
			return isLeftHalf ? starValue - 0.5 : starValue;
		}

		return starValue;
	};

	// Handle star click - now using exact position
	const handleStarClick = (
		starIndex: number,
		event: React.MouseEvent<HTMLDivElement>,
	) => {
		if (readonly) return;

		// Get precise value based on click position
		const clickedValue = getStarValueAtPosition(starIndex, event);

		// Toggle logic: if clicking the exact same value, decrease by one step
		let newRating: number;
		if (Math.abs(rating - clickedValue) < 0.1) {
			// If clicking the same value, decrease by one step
			newRating =
				step === 0.5 && clickedValue % 1 === 0
					? clickedValue - 0.5 // Full star → half star
					: clickedValue - step; // Half star → decrease further
		} else {
			// Otherwise, set to the clicked value
			newRating = clickedValue;
		}

		// Ensure we don't go below 0
		newRating = Math.max(0, newRating);

		setRating(newRating);
		onChange?.(newRating);
	};

	// Handle star hover using same positioning logic
	const handleStarHover = (
		starIndex: number,
		event: React.MouseEvent<HTMLDivElement>,
	) => {
		if (readonly) return;
		const hoverStarValue = getStarValueAtPosition(starIndex, event);
		setHoverValue(hoverStarValue);
	};

	// Reset hover state when mouse leaves
	const handleMouseLeave = () => {
		setHoverValue(null);
	};

	return (
		<div
			className={cn(
				"inline-flex items-center",
				containerSizeClasses,
				className,
			)}
			onMouseLeave={handleMouseLeave}
			role="radiogroup"
			aria-label="Rating"
		>
			{Array.from({ length: max }, (_, i) => {
				const starValue = i + 1;
				const isActiveHalf =
					displayValue >= starValue - 0.5 && displayValue < starValue;
				const isActiveFull = displayValue >= starValue;

				return (
					<div
						key={i}
						className={cn(
							"relative cursor-pointer transition-colors",
							readonly && "cursor-default",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						)}
						onMouseMove={(e) => handleStarHover(i, e)}
						onClick={(e) => handleStarClick(i, e)}
						tabIndex={readonly ? -1 : 0}
						role="radio"
						aria-checked={
							isActiveFull ? "true" : isActiveHalf ? "mixed" : "false"
						}
						aria-label={`${starValue} stars`}
					>
						{/* Background star (empty) */}
						<Star
							className={cn(
								sizeClasses,
								"text-muted-foreground/40 stroke-[1.5px]",
							)}
						/>

						{/* Filled star overlay (full or half) */}
						{(isActiveHalf || isActiveFull) && (
							<div
								className={cn(
									"absolute inset-0 overflow-hidden",
									isActiveHalf && "w-1/2",
								)}
							>
								<Star
									className={cn(
										sizeClasses,
										"text-yellow-400 fill-yellow-400 stroke-[1.5px]",
									)}
								/>
							</div>
						)}
					</div>
				);
			})}

			{!readonly && (
				<span
					className={cn(
						"ml-2 text-muted-foreground",
						size === "sm" && "text-xs",
						size === "md" && "text-sm",
						size === "lg" && "text-base",
					)}
				>
					{displayValue.toFixed(step < 1 ? 1 : 0)}
				</span>
			)}
		</div>
	);
}
