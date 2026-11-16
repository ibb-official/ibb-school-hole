"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";

interface LoginFormProps {
  authEnabled: boolean;
  captchaProvider: string;
  captchaSiteKey: string;
}

export function LoginForm({ authEnabled, captchaProvider, captchaSiteKey }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [website, setWebsite] = useState("");
  const [formToken, setFormToken] = useState<{ issuedAt: number; sig: string } | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    if (!authEnabled) return;
    let active = true;
    fetch("/api/security/form-token")
      .then((res) => res.json())
      .then((data: { ok?: boolean; issuedAt?: number; sig?: string }) => {
        if (active && data.ok && data.issuedAt && data.sig) {
          setFormToken({ issuedAt: data.issuedAt, sig: data.sig });
        }
      })
      .catch(() => {
        // Ignore preview fetch errors
      });
    return () => {
      active = false;
    };
  }, [authEnabled]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!authEnabled || submitting) {
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "ibb-hole-web",
        },
        body: JSON.stringify({
          identifier,
          password,
          website,
          captchaToken,
          formIssuedAt: formToken?.issuedAt ?? null,
          formSig: formToken?.sig ?? null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        setErrorMsg(payload.message ?? "登录失败，请检查账号或密码。");
        return;
      }
      window.dispatchEvent(new Event("ibb-auth-change"));
      router.push("/");
      router.refresh();
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      if (captchaProvider === "turnstile") {
        setCaptchaToken(null);
        setCaptchaReset((value) => value + 1);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card form-card">
      <h1 className="form-title">登录校园论坛</h1>
      <p className="form-subtitle">
        使用用户名与密码登录。
      </p>

      {!authEnabled && (
        <div className="lock-notice-box" role="status">
          <Lock size={17} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>当前暂未开放登录（一期锁定态）</strong>
            账号功能暂未开放。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="login-website">Website</label>
          <input
            id="login-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="login-identifier" className="field-label">
            用户名
          </label>
          <input
            id="login-identifier"
            type="text"
            className="text-input"
            placeholder="请输入用户名"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="login-password" className="field-label">
              密码
            </label>
            <span className="field-hint">登录尝试过多时请稍后再试</span>
          </div>
          <div className="input-with-addon">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="text-input"
              placeholder="请输入账号密码"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: "38px" }}
            />
            <button
              type="button"
              className="input-addon-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {authEnabled && captchaProvider === "turnstile" && (
          <TurnstileWidget siteKey={captchaSiteKey} action="login" onToken={setCaptchaToken} resetCounter={captchaReset} />
        )}

        {errorMsg && (
          <div className="field-hint field-hint-error" role="alert">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!authEnabled || submitting || (captchaProvider === "turnstile" && !captchaToken)}
          aria-disabled={!authEnabled || submitting || (captchaProvider === "turnstile" && !captchaToken)}
          className={`btn btn-lg btn-full btn-primary ${
            !authEnabled ? "btn-locked" : ""
          }`}
          title={
            authEnabled
              ? "登录"
              : "人机验证与 AI 审核接入前暂未开放登录"
          }
        >
          {!authEnabled && <Lock size={15} />}
          {authEnabled ? (submitting ? "正在登录..." : "登录") : "登录（暂未开放）"}
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginTop: "4px",
          }}
        >
          <Link href="/register" className="compliance-link">
            前往注册页预览 →
          </Link>
          <Link href="/about" className="compliance-link">
            查看防爆破设计
          </Link>
        </div>
      </form>
    </div>
  );
}
