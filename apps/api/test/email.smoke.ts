import assert from "node:assert/strict";
import { normalizeEmailAddress, renderEmail } from "../src/modules/email/email-templates";

const escaped = renderEmail("security_alert", {
  name: "<script>alert(1)</script>",
  message: "<img src=x onerror=alert(1)>",
  details: "Use https://example.com/?a=1&b=2",
  actionUrl: "javascript:alert(1)"
});
assert.equal(escaped.html.includes("<script>"), false, "template variables must be HTML escaped");
assert.equal(escaped.html.includes("<img"), false, "untrusted markup must not become an active element");
assert.equal(escaped.html.includes("href=\"javascript:"), false, "unsafe action URL schemes must be rejected");
assert.equal(escaped.text.includes("<img"), true, "plain text must preserve content without interpreting it as markup");

const validRecipient = normalizeEmailAddress("  PERSON+tag@Example.com ");
assert.equal(validRecipient, "person+tag@example.com");
assert.throws(() => normalizeEmailAddress("person@example.com\r\nBcc: attacker@example.com"), /valid recipient/);
assert.throws(() => normalizeEmailAddress("not-an-address"), /valid recipient/);

for (const template of ["welcome", "password_reset", "security_alert", "invitation", "receipt", "invoice", "payment", "subscription", "report", "admin_notice"] as const) {
  const rendered = renderEmail(template, { name: "Amina", businessName: "Sample Shop", message: "A notification", details: "Reference: 42" });
  assert.ok(rendered.subject.length > 0, `${template} must have a subject`);
  assert.ok(rendered.html.includes("Dira OS"), `${template} must have branded HTML`);
  assert.ok(rendered.text.trim().length > 0, `${template} must have a plain text alternative`);
}

console.log("Email template and recipient validation smoke checks passed.");
