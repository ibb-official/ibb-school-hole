export function verifyCsrfRequest(
  request: Request
): { ok: true } | { ok: false; error: string } {
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "ibb-hole-web") {
    return {
      ok: false,
      error: "缺少合法的同源请求校验头，请从站点页面发起操作。",
    };
  }

  const hostHeader =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const expectedHost = hostHeader?.split(",")[0]?.trim().toLowerCase();

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase();
      if (expectedHost && originHost !== expectedHost) {
        return { ok: false, error: "跨域请求来源校验未通过。" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "请求来源格式无效。" };
    }
  }

  if (refererHeader) {
    try {
      const refererHost = new URL(refererHeader).host.toLowerCase();
      if (expectedHost && refererHost !== expectedHost) {
        return { ok: false, error: "来源页面域名与当前站点不匹配。" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Referer 来源格式无效。" };
    }
  }

  return { ok: false, error: "缺少同源 Origin / Referer 校验信息。" };
}
