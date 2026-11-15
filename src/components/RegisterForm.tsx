"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";

interface RegisterFormProps {
  authEnabled: boolean;
  captchaProvider: string;
}

function evaluatePasswordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;
  if (password.length >= 14 && /[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }
  return Math.min(score, 4);
}

export function RegisterForm({ authEnabled, captchaProvider }: RegisterFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedRules, setAgreedRules] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [website, setWebsite] = useState("");
  const [formToken, setFormToken] = useState<{ issuedAt: number; sig: string } | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const usernameWarning = useMemo(() => {
    const trimmed = username.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return "禁止使用纯数字（如学号）作为用户名，请混合使用字母或汉字。";
    }
    if ([...trimmed].length < 3 || [...trimmed].length > 20) {
      return "用户名长度需在 3 至 20 个字符之间。";
    }
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(trimmed)) {
      return "仅支持中文、英文字母、数字与下划线（_）。";
    }
    return null;
  }, [username]);

  const passwordScore = useMemo(() => evaluatePasswordScore(password), [password]);
  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!authEnabled || submitting) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("两次输入的密码不一致。");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "ibb-hole-web",
        },
        body: JSON.stringify({
          username,
          email: email.trim() || null,
          password,
          agreedRules,
          website,
          formIssuedAt: formToken?.issuedAt ?? null,
          formSig: formToken?.sig ?? null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        setErrorMsg(payload.message ?? "注册失败，请检查表单输入。");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card form-card">
      <h1 className="form-title">注册校园论坛账号</h1>
      <p className="form-subtitle">
        仅凭用户名与密码即可完成注册；推荐绑定个人邮箱，用于后续安全提醒与密码找回
      </p>

      {!authEnabled && (
        <div className="lock-notice-box" role="status">
          <Lock size={17} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>当前暂未开放注册（一期锁定态）</strong>
            防批量注册限流、蜜罐耗时检测与接口总闸门已全部启用；因人机验证与 AI 审核尚未接入，注册按钮与后端注册接口均保持锁定，暂不创建任何用户。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="reg-website">Website</label>
          <input
            id="reg-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="reg-username" className="field-label">
            用户名（必填）
          </label>
          <input
            id="reg-username"
            type="text"
            className="text-input"
            placeholder="3-20 位中英文、数字或下划线"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameWarning ? (
            <span className="field-hint field-hint-error">{usernameWarning}</span>
          ) : (
            <span className="field-hint">
              请勿填写真实姓名、学号或“官方/管理员”等容易误导他人的称呼。
            </span>
          )}
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="reg-email" className="field-label">
              绑定邮箱
            </label>
            <span className="optional-pill">选填 · 推荐绑定</span>
          </div>
          <input
            id="reg-email"
            type="email"
            className="text-input"
            placeholder="name@example.com（不填也可直接注册）"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="field-hint">
            绑定邮箱不会在站内任何页面公开，仅用于账号找回与异常登录提醒。
          </span>
        </div>

        <div className="field-group">
          <label htmlFor="reg-password" className="field-label">
            设置密码（必填）
          </label>
          <div className="input-with-addon">
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              className="text-input"
              placeholder="至少 8 位，需包含字母与数字/符号"
              autoComplete="new-password"
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
          <div className="strength-meter" aria-hidden="true">
            {[1, 2, 3, 4].map((level) => {
              let activeClass = "";
              if (passwordScore >= level) {
                if (passwordScore <= 1) activeClass = "strength-bar-active-weak";
                else if (passwordScore <= 2) activeClass = "strength-bar-active-medium";
                else activeClass = "strength-bar-active-strong";
              }
              return <div key={level} className={`strength-bar ${activeClass}`} />;
            })}
          </div>
          <span className="field-hint">
            密码服务端采用随机盐 scrypt 慢哈希存储，不保存任何明文口令。
          </span>
        </div>

        <div className="field-group">
          <label htmlFor="reg-confirm-password" className="field-label">
            确认密码
          </label>
          <input
            id="reg-confirm-password"
            type={showPassword ? "text" : "password"}
            className="text-input"
            placeholder="请再次输入密码"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordMismatch && (
            <span className="field-hint field-hint-error">
              两次输入的密码不一致，请核对。
            </span>
          )}
        </div>

        <div className="captcha-slot">
          <div className="captcha-slot-left">
            <ShieldAlert size={18} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                人机验证模块预留槽位
              </div>
              <div style={{ fontSize: "12px" }}>
                防脚本批量注册组件：{captchaProvider === "disabled" ? "待接入（Turnstile / Altcha）" : captchaProvider}
              </div>
            </div>
          </div>
          <span className="status-tag status-tag-pending">待接入</span>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={agreedRules}
            onChange={(e) => setAgreedRules(e.target.checked)}
          />
          <span>
            我已阅读并同意
            <Link href="/rules" className="compliance-link">
              《社区公约》
            </Link>
            与
            <Link href="/disclaimer" className="compliance-link">
              《免责声明》
            </Link>
            。
          </span>
        </label>

        {errorMsg && (
          <div className="field-hint field-hint-error" role="alert">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!authEnabled || submitting}
          aria-disabled={!authEnabled || submitting}
          className={`btn btn-lg btn-full btn-primary ${
            !authEnabled ? "btn-locked" : ""
          }`}
          title={
            authEnabled
              ? "注册账号"
              : "人机验证与 AI 审核接入前暂未开放注册"
          }
        >
          {!authEnabled && <Lock size={15} />}
          {authEnabled
            ? submitting
              ? "正在提交注册..."
              : "注册账号"
            : "注册账号（暂未开放）"}
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
          <Link href="/login" className="compliance-link">
            已有账号？查看登录页 →
          </Link>
          <Link href="/about" className="compliance-link">
            防批量注册机制
          </Link>
        </div>
      </form>
    </div>
  );
}
