import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: "hsl(var(--card))",
                "card-foreground": "hsl(var(--card-foreground))",
                primary: "hsl(var(--primary))",
                "primary-foreground": "hsl(var(--primary-foreground))",
                destructive: "hsl(var(--destructive))",
                muted: "hsl(var(--muted))",
                "muted-foreground": "hsl(var(--muted-foreground))",
                accent: "hsl(var(--accent))",
                // Warfare palette
                war: {
                    healthy: "#00FFB3",
                    warning: "#FFC857",
                    danger: "#FF5C7A",
                    chaos: "#FF2E63",
                    active: "#4DA3FF",
                    glow: "#00FFB3",
                },
            },
            animation: {
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "pulse-critical": "pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "glow": "glow 2s ease-in-out infinite alternate",
                "scan-line": "scan 8s linear infinite",
                "data-flow": "dataFlow 1.5s linear infinite",
                "flicker": "flicker 0.15s infinite",
                "collapse-pulse": "collapsePulse 0.8s ease-in-out infinite",
                "node-enter": "nodeEnter 0.4s ease-out forwards",
            },
            keyframes: {
                glow: {
                    "0%": { boxShadow: "0 0 5px var(--tw-shadow-color), 0 0 10px var(--tw-shadow-color)" },
                    "100%": { boxShadow: "0 0 20px var(--tw-shadow-color), 0 0 40px var(--tw-shadow-color)" },
                },
                scan: {
                    "0%": { transform: "translateY(-100%)" },
                    "100%": { transform: "translateY(100%)" },
                },
                dataFlow: {
                    "0%": { strokeDashoffset: "100" },
                    "100%": { strokeDashoffset: "0" },
                },
                flicker: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.3" },
                },
                collapsePulse: {
                    "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 46, 99, 0.4)" },
                    "50%": { boxShadow: "0 0 20px 10px rgba(255, 46, 99, 0)" },
                },
                nodeEnter: {
                    "0%": { opacity: "0", transform: "scale(0.8)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
            },
            boxShadow: {
                "glow-healthy": "0 0 15px rgba(0, 255, 179, 0.3), 0 0 30px rgba(0, 255, 179, 0.1)",
                "glow-warning": "0 0 15px rgba(255, 200, 87, 0.3), 0 0 30px rgba(255, 200, 87, 0.1)",
                "glow-danger": "0 0 15px rgba(255, 92, 122, 0.4), 0 0 30px rgba(255, 92, 122, 0.2)",
                "glow-chaos": "0 0 20px rgba(255, 46, 99, 0.5), 0 0 40px rgba(255, 46, 99, 0.3)",
                "glow-active": "0 0 15px rgba(77, 163, 255, 0.3), 0 0 30px rgba(77, 163, 255, 0.1)",
            },
            backgroundImage: {
                "grid-war": "linear-gradient(rgba(0,255,179,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,179,0.03) 1px, transparent 1px)",
                "scan-line": "linear-gradient(180deg, transparent 0%, rgba(0,255,179,0.08) 50%, transparent 100%)",
                "gradient-war": "linear-gradient(135deg, #050816 0%, #0B1020 50%, #111827 100%)",
                "radial-war": "radial-gradient(ellipse at center, rgba(0,255,179,0.05) 0%, transparent 70%)",
            },
            backgroundSize: {
                grid: "40px 40px",
            },
        },
    },
    plugins: [require("@tailwindcss/typography")],
};

export default config;
