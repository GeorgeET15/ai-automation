# Prompting Guide for Insurance Test Case Generation

This guide explains how to create effective prompts for generating insurance test case data using the insurance test case generation application. The application processes natural language scenarios to produce structured test data for 4-wheeler (4W) or 2-wheeler (2W) insurance policies, including fields like `Testcase_id`, `category`, `journey_type`, `addons`, `discounts`, `previous_expiry_date`, and more. Prompts are entered in the UI’s scenario input field and processed by the server’s `/api/parse` endpoint to generate test cases, which are displayed in the UI and exported as CSV.

## Overview

A **prompt** is a natural language description of an insurance test case scenario. The application parses prompts to extract details such as vehicle type, insurance company, policy type, addons, discounts, expiry conditions, and KYC requirements. Each prompt generates one test case, and multiple prompts can be added to produce multiple test cases. The resulting CSV output includes fields like `addons` and `discounts`, which are set to `""` (empty string) when empty, as specified.

### Example Prompt
```
rollover less than 30 days with all addons without discounts hdfc 4w
```
This prompt generates a test case for:
- A 4-wheeler (4W) policy with HDFC.
- A rollover journey (policy expired recently).
- Expiry within 30 days before the current date (e.g., between 29/04/2025 and 27/05/2025 for 28/05/2025).
- All available addons included (e.g., `[{"insurance_cover_code":"ZERO_DEPRECIATION_COVER"},...]`).
- No discounts (`discounts: ""`).

## Prompt Structure

Prompts should include the following components, in any order, using natural language. Required components are marked with an asterisk (*).

1. **Vehicle Type* (4W or 2W)**:
   - Specify the vehicle: `4W` (four-wheeler, e.g., car) or `2W` (two-wheeler, e.g., bike).
   - Example: `4W`, `2W`.
   - Affects fields: `category` (`four_wheeler` or `two_wheeler`), `make_model` (e.g., "HONDA CITY" for 4W, "HONDA ACTIVA" for 2W), `idv` (default 500000 for 4W, 100000 for 2W).

2. **Insurance Company* (HDFC, ICICI, or Royal Sundaram)**:
   - Specify the insurer: `HDFC`, `ICICI`, or `Royal Sundaram`.
   - Example: `hdfc`, `icici`.
   - Affects fields: `carrier_name`, `previous_insurer`, `previous_tp_insurer`, `product_code` prefix (e.g., "HDFC_4W_COMPREHENSIVE").

3. **Policy Type (Comprehensive or Third Party)**:
   - Optional; defaults to Comprehensive if not specified.
   - Specify: `comprehensive` or `third party`.
   - Example: `comprehensive`, `third party`.
   - Affects fields: `product_code` (e.g., "HDFC_4W_THIRD_PARTY"), `select_tab` ("Comprehensive" or "Third Party"), `addons` eligibility (Third Party only allows "PERSONAL_ACCIDENT").

4. **Journey Type and Expiry Condition**:
   - Specify the journey: `New Business`, `Rollover`, or `Not Sure`.
   - For Rollover, include expiry condition: `rollover less than X days` or `expired within X days` (X is a number, e.g., 30).
   - Example: `rollover less than 30 days`, `new business`, `expired within 15 days`.
   - Affects fields:
     - `journey_type`: "New Business", "Rollover", or "Not Sure".
     - `previous_expiry_date`: For Rollover with `rollover less than X days`, a date within X days before today (e.g., 29/04/2025–27/05/2025 for 28/05/2025).
     - `is_inspection_required`: "Yes" for Rollover, "No" for New Business.
     - `previous_ncb`: "0%" for Rollover, "20%" for New Business.

5. **Addons* (All, None, or Specific)**:
   - Specify addon instructions:
     - `with all addons`: Includes all available addons (`ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`).
     - `without addons`: Sets `addons: ""`.
     - `with specified addons X,Y,Z`: Includes listed addons (e.g., `with specified addons zero depreciation cover, personal accident`).
   - Example: `with all addons`, `without addons`, `with specified addons engine protection`.
   - Affects field: `addons` (array of `{"insurance_cover_code": "CODE"}` or `""`).
   - Note: Third Party policies only allow `PERSONAL_ACCIDENT`; others are ignored.

6. **Discounts* (None or Specific)**:
   - Specify discount instructions:
     - `without discounts`: Sets `discounts: ""`.
     - `with discounts X,Y,Z`: Includes listed discounts (e.g., `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`).
   - Example: `without discounts`, `with discounts anti theft discount`.
   - Affects field: `discounts` (array of `{"discount_code": "CODE", "sa": ""}` or `""`).

7. **KYC (Optional)**:
   - Specify KYC type: `kyc ovd`, `kyc pan`, or `kyc ckyc number`.
   - If omitted, a random KYC option is selected (OVD, PAN, or CKYC Number).
   - Example: `kyc pan`, `kyc ovd`.
   - Affects field: `kyc` (e.g., `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`).

### Constraints
- **Required Components**: Vehicle type, insurance company, addon instructions, and discount instructions are mandatory. The UI validates these and shows an error if missing (e.g., "Scenario must include '2W' or '4W'").
- **Case Insensitivity**: Prompts are case-insensitive (e.g., `HDFC` or `hdfc`).
- **Date Format**: All dates (e.g., `previous_expiry_date`, `puc_expiry`) are in `DD/MM/YYYY`.
- **Empty Fields**: `addons` and `discounts` are `""` when empty (e.g., "without addons", "without discounts"), never `[]`.
- **Expiry Days**: For `rollover less than X days` or `expired within X days`, X must be a positive integer.
- **Valid Addons**: Only `ZERO_DEPRECIATION_COVER`, `ROAD_SIDE_ASSISTANCE`, `ENGINE_PROTECTION`, `PERSONAL_ACCIDENT`, `RETURN_TO_INVOICE`.
- **Valid Discounts**: Only `ANTI_THEFT_DISCOUNT`, `VOLUNTARY_DEDUCTIBLE`, `NCB_PROTECTION`.
- **KYC Options**: Only `OVD`, `PAN`, or `CKYC Number`.

### Best Practices
1. **Be Specific**:
   - Clearly state all components to avoid defaults. E.g., `hdfc 4w comprehensive rollover less than 30 days with all addons without discounts kyc pan` is better than `hdfc 4w`.
2. **Use Consistent Terminology**:
   - Stick to `4W`/`2W`, `HDFC`/`ICICI`/`Royal Sundaram`, `comprehensive`/`third party`, etc., to avoid parsing errors.
3. **Specify Expiry for Rollover**:
   - Always include `rollover less than X days` or `expired within X days` for Rollover to control `previous_expiry_date`.
4. **Avoid Ambiguity**:
   - Separate components with spaces or commas, e.g., `with specified addons zero depreciation cover, personal accident`.
5. **Test Single Scenarios First**:
   - Add one scenario, submit, and check the UI/CSV before adding multiple scenarios.
6. **Validate Output**:
   - Check the CSV for correct `previous_expiry_date` (within X days for Rollover), `addons` (array or `""`), and `discounts` (`""` for "without discounts").

### Examples

#### Example 1: Comprehensive Rollover with All Addons
**Prompt**: `rollover less than 30 days with all addons without discounts hdfc 4w kyc pan`
- **Testcase_id**: `HDFC_4W_ROLLOVER_01`
- **category**: `four_wheeler`
- **journey_type**: `Rollover`
- **previous_expiry_date**: e.g., `10/05/2025` (within 30 days before 28/05/2025)
- **offset_previous_expiry_date**: `30`
- **make_model**: `HONDA CITY`
- **product_code**: `HDFC_4W_COMPREHENSIVE`
- **addons**: `[{"insurance_cover_code":"ZERO_DEPRECIATION_COVER"},{"insurance_cover_code":"ROAD_SIDE_ASSISTANCE"},...]`
- **discounts**: `""`
- **kyc**: `[{"PAN":{"pan":"GTTPK1088Q","dob":"28/10/1994"}}]`
- **is_inspection_required**: `Yes`

#### Example 2: Third Party New Business without Addons
**Prompt**: `new business without addons without discounts icici 2w`
- **Testcase_id**: `ICICI_2W_NEW_01`
- **category**: `two_wheeler`
- **journey_type**: `New Business`
- **previous_expiry_date**: `""`
- **make_model**: `HONDA ACTIVA`
- **product_code**: `ICICI_2W_THIRD_PARTY`
- **addons**: `""`
- **discounts**: `""`
- **kyc**: Random, e.g., `[{"OVD":{"proposer_poi_document_type":"PAN Card",...}}]`
- **is_inspection_required**: `No`

#### Example 3: Rollover with Specific Addons and Discounts
**Prompt**: `rollover less than 15 days with specified addons engine protection, personal accident with discounts anti theft discount royal sundaram 4w kyc ovd`
- **Testcase_id**: `ROYAL_SUNDARAM_4W_ROLLOVER_01`
- **category**: `four_wheeler`
- **journey_type**: `Rollover`
- **previous_expiry_date**: e.g., `15/05/2025` (within 15 days before 28/05/2025)
- **offset_previous_expiry_date**: `15`
- **make_model**: `HONDA CITY`
- **product_code**: `ROYAL_SUNDARAM_4W_COMPREHENSIVE`
- **addons**: `[{"insurance_cover_code":"ENGINE_PROTECTION"},{"insurance_cover_code":"PERSONAL_ACCIDENT"}]`
- **discounts**: `[{"discount_code":"ANTI_THEFT_DISCOUNT","sa":""}]`
- **kyc**: `[{"OVD":{"proposer_poi_document_type":"PAN Card",...}}]`
- **is_inspection_required**: `Yes`

### CSV Output Notes
- **Format**: Each test case is a row with columns matching headers (e.g., `Testcase_id`, `category`, ...).
- **Empty Fields**: `addons` and `discounts` appear as empty cells (`""`) when `without addons` or `without discounts`.
- **JSON Fields**: `addons`, `discounts`, `kyc`, and `proposal_questions` are JSON-stringified with escaped quotes (e.g., `"[{""insurance_cover_code"":""ZERO_DEPRECIATION_COVER""}]"`).
- **Date Validation**: Check `previous_expiry_date` in CSV to ensure it falls within the specified range for Rollover.

### Troubleshooting
- **Error: "Scenario must include '2W' or '4W'"**:
  - Ensure `4W` or `2W` is in the prompt.
- **Error: "Scenario must include an insurance company"**:
  - Include `HDFC`, `ICICI`, or `Royal Sundaram`.
- **Error: "Scenario must specify addon instructions"**:
  - Add `with all addons`, `without addons`, or `with specified addons ...`.
- **Error: "Scenario must specify discount instructions"**:
  - Add `without discounts` or `with discounts ...`.
- **Incorrect `previous_expiry_date`**:
  - Verify `rollover less than X days` or `expired within X days` is used for Rollover.
- **Missing Test Cases in CSV**:
  - Check console logs (`Generating CSV with testData`) to ensure all scenarios are in `testData`.
- **Contact Support**:
  - If issues persist, share the prompt, console logs, and CSV output with the development team.

### Additional Features
- **Product Code Override**: Enter a custom `product_code` in the UI’s "Product Code" field to override the derived code (e.g., `HDFC_4W_CUSTOM_123`).
- **Proposal Overrides**: Use the "Proposal Overrides" field to customize `proposal_questions` fields (e.g., `manufacturing_year`, `address`).
- **Multiple Scenarios**: Add multiple scenarios in the UI to generate multiple test cases in one CSV.

By following this guide, you can craft precise prompts to generate accurate insurance test case data tailored to your testing needs.