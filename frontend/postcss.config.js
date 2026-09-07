export default {
  plugins: {
    // Tailwind v4 compiles with Lightning CSS, which already handles vendor
    // prefixing; a separate autoprefixer pass is redundant work.
    '@tailwindcss/postcss': {},
  },
}
