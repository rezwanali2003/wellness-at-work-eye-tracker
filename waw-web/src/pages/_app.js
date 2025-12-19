// pages/_app.js
import "../styles/globals.css";

/**
 * Root app wrapper.
 * Currently only injects global CSS; extend here for layout, providers, etc.
 */
export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
