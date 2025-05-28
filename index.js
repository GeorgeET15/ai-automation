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

// Insurer mapping from CSV
const insurerMap = {
  BAJAJ: "Bajaj Allianz General Insurance Co. Ltd.",
  BHARTI: "Bharti AXA General Insurance Co. Ltd.",
  CHOLAMANDALAM: "Cholamandalam MS General Insurance Co. Ltd.",
  FUTURE: "Future Generali India Insurance Co. Ltd.",
  HDFC: "HDFC ERGO General Insurance Co. Ltd.",
  ICICI: "ICICI Lombard General Insurance Co. Ltd.",
  IFFCO: "IFFCO Tokio General Insurance Co. Ltd.",
  KOTAK: "Kotak Mahindra General Insurance Co. Ltd.",
  LIBERTY: "Liberty General Insurance Ltd.",
  MAGMA: "Magma HDI General Insurance Co. Ltd.",
  NATIONAL: "National Insurance Co. Ltd.",
  RELIANCE: "Reliance General Insurance Co. Ltd.",
  ROYAL: "Royal Sundaram General Insurance Co. Ltd.",
  SHRIRAM: "Shriram General Insurance Co. Ltd.",
  SBI: "SBI General Insurance Co. Ltd.",
  TATA: "Tata AIG General Insurance Co. Ltd.",
  NEWINDIA: "The New India Assurance Co. Ltd.",
  ORIENTAL: "The Oriental Insurance Co. Ltd.",
  UNITED: "United India Insurance Co. Ltd.",
  UNIVERSAL: "Universal Sompo General Insurance Co. Ltd.",
  GODIGIT: "Go Digit General Insurance Ltd.",
  ACKO: "Acko General Insurance Ltd.",
  ZUNO: "Zuno General Insurance Ltd.",
  RAHEJA: "Raheja QBE General Insurance Co. Ltd.",
  NAVI: "Navi General Insurance Ltd.",
};

const insurerList = Object.values(insurerMap);

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
    proposer_first_name: "Nisha",
    proposer_last_name: "Kalpathri",
    proposer_salutation: "Ms",
    proposer_dob: "28/10/1994",
    proposer_age: "30",
    proposer_alternate_number: "",
    proposer_marital_status: "Single",
    proposer_pan: "GTTPK1088Q",
    proposer_gstin: "",
    proposer_annual_income: "500000",
    proposer_occupation: "Engineer",
    proposer_title: "Ms",
    company_details: "",
    company_date_of_incorporation: "01/01/2015",
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

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    date = new Date("2024-01-01");
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getRandomDate(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate) || isNaN(endDate)) {
    return new Date("2024-01-01");
  }
  const timeDiff = endDate - startDate;
  const randomTime = startDate.getTime() + Math.random() * timeDiff;
  const result = new Date(randomTime);
  return isNaN(result) ? new Date("2024-01-01") : result;
}

function generateRegistrationNumber(rto = "KA01") {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const letterPart = Array(2)
    .fill()
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join("");
  const numberPart = Array(4)
    .fill()
    .map(() => numbers[Math.floor(Math.random() * numbers.length)])
    .join("");
  return `${rto}${letterPart}${numberPart}`;
}

app.post("/api/parse", async (req, res) => {
  try {
    const { scenarios, proposal_overrides } = req.body;
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      throw new Error("At least one scenario is required");
    }
    if (!scenarios.every((s) => s.text && s.product_code)) {
      throw new Error("Each scenario must have text and a product code");
    }
    const sanitizedScenarios = scenarios.map((s) => ({
      text: sanitizeHtml(s.text.trim()),
      product_code: sanitizeHtml(s.product_code.trim()),
    }));
    const sanitizedOverrides = sanitizeHtml(proposal_overrides || {}, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const currentDate = formatDate(new Date("2025-05-28"));
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const newBusinessStart = `01/01/${lastYear}`;
    const rolloverStart = `01/01/${currentYear - 7}`;
    const activeExpiryStart = new Date("2025-05-28");
    activeExpiryStart.setDate(activeExpiryStart.getDate() - 90);
    const activeExpiryStartStr = formatDate(activeExpiryStart);
    const activeExpiryEnd = new Date("2025-05-28");
    activeExpiryEnd.setDate(activeExpiryEnd.getDate() + 30);
    const activeExpiryEndStr = formatDate(activeExpiryEnd);
    const expiredExpiryEnd = new Date("2025-05-28");
    expiredExpiryEnd.setDate(expiredExpiryEnd.getDate() - 91);
    const expiredExpiryEndStr = formatDate(expiredExpiryEnd);

    const prompt = `
      Parse natural language inputs for 4W/2W insurance test cases. Return JSON with: {"scenarios": [objects], "proposal_questions": object}. Each scenario has text and product_code. Extract expiry conditions, addons, discounts, KYC, and ownership from scenario text. Derive insurance company and vehicle type from product_code (no fixed format; extract 2W/4W if present, else default to 2W).

      Inputs:
      - Scenarios: ${JSON.stringify(sanitizedScenarios)}
      - Proposal Overrides: ${sanitizedOverrides}
      - Static Data: ${JSON.stringify(staticData)}
      - Insurer Mapping: ${JSON.stringify(insurerMap)}
      - Current Date: ${currentDate}

      Constraints:
      - Scenarios: New Business, Not Sure, Rollover (Individual/Company).
        - New: Manufacturing year ${currentYear} or ${lastYear}.
        - Not Sure: Registration before or after Sep 2018, with/without third-party, ownership changed/not.
        - Rollover: Registration before or after Sep 2018, policy type (Third Party/Comprehensive/SAOD), claim (Yes/No), NCB (0, 20, 25, 35, 45, 50%), expiry (Active: within 90 days; Expired: as specified).
        - Third-Party Tenure: 4W (1/3 years), 2W (1/5 years) from registration date.
        - IDV: 100000-2000000.
        - NCB: Rollover only.
      - Proposal:
        - Vehicle: Manufacturing year (registration year or -1), registration number (generate KA01XX1234 format), engine/chassis, financier, PUC (Yes, No for negative).
        - Nominee: If Personal Accident addon.
        - Contact: Email, phone.
        - Individual: Include CUSTOMER_QUESTIONS, exclude COMPANY_QUESTIONS.
        - Company: Include COMPANY_QUESTIONS, exclude CUSTOMER_QUESTIONS.
        - Address: Karnataka/Maharashtra, is_address_same, registration address.
        - Previous Policy: Rollover only, expiry dates match scenario, previous_insurer differs from current insurer.
      - Insurance Company: Use full name from insurerMap for carrier_name, previous_insurer (different for Rollover).
      - Vehicle Type: Extract 2W/4W (case-insensitive) from product_code, else default to 2W.
      - Expiry: For Rollover, if "expired within X days" or "rollover less than X days", set expiry_days to X; ensure previous_expiry_date is at least 1 year after manufacturing_year.
      - Addons: If "all addons", set include_all_addons to true. If "without addons" or omitted, set specified_addons to "". If "with specified addons X", set specified_addons to array of codes. Never return [].
      - Discounts: If "with discounts X", include specified discounts; if "without discounts" or omitted, set specified_discounts to "". Never return [].
      - KYC: If "kyc X" (OVD, PAN, or CKYC Number), set specified_kyc to X; else null.
      - Proposal Questions: Apply overrides, exclude based on ownership:
        - Exclude PREVIOUS_POLICY_QUESTIONS for New Business or Not Sure (Comprehensive/Third Party).
        - Exclude COMPANY_QUESTIONS if owned_by is "individual" or null.
        - Exclude CUSTOMER_QUESTIONS if owned_by is "company".
        - Exclude NOMINEE_QUESTIONS if PERSONAL_ACCIDENT is not present or owned_by is "company".
        - Exclude ADDITIONAL_QUESTION if PERSONAL_ACCIDENT is present or owned_by is "company".
        - Exclude ADDITIONAL_OD_QUESTION for New Business.
        - Set registration_number to a generated value (e.g., KA01XX1234).

      Instructions:
      - Scenarios fields: testcase_id (e.g., "[INSURER]_[VEHICLE_TYPE]_ROLLOVER_01"), journey_type, product_code, is_inspection_required, previous_ncb, manufacturing_year, vehicle_type, claim_taken, ownership_changed, idv, insurance_company, expiry_days (number or null), include_all_addons (boolean), specified_addons (array or ""), specified_discounts (array or ""), specified_kyc (string or null), owned_by ("Individual" or "Company").
      - Dates: Calculate relative to ${currentDate}, format DD/MM/YYYY.
        - registration_date: New (${newBusinessStart}-${currentDate}), Rollover/Not Sure (${rolloverStart}-${lastYear}/12/31).
        - previous_expiry_date: For Rollover with expiry_days, set within X days before ${currentDate}, at least 1 year after manufacturing_year; else active (${activeExpiryStartStr}-${activeExpiryEndStr}) or expired (before ${expiredExpiryEndStr}).
      - Apply proposal overrides to default_proposal_questions.
      - Defaults: previous_ncb="0%", is_inspection_required="No", idv=500000, valid_puc="Yes", owned_by="Individual".
      - Output: Valid JSON, no Markdown.
    `;

    logger.info("Sending /api/parse request", {
      scenarios: sanitizedScenarios,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            'Output valid JSON only, no explanations, no Markdown formatting. Return an object with "scenarios" (array) and "proposal_questions" (object). Extract vehicle_type (case-insensitive 2W/4W) from product_code, default to 2W if not found. Set expiry_days for "expired within X days" or "rollover less than X days". Include include_all_addons for "all addons". Set specified_discounts to "" for "without discounts"; never []. Set specified_addons to "" for "without addons"; never []. Set specified_kyc for "kyc X". Set owned_by from scenario or default to "Individual". Use full insurer names from mapping. Ensure previous_insurer differs from current insurer for Rollover. Ensure previous_expiry_date is at least 1 year after manufacturing_year for Rollover. Set registration_number to generated value (KA01XX1234 format).',
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
    parsedContent.proposal_questions.registration_number =
      generateRegistrationNumber();
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

    const currentDate = formatDate(new Date("2025-05-28"));
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const newBusinessStart = `01/01/${lastYear}`;
    const rolloverStart = `01/01/${currentYear - 7}`;
    const pucStart = new Date("2025-05-28");
    const pucEnd = new Date(pucStart);
    pucEnd.setMonth(pucEnd.getMonth() + 12);
    const pucEndStr = formatDate(pucEnd);
    const activeExpiryStart = new Date("2025-05-28");
    activeExpiryStart.setDate(activeExpiryStart.getDate() - 90);
    const activeExpiryStartStr = formatDate(activeExpiryStart);
    const activeExpiryEnd = new Date("2025-05-28");
    activeExpiryEnd.setDate(activeExpiryEnd.getDate() + 30);
    const activeExpiryEndStr = formatDate(activeExpiryEnd);
    const expiredExpiryEnd = new Date("2025-05-28");
    expiredExpiryEnd.setDate(expiredExpiryEnd.getDate() - 91);
    const expiredExpiryEndStr = formatDate(expiredExpiryEnd);

    const NOMINEE_QUESTIONS = [
      "nominee_salutation",
      "nominee_last_name",
      "nominee_first_name",
      "nominee_dob",
      "nominee_age",
      "nominee_gender",
      "nominee_relation",
      "nominee_details",
    ];
    const PREVIOUS_POLICY_QUESTIONS = [
      "previous_policy_details",
      "previous_policy_status",
      "previous_policy_claim_taken",
      "previous_policy_expiry_period",
      "previous_policy_expiry_date",
      "previous_policy_ncb",
      "previous_policy_carrier_code",
      "previous_policy_number",
      "previous_policy_type",
      "previous_tp_policy_expiry_date",
      "previous_tp_policy_start_date",
      "previous_tp_policy_number",
      "previous_tp_policy_carrier_code",
    ];
    const COMPANY_QUESTIONS = [
      "company_details",
      "company_name",
      "company_gstin",
      "company_date_of_incorporation",
    ];
    const CUSTOMER_QUESTIONS = [
      "individual_details",
      "proposer_first_name",
      "proposer_last_name",
      "proposer_salutation",
      "proposer_dob",
      "proposer_age",
      "proposer_alternate_number",
      "proposer_marital_status",
      "proposer_pan",
      "proposer_gstin",
      "proposer_annual_income",
      "proposer_occupation",
      "proposer_title",
    ];
    const ADDITIONAL_QUESTION = ["additional_info", "NO_PA_Cover"];
    const ADDITIONAL_OD_QUESTION = ["additional_od_info"];
    const NOT_SURE_OD_QUESTIONS = [
      "previous_policy_expiry_date",
      "previous_policy_type",
      "previous_policy_expiry_period",
      "previous_policy_number",
      "previous_policy_carrier_code",
    ];

    const testData = scenarios.map((scenario) => {
      const productCodeUpper = scenario.product_code.toUpperCase();
      const vehicleType = productCodeUpper.includes("2W")
        ? "2W"
        : productCodeUpper.includes("4W")
        ? "4W"
        : "2W";
      const insurerPrefix = scenario.product_code.split("_")[0].toUpperCase();
      const currentInsurer = insurerMap[insurerPrefix] || insurerPrefix;

      let previousInsurer = currentInsurer;
      if (scenario.journey_type === "Rollover") {
        const availableInsurers = insurerList.filter(
          (insurer) => insurer !== currentInsurer
        );
        previousInsurer =
          availableInsurers[
            Math.floor(Math.random() * availableInsurers.length)
          ];
      }

      let registrationDate, previousExpiryDate, previousTpExpiryDate, pucExpiry;
      const isNewBusiness = scenario.journey_type === "New Business";
      if (isNewBusiness) {
        registrationDate = getRandomDate(newBusinessStart, currentDate);
      } else {
        registrationDate = getRandomDate(rolloverStart, `31/12/${lastYear}`);
      }

      const manufacturingYear =
        scenario.manufacturing_year ||
        new Date(registrationDate).getFullYear().toString();
      if (scenario.journey_type === "Rollover") {
        if (scenario.expiry_days !== null) {
          const startDate = new Date("2025-05-28");
          startDate.setDate(startDate.getDate() - scenario.expiry_days);
          const endDate = new Date("2025-05-28");
          endDate.setDate(endDate.getDate() - 1);
          previousExpiryDate = getRandomDate(startDate, endDate);
          const minExpiryDate = new Date(parseInt(manufacturingYear));
          minExpiryDate.setFullYear(minExpiryDate.getFullYear() + 1);
          if (previousExpiryDate < minExpiryDate || isNaN(previousExpiryDate)) {
            previousExpiryDate = getRandomDate(minExpiryDate, currentDate);
          }
        } else {
          const isActive = Math.random() > 0.5;
          const minExpiryDate = new Date(parseInt(manufacturingYear));
          minExpiryDate.setFullYear(minExpiryDate.getFullYear() + 1);
          previousExpiryDate = getRandomDate(
            isActive ? activeExpiryStartStr : minExpiryDate,
            isActive ? activeExpiryEndStr : expiredExpiryEndStr
          );
        }
        const tenureYears =
          vehicleType === "4W"
            ? Math.random() > 0.5
              ? 1
              : 3
            : Math.random() > 0.5
            ? 1
            : 5;
        previousTpExpiryDate = new Date(registrationDate);
        previousTpExpiryDate.setFullYear(
          previousTpExpiryDate.getFullYear() + tenureYears
        );
      } else {
        previousExpiryDate = "";
        previousTpExpiryDate = "";
      }

      const pucStart = new Date("2025-05-28");
      const pucMonths = 6 + Math.floor(Math.random() * 7);
      pucExpiry = new Date(pucStart);
      pucExpiry.setMonth(pucExpiry.getMonth() + pucMonths);

      const rejectedQuestionKeys = [];
      const isNotSure =
        scenario.journey_type === "Not Sure" &&
        (scenario.product_code.includes("COMPREHENSIVE") ||
          scenario.product_code.includes("THIRD_PARTY"));
      const ownedBy = ["Individual", "Company"].includes(scenario.owned_by)
        ? scenario.owned_by
        : "Individual";
      const hasPersonalAccident =
        (Array.isArray(scenario.specified_addons) &&
          scenario.specified_addons.includes("PERSONAL_ACCIDENT")) ||
        (scenario.include_all_addons &&
          staticData.addons.includes("PERSONAL_ACCIDENT"));

      if (isNewBusiness || isNotSure) {
        rejectedQuestionKeys.push(...PREVIOUS_POLICY_QUESTIONS);
      }
      if (isNotSure) {
        rejectedQuestionKeys.push(...NOT_SURE_OD_QUESTIONS);
      }
      if (ownedBy === "Individual") {
        rejectedQuestionKeys.push(...COMPANY_QUESTIONS);
      }
      if (ownedBy === "Company") {
        rejectedQuestionKeys.push(...CUSTOMER_QUESTIONS);
      }
      if (!hasPersonalAccident || ownedBy === "Company") {
        rejectedQuestionKeys.push(...NOMINEE_QUESTIONS);
      }
      if (hasPersonalAccident || ownedBy === "Company") {
        rejectedQuestionKeys.push(...ADDITIONAL_QUESTION);
      }
      if (isNewBusiness) {
        rejectedQuestionKeys.push(...ADDITIONAL_OD_QUESTION);
      }

      const filteredProposalQuestions = { ...proposal_questions };
      rejectedQuestionKeys.forEach((key) => {
        delete filteredProposalQuestions[key];
      });

      const registrationNumber = generateRegistrationNumber();

      return {
        Testcase_id:
          scenario.testcase_id ||
          `${currentInsurer}_${vehicleType}_${scenario.journey_type.toUpperCase()}_01`,
        category: vehicleType === "4W" ? "four_wheeler" : "two_wheeler",
        journey_type: scenario.journey_type || "Rollover",
        registration_number: registrationNumber,
        make_model: vehicleType === "4W" ? "HONDA CITY" : "HONDA ACTIVA",
        variant: "Standard",
        registration_date: formatDate(registrationDate),
        rto: "KA01",
        owned_by: ownedBy,
        is_ownership_changed: scenario.ownership_changed || "No",
        previous_expiry_date: previousExpiryDate
          ? formatDate(previousExpiryDate)
          : "",
        offset_previous_expiry_date: scenario.expiry_days
          ? String(scenario.expiry_days)
          : "",
        previous_insurer: previousInsurer,
        previous_tp_expiry_date: previousTpExpiryDate
          ? formatDate(previousTpExpiryDate)
          : "",
        offset_previous_tp_expiry_date: "",
        previous_tp_insurer: previousInsurer,
        not_sure: "",
        know_previous_tp_expiry_date: "Yes",
        not_sure_previous_tp_expiry_date: "",
        claim_taken: scenario.claim_taken || "No",
        previous_ncb: scenario.previous_ncb || "0%",
        product_code: scenario.product_code,
        customer_name:
          ownedBy === "Individual" ? "Nisha" : "UMBO IDTECH PRIVATE LIMITED",
        contact_number: "8970985822",
        idv: scenario.idv || (vehicleType === "2W" ? 100000 : 500000),
        NCB_two: "",
        addons: scenario.specified_addons
          ? scenario.specified_addons.map((code) => ({
              insurance_cover_code: code,
            }))
          : scenario.include_all_addons
          ? staticData.addons.map((code) => ({ insurance_cover_code: code }))
          : "",
        discounts: scenario.specified_discounts
          ? scenario.specified_discounts.map((code) => ({
              discount_code: code,
              sa: "",
            }))
          : "",
        select_tab: scenario.product_code.includes("THIRD_PARTY")
          ? "Third Party"
          : "Comprehensive",
        email: "nisha.kalpathri@riskcovry.com",
        kyc: scenario.specified_kyc
          ? [
              staticData.kyc_format.find(
                (opt) =>
                  Object.keys(opt)[0].toLowerCase() ===
                  scenario.specified_kyc.toLowerCase()
              ),
            ]
          : [
              staticData.kyc_format[
                Math.floor(Math.random() * staticData.kyc_format.length)
              ],
            ],
        kyc_verification: "Pending",
        proposal_questions: {
          ...filteredProposalQuestions,
          registration_number: registrationNumber,
        },
        is_inspection_required: scenario.is_inspection_required || "No",
        carrier_name: currentInsurer,
      };
    });

    res.json(testData);
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
