import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171412",
        paper: "#f7f3ea",
        oxblood: "#7a1f2b",
        brass: "#b78a42",
        patina: "#1d6f68"
      },
      borderRadius: {
        panel: "8px"
      },
      boxShadow: {
        soft: "0 20px 70px rgba(23, 20, 18, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
