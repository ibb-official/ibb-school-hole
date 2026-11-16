import type { Metadata } from "next";
import { RegisterForm } from "@/components/RegisterForm";
import { getPublicSystemStatus, getRuntimeConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "注册账号",
};

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const status = getPublicSystemStatus();

  return (
    <div className="auth-page-wrap">
      <RegisterForm
        authEnabled={status.authEnabled}
        captchaProvider={status.captchaProvider}
        captchaSiteKey={getRuntimeConfig().captchaSiteKey}
      />
    </div>
  );
}
