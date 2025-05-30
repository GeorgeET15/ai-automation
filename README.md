# Prompting Guide for Insurance Test Case Generation

This guide helps you create prompts to generate test cases for 4-wheeler (4W) or 2-wheeler (2W) insurance policies using the application. Enter scenarios in the UI’s scenario input and product code(s) in the Product Code field. The app processes these to create test cases with fields like `Testcase_id`, `category_code`, `addons`, `discounts`, `previous_expiry_date`, `carrier_name`, `make_model`, and `variant`. Results appear in the UI and export as a CSV file. If the server fails, an error message like "Generation failed" displays.

## How It Works

- **Prompts**: Write natural language scenarios describing the test case (e.g., journey type, addons, discounts, optional model, and variant). Vehicle type (2W/4W) is derived from the product code’s category mapping, so it’s not needed in the scenario.
- **Product Code**: Enter a product code (e.g., `RELIANCE_TW_COMPREHENSIVE`) in the UI. For multiple scenarios, enter codes separated by commas (e.g., `HDFC_ERGO_PC_COMPREHENSIVE,TATA_AIG_TW_COMPREHENSIVE`).
- **Insurer and Vehicle Type**: The insurer (e.g., `Reliance General Insurance Co. Ltd.`) and vehicle type (2W/4W) are extracted from the product code’s metadata.
- **Output**: Each scenario generates one test case. Empty fields like `addons`, or `discounts` are set to `""`. If the API fails, no mock data is used; instead, a "Generation failed" error appears.

### Example

- **Scenarios**:
  1. `rollover less than 90 days with all addons without discounts model Honda Activa variant Standard`
  2. `new business without addons without discounts`
- **Product Codes**: `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`
- **Output**:
  - Test Case 1: 2W, Reliance, rollover, expiry within 90 days (e.g., `15/03/2025`), all addons, no discounts, `carrier_name`: `Reliance General Insurance Co. Ltd.`, `make_model`: `HONDA ACTIVA`, `variant`: `Standard`.
  - Test Case 2: 4W, HDFC Ergo, new business, no addons, no discounts, `carrier_name`: `HDFC ERGO General Insurance Co. Ltd.`, `make_model`: `HONDA CITY`, `variant`: `Standard`.

## Writing Prompts

Include these in your scenario, in any order. Required items are marked with an asterisk (\*). The product code is entered separately in the UI and provides the vehicle type (2W/4W) and insurer.

1. **Product Code\* (Entered in UI)**:

   - **Format**: A unique identifier for the insurance product (e.g., `RELIANCE_TW_COMPREHENSIVE`, `HDFC_ERGO_PC_COMPREHENSIVE`). Must match an entry in the system’s product database.
   - **Insurer**: Derived from the product code’s associated `insurance_company_code` (e.g., `RELIANCE_MOTOR` → `Reliance General Insurance Co. Ltd.`). Must correspond to a valid insurer.
   - **Vehicle Type**: Determined by the product’s `category_code`: `TWO_WHEELER_RETAIL` for 2W, `MOTOR_RETAIL` for 4W. Not extracted from the product code string.
   - **Policy Type**: Optional, inferred from the code (e.g., `COMPREHENSIVE`, `THIRD_PARTY`, `OD_ONLY`). Affects `select_tab` in output.
   - **Multiple Scenarios**: Enter codes in order, separated by commas (e.g., `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`).
   - **Example**: `RELIANCE_TW_COMPREHENSIVE`, `HDFC_ERGO_PC_COMPREHENSIVE`.
   - **Sets**: `product_code`, `carrier_name`, `previous_insurer`, `select_tab`, `category` (`four_wheeler` or `two_wheeler`), `idv` (500000 for 4W, 100000 for 2W).

2. **Journey Type and Expiry**:

   - **Specify**: `new business`, `rollover`, or `not sure`.
   - **For rollover**, add expiry: `rollover less than X days` or `expired within X days` (X is a number, e.g., 90).
   - **Example**: `rollover less than 90 days`, `new business`.
   - **Sets**:
     - `journey_type`: "New Business", "Rollover", or "Not Sure".
     - `previous_expiry_date`: For rollover, a date within X days before today (e.g., `29/02/2025`–`27/05/2025` for `28/05/2025`), at least 1 year after `manufacturing_year`.
     - `is_inspection_required`: "Yes" (rollover), "No" (new business).
     - `previous_ncb`: "0%" (default for rollover), varies for others.
     - `previous_insurer`: Different from `carrier_name` for rollover.

3. **Addons\* (All, None, or Specific)**:

   - **Options**:
     - `with all addons`: All available addons (e.g., `ZERO_DEPRECIATION_COVER`, `PERSONAL_ACCIDENT`).
     - `without addons`: `addons=""`.
     - `with specified addons X,Y`: List specific addons (e.g., `engine protection, personal accident`).
   - **Example**: `with all addons`, `without addons`.
   - **Sets** `addons`: Array (e.g., `[{"insurance_cover_code":"ENGINE_PROTECTION"}]` or `""`).
   - **Note**: Third-party policies only allow `PERSONAL_ACCIDENT`.

4. **Discounts\* (None or Specific)**:

   - **Options**:
     - `without discounts`: `discounts=""`.
     - `with discounts X,Y`: List specific discounts (e.g., `anti theft discount`).
   - **Example**: `without discounts`, `with discounts ncb protection`.
   - **Sets** `discounts`: Array (e.g., `[{"discount_code":"ANTI_THEFT_DISCOUNT","sa":""}]` or `""`).

5. **KYC (Optional)**:

   - **Specify**: `kyc ovd`, `kyc pan`, or `kyc ckyc number`.
   - **If omitted**, a random KYC is chosen.
   - **Example**: `kyc pan`.
   - **Sets** `kyc`: e.g., `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`.

6. **Ownership (Optional)**:

   - **Specify**: `owned by individual` or `owned by company`.
   - **If omitted**, defaults to `Individual`.
   - **Example**: `owned by company`.
   - **Sets** `owned_by`: "Individual" or "Company".
   - **Affects** `proposal_questions`: Includes `CUSTOMER_QUESTIONS` for Individual, `COMPANY_QUESTIONS` for Company (mutually exclusive).

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
  - **Scenario**: Addon instructions, discount instructions.
  - **UI**: Product code(s). For multiple scenarios, use commas (e.g., `RELIANCE_TW_COMPREHENSIVE,HDFC_ERGO_PC_COMPREHENSIVE`).
- **Case Insensitive**: `rollover` or `ROLLOVER`, `model` or `MODEL`.
- **Product Code**:
  - Must match a valid entry in the product database.
  - Number of codes must equal number of scenarios.
  - Insurer derived from `insurance_company_code` must map to a valid insurer name.
- **Dates**: Format `DD/MM/YYYY`, relative to today (`28/05/2025`). No `NaN/NaN/NaN` values.
- **Empty Fields**: `addons`, `discounts` are `""` when empty.
- **Registration Number**: Non-empty (e.g., `KA01XX1234`) in `registration_number` and `proposal_questions`.
- **Valid Addons**: `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`.
- **Valid Discounts**: `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`.
- **Rollover**: `previous_insurer` differs from `carrier_name`; `previous_expiry_date` is at least 1 year after `manufacturing_year`.

## Prompting Tips

To create effective scenarios and avoid errors, follow these in-depth tips, tailored to the application’s behavior and backend logic:

1. **Write Clear, Structured Scenarios**:

   - Use concise phrases with clear keywords (e.g., `rollover`, `with all addons`, `model Honda Activa`). The backend parses scenarios using regex patterns (e.g., `/rollover/i`, `/model\s*(\w+)/i`).
   - Separate components with spaces or commas (e.g., `with specified addons engine protection, personal accident`).
   - Avoid ambiguous terms or punctuation that might confuse parsing (e.g., use `without discounts` instead of `no discounts`).
   - Example: `rollover less than 90 days with all addons without discounts model Honda Activa variant Standard kyc pan owned by individual`.

2. **Choose Valid Product Codes**:

   - Select product codes from the system’s product database (e.g., `RELIANCE_TW_COMPREHENSIVE`, `HDFC_ERGO_PC_COMPREHENSIVE`). Invalid codes trigger errors like `Product code not found`.
   - Verify the insurer prefix maps to a valid `insurance_company_code` in `insurerCodeToName` (e.g., `RELIANCE_MOTOR`, `HDFC_ERGO`).
   - Ensure the code’s `category_code` (`TWO_WHEELER_RETAIL` or `MOTOR_RETAIL`) aligns with the intended vehicle type (2W or 4W).
   - For multiple scenarios, list codes in the same order as scenarios to avoid mismatches.
   - Example: For a 2W test case, use `RELIANCE_TW_COMPREHENSIVE`; for 4W, use `HDFC_ERGO_PC_COMPREHENSIVE`.

3. **Specify Journey Type and Expiry Precisely**:

   - Use `new business`, `rollover`, or `not sure` explicitly. The backend defaults to `Rollover` if unclear.
   - For rollover, include `less than X days` or `expired within X days` to set `previous_expiry_date` (e.g., `rollover less than 90 days` → date between `29/02/2025` and `27/05/2025`).
   - Ensure X is a positive number; values ≥90 trigger `is_inspection_required: "Yes"`.
   - For `new business`, omit expiry details to set `previous_expiry_date` to `""`.
   - Example: `rollover less than 15 days` for a recent expiry, `new business` for no previous policy.

4. **Select Valid Addons and Discounts**:

   - Use exact addon names: `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`. Misspellings are ignored.
   - For third-party policies (e.g., `RELIANCE_TW_THIRD_PARTY`), only `PERSONAL_ACCIDENT` is allowed; others are filtered out.
   - Use `with all addons` for comprehensive policies to include all valid addons, or `without addons` for `""`.
   - For discounts, use `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`. Specify `without discounts` for `""`.
   - Example: `with specified addons engine protection, personal accident without discounts`.

5. **Leverage Optional Fields Wisely**:

   - **Model and Variant**: Specify `model X variant Y` for custom values (e.g., `model Maruti Swift variant ZX`). Defaults are `HONDA ACTIVA` (2W) or `HONDA CITY` (4W) and `Standard`.
   - **KYC**: Use `kyc ovd`, `kyc pan`, or `kyc ckyc number` to set specific KYC details. Omit for a random choice (defaults to OVD).
   - **Ownership**: Use `owned by individual` or `owned by company` to control `owned_by`. Defaults to `Individual`. Affects `proposal_questions` (e.g., `proposer_pan` for Individual, `company_gstin` for Company).
   - Example: `model Honda Activa variant Standard kyc pan owned by company`.

6. **Avoid Common Errors**:

   - **Mismatched Counts**: Ensure the number of scenarios equals the number of product codes. Error: `Number of product codes must match number of scenarios`.
   - **Invalid Product Codes**: Check codes against `productData`. Error: `Product code not found`.
   - **Missing Required Fields**: Include addon and discount instructions. Error: `At least one scenario is required`.
   - **Ambiguous Scenarios**: Avoid vague terms (e.g., `expired policy` instead of `rollover less than 90 days`).
   - Example: For two scenarios, use `scenario1;scenario2` with `CODE1,CODE2`.

7. **Test Incrementally**:

   - Start with a single scenario and product code to verify output in the UI and CSV.
   - Check `carrier_name`, `make_model`, `variant`, and `previous_expiry_date` in the CSV.
   - Add more scenarios once the first is correct.
   - Example: Test `rollover less than 90 days with all addons without discounts` with `RELIANCE_TW_COMPREHENSIVE` before adding others.

8. **Use Proposal Overrides for Customization**:

   - Add JSON in the "Proposal Overrides" field to customize `proposal_questions` (e.g., `{"manufacturing_year":"2023"}`).
   - Ensure overrides match `proposal_questions` schema to avoid validation errors.
   - Useful for testing specific values (e.g., `proposer_email`, `registration_number`).
   - Example: `{"manufacturing_year":"2022","proposer_email":"test@example.com"}`.

9. **Debug Errors Effectively**:

   - Check the UI error message (e.g., `Generation failed: Product code not found`).
   - Open the browser console (F12) for frontend errors (e.g., `Failed to fetch`).
   - Review backend logs (`error.log`) for detailed errors (e.g., `Invalid productCode`).
   - Verify scenario syntax and product code validity before retrying.
   - Example: If `carrier_name` is empty, ensure the product code’s `insurance_company_code` maps to a valid insurer in `insurerCodeToName`.

10. **Craft Complex Scenarios for Edge Cases**:

    - Test edge cases like `rollover less than 1 day`, `owned by company with kyc ckyc number`, or `with all addons with discounts ncb protection, anti theft discount`.
    - Combine multiple conditions to simulate real-world cases (e.g., `rollover less than 30 days with specified addons personal accident without discounts model Yamaha FZ variant S kyc ovd owned by individual`).
    - Ensure all components are valid to avoid parsing errors.
    - Example: `rollover less than 90 days with all addons with discounts ncb protection model Maruti Swift variant ZX kyc pan owned by company`.

11. **Align with Backend Defaults and Constraints**:
    - **Defaults**: `owned_by` → `Individual`, `make_model` → `HONDA ACTIVA` (2W) or `HONDA CITY` (4W), `variant` → `Standard`, `previous_ncb` → `0%`.
    - **Constraints**: `previous_expiry_date` must be after `registration_date` + 1 year and before `28/05/2025` minus 91 days for rollovers with expiry ≥90 days.
    - **Hardcoded Values**: `proposer_pan` → `GTTPK1088Q`, `proposer_dob` → `28/10/1994` for Individual.
    - Use these to simplify scenarios or override them explicitly.
    - Example: Omit `owned_by` to default to `Individual`, or specify `owned by company` for `company_gstin`.

## Examples

1. **Single Scenario**

   - **Scenario**: `rollover less than 90 days with all addons without discounts model Honda Activa variant Standard kyc pan owned by individual`
   - **Product Code**: `RELIANCE_TW_COMPREHENSIVE`
   - **Output**:
     - `Testcase_id`: `Reliance_General_Insurance_Co_Ltd_2W_ROLLOVER_01`
     - `category`: `two_wheeler`
     - `journey_type`: `Rollover`
     - `registration_number`: `KA01XY1234`
     - `make_model`: `HONDA ACTIVA`
     - `variant`: `Standard`
     - `previous_expiry_date`: e.g., `15/03/2025`
     - `product_code`: `RELIANCE_TW_COMPREHENSIVE`
     - `carrier_name`: `Reliance General Insurance Co. Ltd.`
     - `previous_insurer`: e.g., `Tata AIG General Insurance Co. Ltd.`
     - `addons`: `[{"insurance_cover_code":"PERSONAL_ACCIDENT"}]`
     - `discounts`: `""`
     - `kyc`: `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`
     - `owned_by`: `Individual`
     - `proposal_questions`: Includes `CUSTOMER_QUESTIONS`, excludes `COMPANY_QUESTIONS`

2. **Two Scenarios**

   - **Scenarios**:
     1. `rollover less than 15 days with specified addons engine protection without discounts model Maruti Swift variant ZX owned by company`
     2. `new business without addons without discounts`
   - **Product Codes**: `HDFC_ERGO_PC_COMPREHENSIVE,RELIANCE_TW_THIRD_PARTY`
   - **Output**:
     - **Test Case 1**:
       - `Testcase_id`: `HDFC_ERGO_General_Insurance_Co_Ltd_4W_ROLLOVER_01`
       - `category`: `four_wheeler`
       - `journey_type`: `Rollover`
       - `registration_number`: `KA01AB1234`
       - `make_model`: `MARUTI SWIFT`
       - `variant`: `ZX`
       - `previous_expiry_date`: e.g., `20/05/2025`
       - `product_code`: `HDFC_ERGO_PC_COMPREHENSIVE`
       - `carrier_name`: `HDFC ERGO General Insurance Co. Ltd.`
       - `previous_insurer`: e.g., `Bajaj Allianz General Insurance Co. Ltd.`
       - `addons`: `[{"insurance_cover_code":"ENGINE_PROTECTION"}]`
       - `discounts`: `""`
       - `owned_by`: `Company`
       - `proposal_questions`: Includes `COMPANY_QUESTIONS`, excludes `CUSTOMER_QUESTIONS`
     - **Test Case 2**:
       - `Testcase_id`: `Reliance_General_Insurance_Co_Ltd_2W_NEW_01`
       - `category`: `two_wheeler`
       - `journey_type`: `New Business`
       - `registration_number`: `KA01CD5678`
       - `make_model`: `HONDA ACTIVA`
       - `variant`: `Standard`
       - `previous_expiry_date`: `""`
       - `product_code`: `RELIANCE_TW_THIRD_PARTY`
       - `carrier_name`: `Reliance General Insurance Co. Ltd.`
       - `addons`: `""`
       - `discounts`: `""`
       - `owned_by`: `Individual`
       - `proposal_questions`: Includes `CUSTOMER_QUESTIONS`, excludes `COMPANY_QUESTIONS`

## CSV Output

- **Format**: Each test case is a row with columns like `Testcase_id`, `category`, `carrier_name`, `make_model`, `variant`, etc.
- **Empty Fields**: `addons`, `discounts` are `""` in empty cells.
- **JSON Fields**: `addons`, `discounts`, `kyc`, `proposal_questions` are JSON strings (e.g., `"[{""insurance_cover_code"":""ENGINE_PROTECTION""}]"`).
- **Dates**: Check `previous_expiry_date` for rollover cases (format `DD/MM/YYYY`).
- **Carrier Name**: Full insurer name (e.g., `Reliance General Insurance Co. Ltd.`).

## Troubleshooting

- **Error: "At least one scenario is required"**: Add a scenario in the UI.
- **Error: "Number of product codes must match number of scenarios"**: Ensure the number of codes (comma-separated) equals the number of scenarios.
- **Error: "Generation failed: ..."**: Check if the server is running (`http://localhost:3000`) or if the product code is valid. Verify scenario syntax.
- **Empty Carrier Name**: Ensure the product code’s `insurance_company_code` maps to a valid insurer.
- **Incorrect Model/Variant**: Verify `model` and `variant` syntax (e.g., `model Honda Activa variant Standard`).
- **Invalid Dates**: Dates are validated to avoid `NaN/NaN/NaN`. If issues persist, check server logs.
- **Contact Support**: Share your scenarios, product codes, error message, and CSV output.

## Extra Features

- **Proposal Overrides**: Add JSON in the "Proposal Overrides" field to customize `proposal_questions` (e.g., `{"manufacturing_year":"2023"}`).
- **Multiple Scenarios**: Add multiple scenarios with matching product codes for batch processing.
- **Dynamic Dates**: Dates adjust to today’s date.
