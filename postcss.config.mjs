// Tailwind is used only by the admin panel (src/app/admin/admin.css). The
// public site loads its original CSS files from /public/css and imports none.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
