export async function sendVerificationEmail(to: string, url: string) {
  console.log(`[dev] verification link for ${to}: ${url}`);
}

export async function sendResetPasswordEmail(to: string, url: string) {
  console.log(`[dev] reset password link for ${to}: ${url}`);
}
