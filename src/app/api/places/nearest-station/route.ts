import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { latitude, longitude, country } = await request.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ message: "Missing or invalid coordinates", stage: "input" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "Google Places API key not configured", stage: "config" }, { status: 500 });
    }

    // 1. Find nearest train station using Google Places Nearby Search
    const stationType = country === "JP" ? "train_station" : "transit_station";
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&rankby=distance&type=${stationType}&key=${apiKey}`;
    const placesRes = await fetch(placesUrl);
    const placesData = await placesRes.json();

    if (placesData.status !== "OK" || !placesData.results || placesData.results.length === 0) {
      return NextResponse.json({ message: "No nearby station found", stage: "places", googleStatus: placesData.status }, { status: 400 });
    }
    const station = placesData.results[0];
    const stationLocation = station.geometry.location;

    // 2. Get walking distance and time using Google Directions API
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${stationLocation.lat},${stationLocation.lng}&destination=${latitude},${longitude}&mode=walking&key=${apiKey}`;
    const directionsRes = await fetch(directionsUrl);
    const directionsData = await directionsRes.json();

    if (directionsData.status !== "OK" || !directionsData.routes || directionsData.routes.length === 0) {
      return NextResponse.json({ message: "No walking route found", stage: "directions", googleStatus: directionsData.status }, { status: 400 });
    }
    const leg = directionsData.routes[0].legs[0];

    return NextResponse.json({
      station: {
        name: station.name,
        location: stationLocation,
      },
      distance_meters: leg.distance.value,
      walking_time_minutes: Math.round(leg.duration.value / 60),
      walking_time_text: leg.duration.text,
      distance_text: leg.distance.text,
    });
  } catch (error) {
    console.error("Nearest Station API error:", error);
    return NextResponse.json({ message: "Failed to find nearest station", stage: "catch", error: error }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Method Not Allowed" }, { status: 405 });
} 