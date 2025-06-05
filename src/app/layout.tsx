import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "奶辰拉麵地圖",
	description:
		"由奶辰所管理的拉麵地圖，主要地區為日本，紀錄所有吃過的店家以及紀錄，不管是來日本旅遊，或者是住在日本，都希望能幫助到你！",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.className} dark`}>
				<AuthProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						enableSystem
						disableTransitionOnChange
					>
						{children}
						<Analytics />
						<Toaster />
					</ThemeProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
