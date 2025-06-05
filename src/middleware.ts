import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
	const token = request.cookies.get("token")?.value;
	const pathname = request.nextUrl.pathname;

	// For debugging
	console.log("Middleware running for path:", pathname);
	console.log("Token exists:", !!token);
	console.log("Email verified:", request.cookies.get("emailVerified")?.value);

	// Public routes that don't require auth
	if (
		pathname === "/login" ||
		pathname === "/" ||
		pathname === "/signup" ||
		pathname.startsWith("/verify") ||
		pathname.includes("_next")
	) {
		// If already logged in, redirect from login page to dashboard
		if ((pathname === "/login" || pathname === "/signup") && token) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}
		return NextResponse.next();
	}

	// Protected routes - redirect to login if no token
	if (!token) {
		console.log("No token found, redirecting to login");
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// Check email verification only for dashboard routes
	// And ONLY if we're not in a redirect loop
	if (pathname.startsWith("/dashboard")) {
		const emailVerified = request.cookies.get("emailVerified")?.value;

		// CRITICAL FIX: Only redirect if emailVerified is explicitly 'false'
		// This prevents issues with undefined or other values
		if (emailVerified === "false") {
			console.log("Email not verified, redirecting to verification page");
			return NextResponse.redirect(new URL("/verify/notice", request.url));
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 */
		"/((?!_next/static|_next/image|favicon.ico|public).*)",
	],
};
