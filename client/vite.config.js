import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

// Load environment variables from the root `.env` file
dotenv.config({ path: "../.env" });

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  define: {
    "import.meta.env.VITE_FRONTEND_ORIGIN": JSON.stringify(
      process.env.VITE_FRONTEND_ORIGIN
    ),
  },
});
