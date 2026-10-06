import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        // Forward API calls to the Spring Boot backend so the browser sees one origin.
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                // The API authenticates with a Bearer token, not cookies. Dropping them avoids
                // "Request header is too large" when other localhost apps have left big cookies.
                configure: (proxy) => {
                    proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("cookie"));
                },
            },
        },
    },
});
