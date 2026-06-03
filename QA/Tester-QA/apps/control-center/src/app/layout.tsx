import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "TESTER-QA // Engineering Validation Blacksie",
    description: "AI-Native Engineering Warfare Command Center",
    icons: {
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23050816'/><circle cx='16' cy='16' r='8' fill='none' stroke='%2300FFB3' stroke-width='2'/><circle cx='16' cy='16' r='3' fill='%2300FFB3'/></svg>",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="antialiased bg-war-room min-h-screen">
                {children}
            </body>
        </html>
    );
}
