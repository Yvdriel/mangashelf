"use client";

import { useEffect } from "react";

export function SplashDismiss() {
  useEffect(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 300);
    }
  }, []);

  return null;
}
