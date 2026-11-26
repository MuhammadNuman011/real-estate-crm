const MAX_FIELDS = 20;
const MAX_FIELD_BYTES = 64 * 1024;

function boundaryFrom(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(String(contentType || ""));
  if (!match) return "";
  return (match[1] || match[2] || "").trim();
}

function parseMultipart(buffer, contentType) {
  const boundary = boundaryFrom(contentType);
  if (!boundary || boundary.length > 200) {
    return { error: "Upload could not be read." };
  }

  const delimiter = Buffer.from("--" + boundary);
  const fields = {};
  let file = null;
  let cursor = buffer.indexOf(delimiter);
  if (cursor === -1) return { error: "Upload could not be read." };

  while (cursor !== -1) {
    let partStart = cursor + delimiter.length;
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) break;
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2;
    else if (buffer[partStart] === 10) partStart += 1;
    else return { error: "Upload could not be read." };

    const next = buffer.indexOf(delimiter, partStart);
    if (next === -1) return { error: "Upload could not be read." };

    let partEnd = next;
    if (partEnd >= 2 && buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
      partEnd -= 2;
    }

    const part = buffer.subarray(partStart, partEnd);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) return { error: "Upload could not be read." };

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const body = part.subarray(headerEnd + 4);
    const nameMatch = /name="([^"]+)"/i.exec(headerText);
    const name = nameMatch ? nameMatch[1] : "";
    const isFile = /filename="/i.test(headerText);
    const typeMatch = /content-type:\s*([^\r\n;]+)/i.exec(headerText);
    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : "";

    if (isFile) {
      if (name !== "logo") return { error: "Only a company logo can be uploaded." };
      if (file) return { error: "Upload one logo at a time." };
      if (body.length) {
        file = {
          type: type || "application/octet-stream",
          buffer: body
        };
      }
    } else if (name) {
      if (Object.keys(fields).length >= MAX_FIELDS) {
        return { error: "Upload has too many fields." };
      }
      if (body.length > MAX_FIELD_BYTES) {
        return { error: "A form field is too large." };
      }
      fields[name] = body.toString("utf8");
    }

    cursor = next;
  }

  return { fields: fields, file: file };
}

function readRequestBody(req, maxBytes) {
  return new Promise(function(resolve, reject) {
    const chunks = [];
    let size = 0;
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    req.on("data", function(chunk) {
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error("Upload is too large.");
        error.code = "LIMIT";
        req.destroy();
        fail(error);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", function() {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", fail);
  });
}

module.exports = {
  parseMultipart: parseMultipart,
  readRequestBody: readRequestBody
};
