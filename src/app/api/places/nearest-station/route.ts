import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export async function POST(request: Request) {
	try {
		// Initialize Firebase Admin SDK if not already initialized
		if (!getApps().length) {
			const serviceAccount = JSON.parse(
				process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string,
			);
			initializeApp({
				credential: cert(serviceAccount),
			});
		}

		const auth = getAuth();

		// Get the ID token from the request headers
		const authorizationHeader = request.headers.get("Authorization");
		if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
			return NextResponse.json(
				{ message: "Unauthorized: No token provided" },
				{ status: 401 },
			);
		}

		const idToken = authorizationHeader.split("Bearer ")[1];

		let decodedToken;
		try {
			decodedToken = await auth.verifyIdToken(idToken);
		} catch (error) {
			console.error("Error verifying Firebase ID token:", error);
			return NextResponse.json(
				{ message: "Unauthorized: Invalid token" },
				{ status: 401 },
			);
		}

		console.log("Decoded token:", decodedToken);

		const { latitude, longitude, country, destinationPlaceId } = await request.json();
		if (typeof latitude !== "number" || typeof longitude !== "number") {
			return NextResponse.json(
				{ message: "Missing or invalid coordinates", stage: "input" },
				{ status: 400 },
			);
		}

		const apiKey =
			process.env.GOOGLE_PLACES_API_KEY ||
			process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ message: "Google Places API key not configured", stage: "config" },
				{ status: 500 },
			);
		}

		// Set language code based on country
		let language = "";
		if (country === "JP") language = "ja";
		else if (country === "TW") language = "zh-TW";
		// You can add more country-language mappings as needed

		// 1. Find up to 5 nearest train stations using Google Places Nearby Search
		const stationType = country === "JP" ? "train_station" : "transit_station";
		const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&rankby=distance&type=${stationType}&key=${apiKey}${language ? `&language=${language}` : ""}`;
		const placesRes = await fetch(placesUrl);
		const placesData = await placesRes.json();

		if (
			placesData.status !== "OK" ||
			!placesData.results ||
			placesData.results.length === 0
		) {
			return NextResponse.json(
				{
					message: "No nearby station found",
					stage: "places",
					googleStatus: placesData.status,
				},
				{ status: 400 },
			);
		}

		// Take up to 5 stations to check walking time
		const candidateStations = placesData.results.slice(0, 5);
		const stationInfos = [];

		for (const station of candidateStations) {
			const stationLocation = station.geometry.location;
			// 2. Get walking distance and time using Google Directions API
			const destination = destinationPlaceId ? `place_id:${destinationPlaceId}` : `${latitude},${longitude}`;
			const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=place_id:${station.place_id}&destination=${destination}&mode=walking&key=${apiKey}`;
			const directionsRes = await fetch(directionsUrl);
			const directionsData = await directionsRes.json();
			if (
				directionsData.status !== "OK" ||
				!directionsData.routes ||
				directionsData.routes.length === 0
			) {
				continue; // skip this station if no walking route
			}
			const leg = directionsData.routes[0].legs[0];
			const walkingTimeMinutes = Math.round(leg.duration.value / 60);
			if (walkingTimeMinutes <= 20) {
				stationInfos.push({
					name: station.name,
					location: stationLocation,
					distance_meters: leg.distance.value,
					distance_text: leg.distance.text,
					walking_time_minutes: walkingTimeMinutes,
					walking_time_text: leg.duration.text,
				});
			}
			if (stationInfos.length >= 3) break;
		}

		if (stationInfos.length === 0) {
			return NextResponse.json(
				{
					message: "No nearby station within 20 min walking",
					stage: "directions",
					googleStatus: placesData.status,
				},
				{ status: 400 },
			);
		}

		return NextResponse.json({ stations: stationInfos });
	} catch (error) {
		console.error("Nearest Station API error:", error);
		return NextResponse.json(
			{
				message: error instanceof Error ? error.message : "Failed to find nearest station",
				stage: "catch",
				error: error,
			},
			{ status: 500 },
		);
	}
}

export async function GET() {
	return NextResponse.json({ message: "Method Not Allowed" }, { status: 405 });
}
