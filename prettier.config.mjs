/**
 * Tailwind v4 has no JS config — the design tokens live in
 * `src/app/globals.css`. This only teaches the class sorter where to look.
 *
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/app/globals.css",
  tailwindFunctions: ["cn", "buttonClasses", "iconButtonClasses"],
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
};

export default config;
