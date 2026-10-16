import { z } from "zod";
import { normalizeBdPhone } from "../phone";
import { BD_GEO } from "../geo/bd-geo";
import { parseOrderMessage } from "../admin/quick-order";
import { callGemini, recordAiGeneration, resolveGeminiApiKey } from "./gateway";
import { SYSTEM_PROMPT_CUSTOMER_PARSER } from "./prompts";

export const ParsedCustomerDetailsSchema = z.object({
  name: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  division: z.string().nullable().default(null),
  district: z.string().nullable().default(null),
  upazila: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  paymentMethod: z.enum(["COD", "BKASH", "NAGAD"]).nullable().default("COD"),
});

export type ParsedCustomerDetails = z.infer<typeof ParsedCustomerDetailsSchema>;

/**
 * Parses unstructured customer order text (from Facebook Messenger, WhatsApp, SMS)
 * into clean, validated fields ready for order creation or checkout forms.
 */
export async function parseCustomerDetailsWithAi(
  tenantId: string,
  rawText: string,
  options?: { fetchImpl?: typeof fetch; bypassAi?: boolean }
): Promise<ParsedCustomerDetails> {
  const text = rawText.trim();
  if (!text) {
    return {
      name: null,
      phone: null,
      division: null,
      district: null,
      upazila: null,
      address: null,
      notes: null,
      paymentMethod: "COD",
    };
  }

  // Fallback heuristic function using regex & bd-geo
  const fallbackParse = (): ParsedCustomerDetails => {
    // Normalise newlines to commas for quick-order regex
    const normalisedText = text.replace(/[\r\n]+/g, ", ");
    const reg = parseOrderMessage(normalisedText, []);
    let pm: "COD" | "BKASH" | "NAGAD" = "COD";
    if (reg.payment === "MANUAL_BKASH") pm = "BKASH";
    if (reg.payment === "MANUAL_NAGAD") pm = "NAGAD";

    // Check for explicit "নাম: ..." or "Name: ..."
    let name = reg.name;
    const nameMatch = text.match(/(?:আমার\s+নাম|নাম|name)\s*[:ঃ-]?\s*([^\r\n,]+)/i);
    if (nameMatch && nameMatch[1]?.trim()) {
      name = nameMatch[1].trim();
    }

    // Check for explicit "ঠিকানা: ..." or "Address: ..."
    let address = reg.addressHint;
    const addrMatch = text.match(/(?:ঠিকানা|address)\s*[:ঃ-]?\s*([^\r\n]+)/i);
    if (addrMatch && addrMatch[1]?.trim()) {
      address = addrMatch[1].trim();
    }

    return {
      name,
      phone: reg.phone,
      division: reg.division,
      district: reg.district,
      upazila: reg.upazila,
      address,
      notes: null,
      paymentMethod: pm,
    };
  };

  if (options?.bypassAi) {
    return fallbackParse();
  }

  try {
    const { apiKey, isCustom, model } = await resolveGeminiApiKey(tenantId);

    const prompt = `
Extract structured customer delivery details from this raw message text:
"""
${text}
"""

OUTPUT SCHEMA:
{
  "name": "Customer Name or null",
  "phone": "01XXXXXXXXX or null",
  "division": "Division name in English (e.g. Dhaka, Chattogram) or null",
  "district": "District name in English (e.g. Dhaka, Bogura) or null",
  "upazila": "Thana or Upazila name or null",
  "address": "Clean street address, road, house, area details",
  "notes": "Special delivery instructions or product notes or null",
  "paymentMethod": "COD" | "BKASH" | "NAGAD"
}
`;

    const rawJson = await callGemini({
      apiKey,
      model,
      prompt,
      systemInstruction: SYSTEM_PROMPT_CUSTOMER_PARSER,
      responseMimeType: "application/json",
      temperature: 0.1, // Low temperature for high precision extraction
      fetchImpl: options?.fetchImpl,
    });

    const parsed = JSON.parse(rawJson);
    const validated = ParsedCustomerDetailsSchema.parse(parsed);

    // Normalize phone number if present
    let cleanPhone = validated.phone;
    if (cleanPhone) {
      try {
        cleanPhone = normalizeBdPhone(cleanPhone);
      } catch {
        cleanPhone = null;
      }
    }

    // Match district and division against BD_GEO
    let cleanDistrict = validated.district;
    let cleanDivision = validated.division;

    if (cleanDistrict) {
      for (const div of BD_GEO) {
        const found = div.districts.find(
          (d) => d.name.toLowerCase() === cleanDistrict?.toLowerCase()
        );
        if (found) {
          cleanDistrict = found.name;
          cleanDivision = div.name;
          break;
        }
      }
    }

    await recordAiGeneration(tenantId, isCustom);

    return {
      name: validated.name?.trim() || null,
      phone: cleanPhone,
      division: cleanDivision,
      district: cleanDistrict,
      upazila: validated.upazila?.trim() || null,
      address: validated.address?.trim() || null,
      notes: validated.notes?.trim() || null,
      paymentMethod: validated.paymentMethod || "COD",
    };
  } catch (err) {
    console.warn("[ai customer parser] AI parsing failed, using heuristic fallback", err);
    return fallbackParse();
  }
}
