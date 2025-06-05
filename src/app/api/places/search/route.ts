import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		console.log(request);
		const { query, country } = await request.json(); // Get the query and country from the request body

		if (!query) {
			return NextResponse.json({ message: "搜尋詞為必填" }, { status: 400 });
		}

		if (!country) {
			return NextResponse.json({ message: "請選擇國家" }, { status: 400 });
		}

		const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ message: "Google Places API key not configured" },
				{ status: 500 },
			);
		}

		// Set language code based on country
		const languageCode =
			country === "JP" ? "ja" : country === "TW" ? "zh-TW" : "";

		const textSearchResponse = await fetch(
			"https://places.googleapis.com/v1/places:searchText",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Goog-Api-Key": apiKey,
					"X-Goog-FieldMask":
						"places.displayName,places.formattedAddress,places.currentOpeningHours,places.regularSecondaryOpeningHours,places.location,places.id,places.googleMapsUri",
				},
				body: JSON.stringify({
					textQuery: query,
					languageCode,
				}),
			},
		);

		const textSearchData = await textSearchResponse.json();

		if (!textSearchResponse.ok) {
			// Handle non-OK responses (e.g., 4xx or 5xx errors)
			throw new Error(
				textSearchData.error?.message || "Text Search request failed",
			);
		}

		return NextResponse.json({ results: textSearchData.places });
	} catch (error: unknown) {
		console.error("Text Search error:", error);
		return NextResponse.json(
			{ message: error instanceof Error ? error.message : "搜尋失敗" },
			{ status: 500 },
		);
	}
}
