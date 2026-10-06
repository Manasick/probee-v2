import { createClient } from "@/lib/supabase/server";

export interface ManualBankTransferSettings {
  id: string;
  enabled: boolean;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branch: string | null;
  bankCodeSwift: string | null;
  paymentInstructions: string | null;
}

export async function getActiveManualBankTransferSettings(): Promise<ManualBankTransferSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_settings")
    .select(
      "id,enabled,bank_name,account_name,account_number,branch,bank_code_swift,payment_instructions",
    )
    .eq("payment_method", "manual_bank_transfer")
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    enabled: data.enabled,
    bankName: data.bank_name,
    accountName: data.account_name,
    accountNumber: data.account_number,
    branch: data.branch,
    bankCodeSwift: data.bank_code_swift,
    paymentInstructions: data.payment_instructions,
  };
}
