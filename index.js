const express = require("express");
const { OpenAI } = require("openai");
const cors = require("cors");
const sanitizeHtml = require("sanitize-html");
const JSON5 = require("json5");
const winston = require("winston");
require("dotenv").config();

const app = express();

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.Console(),
  ],
});

// Function to get current date in DD/MM/YYYY format
function getCurrentDate() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Static data
const staticData = {
  kyc_format: [
    {
      OVD: {
        proposer_poi_document_type: "PAN Card",
        proposer_poa_document_type: "Aadhaar Card",
        proposer_phone_number: "8970985822",
        proposer_email: "nisha.kalpathri@riskcovry.com",
      },
    },
    {
      PAN: {
        pan: "GTTPK1088Q",
        dob: "28/10/1994",
      },
    },
    {
      "CKYC Number": {
        ckyc_number: "60061639446221",
        dob: "28/10/1994",
      },
    },
  ],
  default_proposal_questions: {
    manufacturing_year: new Date().getFullYear().toString(),
    registration_number: "",
    engine_number: "234we32432",
    chassis_number: "78u781678936y6789",
    financier_name: "",
    financier_type: "",
    valid_puc: "Yes",
    puc_number: "PUC123456",
    gstin: "27AAUFM1756H1ZT",
    company_name: "UMBO IDTECH PRIVATE LIMITED",
    proposer_email: "nisha.kalpathri@riskcovry.com",
    proposer_phone_number: "8970985822",
    address: {
      address_line_1: "D/O SUBBARAO",
      address_line_2: "SHIVAJI NAGAR",
      pincode: "590001",
      city: "Belgaum",
      state: "Karnataka",
    },
    is_address_same: "Yes",
    registration_address: "",
    previous_policy_carrier_code: "",
    previous_policy_type: "",
    previous_policy_number: "",
    previous_policy_expiry_date: "",
    previous_tp_policy_start_date: "",
    previous_tp_policy_expiry_date: "",
    previous_tp_policy_carrier_code: "",
    previous_tp_policy_number: "",
    NO_PA_Cover: "",
  },
  addons: [
    "ZERO_DEPRECIATION_COVER",
    "ROAD_SIDE_ASSISTANCE",
    "ENGINE_PROTECTION",
    "PERSONAL_ACCIDENT",
    "RETURN_TO_INVOICE",
  ],
  discounts: [
    { discount_code: "ANTI_THEFT_DISCOUNT", sa: "" },
    { discount_code: "VOLUNTARY_DEDUCTIBLE", sa: "" },
    { discount_code: "NCB_PROTECTION", sa: "" },
  ],
  product_types: ["PC_COMPREHENSIVE", "PC_THIRD_PARTY", "PC_OD_ONLY"],
};

// CORS configuration
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cleanMarkdownResponse(content) {
  try {
    const cleaned = content
      .replace(/^```(json)?\s*\n|```$/g, "")
      .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, "")
      .trim();
    return JSON5.parse(cleaned);
  } catch (error) {
    logger.error("JSON parse error:", { content, error: error.message });
    throw new Error("Invalid JSON response from OpenAI");
  }
}

app.post("/api/parse", async (req, res) => {
  try {
    const { scenarios, product_code, proposal_overrides } = req.body;
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      throw new Error("At least one scenario is required");
    }
    const sanitizedScenarios = scenarios.map((s) => sanitizeHtml(s.trim()));
    const sanitizedOverrides = sanitizeHtml(proposal_overrides || {}, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const currentDate = getCurrentDate();
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const newBusinessStart = `01/01/${lastYear}`;
    const rolloverStart = `01/01/${currentYear - 7}`;
    const activeExpiryStart = new Date();
    activeExpiryStart.setDate(activeExpiryStart.getDate() - 90);
    const activeExpiryStartStr = formatDate(activeExpiryStart);
    const activeExpiryEnd = new Date();
    activeExpiryEnd.setDate(activeExpiryEnd.getDate() + 30);
    const activeExpiryEndStr = formatDate(activeExpiryEnd);
    const expiredExpiryEnd = new Date();
    expiredExpiryEnd.setDate(expiredExpiryEnd.getDate() - 91);
    const expiredExpiryEndStr = formatDate(expiredExpiryEnd);

    function formatDate(date) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const prompt = `
      Parse natural language inputs for 4W/2W insurance test cases. Return JSON with: {"scenarios": [objects], "proposal_questions": object}. Extract insurance company, product code, expiry conditions, addons, discounts, and KYC from each scenario. Each scenario generates one test case.

      Inputs:
      - Scenarios: ${JSON.stringify(sanitizedScenarios)}
      - Product Code: ${product_code || "null"}
      - Proposal Overrides: ${sanitizedOverrides}
      - Static Data: ${JSON.stringify(staticData)}
      - Current Date: ${currentDate}

      Constraints:
      - Scenarios: New Business, Not Sure, Rollover (Individual/Company, MMV & RTO change).
        - New: Manufacturing year ${currentYear} or ${lastYear}.
        - Not Sure: Registration before or after Sep 2018, with/without third-party, ownership changed/not.
        - Rollover: Registration before or after Sep 2018, policy type (Third Party/Comprehensive/SAOD), claim (Yes/No), NCB (0, 20, 25, 35, 45, 50%), expiry (Active: within 90 days of current date; Expired: as specified in scenario, e.g., "expired within X days" or "rollover less than X days").
        - Third-Party Tenure: 4W (1/3 years), 2W (1/5 years) from registration date.
        - IDV: 100000-2000000.
        - NCB: Rollover only.
      - Proposal:
        - Vehicle: Manufacturing year (registration year or -1), registration number (optional for New), engine/chassis, financier, PUC (Yes, No for negative).
        - Nominee: If Personal Accident addon.
        - Contact: Email, phone.
        - Individual: DOB (age ≥ 18), gender, title, Aadhaar, marital, PAN, occupation.
        - Company: GSTIN, name, DOB, PAN.
        - Address: Karnataka/Maharashtra, is_address_same, registration address.
        - Previous Policy: Rollover only, expiry dates match scenario.
      - Insurance Company: Extract from scenario (e.g., "HDFC") for product_code prefix, carrier_name.
      - Product Code: Use provided product_code if not null; else extract from scenario (e.g., "HDFC_2W_COMP_123") using regex /[A-Z0-9_]+/; else derive from insurer, vehicle type, and policy type (e.g., "HDFC_2W_COMPREHENSIVE").
      - Expiry: If "expired within X days" or "rollover less than X days", set expiry_days to X; else default logic.
      - Addons: If "all addons", set include_all_addons to true. If "without addons" or omitted, set specified_addons to "". If "with specified addons X", set specified_addons to array of codes. Never return [] for specified_addons.
      - Discounts: If "with discounts X", include specified discounts; if "without discounts" or omitted, set specified_discounts to "". Never return [] for specified_discounts.
      - KYC: If "kyc X" (OVD, PAN, or CKYC Number), set specified_kyc to X; else null.

      Instructions:
      - Scenarios fields: testcase_id (e.g., "[INSURANCE_COMPANY]_[VEHICLE_TYPE]_ROLLOVER_01"), journey_type, product_code, is_inspection_required, previous_ncb, manufacturing_year, vehicle_type, claim_taken, ownership_changed, idv, insurance_company, expiry_days (number or null), include_all_addons (boolean), specified_addons (array or ""), specified_discounts (array or ""), specified_kyc (string or null).
      - Dates: Calculate relative to ${currentDate}, format DD/MM/YYYY.
        - registration_date: New (${newBusinessStart}-${currentDate}), Rollover/Not Sure (${rolloverStart}-${lastYear}/12/31).
        - previous_expiry_date: For Rollover with "expired within X days" or "rollover less than X days", set within X days before ${currentDate}; else active (${activeExpiryStartStr}-${activeExpiryEndStr}) or expired (before ${expiredExpiryEndStr}).
      - Apply proposal overrides to default_proposal_questions.
      - Defaults: previous_ncb="0%", is_inspection_required="No", idv=500000, valid_puc="Yes".
      - Output: Valid JSON, no Markdown.
    `;

    logger.info("Sending /api/parse request", {
      scenarios: sanitizedScenarios,
      product_code,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            'Output valid JSON only, no explanations, no Markdown formatting. Return an object with "scenarios" (array) and "proposal_questions" (object). Prioritize provided product_code, then extract from scenario, then derive. Set expiry_days for "expired within X days" or "rollover less than X days". Include include_all_addons for "all addons". Set specified_discounts to "" for "without discounts" or omitted; never []. Set specified_addons to "" for "without addons" or omitted; never []. Set specified_kyc for "kyc X". Dates must be relative to current date.',
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    const rawContent = response.choices[0].message.content;
    logger.info("Raw OpenAI response (/api/parse)", { rawContent });
    const parsedContent = cleanMarkdownResponse(rawContent);
    logger.info("Parsed response (/api/parse)", { parsedContent });

    if (!parsedContent.scenarios || !parsedContent.proposal_questions) {
      throw new Error(
        "Response missing required fields: scenarios or proposal_questions"
      );
    }
    res.json(parsedContent);
  } catch (error) {
    logger.error("Parse endpoint error", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { scenarios, proposal_questions } = req.body;
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      throw new Error("Scenarios are required");
    }

    const currentDate = getCurrentDate();
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const newBusinessStart = `01/01/${lastYear}`;
    const rolloverStart = `01/01/${currentYear - 7}`;
    const pucStart = new Date();
    const pucEnd = new Date(pucStart.setMonth(pucStart.getMonth() + 12));
    const pucEndStr = formatDate(pucEnd);
    const activeExpiryStart = new Date();
    activeExpiryStart.setDate(activeExpiryStart.getDate() - 90);
    const activeExpiryStartStr = formatDate(activeExpiryStart);
    const activeExpiryEnd = new Date();
    activeExpiryEnd.setDate(activeExpiryEnd.getDate() + 30);
    const activeExpiryEndStr = formatDate(activeExpiryEnd);
    const expiredExpiryEnd = new Date();
    expiredExpiryEnd.setDate(expiredExpiryEnd.getDate() - 91);
    const expiredExpiryEndStr = formatDate(expiredExpiryEnd);

    function formatDate(date) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const prompt = `
      Generate 4W/2W insurance test data. Return JSON array of objects with fields: Testcase_id, category, journey_type, registration_number, make_model, variant, registration_date, rto, owned_by, is_ownership_changed, previous_expiry_date, offset_previous_expiry_date, previous_insurer, previous_tp_expiry_date, offset_previous_tp_expiry_date, previous_tp_insurer, not_sure, know_previous_tp_expiry_date, not_sure_previous_tp_expiry_date, claim_taken, previous_ncb, product_code, customer_name, contact_number, idv, NCB_two, addons, discounts, select_tab, email, kyc, kyc_verification, proposal_questions, is_inspection_required, carrier_name.

      Inputs:
      - Scenarios: ${JSON.stringify(scenarios)}
      - Proposal Questions: ${JSON.stringify(proposal_questions)}
      - Static Data: ${JSON.stringify(staticData)}
      - Current Date: ${currentDate}

      Constraints:
      - Scenarios: New Business, Not Sure, Rollover (Individual/Company, MMV & RTO change).
        - New: Manufacturing year ${currentYear} or ${lastYear}.
        - Not Sure: Registration before or after Sep 2018, with/without third-party, ownership changed/not.
        - Rollover: Registration before or after Sep 2018, policy type (Third Party/Comprehensive/SAOD), claim (Yes/No), NCB (0, 20, 25, 35, 45, 50%), expiry as per expiry_days or default logic.
        - Third-Party Tenure: 4W (1/3 years), 2W (1/5 years) from registration_date.
        - IDV: 100000-2000000.
        - NCB: Rollover only.
      - Proposal:
        - Vehicle: Manufacturing year (registration year or -1), registration number optional for New, engine/chassis, financier, PUC (Yes, No for blocked negative).
        - Nominee: If Personal Accident addon.
        - Individual: DOB (age ≥ 18).
        - Company: GSTIN, name.
        - Previous Policy: Rollover only, expiry dates match previous.
      - Others:
        - KYC: Randomly select ONE option from staticData.kyc_format (OVD, PAN, or CKYC Number) for each test case if not specified_kyc in scenario.
        - Address: Karnataka/Maharashtra.
        - PUC Expiry: 6-12 months from ${currentDate}.
        - Insurance Company: From scenarios for carrier_name, product_code prefix.
        - Discounts: From scenarios.specified_discounts if non-empty array, format as [{"discount_code": "CODE", "sa": ""}]; else "". Never return [].
        - Addons: From scenarios.specified_addons if non-empty array or include_all_addons true, format as [{"insurance_cover_code": "CODE"}]; else "". Never return [].

      Instructions:
      - One test case per scenario.
      - Addons format: Array of objects, e.g., [{"insurance_cover_code": "ZERO_DEPRECIATION_COVER"}] if include_all_addons or specified_addons non-empty; else "". Never [].
        - Comprehensive/SAOD: If include_all_addons, include all from staticData.addons; else use specified_addons if provided; else "".
        - Third Party: Only PERSONAL_ACCIDENT if opted; else "".
      - Discounts format: Array of objects, e.g., [{"discount_code": "ANTI_THEFT_DISCOUNT", "sa": ""}] if specified_discounts non-empty; else "". Never [].
      - KYC format: Array with ONE object, e.g., [{"OVD": {...}}], use specified_kyc if provided.
      - Proposal Questions format: Flattened object, e.g., {"manufacturing_year": "${currentYear}", ...}.
        - puc_expiry: 6-12 months after ${currentDate} (up to ${pucEndStr}).
        - previous_policy_expiry_date, previous_tp_policy_expiry_date: Match previous_expiry_date, previous_tp_expiry_date for Rollover.
      - Dates: Calculate relative to ${currentDate}, format DD/MM/YYYY.
        - registration_date: New (${newBusinessStart}-${currentDate}), Rollover/Not Sure (${rolloverStart}-${lastYear}/12/31).
        - previous_expiry_date: For Rollover with expiry_days, set within expiry_days before ${currentDate}; else active (${activeExpiryStartStr}-${activeExpiryEndStr}) or expired (before ${expiredExpiryEndStr}).
      - Defaults: make_model="HONDA CITY" (4W) or "HONDA ACTIVA" (2W), variant="Standard", rto="KA01", owned_by="Individual", customer_name="Nisha", contact_number="8970985822", email="nisha.kalpathri@riskcovry.com", category="four_wheeler" or "two_wheeler", kyc_verification="Pending".
      - select_tab: If product_code includes "THIRD_PARTY", set to "Third Party"; else "Comprehensive".
      - Output: Valid JSON array, no Markdown.
    `;

    logger.info("Sending /api/generate request", { scenarios });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            'Output valid JSON array only, no explanations, no Markdown formatting. Return an array of objects with fields as specified. Ensure addons, kyc, discounts, and proposal_questions formats are exact. KYC must include one randomly selected option if not specified_kyc. Discounts "" if specified_discounts empty or not provided; never []. Addons "" if specified_addons empty and include_all_addons false; never []. Use expiry_days for previous_expiry_date if provided. Dates must be relative to current date.',
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 6000,
    });

    const rawContent = response.choices[0].message.content;
    logger.info("Raw OpenAI response (/api/generate)", { rawContent });
    const parsedContent = cleanMarkdownResponse(rawContent);
    logger.info("Parsed response (/api/generate)", { parsedContent });

    if (!Array.isArray(parsedContent)) {
      throw new Error("Response must be an array");
    }
    res.json(parsedContent);
  } catch (error) {
    logger.error("Generate endpoint error", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

const port =
  process.env.NODE_ENV === "production" ? process.env.PORT || 80 : 3000;
app.listen(port, () => logger.info(`Server running on port ${port}`));
