// ✅ This matches exactly what your browser sent successfully
fetch("/", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Frappe-Cmd": "frappe.website.doctype.web_form.web_form.accept",
    "X-Frappe-CSRF-Token": "None",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01"
  },
  body: new URLSearchParams({
    // Main payload data as JSON string (this is what ERPNext expects)
    data: JSON.stringify({
      "subject": "Custom Form Submission - content NOT editable",
      "description": "<div class=\"ql-editor contenteditable=\"false\" read-mode\"><p data-gramm=\"false\">UPDATED more Custom Description</p></div>",
      "status": "Open",
      "priority": "Medium",
      "via_customer_portal": 1,
      "doctype": "Issue",
      "web_form_name": "issues"
    }),
    // Additional required parameters
    web_form: "issues",
    for_payment: "false",
    cmd: "frappe.website.doctype.web_form.web_form.accept"
  })
})
.then(async response => {
  // Better error handling
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    const text = await response.text();
    console.warn("Server returned non-JSON response:", text);
    throw new Error("Expected JSON but got HTML/text");
  }
})
.then(result => {
  console.log("✅ Success:", result);
  if (result.message) {
    console.log("📄 New Issue Created:", result.message);
  }
})
.catch(error => {
  console.error("❌ Error:", error);
});