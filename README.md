# Prompting Guide for Insurance Test Case Generation

This guide helps you create simple prompts to generate test cases for 4-wheeler (4W) or 2-wheeler (2W) insurance policies using the application. Enter scenarios in the UI’s scenario input and a product code (or codes) in the Product Code field. The app processes these to create test cases with fields like `Testcase_id`, `category`, `addons`, `discounts`, and `previous_expiry_date`. Results appear in the UI and export as a CSV file.

## How It Works

- **Prompts**: Write natural language scenarios describing the test case (e.g., vehicle type, policy type, addons, discounts).
- **Product Code**: Enter a product code (e.g., `BAJAJ_4W_COMPREHENSIVE`) in the UI. For multiple scenarios, enter codes separated by commas (e.g., `BAJAJ_4W_COMPREHENSIVE,TATA_2W_THIRD_PARTY`).
- **Insurer**: The insurer (e.g., Bajaj) is taken from the product code prefix. Any insurer is allowed.
- **Output**: Each scenario generates one test case. Empty fields like `addons` or `discounts` are set to `""`.

### Example

- **Scenarios**:
  1. `rollover less than 30 days with all addons without discounts 4w`
  2. `new business without addons without discounts 2w`
- **Product Codes**: `BAJAJ_4W_COMPREHENSIVE,TATA_2W_THIRD_PARTY`
- **Output**:
  - Test Case 1: 4W, Bajaj, rollover, expiry within 30 days (e.g., 15/05/2025), all addons, no discounts.
  - Test Case 2: 2W, Tata, new business, no addons, no discounts.

## Writing Prompts

Include these in your scenario, in any order. Required items are marked with an asterisk (\*). The product code is entered separately in the UI.

1. **Vehicle Type\* (4W or 2W)**:

   - Specify `4W` (car) or `2W` (bike).
   - Example: `4W`, `2W`.
   - Sets `category`: `four_wheeler` or `two_wheeler`.
   - Sets `make_model`: e.g., "HONDA CITY" (4W), "HONDA ACTIVA" (2W).
   - Sets `idv`: 500000 (4W), 100000 (2W).

2. **Product Code\* (Entered in UI)**:

   - Format: `INSURER_VEHICLE_TYPE_POLICY_TYPE` (e.g., `BAJAJ_4W_COMPREHENSIVE`).
   - Insurer (e.g., `BAJAJ`) is derived from the prefix.
   - Vehicle type (`4W` or `2W`) must match the scenario.
   - Policy type: `COMPREHENSIVE`, `THIRD_PARTY`, or `OD_ONLY`.
   - For multiple scenarios, enter codes in order, separated by commas.
   - Example: `TATA_2W_THIRD_PARTY`, `HDFC_4W_COMPREHENSIVE`.
   - Sets: `product_code`, `carrier_name`, `previous_insurer`, `select_tab`.

3. **Journey Type and Expiry**:

   - Specify: `new business`, `rollover`, or `not sure`.
   - For rollover, add expiry: `rollover less than X days` or `expired within X days` (X is a number, e.g., 30).
   - Example: `rollover less than 30 days`, `new business`.
   - Sets:
     - `journey_type`: "New Business", "Rollover", or "Not Sure".
     - `previous_expiry_date`: For rollover, a date within X days before today (e.g., 29/04/2025–27/05/2025 for 28/05/2025).
     - `is_inspection_required`: "Yes" (rollover), "No" (new business).
     - `previous_ncb`: "0%" (rollover), "20%" (new business).

4. **Addons\* (All, None, or Specific)**:

   - Options:
     - `with all addons`: All available addons (e.g., `ZERO_DEPRECIATION_COVER`, `PERSONAL_ACCIDENT`).
     - `without addons`: `addons: ""`.
     - `with specified addons X,Y`: List specific addons (e.g., `engine protection, personal accident`).
   - Example: `with all addons`, `without addons`.
   - Sets `addons`: Array (e.g., `[{"insurance_cover_code":"ENGINE_PROTECTION"}]` or `""`).
   - Note: Third-party policies only allow `PERSONAL_ACCIDENT`.

5. **Discounts\* (None or Specific)**:

   - Options:
     - `without discounts`: `discounts: ""`.
     - `with discounts X,Y`: List specific discounts (e.g., `anti theft discount`).
   - Example: `without discounts`, `with discounts ncb protection`.
   - Sets `discounts`: Array (e.g., `[{"discount_code":"ANTI_THEFT_DISCOUNT","sa":""}]` or `""`).

6. **KYC (Optional)**:
   - Specify: `kyc ovd`, `kyc pan`, or `kyc ckyc number`.
   - If omitted, a random KYC is chosen.
   - Example: `kyc pan`.
   - Sets `kyc`: e.g., `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`.

## Rules

- **Required**:
  - Scenario: Vehicle type, addon instructions, discount instructions.
  - UI: Product code(s). For multiple scenarios, use commas (e.g., `CODE1,CODE2`).
- **Case Insensitive**: `4W` or `4w` works.
- **Product Code**:
  - Vehicle type must match scenario’s `4W`/`2W`.
  - Number of codes must equal number of scenarios.
- **Dates**: Format `DD/MM/YYYY`, relative to today (28/05/2025).
- **Empty Fields**: `addons`, `discounts` are `""` when empty.
- **Valid Addons**: `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`.
- **Valid Discounts**: `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`.

## Tips

- **Match Product Codes**: Ensure scenario vehicle type matches product code (e.g., `4W` with `BAJAJ_4W_...`).
- **Clear Scenarios**: Use simple phrases, e.g., `rollover less than 30 days with all addons without discounts 4w`.
- **Order Codes Correctly**: For multiple scenarios, list product codes in the same order (first code for first scenario).
- **Check Expiry**: For rollover, specify `rollover less than X days` to set `previous_expiry_date`.
- **Test One Scenario First**: Submit one scenario and code, check the CSV, then try multiple.

## Examples

1. **Single Scenario**

   - **Scenario**: `rollover less than 30 days with all addons without discounts 4w kyc pan`
   - **Product Code**: `BAJAJ_4W_COMPREHENSIVE`
   - **Output**:
     - `testcase_id`: `BAJAJ_4W_ROLLOVER_01`
     - `category`: `four_wheeler`
     - `journey_type`: `Rollover`
     - `previous_expiry_date`: e.g., `15/05/2025`
     - `product_code`: `BAJAJ_4W_COMPREHENSIVE`
     - `carrier_name`: `BAJAJ`
     - `addons`: `[{"insurance_cover_code":"ZERO_DEPRECIATION_COVER"},...]`
     - `discounts`: `""`
     - `kyc`: `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`

2. **Two Scenarios**
   - **Scenarios**:
     1. `rollover less than 15 days with specified addons engine protection without discounts 4w`
     2. `new business without addons without discounts 2w`
   - **Product Codes**: `HDFC_4W_COMPREHENSIVE,TATA_2W_THIRD_PARTY`
   - **Output**:
     - Test Case 1:
       - `testcase_id`: `HDFC_4W_ROLLOVER_01`
       - `category`: `four_wheeler`
       - `journey_type`: `Rollover`
       - `previous_expiry_date`: e.g., `20/05/2025`
       - `product_code`: `HDFC_4W_COMPREHENSIVE`
       - `carrier_name`: `HDFC`
       - `addons`: `[{"insurance_cover_code":"ENGINE_PROTECTION"}]`
       - `discounts`: `""`
     - Test Case 2:
       - `testcase_id`: `TATA_2W_NEW_01`
       - `category`: `two_wheeler`
       - `journey_type`: `New Business`
       - `previous_expiry_date`: `""`
       - `product_code`: `TATA_2W_THIRD_PARTY`
       - `carrier_name`: `TATA`
       - `addons`: `""`
       - `discounts`: `""`

## CSV Output

- **Format**: Each test case is a row with columns like `Testcase_id`, `category`, etc.
- **Empty Fields**: `addons`, `discounts` are `""` in empty cells.
- **JSON Fields**: `addons`, `discounts`, `kyc` are JSON strings (e.g., `"[{""insurance_cover_code"":""ENGINE_PROTECTION""}]"`).
- **Dates**: Check `previous_expiry_date` for rollover cases.

## Troubleshooting

- **Error: "Product Code is required"**: Fill the Product Code field.
- **Error: "Number of product codes must match number of scenarios"**: Ensure the number of codes (comma-separated) equals the number of scenarios.
- **Error: "Scenario must include '2W' or '4W'"**: Add `4W` or `2W` to the scenario.
- **Error: "Scenario must specify addon instructions"**: Include `with all addons`, `without addons`, or `with specified addons ...`.
- **Wrong Insurer**: Check the product code prefix (e.g., `BAJAJ` for Bajaj).
- **Server Error**: Ensure the server is running (`http://localhost:3000`). Check console logs.
- **Contact Support**: Share your scenarios, product codes, and CSV output.

## Extra Features

- **Proposal Overrides**: Add JSON in the "Proposal Overrides" field to customize `proposal_questions` (e.g., `manufacturing_year`).
- **Multiple Scenarios**: Add multiple scenarios and matching product codes for batch processing.
- **Dynamic Dates**: Dates adjust to today’s date (28/05/2025).

Use this guide to write clear scenarios and product codes for accurate test cases.
