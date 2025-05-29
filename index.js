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
    previous_policy_type: null,
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
    date = new Date();
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
    return new Date();
  }
  const timeDiff = endDate - startDate;
  const randomTime = startDate.getTime() + Math.random() * timeDiff;
  const result = new Date(randomTime);
  return isNaN(result) ? new Date() : result;
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

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const [day, month, year] = dateStr.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  return isNaN(date) ? null : date;
}

function preprocessScenario(text) {
  const hints = {};
  // Extract vehicle age
  const ageMatch = text.match(/(\d+)\s*(?:year|years)\s*old/i);
  if (ageMatch) {
    hints.vehicle_age = parseInt(ageMatch[1]);
  }
  // Extract expiry days
  const expiryMatch = text.match(/(?:expired|more than)\s*(\d+)\s*days/i);
  if (expiryMatch) {
    hints.expiry_days = parseInt(expiryMatch[1]);
  }
  // Extract addons
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
  // Extract discounts
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
  // Extract model/variant
  const modelMatch = text.match(/model\s*(\w+)/i);
  if (modelMatch) {
    hints.model = modelMatch[1].toUpperCase();
  }
  const variantMatch = text.match(/variant\s*(\w+)/i);
  if (variantMatch) {
    hints.variant = variantMatch[1].toUpperCase();
  }
  // Extract journey type
  if (/new\s*(?:business|vehicle)/i.test(text)) {
    hints.journey_type = "New Business";
  } else if (/rollover/i.test(text) || /expired/i.test(text)) {
    hints.journey_type = "Rollover";
  }
  // Extract ownership
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
        const { vehicleType, insurerCode, insurerName } =
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
    const lastYear = currentYear - 1;

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
        valid_puc: "string",
        puc_number: "string",
        gstin: "string",
        company_name: "string",
        proposer_email: "string",
        proposer_phone_number: "string",
        address: {
          address_line_1: "string",
          address_line_2: "string",
          pincode: "string",
          city: "string",
          state: "string",
        },
        is_address_same: "string",
        registration_address: "string",
        previous_policy_carrier_code: "string",
        previous_policy_type: "string|null",
        previous_policy_number: "string",
        previous_policy_expiry_date: "string",
        previous_tp_policy_start_date: "string",
        previous_tp_policy_expiry_date: "string",
        previous_tp_policy_carrier_code: "string",
        previous_tp_policy_number: "string",
        NO_PA_Cover: "string",
        proposer_first_name: "string",
        proposer_last_name: "string",
        proposer_salutation: "string",
        proposer_dob: "string",
        proposer_age: "string",
        proposer_alternate_number: "string",
        proposer_marital_status: "string",
        proposer_pan: "string",
        proposer_gstin: "string",
        proposer_annual_income: "string",
        proposer_occupation: "string",
        proposer_title: "string",
        company_details: "string",
        company_date_of_incorporation: "string",
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
      - For vehicle age (e.g., "10 years old"), set manufacturing_year to current year (2025) minus the age, and registration_date in manufacturing_year or manufacturing_year + 1.
      - For expiry (e.g., "expired more than 90 days"), set expiry_days and previous_expiry_date accordingly.
      - Use vehicle_type and insurance_company from scenario input.
      - For Rollover, select previous_insurer different from insurance_company from availableInsurers.
      - Ensure registration_date (DD/MM/YYYY) is on or after manufacturing_year and before ${currentDate}.
      - Set defaults: previous_ncb="0%", is_inspection_required="No", idv=500000, valid_puc="Yes", owned_by="Individual", model=null, variant=null if not specified.
      - For addons/discounts, use specified_addons/specified_discounts as "" if "without" is mentioned, or array if specific ones are listed.
      - Exclude proposal questions based on journey_type and owned_by as per staticData constraints.

      Output: JSON per the schema, e.g., {"scenarios": [objects], "proposal_questions": object}.
    `;

    logger.info("Sending /api/parse request", { scenarios: enrichedScenarios });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Output valid JSON only, strictly adhering to the provided schema. Parse natural language scenarios for 4W/2W insurance test cases, using context and hints to extract fields. No explanations, no Markdown.",
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

    parsedContent.scenarios = parsedContent.scenarios.map(
      (scenario, index) => ({
        ...scenario,
        vehicle_type: enrichedScenarios[index].vehicle_type,
        insurance_company: enrichedScenarios[index].insurance_company,
      })
    );

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
    const currentDateObj = new Date("2025-05-28");
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

      // Validate manufacturing_year and registration_date
      let manufacturingYear = parseInt(scenario.manufacturing_year) || lastYear;
      let registrationDate = parseDate(scenario.registration_date);

      // Derive manufacturing_year from hints if available
      const hints = preprocessScenario(scenario.text || "");
      if (hints.vehicle_age) {
        const expectedYear = currentYear - hints.vehicle_age;
        if (manufacturingYear !== expectedYear) {
          logger.warn(
            "Manufacturing year mismatch with vehicle age, correcting",
            {
              manufacturing_year: manufacturingYear,
              vehicle_age: hints.vehicle_age,
              expected_year: expectedYear,
            }
          );
          manufacturingYear = expectedYear;
        }
      }

      // Validate manufacturing_year against registration_date
      if (registrationDate && !isNaN(registrationDate)) {
        const regYear = registrationDate.getFullYear();
        if (manufacturingYear > regYear) {
          logger.warn(
            "Manufacturing year after registration date, correcting",
            {
              manufacturing_year: manufacturingYear,
              registration_date: formatDate(registrationDate),
            }
          );
          manufacturingYear = Math.random() > 0.5 ? regYear : regYear - 1;
        }
      }

      // Handle invalid or missing registration_date
      if (!registrationDate || isNaN(registrationDate)) {
        logger.warn(
          "Invalid registration_date from OpenAI, generating fallback",
          {
            registration_date: scenario.registration_date,
          }
        );
        const startDate = new Date(`${manufacturingYear}-01-01`);
        const endDate = new Date(`${manufacturingYear + 1}-12-31`);
        registrationDate = getRandomDate(startDate, endDate);
      } else {
        // Ensure registration_date year is manufacturing_year or manufacturing_year + 1
        const regYear = registrationDate.getFullYear();
        if (regYear < manufacturingYear || regYear > manufacturingYear + 1) {
          logger.warn("Registration date year out of range, correcting", {
            registration_date: formatDate(registrationDate),
            manufacturing_year: manufacturingYear,
          });
          const startDate = new Date(`${manufacturingYear}-01-01`);
          const endDate = new Date(`${manufacturingYear + 1}-12-31`);
          registrationDate = getRandomDate(startDate, endDate);
        }
      }

      // Ensure registration_date is before current date
      if (registrationDate > currentDateObj) {
        logger.warn("Registration date in future, correcting", {
          date: formatDate(registrationDate),
        });
        const endDate = new Date(`${manufacturingYear}-12-31`);
        registrationDate = endDate < currentDateObj ? endDate : currentDateObj;
      }

      // Ensure manufacturing_year is not in the future
      if (manufacturingYear > currentYear) {
        logger.warn("Manufacturing year in future, correcting", {
          manufacturing_year: manufacturingYear,
        });
        manufacturingYear = currentYear;
        const startDate = new Date(`${manufacturingYear}-01-01`);
        const endDate = new Date(`${manufacturingYear + 1}-12-31`);
        registrationDate = getRandomDate(
          startDate,
          endDate < currentDateObj ? endDate : currentDateObj
        );
      }

      let previousExpiryDate, previousTpExpiryDate, pucExpiry;
      const isNewBusiness = scenario.journey_type === "New Business";

      if (scenario.journey_type === "Rollover") {
        if (scenario.expiry_days !== null || hints.expiry_days) {
          const expiryDays = scenario.expiry_days || hints.expiry_days;
          const startDate = new Date("2025-05-28");
          startDate.setDate(startDate.getDate() - expiryDays);
          const endDate = new Date("2025-05-28");
          endDate.setDate(endDate.getDate() - 1);
          previousExpiryDate = getRandomDate(startDate, endDate);
          const minExpiryDate = new Date(registrationDate);
          minExpiryDate.setFullYear(minExpiryDate.getFullYear() + 1);
          if (previousExpiryDate < minExpiryDate || isNaN(previousExpiryDate)) {
            previousExpiryDate = getRandomDate(minExpiryDate, currentDateObj);
          }
        } else {
          const isActive = Math.random() < 0.5;
          const minExpiryDate = new Date(registrationDate);
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
        scenario.include_all_addons ||
        (hints.include_all_addons &&
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
      for (const key of rejectedQuestionKeys) {
        delete filteredProposalQuestions[key];
      }

      const registrationNumber = generateRegistrationNumber();

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
        registration_number: registrationNumber,
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
        contact_number: "8970987654",
        idv: scenario.idv || (vehicleType === "2W" ? 100000 : 500000),
        NCB_two: "",
        addons:
          scenario.specific_addons || hints.specified_addons
            ? (scenario.specific_addons || hints.specified_addons).map(
                (code) => ({
                  insurance_cover_code: code,
                })
              )
            : scenario.include_all_addons || hints.include_all_addons
            ? staticData.addons.map((code) => ({ insurance_cover_code: code }))
            : "",
        discounts:
          scenario.specific_discounts || hints.specific_discounts
            ? (scenario.specific_discounts || hints.specific_discounts).map(
                (code) => ({
                  discount_code: code,
                  sa: "",
                })
              )
            : "",
        select_tab: scenario.product_code.includes("THIRD_PARTY")
          ? "Third Party"
          : "Comprehensive",
        email: "nisha.kalpathri@riskcovry.com",
        kyc: scenario.specific_kyc
          ? [
              staticData.kyc_format.find(
                (opt) =>
                  Object.keys(opt)[0].toLowerCase() ===
                  scenario.specific_kyc.toLowerCase()
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
          manufacturing_year: manufacturingYear.toString(),
        },
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

const port =
  process.env.NODE_ENV === "production" ? process.env.PORT || 80 : 3000;
app.listen(port, () => logger.info(`Server running on port ${port}`));
