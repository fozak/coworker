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


  // with 127:
fetch('http://127.0.0.1:23119/api/users/0/items', {
  headers: {
    'x-zotero-connector-api-version': '2'
  }
}).then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error))
//


// Example with a query parameter (e.g., extra=keyword1):
fetch('http://127.0.0.1:23119/api/users/0/items?itemType=note', {
  headers: {
    'x-zotero-connector-api-version': '2'
  }
}).then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error))
//

http://localhost:23119/api/users/0/items?extra=keyword1

//doesnt work
async function getAnnotations(itemKey) {
  try {
    const response = await fetch(
      `http://127.0.0.1:23119/api/users/0/items/${itemKey}/children`,
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

// Function to save an item to Zotero using the Zotero Connector API

async function saveItemToZotero(itemData) {
  const url = 'http://127.0.0.1:23119/connector/saveItems';  // Replace with your actual Zotero server URL
	const apiVersion = 3; // replace for current connector API version


  // Function to generate a random session ID (you could use a library for this)
  function generateSessionID() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  const sessionID = generateSessionID();

  const payload = {
    sessionID: sessionID,
    items: [itemData] // Wrap the itemData in an array, as the API expects an array of items
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
				'X-Zotero-Connector-API-Version': apiVersion, // Add the API version header
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Zotero save failed:', response.status, response.statusText);
      const errorBody = await response.text();
      console.error('Zotero save failed body:', errorBody);
      throw new Error(`Zotero save failed: ${response.status} ${response.statusText}  Body: ${errorBody}`);
    }

    console.log('Zotero save successful!');
    return {status: "success", sessionID: sessionID}; // Returns session id too
  } catch (error) {
    console.error('Error saving to Zotero:', error);
    throw error; // Re-throw the error for the caller to handle
  }
}

// Example Usage (Replace with your actual item data)
const newItem = {
  "itemType": "NEWTYPE",  
  "title": "The Restaurant at the End of the Universe34",
  "task": "TASK-2025",
  "duedate": "08/15/2025",
  "date": "1980",
  "publisher": "Pan Books",
  "place": "London",
  "ISBN": "978-0330267320",
  "url": "https://example.com/restaurant-at-the-end-of-the-universe"
};

//Save for error and the ability to handle it
saveItemToZotero(newItem)
    .then((ret) => console.log("Saved to session " + ret.sessionID))
    .catch(error => console.error("SAVE CALL FAILED:", error));


//Zotero sqlite (in Zotero console or browser console with Zotero DB access enabled)

Zotero.DB.queryAsync(`SELECT * FROM itemAnnotations`).then(results => {
    for (let row of results) {
        console.log(row.itemID, row.color);
    }
});