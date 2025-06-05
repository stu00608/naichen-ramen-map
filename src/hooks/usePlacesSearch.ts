import { useState } from "react";

interface Place {
	id: string;
	displayName: { text: string };
	formattedAddress: string;
	location: { latitude: number; longitude: number };
	currentOpeningHours?: {
		periods: {
			open: { day: string; hour: number; minute: number };
			close: { day: string; hour: number; minute: number };
		}[];
		weekdayDescriptions: string[];
	};
	regularSecondaryOpeningHours?: {
		type: string;
		periods: {
			open: { day: string; hour: number; minute: number };
			close: { day: string; hour: number; minute: number };
		}[];
		weekdayDescriptions: string[];
	}[];
}

export function usePlacesSearch() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<Place[]>([]);

	const searchPlaces = async (query: string, country: string) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/places/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ query, country }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "搜尋失敗");
			}

			// Process the results from the Text Search (New) API
			const formattedResults: Place[] = data.results.map((place: any) => ({
				id: place.id,
				displayName: place.displayName,
				formattedAddress: place.formattedAddress,
				location: place.location,
				currentOpeningHours: place.currentOpeningHours,
				regularSecondaryOpeningHours: place.regularSecondaryOpeningHours,
			}));

			setResults(formattedResults);
		} catch (err: any) {
			setError(err.message || "搜尋失敗");
			setResults([]);
		} finally {
			setLoading(false);
		}
	};

	const getPlaceDetails = async (placeId: string) => {
		// No need to fetch details separately with Text Search (New)
		// All the details are already in the search results
		const place = results.find((p) => p.id === placeId);
		return place;
	};

	return {
		loading,
		error,
		results,
		searchPlaces,
		getPlaceDetails,
	};
}
