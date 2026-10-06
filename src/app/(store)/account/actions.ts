"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticated } from "@/lib/auth/server";

export interface ProfileActionState {
  ok: boolean;
  message: string;
}

export const INITIAL_PROFILE_STATE: ProfileActionState = {
  ok: false,
  message: "",
};

const DISPLAY_NAME_MAX_LENGTH = 120;
const PHONE_MAX_LENGTH = 50;

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const context = await requireAuthenticated("/account");

  const displayNameValue = formData.get("displayName");
  const phoneValue = formData.get("phone");

  const displayName =
    typeof displayNameValue === "string"
      ? displayNameValue.trim()
      : "";
  const phone =
    typeof phoneValue === "string"
      ? phoneValue.trim()
      : "";

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: "Display name must be 120 characters or fewer.",
    };
  }

  if (phone.length > PHONE_MAX_LENGTH) {
    return {
      ok: false,
      message: "Phone number must be 50 characters or fewer.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      phone: phone || null,
    })
    .eq("id", context.user.id);

  if (error) {
    return {
      ok: false,
      message: "Your profile could not be updated right now. Please try again.",
    };
  }

  revalidatePath("/account");

  return {
    ok: true,
    message: "Your profile was updated successfully.",
  };
}
