/**
 * 
 * 
 * I asked a relevant question in another thread, so would like to ask here as well. I'm not super familiar with CORS limitations though, so let me know if I misunderstand any of its concepts:

=======================================

I am trying the local API out by integrating it into an Electron app (logseq), but got 403 "Request not allowed". The same happened when I just accessed the API using a browser (firefox, chromium). I checked out the source code, and found out that if I include the header "x-zotero-connector-api-version" or "zotero-allowed-request" in my request, then I get the response just fine.
 */



// THis is working request
// Simple one-liner for Chrome console - copy and paste:

fetch('http://localhost:23119/api/users/0/items', {headers: {'x-zotero-connector-api-version': '2'}}).then(r => r.json()).then(console.log)

// Or for collections:
fetch('http://localhost:23119/api/users/0/collections', {headers: {'x-zotero-connector-api-version': '2'}}).then(r => r.json()).then(console.log)

// More readable version:
fetch('http://localhost:23119/api/users/0/items', {
  headers: {
    'x-zotero-connector-api-version': '2'
  }
}).then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error))


//
async function getAnnotations(itemKey) {
  try {
    const response = await fetch(
      `http://localhost:23119/api/users/0/items/${itemKey}/children`,
      {
        headers: { "x-zotero-connector-api-version": "3" },
      }
    );

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error getting annotations:", error);
    return null;
  }
}

// Example use (replace "58WH3EDK:
getAnnotations("MGHLHG2G").then(annotations => {
  if (annotations) console.log("Children:", annotations);
});