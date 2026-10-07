"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getEmailConfirmationUrl,
  getPasswordRecoveryCallbackUrl,
  safeNextPath,
} from "@/lib/auth/urls";
import { ensureProfile } from "@/lib/auth/server";
import {
  isValidEmail,
  normalizeEmail,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/auth/validation";
import type { AuthActionState } from "@/lib/auth/action-state";


function getAuthErrorMessage(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (
    message.includes("invalid login") ||
    message.includes("invalid credentials") ||
    message.includes("email not confirmed")
  ) {
    return "Unable to sign in. Check your email, password, and account activation status.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many authentication attempts. Please try again later.";
  }

  return "The authentication request could not be completed. Please try again.";
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";
  const email = normalizeEmail(emailValue);
  const password = typeof formData.get("password") === "string"
    ? String(formData.get("password"))
    : "";
  const next = safeNextPath(
    typeof formData.get("next") === "string"
      ? String(formData.get("next"))
      : "/account",
  );

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  if (!password) {
    return {
      ok: false,
      message: "Enter your password.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      message: error
        ? getAuthErrorMessage(error)
        : "Unable to sign in. Please try again.",
    };
  }

  await ensureProfile(supabase, data.user.id);

  const { data: isStaff } = await supabase.rpc("current_user_is_staff");

  if (isStaff) {
    redirect("/admin");
  }

  redirect(next === "/admin" ? "/account" : next);
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";
  const email = normalizeEmail(emailValue);
  const password = typeof formData.get("password") === "string"
    ? String(formData.get("password"))
    : "";
  const confirmPassword =
    typeof formData.get("confirmPassword") === "string"
      ? String(formData.get("confirmPassword"))
      : "";

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  const passwordValidation = validatePassword(password);

  if (passwordValidation) {
    return {
      ok: false,
      message: passwordValidation,
    };
  }

  const confirmationValidation = validatePasswordConfirmation(
    password,
    confirmPassword,
  );

  if (confirmationValidation) {
    return {
      ok: false,
      message: confirmationValidation,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailConfirmationUrl("/account"),
    },
  });

  if (error) {
    return {
      ok: false,
      message:
        "We could not complete registration right now. Please try again later.",
    };
  }

  if (data.session && data.user) {
    await ensureProfile(supabase, data.user.id);
    redirect("/account");
  }

  redirect("/login?registered=1");
}

export async function resendVerificationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";
  const email = normalizeEmail(emailValue);

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter the email address you want to use for account activation.",
    };
  }

  const supabase = await createClient();

  // Intentionally return the same public response whether the email exists or not.
  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: getEmailConfirmationUrl("/account"),
    },
  });

  return {
    ok: true,
    message:
      "If an activation email can be sent for this address, it will arrive shortly. Please also check your spam folder.",
  };
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = typeof formData.get("email") === "string"
    ? String(formData.get("email"))
    : "";
  const email = normalizeEmail(emailValue);

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  const supabase = await createClient();

  // Always return a generic response to avoid exposing account existence.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordRecoveryCallbackUrl(),
  });

  return {
    ok: true,
    message:
      "If an account can receive a password reset email for this address, instructions will arrive shortly.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  const confirmPassword =
    typeof formData.get("confirmPassword") === "string"
      ? String(formData.get("confirmPassword"))
      : "";

  const passwordValidation = validatePassword(password);

  if (passwordValidation) {
    return {
      ok: false,
      message: passwordValidation,
    };
  }

  const confirmationValidation = validatePasswordConfirmation(
    password,
    confirmPassword,
  );

  if (confirmationValidation) {
    return {
      ok: false,
      message: confirmationValidation,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message:
        "This password reset session is missing or expired. Request a new password reset email.",
      code: "RECOVERY_SESSION_MISSING",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      ok: false,
      message:
        "The new password could not be saved. Please request another reset email.",
    };
  }

  redirect("/account?password=updated");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function adminSignInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = normalizeEmail(typeof formData.get("email") === "string" ? String(formData.get("email")) : "");
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  if (!isValidEmail(email) || !password) {
    return { ok: false, message: "Enter your authorized staff email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { ok: false, message: "Unable to sign in to the ProBee operations console." };
  }

  const { data: isStaff } = await supabase.rpc("current_user_is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return { ok: false, message: "This account is not authorized for the ProBee operations console." };
  }

  redirect("/admin");
}
