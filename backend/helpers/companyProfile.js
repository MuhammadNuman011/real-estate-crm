const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCompanyPatch(body) {
  const source = body && typeof body === "object" && !Buffer.isBuffer(body) ? body : {};
  const errors = {};
  const values = {};

  if (Object.prototype.hasOwnProperty.call(source, "name")) {
    const name = trimmed(source.name);
    if (!name) errors.name = "Name is required.";
    else if (name.length > 255) errors.name = "Name must be 255 characters or fewer.";
    else values.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(source, "email")) {
    const email = trimmed(source.email).toLowerCase();
    if (!email) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Email must be valid.";
    else if (email.length > 255) errors.email = "Email must be 255 characters or fewer.";
    else values.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(source, "adminid")) {
    const adminid = trimmed(source.adminid);
    if (!adminid) errors.adminid = "Admin ID is required.";
    else if (adminid.length > 255) errors.adminid = "Admin ID must be 255 characters or fewer.";
    else values.adminid = adminid;
  }

  if (Object.prototype.hasOwnProperty.call(source, "mobile")) {
    if (source.mobile == null || source.mobile === "") {
      values.mobile = null;
    } else if (typeof source.mobile !== "string") {
      errors.mobile = "Mobile must be text.";
    } else {
      const mobile = source.mobile.trim();
      if (!mobile) values.mobile = null;
      else if (mobile.length > 255) errors.mobile = "Mobile must be 255 characters or fewer.";
      else values.mobile = mobile;
    }
  }

  return {
    errors: errors,
    values: values,
    logoProvided: Object.prototype.hasOwnProperty.call(source, "logo"),
    logo: source.logo
  };
}

module.exports = {
  validateCompanyPatch: validateCompanyPatch
};
