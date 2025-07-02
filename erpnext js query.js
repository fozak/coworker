frappe.call({
    method: "frappe.client.get_list",
    args: {
        doctype: "Project",
        filters: {
            custom_item: "Toyota 4T1BK3EKXAU110733"
        },
        fields: ["name"]
    },
    callback: function (projects) {
        if (projects.message && projects.message.length) {
            const project_names = projects.message.map(p => p.name);

            // Now query Tasks linked to these project names
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Task",
                    filters: [
                        ["project", "in", project_names]
                    ],
                    fields: ["name", "subject", "status"]
                },
                callback: function (tasks) {
                    console.log("Tasks for :", tasks.message);
                }
            });
        } else {
            console.log("No projects found for customer.");
        }
    }
});

/*  */
frappe.call({
    method: "frappe.client.get_list",
    args: {
        doctype: "Project",
        filters: {
            customer: "Jim Vorough"
        },
        fields: ["name"]
    },
    callback: function (projects) {
        if (projects.message && projects.message.length) {
            const project_names = projects.message.map(p => p.name);

            // Now query Tasks linked to these project names
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Task",
                    filters: [
                        ["project", "in", project_names]
                    ],
                    fields: ["name", "subject", "status"]
                },
                callback: function (tasks) {
                    console.log("Tasks for :", tasks.message);
                }
            });
        } else {
            console.log("No projects found for customer.");
        }
    }
});


frappe.call({
    method: "frappe.client.get_list",
    args: {
        doctype: "Issue",

        fields: ["name", "subject", "status"]
    },
    callback: function (tasks) {
        console.log("Issues for :", tasks.message);
    }
});


/* socket io */
frappe.realtime.doc_subscribe("TASK","TASK-2025-00033")
undefined
frappe.realtime.on("doc_update", (data) => {
  console.log("33 updated:", data);
});

change that from TASK to ISSUE
frappe.realtime.doc_subscribe("ISSUE","ISS-2025-00010")  
issues/ISS-2025-00010

frappe.realtime.on("doc_update", (data) => {
  console.log("ISSUE updated:", data);
});