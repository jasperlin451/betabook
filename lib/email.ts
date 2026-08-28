import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const FROM = "Betabook <noreply@betabook.ca>";

async function getResend() {
  const { env } = await getCloudflareContext({ async: true });
  return env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
}

export async function sendVerificationEmail(to: string, url: string) {
  const resend = await getResend();
  if (!resend) {
    console.log(`[dev] verification link for ${to}: ${url}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Betabook email",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${url}">${url}</a></p>`,
  });
}

export async function sendResetPasswordEmail(to: string, url: string) {
  const resend = await getResend();
  if (!resend) {
    console.log(`[dev] reset password link for ${to}: ${url}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Betabook password",
    html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
  });
}
