import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        positive: "#16a34a",
        negative: "#dc2626",
      },
    },
  },
  plugins: [],
};
export default config;
