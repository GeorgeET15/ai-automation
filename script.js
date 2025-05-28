let testData = []; // Global scope for testData

function getRandomAddons(
  isComprehensive,
  includePersonalAccident,
  includeAllAddons = false,
  specifiedAddons = []
) {
  const addons = [
    "ZERO_DEPRECIATION_COVER",
    "ROAD_SIDE_ASSISTANCE",
    "ENGINE_PROTECTION",
    "PERSONAL_ACCIDENT",
    "RETURN_TO_INVOICE",
  ];
  if (!isComprehensive && !includePersonalAccident) return "";
  if (!includeAllAddons && !specifiedAddons.length) return "";

  let selectedAddons = [];
  if (includeAllAddons && isComprehensive) {
    selectedAddons = addons;
  } else if (specifiedAddons.length) {
    selectedAddons = specifiedAddons.filter((code) => addons.includes(code));
  } else if (isComprehensive) {
    const count = Math.floor(Math.random() * addons.length) + 1;
    const shuffled = addons.sort(() => 0.5 - Math.random());
    selectedAddons = shuffled.slice(0, count);
  } else if (includePersonalAccident) {
    selectedAddons = ["PERSONAL_ACCIDENT"];
  }
  return selectedAddons.length
    ? selectedAddons.map((code) => ({ insurance_cover_code: code }))
    : "";
}

function getRandomDiscounts(specifiedDiscounts = []) {
  if (!specifiedDiscounts.length) return "";
  const discounts = [
    "ANTI_THEFT_DISCOUNT",
    "VOLUNTARY_DEDUCTIBLE",
    "NCB_PROTECTION",
  ];
  const selectedDiscounts = specifiedDiscounts.filter((code) =>
    discounts.includes(code)
  );
  return selectedDiscounts.length
    ? selectedDiscounts.map((code) => ({ discount_code: code, sa: "" }))
    : "";
}

function getRandomKyc(specifiedKyc = null) {
  const kycOptions = [
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
  ];
  if (specifiedKyc) {
    const kycOption = kycOptions.find(
      (option) =>
        Object.keys(option)[0].toLowerCase() === specifiedKyc.toLowerCase()
    );
    if (kycOption) return [kycOption];
  }
  const randomIndex = Math.floor(Math.random() * kycOptions.length);
  return [kycOptions[randomIndex]];
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getRandomDate(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const timeDiff = endDate - startDate;
  const randomTime = startDate.getTime() + Math.random() * timeDiff;
  return new Date(randomTime);
}

function getDynamicDates(journey_type, vehicle_type, expiry_days = null) {
  const currentDate = new Date("2025-05-28");
  let registration_date,
    previous_expiry_date,
    previous_tp_expiry_date,
    puc_expiry;

  if (journey_type === "New Business") {
    registration_date = getRandomDate("2024-01-01", "2025-05-28");
  } else {
    registration_date = getRandomDate("2018-01-01", "2023-12-31");
  }

  if (journey_type === "Rollover") {
    if (expiry_days !== null) {
      const startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - expiry_days);
      const endDate = new Date(currentDate);
      endDate.setDate(currentDate.getDate() - 1);
      previous_expiry_date = getRandomDate(startDate, endDate);
    } else {
      const isActive = Math.random() > 0.5;
      if (isActive) {
        previous_expiry_date = getRandomDate("2025-02-28", "2025-08-27");
      } else {
        previous_expiry_date = getRandomDate("2024-01-01", "2025-02-27");
      }
    }
    const registrationDate = new Date(registration_date);
    const tenureYears =
      vehicle_type === "4W"
        ? Math.random() > 0.5
          ? 1
          : 3
        : Math.random() > 0.5
        ? 1
        : 5;
    previous_tp_expiry_date = new Date(registrationDate);
    previous_tp_expiry_date.setFullYear(
      registrationDate.getFullYear() + tenureYears
    );
  } else {
    previous_expiry_date = "";
    previous_tp_expiry_date = "";
  }

  const pucStart = new Date(currentDate);
  const pucMonths = 6 + Math.floor(Math.random() * 7);
  puc_expiry = new Date(pucStart.setMonth(currentDate.getMonth() + pucMonths));

  return {
    registration_date: formatDate(registration_date),
    previous_expiry_date: previous_expiry_date
      ? formatDate(previous_expiry_date)
      : "",
    previous_tp_expiry_date: previous_tp_expiry_date
      ? formatDate(previous_tp_expiry_date)
      : "",
    puc_expiry: formatDate(puc_expiry),
  };
}

function escapeCsvValue(value, header) {
  if (value === null || value === undefined) return "";
  if (header === "addons" || header === "discounts") {
    if (Array.isArray(value) && value.length === 0) {
      console.log(`Empty array detected for ${header}, converting to ""`);
      return "";
    }
    if (value === "") return "";
    if (typeof value === "object")
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  if (typeof value === "object" && value !== null) {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  value = String(value);
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const scenarioList = document.getElementById("scenarioList");
const scenarioInput = document.getElementById("scenarioInput");
const addScenarioBtn = document.getElementById("addScenarioBtn");
const customDialog = document.getElementById("customDialog");
const dialogMessage = document.getElementById("dialogMessage");
const dialogCloseBtn = document.getElementById("dialogCloseBtn");

function showCustomDialog(message) {
  dialogMessage.textContent = message;
  customDialog.classList.remove("hidden");
  customDialog.classList.add("show");
}

dialogCloseBtn.addEventListener("click", () => {
  customDialog.classList.remove("show");
  customDialog.classList.add("hidden");
});

addScenarioBtn.addEventListener("click", () => {
  const scenarioText = scenarioInput.value.trim();
  if (!scenarioText) {
    showCustomDialog("Please enter a scenario.");
    return;
  }
  if (!scenarioText.match(/2W|4W/i)) {
    showCustomDialog('Scenario must include "2W" or "4W".');
    return;
  }
  if (!scenarioText.match(/HDFC|ICICI|Royal Sundaram/i)) {
    showCustomDialog(
      "Scenario must include an insurance company (HDFC, ICICI, or Royal Sundaram)."
    );
    return;
  }
  if (
    !scenarioText.match(/with all addons|without addons|with specified addons/i)
  ) {
    showCustomDialog(
      'Scenario must specify addon instructions ("with all addons", "without addons", or "with specified addons ...").'
    );
    return;
  }
  if (!scenarioText.match(/with discounts|without discounts/i)) {
    showCustomDialog(
      'Scenario must specify discount instructions ("with discounts ...", "without discounts", or omit discounts).'
    );
    return;
  }

  const li = document.createElement("li");
  li.className = "flex justify-between items-center bg-gray-50 p-3 rounded-md";
  li.innerHTML = `
    <span class="text-sm">${scenarioText}</span>
    <button
      type="button"
      class="remove-scenario-btn inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
    >
      Remove
    </button>
  `;
  scenarioList.appendChild(li);
  scenarioInput.value = "";

  li.querySelector(".remove-scenario-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to remove this scenario?")) {
      scenarioList.removeChild(li);
    }
  });
});

document.getElementById("downloadBtn").onclick = () => {
  if (!testData.length) {
    showCustomDialog("No test data available to download.");
    return;
  }
  console.log(
    "Generating CSV with testData:",
    JSON.stringify(testData, null, 2)
  );
  const headers = [
    "Testcase_id",
    "category",
    "journey_type",
    "registration_number",
    "make_model",
    "variant",
    "registration_date",
    "rto",
    "owned_by",
    "is_ownership_changed",
    "previous_expiry_date",
    "offset_previous_expiry_date",
    "previous_insurer",
    "previous_tp_expiry_date",
    "offset_previous_tp_expiry_date",
    "previous_tp_insurer",
    "not_sure",
    "know_previous_tp_expiry_date",
    "not_sure_previous_tp_expiry_date",
    "claim_taken",
    "previous_ncb",
    "product_code",
    "customer_name",
    "contact_number",
    "idv",
    "NCB_two",
    "addons",
    "discounts",
    "select_tab",
    "email",
    "kyc",
    "kyc_verification",
    "proposal_questions",
    "is_inspection_required",
    "carrier_name",
  ];
  const csvRows = testData.map((row, index) => {
    console.log(`Processing CSV row ${index}:`, JSON.stringify(row, null, 2));
    return headers.map((h) => escapeCsvValue(row[h], h)).join(",");
  });
  const csv = headers.join(",") + "\n" + csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "test_data.csv";
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById("inputForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const results = document.getElementById("results");
  const generateBtn = document.getElementById("generateBtn");
  const tbody = document.querySelector("#dataTable tbody");

  if (generateBtn.disabled) return; // Prevent multiple submissions

  loading.classList.remove("hidden");
  error.classList.add("hidden");
  results.classList.add("hidden");
  generateBtn.disabled = true;

  try {
    testData = []; // Clear testData to prevent stale data
    const scenarioInputs = Array.from(scenarioList.querySelectorAll("span"))
      .map((span) => span.textContent.trim())
      .filter((value) => value);
    const productCode = document
      .getElementById("productCodeInput")
      .value.trim();
    const proposalOverrides = document
      .getElementById("proposal_overrides")
      .value.trim();

    const formData = {
      scenarios: scenarioInputs,
      product_code: productCode || null,
      proposal_overrides: proposalOverrides,
    };

    if (!formData.scenarios.length) {
      showCustomDialog("At least one scenario is required");
      throw new Error("At least one scenario is required");
    }

    console.log("Form data:", formData);

    let structuredData;
    try {
      console.log("Sending /api/parse request");
      const parseResponse = await fetch("http://localhost:3000/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!parseResponse.ok) {
        const err = await parseResponse.json();
        throw new Error(err.error || "Failed to parse scenarios");
      }

      structuredData = await parseResponse.json();
      console.log("Received /api/parse response:", structuredData);
    } catch (parseError) {
      console.error("Parse request failed:", parseError.message);
      error.textContent = "Failed to connect to server. Using mock data.";
      error.classList.remove("hidden");
      structuredData = {
        scenarios: scenarioInputs.map((scenario, index) => {
          const expiryMatch = scenario.match(
            /(?:expired within|rollover less than) (\d+) days/i
          );
          const expiryDays = expiryMatch ? parseInt(expiryMatch[1], 10) : null;
          const isComprehensive = scenario.match(/comprehensive/i);
          const includeAllAddons = scenario.match(/with all addons/i);
          const withoutAddons = scenario.match(/without addons/i);
          const specifiedAddonsMatch = scenario.match(
            /with specified addons ([\w\s,]+)/i
          );
          const specifiedAddons = specifiedAddonsMatch
            ? specifiedAddonsMatch[1]
                .split(",")
                .map((s) => s.trim().toUpperCase())
            : [];
          const specifiedDiscountsMatch = scenario.match(
            /with discounts ([\w\s,]+)/i
          );
          const specifiedDiscounts = specifiedDiscountsMatch
            ? specifiedDiscountsMatch[1]
                .split(",")
                .map((s) => s.trim().toUpperCase())
            : [];
          const vehicleType = scenario.match(/2W/i) ? "2W" : "4W";
          const insurer = scenario.match(/HDFC/i)
            ? "HDFC"
            : scenario.match(/Royal Sundaram/i)
            ? "Royal Sundaram"
            : "ICICI";
          const productCodeMatch = scenario.match(/[A-Z0-9_]+/);
          const productCodeFinal =
            productCode ||
            (productCodeMatch
              ? productCodeMatch[0]
              : `${insurer}_${vehicleType}_${
                  isComprehensive ? "COMPREHENSIVE" : "THIRD_PARTY"
                }`);
          const kycMatch = scenario.match(/kyc (ovd|pan|ckyc number)/i);
          const specifiedKyc = kycMatch ? kycMatch[1] : null;
          return {
            testcase_id: `${insurer}_${vehicleType}_${
              expiryDays !== null ? "ROLLOVER" : "NEW"
            }_${String(index + 1).padStart(2, "0")}`,
            journey_type: expiryDays !== null ? "Rollover" : "New Business",
            product_code: productCodeFinal,
            is_inspection_required: expiryDays !== null ? "Yes" : "No",
            previous_ncb: expiryDays !== null ? "0%" : "20%",
            manufacturing_year: "2025",
            vehicle_type: vehicleType,
            claim_taken: "No",
            ownership_changed: "No",
            idv: vehicleType === "2W" ? 100000 : 500000,
            insurance_company: insurer,
            expiry_days: expiryDays,
            include_all_addons: !!includeAllAddons,
            include_addons:
              !withoutAddons &&
              (includeAllAddons || specifiedAddons.length > 0),
            specified_addons: specifiedAddons.length ? specifiedAddons : "",
            specified_discounts: specifiedDiscounts.length
              ? specifiedDiscounts
              : "",
            specified_kyc: specifiedKyc,
          };
        }),
        proposal_questions: {
          manufacturing_year: "2025",
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
      };
    }

    if (
      !structuredData.scenarios ||
      !Array.isArray(structuredData.scenarios) ||
      structuredData.scenarios.length === 0
    ) {
      throw new Error("No valid scenarios parsed");
    }
    if (
      !structuredData.proposal_questions ||
      typeof structuredData.proposal_questions !== "object"
    ) {
      throw new Error("Invalid proposal_questions");
    }

    try {
      console.log("Sending /api/generate request");
      const generateResponse = await fetch(
        "http://localhost:3000/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarios: structuredData.scenarios,
            proposal_questions: structuredData.proposal_questions,
          }),
        }
      );

      if (!generateResponse.ok) {
        const err = await generateResponse.json();
        throw new Error(err.error || "Failed to generate test data");
      }

      testData = await generateResponse.json();
      console.log("Received /api/generate response:", testData);
    } catch (genError) {
      console.error("Generate request failed:", genError.message);
      error.textContent = "Failed to generate test data. Using mock data.";
      error.classList.remove("hidden");
      testData = structuredData.scenarios.map((scenario) => {
        const dates = getDynamicDates(
          scenario.journey_type || "Rollover",
          scenario.vehicle_type || "2W",
          scenario.expiry_days
        );
        return {
          Testcase_id:
            scenario.testcase_id ||
            `${scenario.insurance_company}_${scenario.vehicle_type}_ROLLOVER_01`,
          category:
            scenario.vehicle_type === "4W" ? "four_wheeler" : "two_wheeler",
          journey_type: scenario.journey_type || "Rollover",
          registration_number: "",
          make_model:
            scenario.vehicle_type === "4W" ? "HONDA CITY" : "HONDA ACTIVA",
          variant: "Standard",
          registration_date: dates.registration_date,
          rto: "KA01",
          owned_by: "Individual",
          is_ownership_changed: scenario.ownership_changed || "No",
          previous_expiry_date: dates.previous_expiry_date,
          offset_previous_expiry_date: scenario.expiry_days
            ? String(scenario.expiry_days)
            : "",
          previous_insurer: scenario.insurance_company || "HDFC",
          previous_tp_expiry_date: dates.previous_tp_expiry_date,
          offset_previous_tp_expiry_date: "",
          previous_tp_insurer: scenario.insurance_company || "HDFC",
          not_sure: "",
          know_previous_tp_expiry_date: "Yes",
          not_sure_previous_tp_expiry_date: "",
          claim_taken: scenario.claim_taken || "No",
          previous_ncb: scenario.previous_ncb || "0%",
          product_code:
            scenario.product_code ||
            `${scenario.insurance_company}_${scenario.vehicle_type}_COMPREHENSIVE`,
          customer_name: "Nisha",
          contact_number: "8970985822",
          idv:
            scenario.idv || (scenario.vehicle_type === "2W" ? 100000 : 500000),
          NCB_two: "",
          addons: getRandomAddons(
            scenario.product_code.includes("COMPREHENSIVE"),
            scenario.product_code.includes("THIRD_PARTY"),
            scenario.include_all_addons || false,
            scenario.specified_addons || []
          ),
          discounts: getRandomDiscounts(scenario.specified_discounts || []),
          select_tab: scenario.product_code.includes("THIRD_PARTY")
            ? "Third Party"
            : "Comprehensive",
          email: "nisha.kalpathri@riskcovry.com",
          kyc: getRandomKyc(scenario.specified_kyc),
          kyc_verification: "Pending",
          proposal_questions: {
            manufacturing_year: scenario.manufacturing_year || "2025",
            registration_number: "",
            engine_number: "234we32432",
            chassis_number: "78u781678936y6789",
            financier_name: "",
            financier_type: "",
            valid_puc: "Yes",
            puc_number: "PUC123456",
            puc_expiry: dates.puc_expiry,
            previous_policy_expiry_date: dates.previous_expiry_date,
            previous_tp_policy_expiry_date: dates.previous_tp_expiry_date,
            proposer_email: "nisha.kalpathri@riskcovry.com",
            proposer_phone_number: "8970985822",
            address: {
              address_line_1: "D/O SUBBARAO",
              address_line_2: "SHIVAJI NAGAR",
              pincode: "590001",
              city: "Belgaum",
              state: "Karnataka",
            },
            gstin: "27AAUFM1756H1ZT",
            company_name: "UMBO IDTECH PRIVATE LIMITED",
            is_address_same: "Yes",
            registration_address: "",
            previous_policy_carrier_code: "",
            previous_policy_type: "",
            previous_policy_number: "",
            previous_tp_policy_start_date: "",
            previous_tp_policy_carrier_code: "",
            previous_tp_policy_number: "",
            NO_PA_Cover: "",
          },
          is_inspection_required: scenario.is_inspection_required || "No",
          carrier_name: scenario.insurance_company || "HDFC",
        };
      });
    }

    if (!Array.isArray(testData) || !testData.length) {
      throw new Error("Invalid test data format");
    }

    tbody.innerHTML = "";
    testData.forEach((row, index) => {
      console.log(`Rendering UI row ${index}:`, JSON.stringify(row, null, 2));
      const tr = document.createElement("tr");
      tr.innerHTML = headers
        .map((h) => {
          let value = row[h] ?? "";
          if (typeof value === "object" && value !== null) {
            value = JSON.stringify(value);
          }
          return `<td class="px-4 py-3 text-sm text-gray-800">${value}</td>`;
        })
        .join("");
      tbody.appendChild(tr);
    });

    results.classList.remove("hidden");
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
    generateBtn.disabled = false;
  }
});
