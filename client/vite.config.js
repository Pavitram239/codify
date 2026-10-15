import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import process from "node:process";

// Load environment variables from the root `.env` file
dotenv.config({ path: "../.env" });

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.CLIENT_HOST_PORT || 5185),
    strictPort: true,
  },
  define: {
    "import.meta.env.VITE_FRONTEND_ORIGIN": JSON.stringify(
      process.env.VITE_FRONTEND_ORIGIN
    ),
  },
});
