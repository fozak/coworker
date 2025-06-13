{
  "translatorID": "5e4ac3fa-2a1c-48e9-aaa1-f3d0cb1d7fa5",
  "label": "ERPNext Task",
  "creator": "Your Name",
  "target": "^https?://.*/app/task/.*",
  "minVersion": "3.0",
  "inRepository": false,
  "translatorType": 4,
  "browserSupport": "gcsibv"
}

function detectWeb(doc, url) {
  return "webpage";
}

function doWeb(doc, url) {
  let newItem = new Zotero.Item("webpage");

  newItem.title = doc.querySelector("div.title-area h1")?.textContent?.trim() || "ERPNext Task";

  // Try to find key fields from the page
  let description = doc.querySelector('[data-fieldname="description"]')?.textContent?.trim();
  if (description) {
    newItem.abstractNote = description;
  }

  let assignedTo = doc.querySelector('[data-fieldname="assigned_to"]')?.textContent?.trim();
  if (assignedTo) {
    newItem.creators.push({ lastName: assignedTo, creatorType: "contributor" });
  }

  let dueDate = doc.querySelector('[data-fieldname="due_date"]')?.textContent?.trim();
  if (dueDate) {
    newItem.date = dueDate;
  }

  let status = doc.querySelector('[data-fieldname="status"]')?.textContent?.trim();
  if (status) {
    newItem.extra = `Status: ${status}`;
  }

  newItem.url = url;
  newItem.attachments.push({
    title: "ERPNext Task Snapshot",
    document: doc
  });

  newItem.complete();
}
