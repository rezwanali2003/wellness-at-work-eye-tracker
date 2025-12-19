// src/components/AppRootRedirect.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root redirect:
 * - Later can check auth state (token, cookie, server session)
 * - For now: always send user to /login
 */
export default function AppRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
