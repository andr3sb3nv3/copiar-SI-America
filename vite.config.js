import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const entry = (path) => fileURLToPath(new URL(path, import.meta.url));
const directoryRoutes = new Set([
  "/benve",
  "/initiatives/education",
  "/initiatives/presidential-challenge",
]);
function canonicalInitiativePaths(server) {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, "http://vite.local");
    if (!directoryRoutes.has(url.pathname)) return next();
    response.writeHead(302, { Location: `${url.pathname}/${url.search}` });
    response.end();
  });
}
export default defineConfig({
  plugins: [
    {
      name: "canonical-initiative-paths",
      configureServer: canonicalInitiativePaths,
      configurePreviewServer: canonicalInitiativePaths,
    },
  ],
  build: {
    rollupOptions: {
      input: {
        home: entry("./index.html"),
        benve: entry("./benve/index.html"),
        education: entry("./initiatives/education/index.html"),
        challenge: entry("./initiatives/presidential-challenge/index.html"),
      },
    },
  },
});
