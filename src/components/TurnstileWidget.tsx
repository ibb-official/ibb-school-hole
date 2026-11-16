"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function TurnstileWidget({
  siteKey, action, onToken, resetCounter,
}: {
  siteKey: string;
  action: "login" | "register";
  onToken: (value: string | null) => void;
  resetCounter: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !siteKey || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      callback: (token) => { setError(null); onToken(token); },
      "expired-callback": () => { onToken(null); setError("验证已过期，请重新验证。"); },
      "error-callback": () => { onToken(null); setError("人机验证加载失败，请稍后重试。"); },
    });
    widget.current = id;
    return () => {
      window.turnstile?.remove(id);
      widget.current = null;
    };
  }, [action, onToken, ready, siteKey]);

  useEffect(() => {
    if (resetCounter && widget.current) window.turnstile?.reset(widget.current);
  }, [resetCounter]);

  return (
    <div className="captcha-slot">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError("人机验证加载失败，请检查网络后刷新页面。")}
      />
      <div ref={container} />
      {error && <span role="alert" className="field-hint field-hint-error">{error}</span>}
      {!siteKey && <span role="alert">人机验证尚未配置。</span>}
    </div>
  );
}
