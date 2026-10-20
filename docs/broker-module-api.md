# Broker module API

API for the broker mobile app and for the company admin screens that manage brokers.

Local base URL: `http://localhost:4000`. In other environments use `http://<host>:<PORT>`. `PORT` defaults to `4000`.

Send JSON:

```http
Content-Type: application/json
```

There is no delete endpoint for brokers, and a broker cannot edit their own profile. Profile changes are made by the company.

## Who calls what

| Caller | Token | Endpoints |
| --- | --- | --- |
| Broker app | Broker JWT from `POST /api/broker/login` | `GET /api/broker/properties` |
| Company admin | Company JWT from `POST /api/company/login` | `GET /api/brokers`, `GET /api/brokers/:id`, `POST /api/brokers`, `PATCH /api/brokers/:id` |

A broker token on a company route, or a company token on a broker route, returns `403`:

```json
{ "error": "You do not have access to this module." }
```

Send the token as:

```http
Authorization: Bearer <token>
```

The word `Bearer` and one space are required.

Both tokens are HS256 JWTs. Lifetime is `JWT_EXPIRES_IN`, or **8 hours** when that is unset. There is no refresh endpoint. Log in again when the token expires.

| Token | Claims |
| --- | --- |
| Broker | `role: "broker"`, `brokerId` |
| Company | `role: "company"`, `companyId`, `adminid` |

### Auth errors

| Status | Body | When |
| --- | --- | --- |
| `401` | `{ "error": "Authentication required." }` | Header is missing or is not `Bearer <token>`. |
| `401` | `{ "error": "Session expired. Please log in again." }` | Token is expired. |
| `401` | `{ "error": "Invalid or missing authentication token." }` | Token is invalid, or the account no longer exists. |
| `403` | `{ "error": "You do not have access to this module." }` | Token role does not match this route. |
| `403` | `{ "error": "Broker account is inactive." }` | Broker `status` is not `active`. |
| `403` | `{ "error": "Company account is inactive." }` | Company account is not active. Company routes only. |
| `500` | `{ "error": "Unable to authenticate." }` | Server failed while checking the token. |

## Broker object

Returned by login and by the company broker endpoints. `password` is never included.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | Also stored in the broker token as `brokerId`. |
| `name` | string | |
| `email` | string | Stored in lowercase. Login uses this. |
| `mobile` | string | Country code plus national number, for example `+966512345678` or `+971501234567`. |
| `profile_picture` | string or `null` | Relative path. Prefix the API host: `http://localhost:4000/uploads/brokers/<file>`. |
| `status` | string | `active`, `inactive`, or `blocked`. Only `active` can log in. |
| `company_id` | string or `null` | Company that owns this broker. Set by the server on create. |
| `license_number` | string or `null` | |
| `bio` | string or `null` | |
| `address` | string or `null` | |
| `last_login_at` | string or `null` | ISO 8601. Updated on each successful login. |
| `created_at` | string | ISO 8601. |
| `updated_at` | string | ISO 8601. |

```json
{
  "id": 12,
  "name": "Sara Ali",
  "email": "broker@example.com",
  "mobile": "+966512345678",
  "profile_picture": "/uploads/brokers/a1b2c3d4.jpg",
  "status": "active",
  "company_id": "4",
  "license_number": "BR-1001",
  "bio": null,
  "address": "Riyadh",
  "last_login_at": "2026-10-18T11:56:00.000Z",
  "created_at": "2026-09-01T08:00:00.000Z",
  "updated_at": "2026-10-18T11:56:00.000Z"
}
```

---

# Broker app

## Log in

`POST /api/broker/login`

Public. No `Authorization` header.

### Body

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `email` | string | yes | Trimmed and lowercased. Must look like `local@domain.tld`. |
| `password` | string | yes | No minimum length on login. |

```json
{
  "email": "broker@example.com",
  "password": "your-password"
}
```

### `200 OK`

`last_login_at` is updated before the response is sent.

```json
{
  "message": "Broker successfully logged in.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "broker": { }
}
```

`broker` is the broker object above.

### Errors

**`422`** — missing or invalid fields. `fields` lists only the failures.

```json
{
  "error": "Validation failed.",
  "fields": {
    "email": "Email is required.",
    "password": "Password is required."
  }
}
```

| Field | Message |
| --- | --- |
| `email` | `Email is required.` |
| `email` | `Email must be valid.` |
| `password` | `Password is required.` |

**`401`** — unknown email or wrong password. Same message either way.

```json
{ "error": "Invalid email or password." }
```

**`403`** — password is correct and `status` is `inactive` or `blocked`.

```json
{ "error": "Broker account is inactive." }
```

**`500`**

```json
{ "error": "Unable to log in." }
```

```bash
curl -X POST http://localhost:4000/api/broker/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"broker@example.com\",\"password\":\"your-password\"}"
```

## List properties

`GET /api/broker/properties`

Broker token required.

Returns active properties for the logged-in broker's company, newest first. Inactive properties are omitted. The list is a summary: location, area, and description are not included.

### Query

All parameters are optional. Empty values are ignored.

| Parameter | Match | Rules |
| --- | --- | --- |
| `property_type` | contains, case depends on the database | Trimmed text. |
| `allowed_nationalities` | contains | Trimmed text. |
| `bedrooms` | exact | Whole number, `0` or greater. |

```http
GET /api/broker/properties?property_type=Villa&bedrooms=3
Authorization: Bearer <broker-token>
```

### `200 OK`

```json
[
  {
    "id": 41,
    "property_type": "Villa",
    "price": "1500000.00",
    "bedrooms": 4,
    "bathrooms": 3,
    "allowed_nationalities": "Any",
    "furnishing": "unfurnished",
    "maid_room": false,
    "available_from": "2026-11-01",
    "status": "active"
  }
]
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | |
| `property_type` | string | Free text, for example `Villa`. |
| `price` | string | Decimal with two fraction digits. Parse it as a number for display. |
| `bedrooms` | number | |
| `bathrooms` | number | |
| `allowed_nationalities` | string or `null` | |
| `furnishing` | string | `furnished`, `unfurnished`, or `semi-furnished`. |
| `maid_room` | boolean | |
| `available_from` | string or `null` | `YYYY-MM-DD`. |
| `status` | string | Always `active` on this route. |

### Errors

**`400`** — `bedrooms` is present and is not a non-negative whole number.

```json
{ "error": "Bedrooms must be a non-negative whole number." }
```

**`500`**

```json
{ "error": "Unable to retrieve properties." }
```

```bash
curl "http://localhost:4000/api/broker/properties?property_type=Villa&bedrooms=3" \
  -H "Authorization: Bearer <broker-token>"
```

---

# Company admin

These routes manage broker accounts. They require a **company** token, from `POST /api/company/login` with `adminid` and `password`. A broker cannot call them.

Every list and read is limited to brokers whose `company_id` matches the logged-in company. A broker from another company is `404`.

Create and update both expect the full broker form. Update is not a partial patch: omitted required fields fail validation. `company_id` is assigned by the server and cannot be sent.

### Mobile number

Send the country code and the local number separately. The stored value joins them.

| Field | Rules |
| --- | --- |
| `country_code` | `+966` (KSA) or `+971` (UAE). |
| `mobile` | Digits only, spaces and dashes allowed. A leading `0` is removed. Must be `5` plus 8 digits, such as `0512345678` or `512345678`. |

Stored result: `+966512345678`.

### Profile picture

`profile_picture` is optional.

| Value | Result |
| --- | --- |
| omitted, `null`, or `""` | No picture. On update, the current file is removed. |
| `data:image/jpeg;base64,...`, `image/png`, or `image/webp` | Saved under `/uploads/brokers/`. Max 5 MB. |
| the current stored path, on update only | Picture is kept. |

Anything else returns `422` with `fields.profile_picture`.

| Message | When |
| --- | --- |
| `Profile picture must be a JPG, PNG, or WebP image.` | Data URL type is not jpeg, png, or webp. |
| `Profile picture must be under 5 MB.` | Decoded file is empty or larger than 5 MB. |
| `Profile picture must be an image.` | Value is not a string, or is not a data URL or the current path. |

### Shared validation

| Field | Create | Update | Rules |
| --- | --- | --- | --- |
| `name` | required | required | Trimmed, non-empty. |
| `email` | required | required | Trimmed, lowercased, must look like an email. Unique. |
| `country_code` | required | required | `+966` or `+971`. |
| `mobile` | required | required | See above. Unique across all brokers. |
| `password` | required, min 8 | optional | If sent on update, min 8. Omit it to keep the current password. |
| `status` | optional | optional | `active`, `inactive`, or `blocked`. Defaults to `active` when omitted or blank. |
| `license_number` | optional | optional | Text, or `null` / `""` to clear. |
| `bio` | optional | optional | Text, or `null` / `""` to clear. |
| `address` | optional | optional | Text, or `null` / `""` to clear. |
| `profile_picture` | optional | optional | See above. |

**`422`**

```json
{
  "error": "Validation failed.",
  "fields": {
    "name": "Name is required.",
    "email": "Email must be valid.",
    "country_code": "Country code must be KSA (+966) or UAE (+971).",
    "mobile": "Enter a mobile number like 05xxxxxxxx.",
    "password": "Password must be at least 8 characters long.",
    "status": "Status must be active, inactive, or blocked."
  }
}
```

Other field messages:

| Field | Message |
| --- | --- |
| `email` | `Email is required.` |
| `mobile` | `Mobile is required.` |
| `mobile` | `Mobile must contain only digits.` |
| `password` | `Password is required.` (create only) |
| `license_number` | `License number must be text.` |
| `bio` | `Bio must be text.` |
| `address` | `Address must be text.` |

**`409`** — email or mobile already belongs to a broker.

```json
{
  "error": "Validation failed.",
  "fields": {
    "email": "Email is already registered.",
    "mobile": "Mobile is already registered."
  }
}
```

If the database reports the clash first, `error` is `Email is already registered.` or `Mobile is already registered.` and `fields` still names the field. Otherwise `error` is `A broker with these details already exists.`

## List brokers

`GET /api/brokers`

Company token. Newest first. Returns an array of broker objects. Passwords are omitted.

```json
[ { "id": 12, "name": "Sara Ali" } ]
```

**`500`** `{ "error": "Unable to retrieve brokers." }`

## Get one broker

`GET /api/brokers/:id`

Company token. `:id` is the broker id.

**`200`** — one broker object.

**`404`** `{ "error": "Broker not found." }`

**`500`** `{ "error": "Unable to retrieve broker." }`

## Create a broker

`POST /api/brokers`

Company token. `company_id` is set from the logged-in company.

```json
{
  "name": "Sara Ali",
  "email": "broker@example.com",
  "country_code": "+966",
  "mobile": "0512345678",
  "password": "at-least-8",
  "status": "active",
  "license_number": "BR-1001",
  "bio": null,
  "address": "Riyadh",
  "profile_picture": null
}
```

**`201`** — the created broker object.

**`400`** `{ "error": "Unable to create broker." }`

## Update a broker

`PATCH /api/brokers/:id`

Company token. Send the full form. Leave `password` out to keep the current one. Send `profile_picture: null` or `""` to remove the photo. Send the existing path to keep it.

```json
{
  "name": "Sara Ali",
  "email": "broker@example.com",
  "country_code": "+966",
  "mobile": "0512345678",
  "status": "active",
  "license_number": "BR-1001",
  "bio": "Senior broker",
  "address": "Riyadh",
  "profile_picture": "/uploads/brokers/a1b2c3d4.jpg"
}
```

**`200`** — the updated broker object.

**`404`** `{ "error": "Broker not found." }`

**`400`** `{ "error": "Unable to update broker." }`

Setting `status` to `inactive` or `blocked` blocks the next login and rejects later broker-token requests with `403`.
