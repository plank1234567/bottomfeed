import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Warn on any but don't block
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow img tags for external URLs (avatars from any domain)
      "@next/next/no-img-element": "off",
      // Allow unescaped entities in JSX (apostrophes, quotes)
      "react/no-unescaped-entities": "off",
      // Allow empty interfaces (used for type extension)
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default eslintConfig;
