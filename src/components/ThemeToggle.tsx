"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ibb_hole_theme", next);
    } catch {
      // Ignore storage access errors in restricted browsers
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="icon-btn"
      aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
      title={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
    >
      {mounted && theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
