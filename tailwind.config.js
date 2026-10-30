/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // The same semantic grays + system accent colors iOS itself uses
        // in dark mode (systemGray scale, systemBlue, systemGreen/Yellow/
        // Orange/Red), so the app sits flush with the rest of the OS.
        flight: {
          50: "#f2f2f7",
          100: "#d1d1d6",
          200: "#aeaeb2",
          300: "#98989d",
          400: "#8e8e93",
          500: "#636366",
          600: "#48484a",
          700: "#3a3a3c",
          800: "#2c2c2e",
          900: "#1c1c1e",
          950: "#000000",
        },
        instrument: "#0a84ff",
        caution: "#ff9f0a",
        warning: "#ff453a",
        ok: "#30d158",
      },
    },
  },
  plugins: [],
};
