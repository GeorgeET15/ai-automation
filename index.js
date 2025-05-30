const express = require("express");
const { OpenAI } = require("openai");
const cors = require("cors");
const sanitizeHtml = require("sanitize-html");
const JSON5 = require("json5");
const winston = require("winston");
const {
  productData,
  getVehicleTypeAndInsurer,
  insurerCodeToName,
} = require("./data");
require("dotenv").config();

const app = express();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.Console(),
  ],
});

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
    engine_number: "ENG234WE32432",
    chassis_number: "78U781678936Y6789",
    financier_name: "",
    financier_type: "",
    tyre_details: "",
    rim_details: "",
    nominee_first_name: "John",
    nominee_last_name: "Doe",
    nominee_dob: "01/01/1990",
    nominee_relation: "Spouse",
    proposer_email: "nisha.kalpathri@riskcovry.com",
    proposer_phone_number: "8970985822",
    proposer_first_name: "Nisha",
    proposer_last_name: "Kalpathri",
    proposer_dob: "28/10/1994",
    proposer_gender: "Female",
    proposer_title: "Ms",
    proposer_marital_status: "Single",
    proposer_occupation: "Professional",
    proposer_pan: "GTTPK1088Q",
    company_gstin: "27AAUFM1756H1ZT",
    company_name: "UMBO IDTECH PRIVATE LIMITED",
    address: {
      address_line_1: "D/O SUBBARAO",
      address_line_2: "SHIVAJI NAGAR",
      pincode: "590001",
      city: "Belgaum",
      state: "Karnataka",
    },
    is_address_same: "Yes",
    registration_address: {
      address_line_1: "",
      address_line_2: "",
      pincode: "",
      city: "",
      state: "",
    },
    previous_policy_carrier_code: "",
    previous_policy_type: null,
    previous_policy_number: "",
    previous_tp_policy_number: "",
    previous_tp_policy_carrier_code: "",
    previous_tp_policy_expiry_date: "",
    previous_tp_policy_start_date: "",
    previous_policy_expiry_date: "",
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
    logger.debug("Raw OpenAI response content", { content });
    if (!content || content.trim() === "") {
      logger.error("Empty or null OpenAI response content");
      throw new Error("Empty or null OpenAI response");
    }
    let cleaned = content
      .replace(/^```(json)?\s*\n|```$/g, "")
      .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, "")
      .trim();
    try {
      return JSON5.parse(cleaned);
    } catch (jsonError) {
      logger.warn(
        "Initial JSON5 parse failed, attempting to extract valid JSON",
        {
          error: jsonError.message,
          cleanedContent: cleaned,
        }
      );
      const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        try {
          return JSON5.parse(cleaned);
        } catch (secondError) {
          logger.error("Failed to parse extracted JSON", {
            error: secondError.message,
            extractedContent: cleaned,
          });
          throw new Error(
            "Invalid JSON response from OpenAI after extraction attempt"
          );
        }
      } else {
        logger.error("No valid JSON found in response", {
          cleanedContent: cleaned,
        });
        throw new Error("No valid JSON found in OpenAI response");
      }
    }
  } catch (error) {
    logger.error("cleanMarkdownResponse error", {
      error: error.message,
      content,
    });
    throw new Error(`Invalid JSON response from OpenAI: ${error.message}`);
  }
}

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    date = new Date("2025-05-28");
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getRandomDate(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
    logger.warn("Invalid date range, returning current date", { start, end });
    return new Date("2025-05-28");
  }
  const timeDiff = endDate.getTime() - startDate.getTime();
  const randomTime = startDate.getTime() + Math.random() * timeDiff;
  const result = new Date(randomTime);
  return isNaN(result) ? new Date("2025-05-28") : result;
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    logger.warn("Invalid date string, returning null", { dateStr });
    return null;
  }
  const [day, month, year] = dateStr.split("/").map(Number);
  if (!day || !month || !year || year < 1900 || year > 2025) {
    logger.warn("Invalid date components, returning null", { dateStr });
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (isNaN(date)) {
    logger.warn("Invalid parsed date, returning null", { dateStr });
    return null;
  }
  return date;
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

function generateEngineNumber() {
  return `ENG${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

function generateChassisNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array(17)
    .fill()
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
}

const HARD_CODED_PAN = "GTTPK1088Q";
const HARD_CODED_DOB = "28/10/1994";

function generatePanNumber() {
  return HARD_CODED_PAN;
}

function generateGstin() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const stateCode = "27";
  const panPart = generatePanNumber();
  const entityNumber = numbers[Math.floor(Math.random() * numbers.length)];
  const z = "Z";
  const checkDigit = numbers[Math.floor(Math.random() * numbers.length)];
  return `${stateCode}${panPart}${entityNumber}${z}${checkDigit}`;
}

function preprocessScenario(text) {
  const hints = {};
  const ageMatch = text.match(/(\d+)\s*(?:year|years)\s*old/i);
  if (ageMatch) {
    hints.vehicle_age = parseInt(ageMatch[1]);
  }
  const expiryMatch = text.match(/(?:expired|more than)\s*(\d+)\s*days/i);
  if (expiryMatch) {
    hints.expiry_days = parseInt(expiryMatch[1]);
  }
  if (/all addons/i.test(text)) {
    hints.include_all_addons = true;
  } else if (/without addons/i.test(text)) {
    hints.specified_addons = "";
  } else {
    const addonMatch = text.match(/with\s*([^,]+?)\s*addon/i);
    if (addonMatch) {
      hints.specified_addons = addonMatch[1]
        .split(/and|,/i)
        .map((s) => s.trim().toUpperCase())
        .filter((a) => staticData.addons.includes(a));
    }
  }
  if (/without discounts/i.test(text)) {
    hints.specified_discounts = "";
  } else {
    const discountMatch = text.match(/with\s*([^,]+?)\s*discount/i);
    if (discountMatch) {
      hints.specified_discounts = discountMatch[1]
        .split(/and|,/i)
        .map((s) => s.trim().toUpperCase())
        .filter((d) =>
          staticData.discounts.some((disc) => disc.discount_code === d)
        );
    }
  }
  const modelMatch = text.match(/model\s*(\w+)/i);
  if (modelMatch) {
    hints.model = modelMatch[1].toUpperCase();
  }
  const variantMatch = text.match(/variant\s*(\w+)/i);
  if (variantMatch) {
    hints.variant = variantMatch[1].toUpperCase();
  }
  if (/new\s*(?:business|vehicle)/i.test(text)) {
    hints.journey_type = "New Business";
  } else if (/rollover/i.test(text) || /expired/i.test(text)) {
    hints.journey_type = "Rollover";
  }
  if (/company/i.test(text)) {
    hints.owned_by = "Company";
  } else if (/individual/i.test(text)) {
    hints.owned_by = "Individual";
  }
  return hints;
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

    const enrichedScenarios = scenarios.map((s) => {
      const sanitizedText = sanitizeHtml(s.text.trim());
      const sanitizedProductCode = sanitizeHtml(s.product_code.trim());
      try {
        const { vehicleType, insurerName } =
          getVehicleTypeAndInsurer(sanitizedProductCode);
        return {
          text: sanitizedText,
          product_code: sanitizedProductCode,
          vehicle_type: vehicleType,
          insurance_company: insurerName,
          hints: preprocessScenario(sanitizedText),
        };
      } catch (error) {
        logger.error("Invalid product code:", {
          product_code: sanitizedProductCode,
          error: error.message,
        });
        throw new Error(`Invalid product code: ${sanitizedProductCode}`);
      }
    });

    const sanitizedOverrides = sanitizeHtml(proposal_overrides || {}, {
      allowedTags: [],
      allowedAttributes: {},
    });
    const currentDate = formatDate(new Date("2025-05-28"));
    const currentYear = new Date().getFullYear();

    const availableInsurers = [
      ...new Set(
        Object.values(productData.map((p) => p.insurance_company_code))
      ),
    ].map((code) => ({
      code,
      name: insurerCodeToName[code] || "Unknown Insurer",
    }));

    const outputSchema = {
      scenarios: [
        {
          testcase_id: "string",
          journey_type: "string",
          product_code: "string",
          is_inspection_required: "string",
          previous_ncb: "string",
          manufacturing_year: "string",
          vehicle_type: "string",
          claim_taken: "string",
          ownership_changed: "string",
          idv: "number",
          insurance_company: "string",
          expiry_days: "number|null",
          include_all_addons: "boolean",
          specified_addons: "array|string",
          specified_discounts: "array|string",
          specified_kyc: "string|null",
          owned_by: "string",
          model: "string|null",
          variant: "string|null",
          registration_date: "string",
        },
      ],
      proposal_questions: {
        manufacturing_year: "string",
        registration_number: "string",
        engine_number: "string",
        chassis_number: "string",
        financier_name: "string",
        financier_type: "string",
        tyre_details: "string",
        rim_details: "string",
        nominee_first_name: "string",
        nominee_last_name: "string",
        nominee_dob: "string",
        nominee_relation: "string",
        proposer_email: "string",
        proposer_phone_number: "string",
        proposer_first_name: "string",
        proposer_last_name: "string",
        proposer_dob: "string",
        proposer_gender: "string",
        proposer_title: "string",
        proposer_marital_status: "string",
        proposer_occupation: "string",
        proposer_pan: "string",
        company_gstin: "string",
        company_name: "string",
        address: {
          address_line_1: "string",
          address_line_2: "string",
          pincode: "string",
          city: "string",
          state: "string",
        },
        is_address_same: "string",
        registration_address: {
          address_line_1: "string",
          address_line_2: "string",
          pincode: "string",
          city: "string",
          state: "string",
        },
        previous_policy_carrier_code: "string",
        previous_policy_type: "string|null",
        previous_policy_number: "string",
        previous_tp_policy_number: "string",
        previous_tp_policy_carrier_code: "string",
        previous_tp_policy_expiry_date: "string",
        previous_tp_policy_start_date: "string",
        previous_policy_expiry_date: "string",
        NO_PA_Cover: "string",
      },
    };

    const prompt = `
      Parse the natural language scenario for 4W/2W insurance test cases, extracting relevant fields based on context and insurance domain knowledge. Use the provided hints to guide interpretation. Output JSON strictly adhering to the schema below, with no explanations or Markdown.

      Inputs:
      - Scenarios: ${JSON.stringify(enrichedScenarios)}
      - Proposal Overrides: ${sanitizedOverrides}
      - Static Data: ${JSON.stringify(staticData)}
      - Available Insurers: ${JSON.stringify(availableInsurers)}
      - Current Date: ${currentDate}
      - Current Year: ${currentYear}
      - Output Schema: ${JSON.stringify(outputSchema)}

      Instructions:
      - Interpret the scenario text and hints to determine fields like journey type, vehicle age, policy status, addons, and discounts.
      - **Date Handling Rules**:
        - For vehicle age (e.g., "10 years old"), calculate \`manufacturing_year\` as current year (2025) minus the age. Ensure \`manufacturing_year\` is a 4-digit year (e.g., 2015 for a 10-year-old vehicle) and not in the future (>2025).
        - Set \`registration_date\` (format: DD/MM/YYYY) to a random date between January 1 of \`manufacturing_year\` and December 31 of \`manufacturing_year + 1\`, ensuring it is on or after \`manufacturing_year\` and before or on ${currentDate}.
        - For Rollover scenarios:
          - If \`expiry_days\` is specified (e.g., "expired more than 90 days"), calculate \`previous_policy_expiry_date\` as a date between ${currentDate} minus (\`expiry_days\` + 1) and ${currentDate} minus 91 days to ensure strict adherence.
          - If \`expiry_days\` is not specified, set \`previous_policy_expiry_date\` to a random date between the \`registration_date\` plus 1 year and ${currentDate} minus 1 day.
          - Set \`previous_tp_policy_expiry_date\` to match \`previous_policy_expiry_date\`.
          - Set \`previous_tp_policy_start_date\` as \`previous_tp_policy_expiry_date\` minus 1 year.
        - For New Business scenarios, set \`previous_policy_expiry_date\`, \`previous_tp_policy_expiry_date\`, and \`previous_tp_policy_start_date\` to empty strings ("").
        - Validate all dates to ensure:
          - \`registration_date\` >= \`manufacturing_year\` and <= ${currentDate}.
          - \`previous_policy_expiry_date\` and \`previous_tp_policy_expiry_date\` are after \`registration_date\` + 1 year and before ${currentDate} for Rollover.
          - \`previous_tp_policy_start_date\` is exactly 1 year before \`previous_tp_policy_expiry_date\`.
      - Use \`vehicle_type\` and \`insurance_company\` from scenario input.
      - For Rollover, select \`previous_policy_carrier_code\` and \`previous_tp_policy_carrier_code\` from \`availableInsurers\`, ensuring they differ from \`insurance_company\`.
      - Set defaults: \`previous_ncb\`="0%", \`is_inspection_required\`="No", \`idv\`=500000 for 4W or 100000 for 2W, \`owned_by\`="Individual", \`model\`=null, \`variant\`=null if not specified.
      - For addons/discounts, use \`specified_addons\`/\`specified_discounts\` as [] if "without" is mentioned, or an array if specific ones are listed.
      - For \`proposal_questions\`, set \`manufacturing_year\` to match the scenario's \`manufacturing_year\`.
      - Adhere to constraints as per the original code.

      Output: JSON per the schema, e.g., {"scenarios": [objects], "proposal_questions": object}.
    `;

    logger.info("Sending /api/parse request", { scenarios: enrichedScenarios });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Output valid JSON only, strictly adhering to the provided schema. Parse natural language scenarios for 4W/2W insurance test cases, using context and hints. No explanations, no Markdown.",
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
        "Response is missing required fields: scenarios or proposal_questions"
      );
    }

    parsedContent.scenarios = parsedContent.scenarios.map(
      (scenario, index) => ({
        ...scenario,
        vehicle_type: enrichedScenarios[index].vehicle_type,
        insurance_company: enrichedScenarios[index].insurance_company,
      })
    );

    parsedContent.proposal_questions.manufacturing_year =
      parsedContent.scenarios[0].manufacturing_year;
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
    const currentDateObj = new Date("2025-05-28");

    const NOMINEE_QUESTIONS = [
      "nominee_first_name",
      "nominee_last_name",
      "nominee_dob",
      "nominee_relation",
    ];
    const PREVIOUS_POLICY_QUESTIONS = [
      "previous_policy_carrier_code",
      "previous_policy_type",
      "previous_policy_number",
      "previous_tp_policy_number",
      "previous_tp_policy_carrier_code",
      "previous_tp_policy_expiry_date",
      "previous_tp_policy_start_date",
      "previous_policy_expiry_date",
    ];
    const COMPANY_QUESTIONS = ["company_gstin", "company_name"];
    const CUSTOMER_QUESTIONS = [
      "proposer_first_name",
      "proposer_last_name",
      "proposer_dob",
      "proposer_gender",
      "proposer_title",
      "proposer_occupation",
    ];
    const ADDITIONAL_QUESTION = ["NO_PA_Cover"];

    const testData = scenarios.map((scenario) => {
      let vehicleType, insurerName;
      try {
        const { vehicleType: vt, insurerName: iname } =
          getVehicleTypeAndInsurer(scenario.product_code);
        vehicleType = vt;
        insurerName = iname;
      } catch (error) {
        logger.error("Invalid product code in generate:", {
          product_code: scenario.product_code,
          error: error.message,
        });
        throw new Error(`Invalid product code: ${scenario.product_code}`);
      }

      const availableInsurers = [
        ...new Set(
          Object.values(productData.map((p) => p.insurance_company_code))
        ),
      ]
        .map((code) => insurerCodeToName[code] || "Unknown Insurer")
        .filter((insurer) => insurer !== insurerName);
      let previousInsurer = insurerName;
      if (
        scenario.journey_type === "Rollover" &&
        availableInsurers.length > 0
      ) {
        previousInsurer =
          availableInsurers[
            Math.floor(Math.random() * availableInsurers.length)
          ];
      }

      let manufacturingYear =
        parseInt(scenario.manufacturing_year) || currentYear - 1;
      let registrationDate = parseDate(scenario.registration_date);

      const hints = preprocessScenario(scenario.text || "");
      if (hints.vehicle_age) {
        manufacturingYear = currentYear - hints.vehicle_age;
        if (manufacturingYear > currentYear) {
          manufacturingYear = currentYear;
          logger.warn("Corrected manufacturing year to current year", {
            original: manufacturingYear,
            corrected: currentYear,
          });
        }
      }

      if (!registrationDate || isNaN(registrationDate)) {
        const startDate = new Date(`${manufacturingYear}-01-01`);
        const endDate = new Date(`${manufacturingYear + 1}-12-31`);
        registrationDate = getRandomDate(
          startDate,
          endDate > currentDateObj ? currentDateObj : endDate
        );
      }

      if (registrationDate > currentDateObj) {
        registrationDate = currentDateObj;
        logger.warn("Corrected registration date to current date", {
          original: formatDate(registrationDate),
          corrected: formatDate(currentDateObj),
        });
      }

      let previousExpiryDate, previousTpExpiryDate, previousTpStartDate;
      if (scenario.journey_type === "Rollover") {
        const minExpiryDate = new Date(registrationDate);
        minExpiryDate.setFullYear(minExpiryDate.getFullYear() + 1);
        if (scenario.expiry_days || hints.expiry_days) {
          const expiryDays = scenario.expiry_days || hints.expiry_days;
          const startDate = new Date(currentDateObj);
          startDate.setDate(startDate.getDate() - (expiryDays + 1));
          const endDate = new Date(currentDateObj);
          endDate.setDate(endDate.getDate() - 91);
          previousExpiryDate = getRandomDate(startDate, endDate);
        } else {
          previousExpiryDate = getRandomDate(minExpiryDate, currentDateObj);
        }
        previousTpExpiryDate = previousExpiryDate;
        previousTpStartDate = new Date(
          previousTpExpiryDate.getFullYear() - 1,
          previousTpExpiryDate.getMonth(),
          previousTpExpiryDate.getDate()
        );
      } else {
        previousExpiryDate = "";
        previousTpExpiryDate = "";
        previousTpStartDate = "";
      }

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
        scenario.include_all_addons ||
        (hints.include_all_addons &&
          staticData.addons.includes("PERSONAL_ACCIDENT"));

      if (scenario.journey_type === "New Business" || isNotSure) {
        rejectedQuestionKeys.push(...PREVIOUS_POLICY_QUESTIONS);
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

      const filteredProposalQuestions = {
        ...staticData.default_proposal_questions,
        ...proposal_questions,
      };
      for (const key of rejectedQuestionKeys) {
        delete filteredProposalQuestions[key];
      }

      filteredProposalQuestions.registration_number =
        generateRegistrationNumber();
      filteredProposalQuestions.manufacturing_year =
        manufacturingYear.toString();
      filteredProposalQuestions.engine_number = generateEngineNumber();
      filteredProposalQuestions.chassis_number = generateChassisNumber();
      filteredProposalQuestions.financier_name = "";
      filteredProposalQuestions.financier_type = "Hypothecated";
      filteredProposalQuestions.tyre_details = "Michelin 205/55R16";
      filteredProposalQuestions.rim_details = "Alloy";
      if (hasPersonalAccident && ownedBy === "Individual") {
        filteredProposalQuestions.nominee_first_name = "John";
        filteredProposalQuestions.nominee_last_name = "Doe";
        filteredProposalQuestions.nominee_dob = "01/01/1990";
        filteredProposalQuestions.nominee_relation = "Spouse";
      }
      filteredProposalQuestions.proposer_email =
        "nisha.kalpathri@riskcovry.com";
      filteredProposalQuestions.proposer_phone_number = "8970985822";
      if (ownedBy === "Individual") {
        filteredProposalQuestions.proposer_first_name = "Nisha";
        filteredProposalQuestions.proposer_last_name = "Kalpathri";
        filteredProposalQuestions.proposer_dob = HARD_CODED_DOB;
        filteredProposalQuestions.proposer_gender = "Female";
        filteredProposalQuestions.proposer_title = "Ms";
        filteredProposalQuestions.proposer_marital_status = "Single";
        filteredProposalQuestions.proposer_occupation = "Professional";
        filteredProposalQuestions.proposer_pan = HARD_CODED_PAN;
      }
      if (ownedBy === "Company") {
        filteredProposalQuestions.company_gstin = generateGstin();
        filteredProposalQuestions.company_name = "UMBO IDTECH PRIVATE LIMITED";
      }
      filteredProposalQuestions.address = {
        address_line_1: "D/O SUBBARAO",
        address_line_2: "SHIVAJI NAGAR",
        pincode: "590001",
        city: "Belgaum",
        state: "Karnataka",
      };
      filteredProposalQuestions.is_address_same = "Yes";
      filteredProposalQuestions.registration_address =
        filteredProposalQuestions.is_address_same === "Yes"
          ? filteredProposalQuestions.address
          : {
              address_line_1: "123 MG Road",
              address_line_2: "Near Park",
              pincode: "560001",
              city: "Bangalore",
              state: "Karnataka",
            };
      if (scenario.journey_type === "Rollover") {
        filteredProposalQuestions.previous_policy_carrier_code =
          previousInsurer;
        filteredProposalQuestions.previous_policy_type = "comprehensive";
        filteredProposalQuestions.previous_policy_number = `POL${Math.floor(
          Math.random() * 1000000
        )}`;
        filteredProposalQuestions.previous_tp_policy_number = `TP${Math.floor(
          Math.random() * 1000000
        )}`;
        filteredProposalQuestions.previous_tp_policy_carrier_code =
          previousInsurer;
        filteredProposalQuestions.previous_tp_policy_expiry_date =
          formatDate(previousTpExpiryDate);
        filteredProposalQuestions.previous_tp_policy_start_date =
          formatDate(previousTpStartDate);
        filteredProposalQuestions.previous_policy_expiry_date =
          formatDate(previousExpiryDate);
      }
      filteredProposalQuestions.NO_PA_Cover =
        !hasPersonalAccident && ownedBy === "Individual"
          ? "No Valid Drivers license"
          : "";

      const makeModel =
        scenario.model || hints.model
          ? (scenario.model || hints.model).toUpperCase()
          : vehicleType === "2W"
          ? "HONDA ACTIVA"
          : "HONDA CITY";
      const variant =
        scenario.variant || hints.variant
          ? (scenario.variant || hints.variant).toUpperCase()
          : "STANDARD";

      return {
        Testcase_id:
          scenario.testcase_id ||
          `${insurerName.replace(
            /[^A-Z0-9]/g,
            "_"
          )}_${vehicleType}_${scenario.journey_type.toUpperCase()}_01`,
        category: vehicleType === "4W" ? "four_wheeler" : "two_wheeler",
        journey_type: scenario.journey_type || hints.journey_type || "Rollover",
        registration_number: filteredProposalQuestions.registration_number,
        make_model: makeModel,
        variant: variant,
        registration_date: formatDate(registrationDate),
        rto: "KA01",
        owned_by: ownedBy,
        is_ownership_changed: scenario.ownership_changed || "No",
        previous_expiry_date: previousExpiryDate
          ? formatDate(previousExpiryDate)
          : "",
        offset_previous_expiry_date:
          scenario.expiry_days || hints.expiry_days
            ? String(scenario.expiry_days || hints.expiry_days)
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
        addons:
          scenario.specified_addons || hints.specified_addons
            ? (scenario.specified_addons || hints.specified_addons).map(
                (code) => ({ insurance_cover_code: code })
              )
            : scenario.include_all_addons || hints.include_all_addons
            ? staticData.addons.map((code) => ({ insurance_cover_code: code }))
            : [],
        discounts:
          scenario.specified_addons || hints.specified_discounts
            ? (scenario.specified_discounts || hints.specified_discounts).map(
                (code) => ({ discount_code: code, sa: "" })
              )
            : [],
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
          : [staticData.kyc_format[0]],
        kyc_verification: "Pending",
        proposal_questions: filteredProposalQuestions,
        is_inspection_required: scenario.is_inspection_required || "No",
        carrier_name: insurerName,
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

app.post("/api/validate", async (req, res) => {
  try {
    const { scenario, product_code, test_data } = req.body;
    if (!scenario || !product_code || !test_data) {
      throw new Error("Scenario, product_code, and test_data are required");
    }

    let vehicleType, insurerName;
    try {
      const { vehicleType: vt, insurerName: iname } =
        getVehicleTypeAndInsurer(product_code);
      vehicleType = vt;
      insurerName = iname;
    } catch (error) {
      logger.error("Invalid product code in validate:", {
        product_code,
        error: error.message,
      });
      throw new Error(`Invalid product code: ${product_code}`);
    }

    const currentDate = formatDate(new Date("2025-05-28"));
    const currentYear = new Date().getFullYear();
    const currentDateObj = new Date("2025-05-28");

    const availableInsurers = [
      ...new Set(
        Object.values(productData.map((p) => p.insurance_company_code))
      ),
    ].map((code) => ({
      code,
      name: insurerCodeToName[code] || "Unknown Insurer",
    }));

    const hints = preprocessScenario(scenario || "");

    const validationSchema = {
      is_valid: "boolean",
      errors: [{ field: "string", message: "string" }],
      fixes: [{ field: "string", value: "any", reason: "string" }],
      validated_data: "object",
    };

    const proposalConstraints = {
      manufacturing_year: {
        mandatory: true,
        regex: "^[2]{1}[0-9]{3}$",
        condition: (value) => parseInt(value) <= 2025,
        fix: () =>
          hints.vehicle_age
            ? (currentYear - hints.vehicle_age).toString()
            : currentYear.toString(),
      },
      registration_number: {
        mandatory: true,
        regex:
          "^(?=.{8,10}$)(([A-Za-z]){2}([0-9]){1,2}([A-Za-z]){0,3}([0-9]){1,5})$|(^[0-9]{2}BH[0-9]{4}[A-Za-z]{1,2})$",
        fix: () => generateRegistrationNumber(),
      },
      engine_number: {
        mandatory: true,
        regex: "^[a-zA-Z0-9]{5,20}$",
        fix: () => generateEngineNumber(),
      },
      chassis_number: {
        mandatory: true,
        regex: "^[a-zA-Z0-9]{17}$",
        fix: () => generateChassisNumber(),
      },
      proposer_email: {
        mandatory: true,
        regex: "^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$",
        fix: () => "nisha.kalpathri@riskcovry.com",
      },
      proposer_phone_number: {
        mandatory: true,
        regex: "^[0-9]{10}$",
        fix: () => "8970985822",
      },
      proposer_dob: {
        mandatory: () => test_data.owned_by === "Individual",
        condition: () =>
          test_data.proposal_questions.proposer_dob === HARD_CODED_DOB,
        fix: () => HARD_CODED_DOB,
      },
      proposer_pan: {
        mandatory: () => test_data.owned_by === "Individual",
        condition: () =>
          test_data.proposal_questions.proposer_pan === HARD_CODED_PAN,
        fix: () => HARD_CODED_PAN,
      },
      company_gstin: {
        mandatory: () => test_data.owned_by === "Company",
        regex: "^27[A-Z]{5}[0-9]{4}[A-Z][1-9][0-9A-Z]{2}$",
        fix: () => generateGstin(),
      },
      company_name: {
        mandatory: () => test_data.owned_by === "Company",
        regex: "^.+$",
        fix: () => "UMBO IDTECH PRIVATE LIMITED",
      },
      address: {
        mandatory: true,
        condition: (obj) =>
          obj &&
          typeof obj === "object" &&
          typeof obj.address_line_1 === "string" &&
          obj.address_line_1.length <= 100 &&
          typeof obj.address_line_2 === "string" &&
          obj.address_line_2.length <= 100 &&
          typeof obj.pincode === "string" &&
          typeof obj.city === "string" &&
          typeof obj.state === "string",
        fix: () => ({
          address_line_1: "D/O SUBBARAO",
          address_line_2: "SHIVAJI NAGAR",
          pincode: "590001",
          city: "Belgaum",
          state: "Karnataka",
        }),
      },
      previous_policy_expiry_date: {
        mandatory: () => test_data.journey_type === "Rollover",
        condition: (value) => {
          const date = parseDate(value);
          const regDate = parseDate(test_data.registration_date);
          if (!date || !regDate) return false;
          const minDate = new Date(regDate);
          minDate.setFullYear(minDate.getFullYear() + 1);
          const maxDate = new Date(currentDateObj);
          maxDate.setDate(maxDate.getDate() - 91);
          return date >= minDate && date <= maxDate;
        },
        fix: () => {
          const minExpiryDate = parseDate(test_data.registration_date);
          minExpiryDate.setFullYear(minExpiryDate.getFullYear() + 1);
          const endDate = new Date(currentDateObj);
          endDate.setDate(endDate.getDate() - 91);
          return formatDate(getRandomDate(minExpiryDate, endDate));
        },
      },
      NO_PA_Cover: {
        mandatory: () =>
          test_data.addons &&
          !test_data.addons.some(
            (a) => a.insurance_cover_code === "PERSONAL_ACCIDENT"
          ) &&
          test_data.owned_by === "Individual",
        options: ["No Valid Drivers license", "Having a PA cover"],
        fix: () => "No Valid Drivers license",
      },
    };

    const aiPrompt = `
Validate the test_data against the scenario and product_code for a 4W/2W insurance test case. Ensure strict adherence to insurance domain rules, scenario intent, and provided constraints. Output JSON per the validation schema with structured errors and fixes, no explanations or Markdown.

Inputs:
- Scenario: ${JSON.stringify(scenario)}
- Product Code: ${product_code}
- Test Data: ${JSON.stringify(test_data)}
- Vehicle Type: ${vehicleType}
- Insurer: ${insurerName}
- Hints: ${JSON.stringify(hints)}
- Available Addons: ${JSON.stringify(staticData.addons)}
- Available Discounts: ${JSON.stringify(staticData.discounts)}
- Available Insurers: ${JSON.stringify(availableInsurers)}
- Static Data: ${JSON.stringify(staticData)}
- Current Date: ${currentDate}
- Current Year: ${currentYear}
- Validation Schema: ${JSON.stringify(validationSchema)}
- Proposal Constraints: ${JSON.stringify(proposalConstraints)}

Instructions:
- Validate test_data fields against scenario, product_code, hints, and constraints.
- **Field Validations**:
  - journey_type: Must match hints.journey_type or scenario intent (e.g., "Rollover" for expired cases). Skip validation if already correct.
  - manufacturing_year: Must be a 4-digit year <= 2025, align with hints.vehicle_age (e.g., 2015 for 10-year-old vehicle).
  - registration_date: Must be DD/MM/YYYY, >= manufacturing_year, <= ${currentDate}.
  - addons: Must match hints.specified_addons or include_all_addons; [] if "without addons".
  - discounts: Must match hints.specified_discounts; [] if "without discounts".
  - proposer_pan: Must be exactly "${HARD_CODED_PAN}" if owned_by="Individual".
  - proposer_dob: Must be exactly "${HARD_CODED_DOB}" if owned_by="Individual".
  - For Rollover: previous_policy_expiry_date and previous_tp_policy_expiry_date must be after registration_date + 1 year and strictly before ${currentDate} minus 91 days if expiry_days >= 90.
  - For New Business: No previous_policy fields should be present.
  - idv: 100000 for 2W, 500000 for 4W unless specified.
  - kyc: Must match staticData.kyc_format and hints.specified_kyc.
  - NO_PA_Cover: Required if no PERSONAL_ACCIDENT addon and owned_by="Individual"; nominee fields must be absent in this case.
  - company_gstin, company_name: Must be absent if owned_by="Individual".
- **Error Format**: { "field": "string", "message": "string" }
  - Example: { "field": "proposer_pan", "message": "Must be ${HARD_CODED_PAN}" }
- **Fix Format**: { "field": "string", "value": "any", "reason": "string" }
  - Use proposalConstraints.fix() for fixes.
  - Example: { "field": "proposer_pan", "value": "${HARD_CODED_PAN}", "reason": "Enforced hardcoded PAN" }
- **Date Handling**:
  - registration_date: Align with manufacturing_year.
  - previous_expiry_date: For Rollover with expiry_days >= 90, set between registration_date + 1 year and ${currentDate} minus 91 days.
- Output:
  {
    "is_valid": boolean,
    "errors": [{ "field": "string", "message": "string" }],
    "fixes": [{ "field": "string", "value": "any", "reason": "string" }],
    "validated_data": object
  }
`;

    logger.info("Sending /api/validate AI request", { scenario, product_code });
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Output valid JSON per the validation schema, validating test_data for insurance test cases. Use structured errors and fixes. No explanations, no Markdown.",
        },
        { role: "user", content: aiPrompt },
      ],
      max_tokens: 1500,
    });

    const aiValidation = cleanMarkdownResponse(
      aiResponse.choices[0].message.content
    );
    logger.info("AI validation response", { aiValidation });

    console.log("AI Validation: ", aiValidation);

    const errors = [];
    const fixes = [];
    let validatedProposalQuestions = { ...test_data.proposal_questions };

    Object.entries(proposalConstraints).forEach(([field, constraint]) => {
      const value = validatedProposalQuestions[field];
      const isMandatory =
        typeof constraint.mandatory === "function"
          ? constraint.mandatory()
          : constraint.mandatory;

      if (isMandatory && (value === undefined || value === "")) {
        errors.push({ field, message: `${field} is mandatory` });
        fixes.push({
          field,
          value: constraint.fix(),
          reason: `Fixed missing mandatory ${field}`,
        });
        validatedProposalQuestions[field] = constraint.fix();
      } else if (value !== undefined && value !== "") {
        if (constraint.regex && !new RegExp(constraint.regex).test(value)) {
          errors.push({ field, message: `Invalid format for ${field}` });
          fixes.push({
            field,
            value: constraint.fix(),
            reason: `Fixed invalid format for ${field}`,
          });
          validatedProposalQuestions[field] = constraint.fix();
        }
        if (constraint.condition && !constraint.condition(value)) {
          errors.push({ field, message: `Invalid ${field}` });
          fixes.push({
            field,
            value: constraint.fix(),
            reason: `Fixed invalid ${field}`,
          });
          validatedProposalQuestions[field] = constraint.fix();
        }
      }
    });

    let validatedData = {
      ...test_data,
      proposal_questions: validatedProposalQuestions,
    };
    aiValidation.fixes.forEach((fix) => {
      const { field, value, reason } = fix;
      const fieldParts = field.split(".");
      if (fieldParts.length > 1 && fieldParts[0] === "proposal_questions") {
        validatedData.proposal_questions[fieldParts[1]] = value;
        fixes.push({ field, value, reason });
      } else {
        validatedData[field] = value;
        fixes.push({ field, value, reason });
      }
    });

    fixes.forEach((fix) => {
      logger.info("Applied fix", {
        field: fix.field,
        value: fix.value,
        reason: fix.reason,
      });
    });

    const response = {
      is_valid: aiValidation.is_valid && errors.length === 0,
      errors: [...errors, ...aiValidation.errors],
      fixes: [...fixes, ...aiValidation.fixes],
      validated_data: validatedData,
    };

    res.json(response);
  } catch (error) {
    logger.error("Validate endpoint error", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

const port =
  process.env.NODE_ENV === "production" ? process.env.PORT || 80 : 3000;
app.listen(port, () => logger.info(`Server running on port ${port}`));
