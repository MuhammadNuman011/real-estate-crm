# Company profile API

Company admins can read and update their own company profile, including the logo.

Local base URL: `http://localhost:4000`. Send the company access token:

```http
Authorization: Bearer <token>
```

The token comes from `POST /api/company/login`. A broker token receives `403`.

## Company object

`password` is never returned. `id`, `status`, `createdAt`, and `updatedAt` are read-only.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | Company id. |
| `name` | string | Required when sent. |
| `email` | string | Required when sent. Stored in lowercase. Must be unique. |
| `adminid` | string | Required when sent. Must be unique. Used to sign in. |
| `mobile` | string or `null` | Optional. Send an empty string to clear it. |
| `logo` | string or `null` | Relative path such as `/uploads/companies/<file>`. `null` when no logo is stored. |
| `status` | string | `active` or `inactive`. Not editable on this route. |
| `createdAt` | string | Not editable. |
| `updatedAt` | string | Not editable. |

Logo files are served from `/uploads/companies/<file>` and `/api/uploads/companies/<file>`.

## Get the signed-in company

`GET /api/company`

Returns a one-item array so existing company screens keep working:

```json
[
  {
    "id": 1,
    "name": "North Realty",
    "email": "owner@example.com",
    "adminid": "north-admin",
    "mobile": "0550000000",
    "logo": null,
    "status": "active",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
```

`404` when the company record no longer exists.

## Update the signed-in company

`PATCH /api/company`

Only fields present in the request are changed. `id`, `password`, `status`, `createdAt`, and `updatedAt` are ignored.

JSON:

```http
Content-Type: application/json
```

```json
{
  "name": "North Realty",
  "email": "owner@example.com",
  "adminid": "north-admin",
  "mobile": "0550000000"
}
```

Logo upload is optional.

| `logo` value | Result |
| --- | --- |
| omitted | Current logo stays. |
| existing stored path | Current logo stays. |
| `""` or `null` | Logo is removed and the stored file is deleted. |
| `data:image/...;base64,...` | New logo is stored. The previous file is deleted after the update succeeds. |

Accepted images are PNG, JPG, JPEG, and WebP. The same image helper also accepts iPhone HEIC/HEIF photos and converts them. Other formats are rejected. Source files must be under 25 MB and are stored at 5 MB or smaller.

Multipart is also accepted. Send text fields plus an optional file part named `logo`:

```http
Content-Type: multipart/form-data
```

A successful update returns the company object (not an array):

```json
{
  "id": 1,
  "name": "North Realty",
  "email": "owner@example.com",
  "adminid": "north-admin",
  "mobile": "0550000000",
  "logo": "/uploads/companies/logo.png",
  "status": "active",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-02T00:00:00.000Z"
}
```

### Update errors

| Status | When |
| --- | --- |
| `401` / `403` | Missing, expired, or non-company token, or the company is inactive. |
| `404` | Company record no longer exists. |
| `413` | Multipart body is larger than the upload limit. |
| `422` | `{ "error": "Validation failed.", "fields": { "name": "Name is required." } }` |
| `409` | Email or admin ID is already registered. `fields` names the conflicting field. |
| `400` | Upload could not be read, or the update failed. |
