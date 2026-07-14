# AirCare Customer Feedback UI

A lightweight single-page customer experience for the AirCare QR flow.

## Flow
- Customer scans the QR code and lands on this page with `ro_code` in the URL.
- The page looks up outlet details from `GET /api/v1/ro/{ro_code}/validate`.
- The customer enters a mobile number and requests OTP via `POST /api/v1/otp/request`.
- OTP verification returns a feedback session token.
- The page submits the rating/comment/photo/location via `POST /api/v1/feedback`.

## Run locally
This scaffold is static and can be served by any HTTP server, or built into the included Nginx image.

Example:

```bash
docker build -t aircare-customer-feedback ./web/customer-feedback
docker run --rm -p 8080:80 aircare-customer-feedback
```

Then open:

`http://localhost:8080/?ro_code=AIRCARE-219578`
