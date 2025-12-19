// src/pages/index.js
import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Root route: immediately redirect to /login.
 */
export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
