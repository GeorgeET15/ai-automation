let testData = [];

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

function escapeCsvValue(value, header) {
  if (value === null || value === undefined) return "";
  if (header === "addons" || header === "discounts") {
    if (Array.isArray(value) && value.length === 0) return "";
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

  const li = document.createElement("li");
  li.className = "flex justify-between items-center bg-gray-50 p-3 rounded-md";
  li.innerHTML = `
    <span class="text-sm">${scenarioText}</span>
    <button type="button" class="remove-scenario-btn inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none">
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
  const csvRows = testData.map((row) =>
    headers.map((h) => escapeCsvValue(row[h], h)).join(",")
  );
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

  if (generateBtn.disabled) return;

  loading.classList.remove("hidden");
  error.classList.add("hidden");
  results.classList.add("hidden");
  generateBtn.disabled = true;

  try {
    testData = [];
    const scenarioInputs = Array.from(scenarioList.querySelectorAll("span"))
      .map((span) => span.textContent.trim())
      .filter((value) => value);
    const productCodes = document
      .getElementById("productCodeInput")
      .value.split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    if (!scenarioInputs.length) {
      showCustomDialog("At least one scenario is required");
      throw new Error("At least one scenario is required");
    }
    if (productCodes.length !== scenarioInputs.length) {
      showCustomDialog(
        "Number of product codes must match number of scenarios"
      );
      throw new Error("Product code count mismatch");
    }

    const proposalOverrides = document
      .getElementById("proposal_overrides")
      .value.trim();

    // Call /api/parse
    const parseResponse = await fetch("http://localhost:3000/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarios: scenarioInputs.map((text, i) => ({
          text,
          product_code: productCodes[i],
        })),
        proposal_overrides: proposalOverrides,
      }),
    });

    if (!parseResponse.ok) {
      const err = await parseResponse.json();
      throw new Error(err.error || "Failed to parse scenarios");
    }

    const structuredData = await parseResponse.json();

    if (!structuredData.scenarios || !structuredData.proposal_questions) {
      throw new Error(
        "Invalid response: missing scenarios or proposal_questions"
      );
    }

    // Call /api/generate
    const generateResponse = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarios: structuredData.scenarios,
        proposal_questions: structuredData.proposal_questions,
      }),
    });

    if (!generateResponse.ok) {
      const err = await generateResponse.json();
      throw new Error(err.error || "Failed to generate test data");
    }

    testData = await generateResponse.json();

    if (!Array.isArray(testData) || !testData.length) {
      throw new Error("Invalid test data format");
    }

    tbody.innerHTML = "";
    testData.forEach((row) => {
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
    error.textContent = "Generation failed: " + err.message;
    error.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
    generateBtn.disabled = false;
  }
});
