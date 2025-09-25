# Google Sheets Integration Setup

Follow these steps to grant the Cloudflare Worker write access to your Google Sheets.

## 1. Create or Select a Google Cloud Project
1. Visit <https://console.cloud.google.com/> and sign in.
2. Either select an existing project or create a new one dedicated to AC Shuttle.

## 2. Enable the Google Sheets API
1. In the left navigation, choose **APIs & Services → Library**.
2. Search for "Google Sheets API".
3. Click **Enable**.

## 3. Create a Service Account
1. Navigate to **APIs & Services → Credentials**.
2. Click **Create Credentials → Service account**.
3. Provide a name (e.g. `ac-shuttle-worker`) and description.
4. Assign at least the **Basic → Editor** role (or a more restrictive custom role that permits Sheets updates).
5. After creating, open the service account details and add a JSON key:
   - Click **Keys → Add key → Create new key**.
   - Choose **JSON** and download the file. Keep it secure—this is what we load into Wrangler.

## 4. Share Sheets With the Service Account
1. Each target spreadsheet must be shared with the service account’s email (something like `ac-shuttle-worker@project-id.iam.gserviceaccount.com`).
2. Open the spreadsheet → **Share** → enter the service account email → grant **Editor** access.
3. Repeat for both the primary and backup sheets.

## 5. Store the Credentials in Wrangler
Run the command from the worker directory:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT
```

When prompted, paste the entire JSON object from the downloaded key file. Wrangler encrypts and stores it for the Worker.

## 6. Configure Sheet IDs
- Copy the spreadsheet IDs (the long string between `/d/` and `/edit` in the URL) into `.dev.vars`:
  - `GOOGLE_SHEET_ID_PRIMARY`
  - `GOOGLE_SHEET_ID_BACKUP`
- Optional: set `GOOGLE_SHEET_RANGE_PRIMARY` and `_BACKUP` if the data lives on specific tabs or ranges (default `Sheet1!A:Z`).
- Create the header row in this exact order so each append lands in the right column:

  1. `transaction_id`
  2. `submission_id`
  3. `received_at`
  4. `customer_name`
  5. `customer_email`
  6. `customer_phone`
  7. `pickup_location`
  8. `dropoff_location`
  9. `pickup_time`
  10. `estimated_distance`
  11. `estimated_duration`
  12. `passenger_count`
  13. `quoted_price`
  14. `vehicle_type`
  15. `customer_notes`
  16. `driver_contact_name`
  17. `driver_contact_email`
  18. `driver_contact_phone`
  19. `status`
  20. `raw_payload`

  The worker defaults `status` to `Pending Review` and stores phone numbers as literal text (prefixed with `'` when necessary).

## 7. Local Verification
1. Ensure `.dev.vars` includes the sheet IDs and ranges.
2. Run `wrangler dev --local` with `VERBOSE_LOGGING=true`.
3. Trigger a test submission (`npm run webhook:test`) and confirm the worker logs any Sheets errors.
4. Check the spreadsheet to verify rows were appended (this will be built during Phase 2).

## 8. Production Reminder
- After deploying, re-run `wrangler secret put GOOGLE_SERVICE_ACCOUNT` and `wrangler secret put ...` for any other sensitive env vars under the production worker name (`ac-shuttle-dev-worker`).
- If you rotate the service account key, repeat steps 5 & 8.
