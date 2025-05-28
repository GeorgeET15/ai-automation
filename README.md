# Prompting Guide for Insurance Test Case Generation

This guide helps you create prompts to generate test cases for 4-wheeler (4W) or 2-wheeler (2W) insurance policies using the application. Enter scenarios in the UI’s scenario input and product code(s) in the Product Code field. The app processes these to create test cases with fields like `Testcase_id`, `category`, `addons`, `discounts`, `previous_expiry_date`, and `carrier_name`. Results appear in the UI and export as a CSV file. If the server fails, an error like "Generation failed" displays.

## How It Works

- **Prompts**: Write natural language scenarios describing the test case (e.g., journey type, addons, discounts). Vehicle type (2W/4W) is derived from the product code, so it’s not needed in the scenario.
- **Product Code**: Enter a product code (e.g., `RELIANCE_2W_THIRD_PARTY`) in the UI. For multiple scenarios, enter codes separated by commas (e.g., `HDFC_4W_COMPREHENSIVE,TATA_2W_THIRD_PARTY`).
- **Insurer and Vehicle Type**: The insurer (e.g., `Reliance General Insurance Co. Ltd.`) and vehicle type (2W/4W) are extracted from the product code prefix and type (e.g., `RELIANCE` and `2W`).
- **Output**: Each scenario generates one test case. Empty fields like `addons` or `discounts` are set to `""`. If the API fails, no mock data is used; instead, a "Generation failed" error appears.

### Example

- **Scenarios**:
  1. `rollover less than 90 days with all addons without discounts`
  2. `new business without addons without discounts`
- **Product Codes**: `RELIANCE_2W_THIRD_PARTY,TATA_4W_COMPREHENSIVE`
- **Output**:
  - Test Case 1: 2W, Reliance, rollover, expiry within 90 days (e.g., `15/03/2025`), all addons, no discounts, `carrier_name`: `Reliance General Insurance Co. Ltd.`.
  - Test Case 2: 4W, Tata, new business, no addons, no discounts, `carrier_name`: `Tata AIG General Insurance Co. Ltd.`.

## Writing Prompts

Include these in your scenario, in any order. Required items are marked with an asterisk (\*). The product code is entered separately in the UI and provides the vehicle type (2W/4W) and insurer.

1. **Product Code\* (Entered in UI)**:

   - Format: Typically `INSURER_VEHICLE_TYPE_POLICY_TYPE` (e.g., `RELIANCE_2W_THIRD_PARTY`, `HDFC_4W_COMPREHENSIVE`). The system is flexible, but this format is expected.
   - Insurer: Derived from prefix (e.g., `RELIANCE` → `Reliance General Insurance Co. Ltd.`). Must match a valid insurer.
   - Vehicle Type: Extracted from `2W` or `4W` (case-insensitive) in the code; defaults to 2W if unclear.
   - Policy Type: Optional (e.g., `COMPREHENSIVE`, `THIRD_PARTY`, `OD_ONLY`). Affects `select_tab`.
   - For multiple scenarios, enter codes in order, separated by commas.
   - Example: `RELIANCE_2W_THIRD_PARTY`, `TATA_4W_COMPREHENSIVE`.
   - Sets: `product_code`, `carrier_name`, `previous_insurer`, `select_tab`, `category` (`four_wheeler` or `two_wheeler`), `make_model` (e.g., "HONDA CITY" for 4W, "HONDA ACTIVA" for 2W), `idv` (500000 for 4W, 100000 for 2W).

2. **Journey Type and Expiry**:

   - Specify: `new business`, `rollover`, or `not sure`.
   - For rollover, add expiry: `rollover less than X days` or `expired within X days` (X is a number, e.g., 90).
   - Example: `rollover less than 90 days`, `new business`.
   - Sets:
     - `journey_type`: "New Business", "Rollover", or "Not Sure".
     - `previous_expiry_date`: For rollover, a date within X days before today (e.g., `29/02/2025`–`27/05/2025` for `28/05/2025`), at least 1 year after `manufacturing_year`.
     - `is_inspection_required`: "Yes" (rollover), "No" (new business).
     - `previous_ncb`: "0%" (default for rollover), varies for others.
     - `previous_insurer`: Different from `carrier_name` for rollover.

3. **Addons\* (All, None, or Specific)**:

   - Options:
     - `with all addons`: All available addons (e.g., `ZERO_DEPRECIATION_COVER`, `PERSONAL_ACCIDENT`).
     - `without addons`: `addons=""`.
     - `with specified addons X,Y`: List specific addons (e.g., `engine protection, personal accident`).
   - Example: `with all addons`, `without addons`.
   - Sets `addons`: Array (e.g., `[{"insurance_cover_code":"ENGINE_PROTECTION"}]` or `""`).
   - Note: Third-party policies only allow `PERSONAL_ACCIDENT`.

4. **Discounts\* (None or Specific)**:

   - Options:
     - `without discounts`: `discounts=""`.
     - `with discounts X,Y`: List specific discounts (e.g., `anti theft discount`).
   - Example: `without discounts`, `with discounts ncb protection`.
   - Sets `discounts`: Array (e.g., `[{"discount_code":"ANTI_THEFT_DISCOUNT","sa":""}]` or `""`).

5. **KYC (Optional)**:

   - Specify: `kyc ovd`, `kyc pan`, or `kyc ckyc number`.
   - If omitted, a random KYC is chosen.
   - Example: `kyc pan`.
   - Sets `kyc`: e.g., `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`.

6. **Ownership (Optional)**:

   - Specify: `owned by individual` or `owned by company`.
   - If omitted, defaults to `Individual`.
   - Example: `owned by company`.
   - Sets `owned_by`: "Individual" or "Company".
   - Affects `proposal_questions`: Includes `CUSTOMER_QUESTIONS` for Individual, `COMPANY_QUESTIONS` for Company (mutually exclusive).

## Rules

- **Required**:
  - Scenario: Addon instructions, discount instructions.
  - UI: Product code(s). For multiple scenarios, use commas (e.g., `RELIANCE_2W_THIRD_PARTY,TATA_4W_COMPREHENSIVE`).
- **Case Insensitive**: `rollover` or `ROLLOVER`, `2W` or `2w` in product code.
- **Product Code**:
  - Provides vehicle type (2W/4W) and insurer; vehicle type defaults to 2W if unclear.
  - Number of codes must equal number of scenarios.
  - Insurer prefix must match a valid insurer in the mapping.
- **Dates**: Format `DD/MM/YYYY`, relative to today (`28/05/2025`). No `NaN/NaN/NaN` values.
- **Empty Fields**: `addons`, `discounts` are `""` when empty.
- **Registration Number**: Non-empty (e.g., `KA01XX1234`) in `registration_number` and `proposal_questions`.
- **Valid Addons**: `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`.
- **Valid Discounts**: `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`.
- **Rollover**: `previous_insurer` differs from `carrier_name`; `previous_expiry_date` is at least 1 year after `manufacturing_year`.

## Tips

- **Use Clear Scenarios**: Write simple phrases, e.g., `rollover less than 90 days with all addons without discounts`.
- **Order Codes Correctly**: For multiple scenarios, list product codes in the same order as scenarios.
- **Specify Expiry for Rollover**: Use `rollover less than X days` to set `previous_expiry_date`.
- **Test One Scenario First**: Submit one scenario and code, check the CSV, then try multiple.
- **Check Product Code**: Ensure prefix (e.g., `RELIANCE`) matches a valid insurer and includes `2W` or `4W`.

## Examples

1. **Single Scenario**

   - **Scenario**: `rollover less than 90 days with all addons without discounts kyc pan owned by individual`
   - **Product Code**: `RELIANCE_2W_THIRD_PARTY`
   - **Output**:
     - `Testcase_id`: `Reliance General Insurance Co. Ltd._2W_ROLLOVER_01`
     - `category`: `two_wheeler`
     - `journey_type`: `Rollover`
     - `registration_number`: `KA01XY1234`
     - `previous_expiry_date`: e.g., `15/03/2025`
     - `product_code`: `RELIANCE_2W_THIRD_PARTY`
     - `carrier_name`: `Reliance General Insurance Co. Ltd.`
     - `previous_insurer`: e.g., `Tata AIG General Insurance Co. Ltd.`
     - `addons`: `[{"insurance_cover_code":"PERSONAL_ACCIDENT"}]`
     - `discounts`: `""`
     - `kyc`: `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`
     - `owned_by`: `Individual`
     - `proposal_questions`: Includes `CUSTOMER_QUESTIONS`, excludes `COMPANY_QUESTIONS`

2. **Two Scenarios**

   - **Scenarios**:
     1. `rollover less than 15 days with specified addons engine protection without discounts owned by company`
     2. `new business without addons without discounts`
   - **Product Codes**: `HDFC_4W_COMPREHENSIVE,TATA_2W_THIRD_PARTY`
   - **Output**:
     - Test Case 1:
       - `Testcase_id`: `HDFC ERGO General Insurance Co. Ltd._4W_ROLLOVER_01`
       - `category`: `four_wheeler`
       - `journey_type`: `Rollover`
       - `registration_number`: `KA01AB1234`
       - `previous_expiry_date`: e.g., `20/05/2025`
       - `product_code`: `HDFC_4W_COMPREHENSIVE`
       - `carrier_name`: `HDFC ERGO General Insurance Co. Ltd.`
       - `previous_insurer`: e.g., `Bajaj Allianz General Insurance Co. Ltd.`
       - `addons`: `[{"insurance_cover_code":"ENGINE_PROTECTION"}]`
       - `discounts`: `""`
       - `owned_by`: `Company`
       - `proposal_questions`: Includes `COMPANY_QUESTIONS`, excludes `CUSTOMER_QUESTIONS`
     - Test Case 2:
       - `Testcase_id`: `Tata AIG General Insurance Co. Ltd._2W_NEW_01`
       - `category`: `two_wheeler`
       - `journey_type`: `New Business`
       - `registration_number`: `KA01CD5678`
       - `previous_expiry_date`: `""`
       - `product_code`: `TATA_2W_THIRD_PARTY`
       - `carrier_name`: `Tata AIG General Insurance Co. Ltd.`
       - `addons`: `""`
       - `discounts`: `""`
       - `owned_by`: `Individual`
       - `proposal_questions`: Includes `CUSTOMER_QUESTIONS`, excludes `COMPANY_QUESTIONS`

## CSV Output

- **Format**: Each test case is a row with columns like `Testcase_id`, `category`, `carrier_name`, etc.
- **Empty Fields**: `addons`, `discounts` are `""` in empty cells.
- **JSON Fields**: `addons`, `discounts`, `kyc`, `proposal_questions` are JSON strings (e.g., `"[{""insurance_cover_code"":""ENGINE_PROTECTION""}]"`).
- **Dates**: Check `previous_expiry_date` for rollover cases (format `DD/MM/YYYY`).
- **Carrier Name**: Full insurer name (e.g., `Reliance General Insurance Co. Ltd.`).

## Troubleshooting

- **Error: "At least one scenario is required"**: Add a scenario in the UI.
- **Error: "Number of product codes must match number of scenarios"**: Ensure the number of codes (comma-separated) equals the number of scenarios.
- **Error: "Generation failed: ..."**: Check if the server is running (`http://localhost:3000`) or if the product code prefix is valid. Verify scenario syntax.
- **Empty Carrier Name**: Ensure the product code prefix (e.g., `RELIANCE`) matches a valid insurer.
- **Invalid Dates**: Dates are validated to avoid `NaN/NaN/NaN`. If issues persist, check server logs.
- **Contact Support**: Share your scenarios, product codes, error message, and CSV output.

## Extra Features

- **Proposal Overrides**: Add JSON in the "Proposal Overrides" field to customize `proposal_questions` (e.g., `{"manufacturing_year":"2023"}`).
- **Multiple Scenarios**: Add multiple scenarios with matching product codes for batch processing.
- **Dynamic Dates**: Dates adjust to today’s date (`28/05/2025`).
- **Registration Number**: Always non-empty (e.g., `KA01XX1234`) in `registration_number` and `proposal_questions`.

Use this guide to write clear scenarios and product codes for accurate test cases.
