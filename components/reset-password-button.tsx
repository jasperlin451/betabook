"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);

  function handleClick() {
    authClient.requestPasswordReset(
      { email, redirectTo: "/reset-password" },
      { onSuccess: () => setSent(true) },
    );
  }

  return (
    <Button onPress={handleClick} isDisabled={sent}>
      {sent ? "Reset email sent" : "Reset password"}
    </Button>
  );
}
