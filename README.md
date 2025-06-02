# Prompting Guide for Insurance Test Case Generation

This guide helps you create prompts to generate test cases for 4-wheeler (4W) or 2-wheeler (2W) insurance policies using the application. Enter scenarios in the UI’s scenario input and product code(s) in the Product Code field. The app processes these to create test cases with fields like `Testcase_id`, `category`, `addons`, `discounts`, `previous_expiry_date`, `carrier_name`, `make_model`, and `variant`. Results appear in the UI and export as a CSV file. If the server fails, an error message like "Generation failed" displays.

## How It Works

- **Prompts**: Write natural language scenarios describing the test case (e.g., journey type, addons, discounts, optional model, and variant). Vehicle type (2W/4W) is derived from the product code’s category mapping, so it’s not needed in the scenario.
- **Product Code**: Enter a product code (e.g., `RELIANCE_TW_COMPREHENSIVE`) in the UI. For multiple scenarios, enter codes separated by commas (e.g., `HDFC_ERGO_PC_COMPREHENSIVE,TATA_AIG_TW_COMPREHENSIVE`).
- **Insurer and Vehicle Type**: The insurer (e.g., `Reliance General Insurance Co. Ltd.`) and vehicle type (2W/4W) are extracted from the product code’s metadata.
- **Output**: Each scenario generates one test case. Empty fields like `addons` or `discounts` are set to `[]`. If the API fails, no mock data is used; instead, a "Generation failed" error appears.

### Example

- **Scenarios**:
  1. `rollover less than 90 days with all addons without discounts model Honda Activa variant Standard`
  2. `new business without addons without discounts`
- **Product Codes**: `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`
- **Output**:
  - Test Case 1: 2W, Reliance, rollover, expiry within 90 days (e.g., `01/03/2025`), all addons, no discounts, `carrier_name`: `Reliance General Insurance Co. Ltd.`, `make_model`: `HONDA ACTIVA`, `variant`: `Standard`.
  - Test Case 2: 4W, HDFC Ergo, new business, no addons, no discounts, `carrier_name`: `HDFC ERGO General Insurance Co. Ltd.`, `make_model`: `HONDA CITY`, `variant`: `Standard`.

## Writing Prompts

Include these in your scenario, in any order. Required items are marked with an asterisk (\*). The product code is entered separately in the UI and provides the vehicle type (2W/4W) and insurer.

1. **Product Code\* (Entered in UI)**:

   - **Format**: A unique identifier for the insurance product (e.g., `RELIANCE_TW_COMPREHENSIVE`, `HDFC_ERGO_PC_COMPREHENSIVE`). Must match an entry in the system’s product database (`productData` in `data.js`).
   - **Insurer**: Derived from the product code’s `insurance_company_code` (e.g., `RELIANCE_MOTOR` → `Reliance General Insurance Co. Ltd.` via `insurerCodeToName`). Must correspond to a valid insurer.
   - **Vehicle Type**: Determined by the product’s `category_code`: `TWO_WHEELER_RETAIL` for 2W, `MOTOR_RETAIL` for 4W.
   - **Policy Type**: Inferred from the code (e.g., `COMPREHENSIVE`, `THIRD_PARTY`, `OD_ONLY`). Affects `select_tab` (e.g., "Third Party" or "Comprehensive").
   - **Multiple Scenarios**: Enter codes in order, separated by commas (e.g., `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`).
   - **Example**: `RELIANCE_TW_COMPREHENSIVE`, `HDFC_ERGO_PC_COMPREHENSIVE`.
   - **Sets**: `product_code`, `carrier_name`, `previous_insurer`, `select_tab`, `category` (`MOTOR_RETAIL` or `TWO_WHEELER_RETAIL`), `idv` (500000 for 4W, 100000 for 2W).

2. **Journey Type and Expiry**:

   - **Specify**: `new business`, `rollover`, or `not sure`.
   - **For rollover**, add expiry: `rollover less than X days` or `expired within X days` (X is a number, e.g., 90).
   - **Example**: `rollover less than 90 days`, `new business`.
   - **Sets**:
     - `journey_type`: `new_business`, `without_registration`, or `not_sure`.
     - `previous_expiry_date`: For rollover, a date within X days before today (e.g., `01/03/2025`–`30/05/2025` for May 30, 2025), at least 1 year after `registration_date`.
     - `is_inspection_required`: `Yes` for rollover with expiry ≥90 days, `No` otherwise.
     - `previous_ncb`: `0%` (default for rollover).
     - `previous_insurer`: Different from `carrier_name` for rollover.

3. **Addons\* (All, None, or Specific)**:

   - **Options**:
     - `with all addons`: All available addons from `staticData.addons` (e.g., `ZERO_DEPRECIATION_COVER`, `PERSONAL_ACCIDENT`).
     - `without addons`: `addons: []`.
     - `with specified addons X,Y`: List specific addons (e.g., `engine protection, personal accident`).
   - **Example**: `with all addons`, `without addons`.
   - **Sets** `addons`: Array of objects (e.g., `[{insurance_cover_code: "ENGINE_PROTECTION", sa: ""}]` or `[]`).
   - **Note**: Third-party policies only allow `PERSONAL_ACCIDENT`.

4. **Discounts\* (None or Specific)**:

   - **Options**:
     - `without discounts`: `discounts: []`.
     - `with discounts X,Y`: List specific discounts (e.g., `anti theft discount`).
   - **Example**: `without discounts`, `with discounts ncb protection`.
   - **Sets** `discounts`: Array of objects (e.g., `[{discount_code: "ANTI_THEFT_DISCOUNT", sa: ""}]` or `[]`).

5. **KYC (Optional)**:

   - **Specify**: `kyc ovd`, `kyc pan`, or `kyc ckyc number`.
   - **If omitted**, defaults to `OVD` from `staticData.kyc_format`.
   - **Example**: `kyc pan`.
   - **Sets** `kyc`: e.g., `[{PAN: {pan: "GTTPK1088Q", dob: "28/10/1994"}}]`.

6. **Ownership (Optional)**:

   - **Specify**: `owned by individual` or `owned by company`.
   - **If omitted**, defaults to `Individual`.
   - **Example**: `owned by company`.
   - **Sets** `owned_by`: `Individual` or `Company`.
   - **Affects** `proposal_questions`: Includes `CUSTOMER_QUESTIONS` (e.g., `proposer_first_name`) for Individual, `COMPANY_QUESTIONS` (e.g., `company_gstin`) for Company.

7. **Model (Optional)**:

   - **Specify**: `model X` where X is the vehicle model (e.g., `Honda Activa`, `Maruti Swift`).
   - **If omitted**, defaults to `HONDA ACTIVA` (2W) or `HONDA CITY` (4W).
   - **Example**: `model Honda Activa`.
   - **Sets** `make_model`: e.g., `HONDA ACTIVA`.

8. **Variant (Optional)**:

   - **Specify**: `variant X` where X is the vehicle variant (e.g., `Standard`, `ZX`).
   - **If omitted**, defaults to `Standard`.
   - **Example**: `variant Standard`.
   - **Sets** `variant`: e.g., `Standard`.

## Rules

- **Required**:
  - **Scenario**: Addon and discount instructions.
  - **UI**: Product code(s). For multiple scenarios, use commas (e.g., `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`).
- **Case Insensitive**: `rollover` or `ROLLOVER`, `model` or `MODEL`.
- **Product Code**:
  - Must exist in `productData`.
  - Number of codes must match number of scenarios.
  - `insurance_company_code` must map to a valid insurer in `insurerCodeToName`.
- **Dates**: Format `DD/MM/YYYY`, relative to today (May 30, 2025). No `NaN/NaN/NaN`.
- **Empty Fields**: `addons`, `discounts` are `[]` when empty.
- **Registration Number**: Matches regex `^([A-Z]{2}\d{2}[A-Z]{0,3}\d{4})$` (e.g., `KA01AB1234`) in `registration_number` and `proposal_questions`.
- **Valid Addons**: `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`.
- **Valid Discounts**: `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`.
- **Rollover**: `previous_insurer` differs from `carrier_name`; `previous_expiry_date` is ≥1 year after `registration_date`.

## Prompting Tips

1. **Clear Scenarios**:

   - Use keywords: `rollover`, `new business`, `with addons`, `model X`.
   - Example: `rollover less than 90 days with all addons without discounts model Honda Activa`.

2. **Valid Product Codes**:

   - Check `productData` for codes like `RELIANCE_TW_COMPREHENSIVE`.
   - Example: `HDFC_ERGO_PC_COMPREHENSIVE` for 4W.

3. **Precise Expiry**:

   - Use `rollover less than X days` (e.g., `90` → `01/03/2025`–`30/05/2025`).
   - Example: `rollover less than 15 days`.

4. **Valid Addons/Discounts**:

   - Use exact names: `ENGINE_PROTECTION`, `ANTI_THEFT_DISCOUNT`.
   - Example: `with addons engine protection personal accident without discounts`.

5. **Optional Fields**:

   - Specify `model`, `variant`, `kyc`, `owned_by` for customization.
   - Example: `model Yamaha FZ variant S kyc pan owned by company`.

6. **Avoid Errors**:

   - Match scenario and product code counts.
   - Use valid codes to avoid `Product code not found`.

7. **Test Incrementally**:

   - Start with one scenario (e.g., `new business without addons without discounts` with `RELIANCE_TW_COMPREHENSIVE`).

8. **Proposal Overrides**:

   - Use JSON (e.g., `{"manufacturing_year":"2023"}`) in the UI’s "Proposal Overrides" field.

9. **Debug Errors**:

   - Check UI errors (e.g., `Generation failed`), browser console, or `error.log`.
   - Example: Empty `carrier_name` → verify `insurance_company_code`.

10. **Edge Cases**:

    - Test `rollover less than 1 day`, `owned by company with kyc ckyc number`.
    - Example: `rollover less than 30 days with addons personal accident model Yamaha FZ`.

11. **Backend Defaults**:
    - Defaults: `owned_by`: `Individual`, `make_model`: `HONDA ACTIVA` (2W) or `HONDA CITY` (4W), `variant`: `Standard`.
    - Hardcoded: `proposer_pan`: `GTTPK1088Q`, `proposer_dob`: `28/10/1994`.

## Examples

1. **Single Scenario**:

   - **Scenario**: `rollover less than 90 days with all addons without discounts model Honda Activa variant Standard kyc pan owned by individual`
   - **Product Code**: `RELIANCE_TW_COMPREHENSIVE`
   - **Output**:
     - `Testcase_id`: `RELIANCE_2W_WITHOUT_REGISTRATION_01`
     - `category`: `TWO_WHEELER_RETAIL`
     - `journey_type`: `without_registration`
     - `registration_number`: `KA01XY1234`
     - `make_model`: `HONDA ACTIVA`
     - `variant`: `Standard`
     - `previous_expiry_date`: `15/03/2025`
     - `product_code`: `RELIANCE_TW_COMPREHENSIVE`
     - `carrier_name`: `Reliance General Insurance Co. Ltd.`
     - `previous_insurer`: `Tata AIG General Insurance Co. Ltd.`
     - `addons`: `[{insurance_cover_code: "PERSONAL_ACCIDENT", sa: ""}, ...]`
     - `discounts`: `[]`
     - `kyc`: `[{PAN: {pan: "GTTPK1088Q", dob: "28/10/1994"}}]`
     - `owned_by`: `Individual`

2. **Two Scenarios**:
   - **Scenarios**:
     1. `rollover less than 15 days with addons engine protection without discounts model Maruti Swift variant ZX owned by company`
     2. `new business without addons without discounts`
   - **Product Codes**: `HDFC_ERGO_PC_COMPREHENSIVE,RELIANCE_TW_THIRD_PARTY`
   - **Output**:
     - **Test Case 1**:
       - `Testcase_id`: `HDFC_ERGO_4W_WITHOUT_REGISTRATION_01`
       - `category`: `MOTOR_RETAIL`
       - `journey_type`: `without_registration`
       - `make_model`: `MARUTI SWIFT`
       - `variant`: `ZX`
       - `previous_expiry_date`: `15/05/2025`
       - `carrier_name`: `HDFC ERGO General Insurance Co. Ltd.`
       - `addons`: `[{insurance_cover_code: "ENGINE_PROTECTION", sa: ""}]`
       - `discounts`: `[]`
       - `owned_by`: `Company`
     - **Test Case 2**:
       - `Testcase_id`: `RELIANCE_2W_NEW_BUSINESS_01`
       - `category`: `TWO_WHEELER_RETAIL`
       - `journey_type`: `new_business`
       - `make_model`: `HONDA ACTIVA`
       - `variant`: `Standard`
       - `previous_expiry_date`: `""`
       - `carrier_name`: `Reliance General Insurance Co. Ltd.`
       - `addons`: `[]`
       - `discounts`: `[]`
       - `owned_by`: `Individual`

## CSV Output

- **Columns**: `Testcase_id`, `category`, `carrier_name`, `make_model`, `variant`, etc.
- **Empty Fields**: `addons`, `discounts` as `[]`.
- **JSON Fields**: `addons`, `discounts`, `kyc`, `proposal_questions` as JSON strings.
- **Dates**: `previous_expiry_date` in `DD/MM/YYYY`.

## Troubleshooting

- **Error: "At least one scenario is required"**: Add a scenario.
- **Error: "Number of product codes must match number of scenarios"**: Match counts.
- **Error: "Generation failed"**: Check server (`http://localhost:3000`) and product code.
- **Empty Carrier Name**: Verify `insurance_company_code` in `insurerCodeToName`.
- **Contact Support**: Share scenarios, codes, errors, and CSV.

## Extra Features

- **Proposal Overrides**: JSON in "Proposal Overrides" (e.g., `{"manufacturing_year":"2023"}`).
- **Multiple Scenarios**: Batch process with matching codes.
- **Dynamic Dates**: Relative to May 30, 2025.
