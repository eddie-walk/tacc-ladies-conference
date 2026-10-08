export type MoolreCollectionChannel = "13" | "6" | "7";

/**
 * Detects the Moolre Collection channel code based on Ghana phone prefixes.
 * In Moolre Collection API:
 * 13 = MTN Mobile Money
 * 6  = Telecel Cash (Vodafone)
 * 7  = AT Money (AirtelTigo)
 */
export function detectMoolreCollectionChannel(phone: string): MoolreCollectionChannel {
  const digits = phone.replace(/\D/g, "");
  let localNumber = digits;
  if (digits.startsWith("233") && digits.length === 12) {
    localNumber = "0" + digits.slice(3);
  }
  const prefix = localNumber.slice(0, 3);

  // Telecel (020, 050)
  if (["020", "050"].includes(prefix)) {
    return "6";
  }
  // AT (027, 057, 026, 056)
  if (["027", "057", "026", "056"].includes(prefix)) {
    return "7";
  }
  // MTN (024, 054, 055, 059, 025, 053) & default
  return "13";
}
