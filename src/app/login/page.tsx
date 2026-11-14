import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { getPublicSystemStatus } from "@/lib/config";

export const metadata: Metadata = {
  title: "登录",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const status = getPublicSystemStatus();

  return (
    <div className="auth-page-wrap">
      <LoginForm
        authEnabled={status.authEnabled}
        captchaProvider={status.captchaProvider}
      />
    </div>
  );
}
