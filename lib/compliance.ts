export interface ComplianceViolation {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  found: string;
  fix: string;
}

export interface ComplianceResult {
  passed: boolean;
  risk_score: number;
  violations: ComplianceViolation[];
  brand_name: string;
  auto_additions: string[];
}

const BRAND_RULES = {
  nimulid: {
    name: "Nimulid Strong (Topical Diclofenac Gel & Spray)",
    forbidden: [
      { phrase: "cures", fix: "Use 'helps manage' or 'may provide relief from'" },
      { phrase: "cure", fix: "Use 'helps manage'" },
      { phrase: "permanently eliminates", fix: "Use 'provides relief from'" },
      { phrase: "permanent relief", fix: "Use 'helps manage pain'" },
      { phrase: "guaranteed relief", fix: "Remove guarantee language" },
      { phrase: "completely eliminates pain", fix: "Use 'helps manage pain and discomfort'" },
      { phrase: "no side effects", fix: "Remove — topical NSAIDs can cause skin reactions" },
      { phrase: "safe for everyone", fix: "Use 'suitable for most adults — consult doctor for children or if pregnant'" },
      { phrase: "heals injury", fix: "Use 'helps manage discomfort associated with'" },
      { phrase: "miracle", fix: "Remove promotional language" },
      { phrase: "100% effective", fix: "Remove absolute efficacy claims" },
      { phrase: "best painkiller", fix: "Avoid superlative comparisons" },
      { phrase: "apply to eyes", fix: "Never suggest near eyes — remove immediately" },
      { phrase: "apply on broken skin", fix: "Remove — contraindicated on broken/infected skin" },
    ],
    required_warnings: [
      "For external use only.",
      "Avoid contact with eyes and mucous membranes.",
      "Do not apply on broken, damaged, or infected skin.",
      "Discontinue use if skin irritation or rash develops.",
      "Consult a doctor before use in children or if you are pregnant or breastfeeding.",
      "If pain persists or worsens beyond a few days, consult a qualified healthcare professional.",
    ],
    auto_disclaimer:
      "Disclaimer: Nimulid Strong Gel/Spray is for external use only. Avoid contact with eyes and mucous membranes. Do not apply to broken, damaged, or infected skin. Discontinue if irritation develops. If pain persists, consult a qualified healthcare professional. Not for self-medication in children without medical advice.",
    regulatory: "Drug & Cosmetics Act 1940 | Topical NSAID Advertising Guidelines",
  },

  gas_o_fast: {
    name: "Gas-O-Fast Asli Jeera (OTC Antacid)",
    forbidden: [
      { phrase: "permanent cure", fix: "Use 'provides temporary relief from'" },
      { phrase: "permanently cures", fix: "Use 'helps manage'" },
      { phrase: "cures acidity", fix: "Use 'helps with acidity symptoms'" },
      { phrase: "eliminates acidity forever", fix: "Use 'helps manage acidity'" },
      { phrase: "prevents all digestive", fix: "Use 'may help with occasional digestive discomfort'" },
      { phrase: "eliminates gas permanently", fix: "Use 'helps relieve gas and bloating'" },
      { phrase: "100% natural", fix: "Use just 'natural' — '100% natural' requires certification" },
      { phrase: "no side effects", fix: "Remove — even OTC products can have interactions" },
      { phrase: "completely safe for everyone", fix: "Use 'generally well-tolerated — consult doctor if unsure'" },
      { phrase: "replaces medication", fix: "Remove — OTC antacid is not a prescription replacement" },
      { phrase: "substitute for medication", fix: "Remove — complement, not replacement" },
    ],
    required_warnings: [
      "For symptomatic relief only.",
      "Consult a doctor if symptoms persist beyond 2 weeks.",
    ],
    auto_disclaimer:
      "Disclaimer: This content is for informational purposes only and is not a substitute for professional medical advice. Gas-O-Fast Asli Jeera is an OTC product for temporary symptomatic relief of acidity, gas, and digestive discomfort. If symptoms persist for more than 2 weeks, please consult a qualified healthcare professional. Read the label carefully before use.",
    regulatory: "AIOCD OTC Code | AYUSH Guidelines | FSSAI",
  },

  healthok: {
    name: "HealthOK (Multivitamin Supplement)",
    forbidden: [
      { phrase: "cures", fix: "Use 'may help support' or 'may contribute to'" },
      { phrase: "cure", fix: "Use 'may help support' or 'may contribute to'" },
      { phrase: "treats", fix: "Use 'may help support normal functioning'" },
      { phrase: "prevents disease", fix: "Use 'may help support immunity'" },
      { phrase: "100% effective", fix: "Remove absolute efficacy claims — supplements are not drugs" },
      { phrase: "guaranteed", fix: "Remove guarantee language — not permissible for supplements" },
      { phrase: "clinically proven to cure", fix: "Use 'shown in clinical studies to improve energy and fatigue scores within 14 days in some individuals'" },
      { phrase: "no side effects", fix: "Remove — even supplements can interact with medications" },
      { phrase: "replaces your diet", fix: "Use 'supplements a balanced diet'" },
      { phrase: "substitute for medication", fix: "Remove — supplements are not drug replacements" },
      { phrase: "diagnoses", fix: "Remove — supplement does not diagnose conditions" },
      { phrase: "medical treatment", fix: "Use 'nutritional support'" },
    ],
    required_warnings: [
      "This product is a nutritional supplement and is not intended to diagnose, treat, cure, or prevent any disease.",
      "For best results, consume as part of a balanced diet and healthy lifestyle.",
      "If you are pregnant, nursing, or have a medical condition, consult a doctor before use.",
    ],
    auto_disclaimer:
      "Disclaimer: Pure Veg HealthOK Multivitamin Tablets are a nutritional supplement, not a medicine. This content is for informational purposes only and does not constitute medical advice. Supplements are not intended to diagnose, treat, cure, or prevent any disease. Consult a qualified healthcare professional before starting any new supplement, especially if you have an existing medical condition or are on medication.",
    regulatory: "FSSAI Regulations for Nutraceuticals | Food Safety and Standards (Health Supplements) Regulations 2016",
  },
};

export type BrandKey = keyof typeof BRAND_RULES;

export function checkCompliance(
  content: string,
  brand: BrandKey
): ComplianceResult {
  const rules = BRAND_RULES[brand];
  if (!rules) {
    return {
      passed: false,
      risk_score: 100,
      violations: [{ type: "Unknown Brand", severity: "CRITICAL", found: brand, fix: "Select a valid brand" }],
      brand_name: "Unknown",
      auto_additions: [],
    };
  }

  const violations: ComplianceViolation[] = [];
  const contentLower = content.toLowerCase();

  for (const forbidden of rules.forbidden) {
    if (contentLower.includes(forbidden.phrase.toLowerCase())) {
      violations.push({
        type: "Forbidden Claim",
        severity: "HIGH",
        found: `"${forbidden.phrase}"`,
        fix: forbidden.fix,
      });
    }
  }

  // Auto-additions that will be appended to content
  const auto_additions = [rules.auto_disclaimer];

  // Risk score: 0 = safe, 100 = critical
  const risk_score = Math.min(100, violations.length * 20);
  const passed = violations.length === 0;

  return {
    passed,
    risk_score,
    violations,
    brand_name: rules.name,
    auto_additions,
  };
}

export function getBrandNames(): Record<BrandKey, string> {
  return Object.fromEntries(
    Object.entries(BRAND_RULES).map(([key, val]) => [key, val.name])
  ) as Record<BrandKey, string>;
}

export function getRequiredWarnings(brand: BrandKey): string[] {
  return BRAND_RULES[brand]?.required_warnings ?? [];
}

export function getAutoDisclaimer(brand: BrandKey): string {
  return BRAND_RULES[brand]?.auto_disclaimer ?? "";
}

export function getRegulatory(brand: BrandKey): string {
  return BRAND_RULES[brand]?.regulatory ?? "";
}
