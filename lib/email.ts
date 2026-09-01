import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const FROM = "Betabook <noreply@betabook.ca>";

// Cloudflare Email Routing forwards this to the maintainer's inbox, so the
// address here is the whole configuration — nothing to set per environment.
const CONTACT_TO = "hello@betabook.ca";

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

/** A message from the public /contact form.
 *
 * Sent from noreply@ — the only DKIM-signed sender for betabook.ca — with
 * the visitor's address as Reply-To, so hitting reply in a mail client
 * addresses them rather than a mailbox nobody reads.
 *
 * Unlike the two helpers above this one surfaces a Resend failure. Those are
 * fire-and-forget side effects of an auth flow with a "resend" button behind
 * them; this one is the entire point of the visitor's click, and reporting
 * success for a message that never left would be a lie they can't detect.
 */
export async function sendContactEmail(opts: {
  replyTo: string;
  subject: string;
  text: string;
}) {
  const resend = await getResend();
  if (!resend) {
    console.log(
      `[dev] contact message to ${CONTACT_TO}, reply to ${opts.replyTo}\n${opts.subject}\n\n${opts.text}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: CONTACT_TO,
    replyTo: opts.replyTo,
    subject: opts.subject,
    // Plain text, not html: three visitor-supplied strings go into this body
    // and `text` has nothing to escape.
    text: opts.text,
  });

  // Resend returns its errors rather than throwing them. A plain Error, not
  // an ActionError, so the action boundary logs it to the Worker logs and
  // shows the visitor the generic message instead of Resend's internals.
  if (error) throw new Error(`Resend rejected the contact message: ${error.message}`);
}
