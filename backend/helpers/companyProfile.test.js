const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCompanyPatch } = require("./companyProfile");
const { parseMultipart } = require("./multipartForm");
const { prepareStoredImage } = require("./imageFile");

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

test("company profile updates only fields that were sent", function() {
  const parsed = validateCompanyPatch({ name: "  North Realty  " });
  assert.deepEqual(parsed.values, { name: "North Realty" });
  assert.equal(parsed.logoProvided, false);
  assert.deepEqual(parsed.errors, {});
});

test("company profile ignores protected fields", function() {
  const parsed = validateCompanyPatch({
    id: 9,
    password: "new-password",
    status: "inactive",
    createdAt: "2020-01-01",
    updatedAt: "2020-01-02",
    email: "Owner@Example.com"
  });
  assert.deepEqual(parsed.values, { email: "owner@example.com" });
  assert.equal(parsed.values.password, undefined);
  assert.equal(parsed.values.status, undefined);
  assert.equal(parsed.values.id, undefined);
});

test("company profile validates editable fields and an optional logo", function() {
  const parsed = validateCompanyPatch({
    name: "",
    email: "not-an-email",
    adminid: "",
    mobile: "  0550000000  ",
    logo: ""
  });
  assert.equal(parsed.errors.name, "Name is required.");
  assert.equal(parsed.errors.email, "Email must be valid.");
  assert.equal(parsed.errors.adminid, "Admin ID is required.");
  assert.equal(parsed.values.mobile, "0550000000");
  assert.equal(parsed.logoProvided, true);
  assert.equal(parsed.logo, "");
});

test("company profile accepts a cleared mobile number", function() {
  const parsed = validateCompanyPatch({ mobile: "   " });
  assert.equal(parsed.values.mobile, null);
  assert.deepEqual(parsed.errors, {});
});

test("multipart company update reads text fields and one logo", function() {
  const body = Buffer.concat([
    Buffer.from(
      "--bound\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nNorth Realty\r\n" +
      "--bound\r\nContent-Disposition: form-data; name=\"logo\"; filename=\"logo.png\"\r\nContent-Type: image/png\r\n\r\n"
    ),
    PNG,
    Buffer.from("\r\n--bound--\r\n")
  ]);

  const parsed = parseMultipart(body, "multipart/form-data; boundary=bound");
  assert.equal(parsed.fields.name, "North Realty");
  assert.equal(parsed.file.type, "image/png");
  assert.equal(parsed.file.buffer.equals(PNG), true);
});

test("logo storage accepts png and rejects unsupported formats", async function() {
  const png = await prepareStoredImage("data:image/png;base64," + PNG.toString("base64"), "Logo");
  assert.equal(png.error, undefined);
  assert.equal(png.extension, ".png");

  const gif = await prepareStoredImage(
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    "Logo"
  );
  assert.match(gif.error, /JPG, PNG, WebP/);
});

test("multipart company update rejects a file that is not the logo", function() {
  const body = Buffer.from(
    "--bound\r\nContent-Disposition: form-data; name=\"document\"; filename=\"notes.txt\"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--bound--\r\n"
  );
  const parsed = parseMultipart(body, "multipart/form-data; boundary=bound");
  assert.equal(parsed.error, "Only a company logo can be uploaded.");
});
