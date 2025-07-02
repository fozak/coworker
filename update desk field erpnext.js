cur_frm.set_value("custom_text", "<p>Updated content</p>").then(() => {
    return cur_frm.save();
}).then(() => {
    console.log("Saved successfully");
}).catch(err => {
    console.error("Error saving", err);
});


cur_frm.get_field("custom_text").last_value

cur_frm.set_value("custom_markdown", "<h1>Updated content</h1>").then(() => {
    return cur_frm.save();
}).then(() => {
    console.log("Saved successfully");
}).catch(err => {
    console.error("Error saving", err);
});


// Get the last value of the custom_markdown field

frappe.web_form.get_field('custom_text').value
//set values

const newCode = "console.log('Hello from widget!');";

    // Set it in the web form
frappe.web_form.set_value('custom_text', newCode);