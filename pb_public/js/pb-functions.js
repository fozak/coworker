// ============================================================================
// POCKETBASE CLIENT INITIALIZATION
// ============================================================================

window.pb = window.pb || new PocketBase("http://127.0.0.1:8090/");

// Global config
window.MAIN_COLLECTION = window.MAIN_COLLECTION || 'item';
window.currentUser = null;  // Initialize global user state

// Connect function (keeps your functions intact)
async function connectToPocketBase() {
  const statusDiv = document.getElementById('status');
  try {
    // Test connection
    await pb.collection('item').getList(1, 1);

    statusDiv.textContent = 'Connected';
    statusDiv.className = 'mt-2 p-2 rounded text-sm bg-green-100 text-green-800';

    await loadRenderCode();
    setupSearch();

  } catch (error) {
    statusDiv.textContent = 'Failed to connect';
    statusDiv.className = 'mt-2 p-2 rounded text-sm bg-red-100 text-red-800';
  }
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Generate unique ID (15 characters, alphanumeric)
pb.generateId = async function () {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 15; i++) {  // 15 characters
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};


// ============================================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

// Initialize auth state on page load
async function initializeAuth() {
  try {
    // Check if there's a valid auth token from previous session
    if (pb.authStore.isValid) {
      // Refresh the auth state to ensure token is still valid
      await pb.collection('users').authRefresh();
      window.currentUser = pb.authStore.model;
      console.log('Restored session for:', window.currentUser.name);
      return { authenticated: true, user: window.currentUser };
    } else {
      console.log('No valid session found - operating as anonymous user');
      return { authenticated: false, user: null };
    }
  } catch (error) {
    console.log('Session expired or invalid - operating as anonymous user');
    pb.authStore.clear();
    window.currentUser = null;
    return { authenticated: false, user: null };
  }
}

// Helper: Login function (for when user wants to authenticate)
pb.login = async function(email, password) {
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    window.currentUser = authData.record;
    console.log('Logged in as:', window.currentUser.name);
    return authData;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

// Helper: Logout function
pb.logout = function() {
  pb.authStore.clear();
  window.currentUser = null;
  console.log('Logged out - now operating as anonymous user');
};



// ==============================================
// 📋 Document Database Operations
// ==============================================



// Extract allowed roles from schema permissions
pb.setAllowedRoles = function(schema) {
  if (!schema || !schema.permissions) {
    return { writeRoles: [], readRoles: [] };
  }
  
  const writeRoles = [];
  const readRoles = [];
  
  schema.permissions.forEach(perm => {
    if (perm.role) {
      if (perm.write === 1 || perm.create === 1) {
        writeRoles.push(perm.role);
      } else if (perm.read === 1 || perm.select === 1) {
        readRoles.push(perm.role);
      }
    }
  });
  
  return { writeRoles, readRoles };
};

// ============================================================================
// CRUD OPERATIONS - CREATE
// ============================================================================

// Create document
pb.createDoc = async function (doctype, data = {}) {
  const generatedId = data.id || await this.generateId();
  const finalName = data.name || `${doctype.replace(/\s+/g, '-')}-${generatedId}`;
  
  const currentUser = window.currentUser;
  
  const docData = {
    ...data,
    name: finalName
  };
  
  if (currentUser) {
    docData._owner = currentUser.name;
    
    // Only derive permissions if not explicitly provided
    if (!data._allowed_roles && !data._allowed_roles_read && !data._allowed_users && !data._allowed_users_read) {
      const schema = await this.getSchema(doctype);
      const { writeRoles, readRoles } = this.setAllowedRoles(schema);
      
      if (writeRoles.length > 0) {
        docData._allowed_roles = writeRoles;
      }
      if (readRoles.length > 0) {
        docData._allowed_roles_read = readRoles;
      }
    } else {
      // Use explicitly provided permissions
      if (data._allowed_roles) docData._allowed_roles = data._allowed_roles;
      if (data._allowed_roles_read) docData._allowed_roles_read = data._allowed_roles_read;
      if (data._allowed_users) docData._allowed_users = data._allowed_users;
      if (data._allowed_users_read) docData._allowed_users_read = data._allowed_users_read;
    }
  }
  
  const doc = await this.collection(window.MAIN_COLLECTION).create({
    doctype,
    id: generatedId,
    name: finalName,
    data: docData
  });
  
  return doc;
};

// Create new user (registration/self-provisioning)
pb.createUser = async function(email, password, roles = ["Owner"]) {
  try {
    const generatedId = await pb.generateId();
    const universalName = `User-${generatedId}`;
    
    // Step 1: Create user in auth collection
    const user = await pb.collection("users").create({
      email: email,
      password: password,
      passwordConfirm: password,
      name: universalName,
      roles: roles
    });
    
    // Step 2: Create User document with schema-based permissions
    const userDoc = await pb.createDoc("User", {
      id: generatedId,
      name: universalName,
      email: email,
      _owner: universalName
    });
    
    return { user, userDoc };
    
  } catch (err) {
    console.error("Error creating user:", err);
    
    if (err.data) {
      if (err.data.email) {
        console.error("Email validation error:", err.data.email);
        throw new Error("Email already exists or is invalid");
      }
      if (err.data.password) {
        console.error("Password validation error:", err.data.password);
        throw new Error("Password does not meet requirements");
      }
    }
    
    throw err;
  }
};
// ==============================================
pb.getDoc = async function (name) {
  const records = await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `name = "${name}"`
  });
  return records.length > 0 ? records[0] : null;
};




/**
 * @func updateDoc
 * @description Update a document's data by name
 */

pb.updateDoc = async function (name, newData) {
  const doc = await this.getDoc(name);
  if (!doc) throw new Error(`Document not found: ${name}`);

  // merge with existing data
  const mergedData = { ...doc.data, ...newData };

  return await this.collection(window.MAIN_COLLECTION).update(doc.id, {
    data: mergedData
  });
};
/*pb.updateDoc = async function (name, data) {
  const doc = await this.getDoc(name);
  if (!doc) throw new Error(`Document not found: ${name}`);

  return await this.collection(window.MAIN_COLLECTION).update(doc.id, { data });
};*/

/**
 * @func deleteDoc
 * @description Delete a document by name
 */
pb.deleteDoc = async function (name) {
  const doc = await this.getDoc(name);
  if (!doc) throw new Error(`Document not found: ${name}`);

  return await this.collection(window.MAIN_COLLECTION).delete(doc.id);
};

/**
 * @func listDocs
 * @description List documents of a given doctype with optional filter
 */
pb.listDocs = async function (doctype, filter = '') {
  let fullFilter = `doctype = "${doctype}"`;
  if (filter) fullFilter += ` && (${filter})`;

  return await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: fullFilter
  });
};

// ==============================================
// 👥 Child Table Database Operations
// ==============================================

/**
 * @func createChild
 * @description Create a child document linked to a parent
 */
pb.createChild = async function (childDoctype, parentName, parentDoctype, parentField, data = {}) {
  const childData = {
    parent: parentName,
    parenttype: parentDoctype,
    parentfield: parentField,
    ...data
  };

  return await this.createDoc(childDoctype, childData);
};

/**
 * @func listChildren
 * @description List child documents for a given parent
 */
pb.listChildren = async function (childDoctype, parentName) {
  return await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `doctype = "${childDoctype}" && data.parent = "${parentName}"`
  });
};

/**
 * @func updateChild
 * @description Update a field value of a child document
 */
pb.updateChild = async function (childName, fieldName, value) {
  const child = await this.getDoc(childName);
  if (!child) throw new Error(`Child document not found: ${childName}`);

  const newData = { ...child.data, [fieldName]: value };
  return await this.collection(window.MAIN_COLLECTION).update(child.id, { data: newData });
};

/**
 * @func deleteChildren
 * @description Delete multiple child documents by names
 */
pb.deleteChildren = async function (childNames) {
  const promises = childNames.map(async (name) => {
    const doc = await this.getDoc(name);
    if (doc) {
      return this.collection(window.MAIN_COLLECTION).delete(doc.id);
    }
  });
  return await Promise.allSettled(promises);
};

// ==============================================
// 📝 Schema Database Operations
// ==============================================

/**
 * @func getSchema
 * @description Get schema data for a given doctype v6.
 */
pb.getSchema = async function (doctype) {
  try {
    const schemaResult = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
      filter: `doctype = "Schema" && data._schema_doctype = "${doctype}"`
    });
    return schemaResult.items.length > 0 ? schemaResult.items[0].data : null;
  } catch (error) {
    console.error(`Error fetching schema for doctype "${doctype}":`, error);
    return null;
  }
};

// Add this after your existing helper functions in pb-functions.js
/**
 * @func getDisplayName
 * @description Get display name for a record based on schema autoname configuration
 */
pb.getDisplayName = function (record, schema) {
  if (!schema?.autoname || !record?.data) return record.name;

  // Handle "field:fieldname" pattern
  if (schema.autoname.startsWith('field:')) {
    const fieldName = schema.autoname.substring(6); // Remove "field:" prefix
    const displayValue = record.data[fieldName];
    return displayValue || record.name; // Fallback to record.name if field is empty
  }

  // Add other autoname patterns here if needed (like "format:..." etc.)

  return record.name; // Default fallback
};


// ==============================================
// 🔗 Link Field Database Operations
// ==============================================

/**
 * @func getLinkOptions
 * @description Get options for a Link field of a doctype
 */
pb.getLinkOptions = async function (doctype, titleField = 'subject') {
  const records = await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `doctype = "${doctype}"`
  });

  // Get the schema for the target doctype to use with getDisplayName
  const targetSchema = await this.getSchema(doctype);

  return records.map(record => ({
    value: record.name,
    text: record.data[titleField] || record.name,
    displayName: this.getDisplayName(record, targetSchema)  // Add displayName using schema
  }));
};

/**
 * @func getDynamicLinkOptions
 * @description Alias for getLinkOptions (supports dynamic links)
 */
pb.getDynamicLinkOptions = async function (doctype, titleField = 'subject') {
  return await this.getLinkOptions(doctype, titleField);
};

// ==============================================
// ⚡ Fetch From Database Operations
// ==============================================

/**
 * @func processFetchFrom
 * @description Fetch a value from another document using fetch_from path
 */
pb.processFetchFrom = async function (fetchFromPath, sourceValue) {
  if (!fetchFromPath || !sourceValue) return null;

  const [sourceField, targetProperty] = fetchFromPath.split('.');

  if (!sourceField || !targetProperty) return null;

  // Fetch the linked document by name
  const sourceDoc = await this.getDoc(sourceValue);

  if (sourceDoc && sourceDoc.data?.[targetProperty] !== undefined) {
    return sourceDoc.data[targetProperty];
  }

  return null;
};

/**
 * @func processFetchFromBatch
 * @description Process multiple fetch_from fields at once
 */
pb.processFetchFromBatch = async function (fetchFromFields, formData) {
  const fetchPromises = fetchFromFields.map(async (field) => {
    const [sourceField] = field.fetch_from.split('.');
    const sourceValue = formData[sourceField];

    if (sourceValue) {
      const fetchedValue = await this.processFetchFrom(field.fetch_from, sourceValue);
      return { fieldname: field.fieldname, value: fetchedValue };
    }

    return { fieldname: field.fieldname, value: null };
  });

  const results = await Promise.all(fetchPromises);

  const updates = {};
  results.forEach(({ fieldname, value }) => {
    if (value !== null) {
      updates[fieldname] = value;
    }
  });

  return updates;
};

// ==============================================
// 🔍 Search Database Operations
// ==============================================

/**
 * @func search
 * @description Search documents by term in specified fields
 */
pb.search = async function (doctype, searchTerm, fields = ['name']) {
  const filterConditions = fields.map(field => {
    if (field === 'name') {
      return `name ~ "${searchTerm}"`;
    } else {
      return `data.${field} ~ "${searchTerm}"`;
    }
  });

  const filter = `doctype = "${doctype}" && (${filterConditions.join(' || ')})`;

  return await this.collection(window.MAIN_COLLECTION).getFullList({ filter });
};

// ==============================================
// 🔄 Batch Database Operations
// ==============================================

/**
 * @func batchUpdate
 * @description Update multiple documents in batch
 */
pb.batchUpdate = async function (updates) {
  const promises = updates.map(async ({ name, data }) => {
    const doc = await this.getDoc(name);
    if (doc) {
      return this.collection(window.MAIN_COLLECTION).update(doc.id, { data });
    }
  });
  return await Promise.allSettled(promises);
};

/**
 * @func batchDelete
 * @description Delete multiple documents in batch
 */
pb.batchDelete = async function (names) {
  const promises = names.map(async (name) => {
    const doc = await this.getDoc(name);
    if (doc) {
      return this.collection(window.MAIN_COLLECTION).delete(doc.id);
    }
  });
  return await Promise.allSettled(promises);
};

/**
 * @func batchCreate
 * @description Create multiple documents in batch
 */
pb.batchCreate = async function (doctype, dataArray) {
  const promises = dataArray.map(data => this.createDoc(doctype, data));
  return await Promise.allSettled(promises);
};

// ==============================================
// 🎯 React-Friendly Composite Operations
// ==============================================
/**
* @func loadFormData
* @description Load schema, record, and link options for a form (React-friendly)
*/
pb.loadFormData = async function (doctype, recordName = null) {
  const promises = [
    this.getSchema(doctype),
    recordName ? this.getDoc(recordName) : Promise.resolve(null)
  ];

  const [schema, record] = await Promise.all(promises);

  if (!schema) {
    throw new Error(`Schema not found for doctype: ${doctype}`);
  }

  // Load link options for all Link fields
  const linkFields = schema.fields?.filter(f => f.fieldtype === 'Link') || [];
  const linkPromises = linkFields.map(async (field) => {
    const options = await this.getLinkOptions(field.options, schema.title_field || 'subject');
    return { fieldname: field.fieldname, options };
  });

  const linkResults = await Promise.all(linkPromises);
  const linkOptions = {};
  linkResults.forEach(({ fieldname, options }) => {
    linkOptions[fieldname] = options;
  });

  return {
    schema,
    record,
    linkOptions,
    formData: record?.data || {}
  };
};

/**
 * @func loadChildTableData
 * @description Load schema and records for a child table (React-friendly)
 */
pb.loadChildTableData = async function (childDoctype, parentName) {
  const promises = [
    this.getSchema(childDoctype),
    this.listChildren(childDoctype, parentName)
  ];

  const [childSchema, childRecords] = await Promise.all(promises);

  return {
    schema: childSchema,
    records: childRecords,
    formattedRecords: childRecords.map(record => ({
      ...record,
      _isNew: false,
      _isDirty: false
    }))
  };
};

/**
 * @func handleFetchFromUpdates
 * @description Handle fetch_from updates when a field changes in React form
 */
pb.handleFetchFromUpdates = async function (changedField, newValue, schema, currentFormData) {
  if (!schema?.fields) return {};

  const fetchFromFields = schema.fields.filter(field =>
    field.fetch_from && field.fetch_from.startsWith(`${changedField}.`)
  );

  if (fetchFromFields.length === 0) return {};

  return await this.processFetchFromBatch(fetchFromFields, {
    ...currentFormData,
    [changedField]: newValue
  });
};

/**
 * @func getDocCount
 * @description Get total number of documents for a doctype with optional filter
 */
pb.getDocCount = async function (doctype, filter = '') {
  let fullFilter = `doctype = "${doctype}"`;
  if (filter) fullFilter += ` && (${filter})`;

  const result = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
    filter: fullFilter
  });
  return result.totalItems;
};

/**
 * @func getFieldValues
 * @description Get values of a specific field for all documents of a doctype
 */
pb.getFieldValues = async function (doctype, fieldname, filter = '') {
  let fullFilter = `doctype = "${doctype}"`;
  if (filter) fullFilter += ` && (${filter})`;

  const records = await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: fullFilter,
    fields: `data.${fieldname}`
  });

  return records.map(r => r.data?.[fieldname]).filter(v => v !== undefined);
};

/**
 * @func docExists
 * @description Check if a document exists by name
 */
pb.docExists = async function (name) {
  try {
    const doc = await this.getDoc(name);
    return !!doc;
  } catch {
    return false;
  }
};

/**
 * @func getLastModified
 * @description Get the last modified timestamp of a document
 */
pb.getLastModified = async function (name) {
  const doc = await this.getDoc(name);
  return doc?.updated || null;
};

/**
 * @func duplicateDoc
 * @description Duplicate a document with optional overrides and target doctype
 */
pb.duplicateDoc = async function (sourceName, doctype = null, newData = {}) {
  const sourceDoc = await this.getDoc(sourceName);
  if (!sourceDoc) throw new Error(`Source document not found: ${sourceName}`);

  const targetDoctype = doctype || sourceDoc.doctype;
  const duplicatedData = { ...sourceDoc.data, ...newData };
  return await this.createDoc(targetDoctype, duplicatedData);
};
/**
 * @func resolveToId
 * @description Convert document name to PocketBase ID
 */
pb.resolveToId = async function (name) {
  const doc = await this.getDoc(name);
  return doc?.id || null;
};

/**
 * @func resolveToName
 * @description Convert PocketBase ID to document name
 */
pb.resolveToName = async function (id) {
  try {
    const doc = await this.collection(window.MAIN_COLLECTION).getOne(id);
    return doc?.name || null;
  } catch {
    return null;
  }
};

/**
 * @func parseSelectOptions
 * @description Parse ERPNext Select field options string into array of objects
 */
pb.parseSelectOptions = function (optionsString) {
  if (!optionsString || typeof optionsString !== 'string') {
    return [];
  }

  return optionsString
    .split('\n')
    .map(option => option.trim())
    .filter(option => option.length > 0)
    .map(option => ({
      value: option,
      text: option,
      displayName: option  // Add displayName property
    }));
};

/**
 * @func getSelectFieldOptions
 * @description Get all Select field options for a schema
 */
pb.getSelectFieldOptions = function (schema) {
  if (!schema?.fields) return {};

  const selectOptions = {};

  schema.fields.forEach(field => {
    if (field.fieldtype === 'Select' && field.options) {
      selectOptions[field.fieldname] = this.parseSelectOptions(field.options);
    }
  });

  return selectOptions;
};

/**
 * @func loadFormDataWithSelects
 * @description Load schema, record, link options, and select options for a form
 */
pb.loadFormDataWithSelects = async function (doctype, recordName = null) {
  const promises = [
    this.getSchema(doctype),
    recordName ? this.getDoc(recordName) : Promise.resolve(null)
  ];

  const [schema, record] = await Promise.all(promises);

  if (!schema) {
    throw new Error(`Schema not found for doctype: ${doctype}`);
  }

  // Load link options for Link fields
  const linkFields = schema.fields?.filter(f => f.fieldtype === 'Link') || [];
  const linkPromises = linkFields.map(async (field) => {
    const options = await this.getLinkOptions(field.options, schema.title_field || 'subject');
    return { fieldname: field.fieldname, options };
  });

  const linkResults = await Promise.all(linkPromises);
  const linkOptions = {};
  linkResults.forEach(({ fieldname, options }) => {
    linkOptions[fieldname] = options;
  });

  // Get Select field options
  const selectOptions = this.getSelectFieldOptions(schema);

  return {
    schema,
    record,
    linkOptions,
    selectOptions, // New: Select field options
    formData: record?.data || {}
  };
};

/**
 * @func createSchema
 * @description Create a Schema document for a given doctype
 * TODO: Implement schema creation logic
 */
pb.createSchema = async function (for_doctype, data = {}) {
  try {
    // Step 1: Create with temp name and doctype = "Schema"
    const tempDoc = await this.collection(window.MAIN_COLLECTION).create({
      doctype: "Schema",
      name: `temp-${Date.now()}`, //update
      data: {
        "doctype": "Schema",
        "_for_doctype": for_doctype,
        "public": true   //old version
      }
    });

    // Step 2: Update with proper name
    const finalName = `Schema-${for_doctype.replace(/\s+/g, '-')}-${tempDoc.id}`;
    const updatedDoc = await this.collection(window.MAIN_COLLECTION).update(tempDoc.id, {
      name: finalName
    });

    console.log(`✅ Created schema for doctype: ${for_doctype} with name: ${finalName}`);

    return { ...updatedDoc, name: finalName };

  } catch (error) {
    console.error(`❌ Failed to create schema for ${for_doctype}:`, error);
    throw error;
  }
};

/**
 * @func getFieldValue
 * @description Retrieve a nested field value from a document using dot notation
 */
pb.getFieldValue = function (doc, fieldPath) {
  const parts = fieldPath.split('.');
  let value = doc.data || doc;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
};

/**
 * @func createDocFrom
 * @description Create a new document by copying data from a source document with optional overrides and field mapping
 */
pb.createDocFrom = async function (sourceName, targetDoctype, {
  overrides = {},
  fieldMapping = {}   // optional: map from sourceField to targetField
} = {}) {
  const sourceDoc = await this.getDoc(sourceName);
  if (!sourceDoc) throw new Error(`Source doc not found: ${sourceName}`);

  const schema = await this.getSchema(targetDoctype);
  if (!schema || !schema.fields) throw new Error(`Schema for ${targetDoctype} not found`);

  const targetData = {};

  for (const field of schema.fields) {
    const targetFieldname = field.fieldname;
    const sourceFieldname = Object.entries(fieldMapping).find(([, v]) => v === targetFieldname)?.[0] || targetFieldname;

    // Skip if explicitly overridden
    if (targetFieldname in overrides) continue;

    const value = this.getFieldValue(sourceDoc, sourceFieldname);
    if (value !== undefined) {
      targetData[targetFieldname] = value;
    }
  }

  const finalData = {
    ...targetData,
    ...overrides
  };

  return await this.createDoc(targetDoctype, finalData);
};

/**
 * @func runCode
 * @description Execute JavaScript code stored in a document's `code` field
 */
pb.runCode = async function (name) {
  const record = await this.getDoc(name);
  if (!record || !record.data?.code) {
    throw new Error("Code not found");
  }

  // This will execute the code inside the current scope
  eval(record.data.code);
};
/**
* @func getWorkflow
* @description Retrieve the workflow configuration for a given doctype, including states and transitions
*/
pb.getWorkflow = async function (doctype) {
  const workflowResult = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
    filter: `doctype = "Workflow" && data.document_type = "${doctype}"`
  });

  if (workflowResult.items.length === 0) return null;

  const workflow = workflowResult.items[0];

  // Get all workflow states for this workflow
  const states = await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `doctype = "Workflow Document State" && data.parent = "${workflow.name}"`
  });

  // Get all workflow transitions for this workflow  
  const transitions = await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `doctype = "Workflow Transition" && data.parent = "${workflow.name}"`
  });

  // Build complete workflow object
  return {
    ...workflow.data,
    name: workflow.name,
    states: states.map(state => ({
      state: state.data.state,
      doc_status: state.data.doc_status,
      allow_edit: state.data.allow_edit,
      is_optional_state: state.data.is_optional_state,
      allow_self_approval: state.data.allow_self_approval,
      name: state.name
    })),
    transitions: transitions.map(transition => ({
      action: transition.data.action,
      state: transition.data.state,
      next_state: transition.data.next_state,
      allowed: transition.data.allowed,
      condition: transition.data.condition,
      allow_self_approval: transition.data.allow_self_approval,
      name: transition.name
    }))
  };
};

/**
 * @func getWorkflowState
 * @description Get the current workflow state of a document, fallback to status or 'Draft'
 */
pb.getWorkflowState = async function (docName) {
  const doc = await this.getDoc(docName);
  if (!doc) return null;

  // Get the workflow for this doctype
  const workflow = await this.getWorkflow(doc.doctype);
  if (!workflow) return doc.data?.status || 'Draft';

  // Use the workflow state field if specified, otherwise fall back to common fields
  const stateField = workflow.workflow_state_field || 'workflow_state';
  return doc.data?.[stateField] || doc.data?.status || 'Draft';
};

/**
 * @func getAvailableTransitions
 * @description Get all valid workflow transitions for a document's current state and optional user role
 */
pb.getAvailableTransitions = async function (doctype, currentState, userRole = null) {
  const workflow = await this.getWorkflow(doctype);
  if (!workflow || !workflow.transitions) return [];

  // Filter transitions that start from the current state
  let availableTransitions = workflow.transitions.filter(t =>
    t.state === currentState
  );

  // If userRole is provided, filter by allowed roles
  if (userRole) {
    availableTransitions = availableTransitions.filter(t =>
      !t.allowed || t.allowed === userRole || t.allowed.includes(userRole)
    );
  }

  return availableTransitions;
};

/**
 * @func executeWorkflowTransition
 * @description Execute a workflow transition on a document, update workflow state, docstatus, and history
 */
pb.executeWorkflowTransition = async function (docName, transitionAction, comments = '', userRole = null) {
  const doc = await this.getDoc(docName);
  if (!doc) throw new Error(`Document not found: ${docName}`);

  const workflow = await this.getWorkflow(doc.doctype);
  if (!workflow) throw new Error(`No workflow found for doctype: ${doc.doctype}`);

  const currentState = await this.getWorkflowState(docName);
  const availableTransitions = await this.getAvailableTransitions(doc.doctype, currentState, userRole);

  // Find the transition by action
  const validTransition = availableTransitions.find(t => t.action === transitionAction);
  if (!validTransition) {
    const availableActions = availableTransitions.map(t => t.action).join(', ');
    throw new Error(`Invalid transition: ${transitionAction} from state: ${currentState}. Available: ${availableActions}`);
  }

  const stateField = workflow.workflow_state_field || 'workflow_state';

  const updatedData = {
    ...doc.data,
    [stateField]: validTransition.next_state
  };

  // Also update status field for compatibility
  if (stateField !== 'status') {
    updatedData.status = validTransition.next_state;
  }

  // Update docstatus based on the new state
  const newStateInfo = workflow.states.find(s => s.state === validTransition.next_state);
  if (newStateInfo && newStateInfo.doc_status !== undefined) {
    updatedData.docstatus = parseInt(newStateInfo.doc_status);
  }

  // Add to workflow history
  if (!updatedData.workflow_history) {
    updatedData.workflow_history = [];
  }

  updatedData.workflow_history.push({
    timestamp: new Date().toISOString(),
    action: transitionAction,
    from_state: currentState,
    to_state: validTransition.next_state,
    comments: comments,
    user: userRole || 'Current User'
  });

  await this.updateDoc(docName, updatedData);
  return validTransition.next_state;
};
// end of workflow functions
if (!pb.context) {
  pb.context = {};
}




// refactoring react

// ==============================================
// 🎨 Form Field Rendering Functions
// ==============================================

/**
 * @func getFieldInputType
 * @description Get HTML input type for a Frappe field
 */
pb.getFieldInputType = function (fieldtype) {
  const typeMap = {
    'Int': 'number',
    'Float': 'number',
    'Currency': 'number',
    'Percent': 'number',
    'Date': 'date',
    'Datetime': 'datetime-local',
    'Time': 'time',
    'Check': 'checkbox',
    'Text': 'textarea',
    'Small Text': 'textarea',
    'Text Editor': 'textarea',
    'Code': 'textarea',
    'Color': 'color',
    'Password': 'password',
    'Link': 'select',
    'Dynamic Link': 'select',
    'Select': 'select'
  };
  return typeMap[fieldtype] || 'text';
};

/**
 * @func processFieldValue
 * @description Process form field value based on fieldtype
 */
pb.processFieldValue = function (value, fieldtype) {
  switch (fieldtype) {
    case 'Int':
      return value === '' ? null : parseInt(value);
    case 'Float':
    case 'Currency':
    case 'Percent':
      return value === '' ? null : parseFloat(value);
    case 'Check':
      return value ? 1 : 0;
    default:
      return value;
  }
};

/**
 * @func getDynamicLinkDependentValue
 * @description Get the value of the field that a Dynamic Link depends on
 */
pb.getDynamicLinkDependentValue = function (field, formData) {
  if (field.fieldtype !== 'Dynamic Link' || !field.options) {
    return null;
  }
  return formData[field.options] || null;
};

/**
 * @func getFieldOptions
 * @description Get options for Select/Link fields with Dynamic Link support
 */
pb.getFieldOptions = function (field, selectOptions, linkOptions, formData) {
  if (field.fieldtype === 'Select') {
    return selectOptions[field.fieldname] || [];
  }

  if (field.fieldtype === 'Link') {
    return linkOptions[field.fieldname] || [];
  }

  if (field.fieldtype === 'Dynamic Link') {
    const dependentValue = this.getDynamicLinkDependentValue(field, formData);
    if (!dependentValue) {
      return []; // No options until dependent field is selected
    }
    return linkOptions[field.fieldname] || [];
  }

  return [];
};

/**
 * @func isDynamicLinkReady
 * @description Check if Dynamic Link field is ready to show options
 */
pb.isDynamicLinkReady = function (field, formData) {
  if (field.fieldtype !== 'Dynamic Link') {
    return true; // Not a dynamic link, always ready
  }

  const dependentValue = this.getDynamicLinkDependentValue(field, formData);
  return !!dependentValue;
};

/**
 * @func getDynamicLinkPlaceholder
 * @description Get appropriate placeholder text for Dynamic Link fields
 */
pb.getDynamicLinkPlaceholder = function (field, formData) {
  if (field.fieldtype !== 'Dynamic Link') {
    return `-- Select ${field.label} --`;
  }

  const dependentValue = this.getDynamicLinkDependentValue(field, formData);
  if (!dependentValue) {
    return `Select ${field.options} first`;
  }

  return `-- Select ${field.label} --`;
};

/**
 * @func createFormFieldConfig
 * @description Create standardized field configuration object with Dynamic Link support
 */
pb.createFormFieldConfig = function (
  field,
  value,
  formData,
  selectOptions,
  linkOptions,
  permissions = { write: true } // ✅ default
) {
  const inputType = this.getFieldInputType(field.fieldtype);
  const options = this.getFieldOptions(field, selectOptions, linkOptions, formData);

  const isReadOnly = !!field.fetch_from || field.read_only || permissions.write === false;

  const isDynamicLinkReady = this.isDynamicLinkReady(field, formData);

  return {
    field,
    inputType,
    value: value || '',
    options,
    isReadOnly,
    isDynamicLinkReady,
    dependentField: field.fieldtype === 'Dynamic Link' ? field.options : null,
    dependentValue: field.fieldtype === 'Dynamic Link'
      ? this.getDynamicLinkDependentValue(field, formData)
      : null,
    placeholder: this.getDynamicLinkPlaceholder(field, formData),
    hasAutoFill: !!field.fetch_from,
    cssClass: `form-control ${isReadOnly ? 'bg-light' : ''}`,
    showDependencyHint: field.fieldtype === 'Dynamic Link' && !isDynamicLinkReady
  };
};


/**
 * @func loadDynamicLinkOptions
 * @description Load options for a Dynamic Link field when dependent field changes
 */
pb.loadDynamicLinkOptions = async function (field, dependentValue, schema) {
  if (field.fieldtype !== 'Dynamic Link' || !dependentValue) {
    return [];
  }

  try {
    const titleField = schema?.title_field || 'name';
    return await this.getDynamicLinkOptions(dependentValue, titleField);
  } catch (err) {
    console.warn(`Failed to load dynamic options for ${field.fieldname}:`, err);
    return [];
  }
};

/**
 * @func processDynamicLinkUpdate
 * @description Process updates when a Dynamic Link dependent field changes
 */
pb.processDynamicLinkUpdate = async function (changedFieldName, newValue, schema, linkOptions) {
  if (!schema?.fields) return { linkOptions, clearedFields: [] };

  // Find all Dynamic Link fields that depend on the changed field
  const dependentDynamicLinks = schema.fields.filter(f =>
    f.fieldtype === 'Dynamic Link' && f.options === changedFieldName
  );

  if (dependentDynamicLinks.length === 0) {
    return { linkOptions, clearedFields: [] };
  }

  const updatedLinkOptions = { ...linkOptions };
  const clearedFields = [];

  for (const dynField of dependentDynamicLinks) {
    if (newValue) {
      // Load new options for this Dynamic Link
      const options = await this.loadDynamicLinkOptions(dynField, newValue, schema);
      updatedLinkOptions[dynField.fieldname] = options;
    } else {
      // Clear options if dependent field is empty
      updatedLinkOptions[dynField.fieldname] = [];
      clearedFields.push(dynField.fieldname);
    }
  }

  return { linkOptions: updatedLinkOptions, clearedFields };
};

/**
 * @func getSelectBadgeColor
 * @description Get Bootstrap badge color for select field values
 */
pb.getSelectBadgeColor = function (value) {
  if (!value) return 'secondary';

  const colorMap = {
    'Open': 'primary',
    'Working': 'info',
    'Pending Review': 'warning',
    'Overdue': 'danger',
    'Template': 'secondary',
    'Completed': 'success',
    'Cancelled': 'dark',
    'Active': 'success',
    'Inactive': 'secondary',
    'Draft': 'secondary',
    'Submitted': 'info',
    'Approved': 'success',
    'Rejected': 'danger'
  };

  return colorMap[value] || 'secondary';
};

console.log('✅ PocketBase Frappe Database Functions loaded!');
console.log(`📋 Collection: ${window.MAIN_COLLECTION}`);


// node functions
// ============================================== 
// 🔗 Node Database Operations
// ==============================================

/**
 * @func createNode
 * @description Create a Node alias for a document
 */
pb.createNode = async function (refDoctype, refDocname, nodeData = {}) {
  const nodeData_final = {
    node_ref_doctype: refDoctype,
    node_ref_docname: refDocname,
    ...nodeData
  };

  return await this.createDoc('Node', nodeData_final);
};

/**
 * @func createRelationshipNode
 * @description Create a Node that represents a relationship between two other nodes
 */
pb.createRelationshipNode = async function (parentNodeName, childNodeName, relationshipType = '', relationshipData = {}) {
  const relationshipNode = {
    parent: parentNodeName,
    parenttype: 'Node',
    parentfield: 'node_parent',
    relationship_type: relationshipType,
    ...relationshipData
  };

  return await this.createChild('Node', parentNodeName, 'Node', 'node_parent', relationshipNode);
};

/**
 * @func getNode
 * @description Get a Node by name
 */
pb.getNode = async function (nodeName) {
  return await this.getDoc(nodeName);
};

/**
 * @func getNodeByRef
 * @description Get Node(s) that reference a specific document
 */
pb.getNodeByRef = async function (refDoctype, refDocname) {
  return await this.listDocs('Node', `data.node_ref_doctype = "${refDoctype}" && data.node_ref_docname = "${refDocname}"`);
};

/**
 * @func getReferencedDoc
 * @description Get the actual document that a Node references
 */
pb.getReferencedDoc = async function (nodeName) {
  const node = await this.getNode(nodeName);
  if (!node) throw new Error(`Node not found: ${nodeName}`);

  const { node_ref_doctype, node_ref_docname } = node.data;
  return await this.getDoc(node_ref_docname);
};

/**
 * @func getChildNodes
 * @description Get all child nodes of a parent node
 */
pb.getChildNodes = async function (parentNodeName) {
  return await this.listChildren('Node', parentNodeName);
};

/**
 * @func getParentNode
 * @description Get the parent node of a child node
 */
pb.getParentNode = async function (childNodeName) {
  const childNode = await this.getNode(childNodeName);
  if (!childNode || !childNode.data.parent) return null;

  return await this.getNode(childNode.data.parent);
};

/**
 * @func getRelatedNodes
 * @description Get all nodes related to a given node (both parent and children)
 */
pb.getRelatedNodes = async function (nodeName) {
  const [children, parent] = await Promise.all([
    this.getChildNodes(nodeName),
    this.getParentNode(nodeName)
  ]);

  return {
    children: children || [],
    parent: parent
  };
};

/**
 * @func getNodesByRelationship
 * @description Get nodes by relationship type
 */
pb.getNodesByRelationship = async function (relationshipType) {
  return await this.listDocs('Node', `data.relationship_type = "${relationshipType}"`);
};

/**
 * @func getRelationshipChain
 * @description Get the complete relationship chain starting from a node
 */
pb.getRelationshipChain = async function (startNodeName, maxDepth = 10) {
  const visited = new Set();
  const chain = [];

  const traverse = async (nodeName, depth = 0) => {
    if (depth >= maxDepth || visited.has(nodeName)) return;
    visited.add(nodeName);

    const node = await this.getNode(nodeName);
    if (!node) return;

    chain.push({
      node: node,
      depth: depth,
      referenced_doc: await this.getReferencedDoc(nodeName).catch(() => null)
    });

    const children = await this.getChildNodes(nodeName);
    for (const child of children) {
      await traverse(child.name, depth + 1);
    }
  };

  await traverse(startNodeName);
  return chain;
};

/**
 * @func createWorkflowStep
 * @description Create a workflow step node
 */
pb.createWorkflowStep = async function (workflowName, parentNodeName, childNodeName, stepData = {}) {
  const stepNode = {
    relationship_type: 'workflow_step',
    workflow_name: workflowName,
    step_parent_node: parentNodeName,
    step_child_node: childNodeName,
    state: 'pending',
    ...stepData
  };

  return await this.createRelationshipNode(parentNodeName, childNodeName, 'workflow_step', stepNode);
};

/**
 * @func getWorkflowSteps
 * @description Get all workflow steps for a workflow
 */
pb.getWorkflowSteps = async function (workflowName) {
  return await this.listDocs('Node', `data.relationship_type = "workflow_step" && data.workflow_name = "${workflowName}"`);
};

/**
 * @func updateWorkflowStepState
 * @description Update the state of a workflow step
 */
pb.updateWorkflowStepState = async function (stepNodeName, newState, updateData = {}) {
  const updatePayload = {
    state: newState,
    updated_date: new Date().toISOString(),
    ...updateData
  };

  return await this.updateDoc(stepNodeName, updatePayload);
};

/**
 * @func getNodesByDoctype
 * @description Get all nodes that reference documents of a specific doctype
 */
pb.getNodesByDoctype = async function (refDoctype) {
  return await this.listDocs('Node', `data.node_ref_doctype = "${refDoctype}"`);
};

/**
 * @func deleteNodeAndRelationships
 * @description Delete a node and all its relationship children
 */
pb.deleteNodeAndRelationships = async function (nodeName) {
  // Get all child relationship nodes
  const children = await this.getChildNodes(nodeName);

  // Delete all children first
  if (children.length > 0) {
    const childNames = children.map(child => child.name);
    await this.deleteChildren(childNames);
  }

  // Delete the node itself
  return await this.deleteDoc(nodeName);
};

/**
 * @func findNodePath
 * @description Find path between two nodes through relationships
 */
pb.findNodePath = async function (startNodeName, targetNodeName, maxDepth = 5) {
  const visited = new Set();
  const queue = [{ node: startNodeName, path: [startNodeName] }];

  while (queue.length > 0) {
    const { node: currentNode, path } = queue.shift();

    if (currentNode === targetNodeName) {
      return path;
    }

    if (path.length >= maxDepth || visited.has(currentNode)) {
      continue;
    }

    visited.add(currentNode);

    // Get related nodes (both children and parent)
    const related = await this.getRelatedNodes(currentNode);

    // Add children to queue
    for (const child of related.children) {
      if (!visited.has(child.name)) {
        queue.push({
          node: child.name,
          path: [...path, child.name]
        });
      }
    }

    // Add parent to queue
    if (related.parent && !visited.has(related.parent.name)) {
      queue.push({
        node: related.parent.name,
        path: [...path, related.parent.name]
      });
    }
  }

  return null; // No path found
};

/**
 * @func createNodeAlias
 * @description Create a Node alias for an existing document (convenience wrapper)
 */
pb.createNodeAlias = async function (docname) {
  // Get the document to find its doctype
  const doc = await this.getDoc(docname);
  if (!doc) throw new Error(`Document not found: ${docname}`);

  return await this.createNode(doc.doctype, docname);
};


/**
 * @func getContext
 * @description Get complete context for a document - handles both Node and business documents
 * @param {string} docName - Name of the document (Node or business document)
 * @param {Object} options - Context retrieval options
 * @returns {Object} Complete context with document, relationships, and children
 */

/**
 * @func getContext
 * @description Get complete context for a document - handles both Node and business documents
 * @param {string} docName - Name of the document (Node or business document)
 * @param {Object} options - Context retrieval options
 * @returns {Object} Complete context with document, relationships, and children
 */
pb.getContext = async function (docName, options = {}) {
  const {
    includeChildren = true,
    includeParent = true,
    includeReferencedDocs = true,
    maxDepth = 2,
    relationshipTypes = null // null = all types, array = specific types
  } = options;

  try {
    // Step 1: Get the main document
    const mainDoc = await this.getDoc(docName);
    if (!mainDoc) {
      throw new Error(`Document not found: ${docName}`);
    }

    let context = {
      mainDoc: mainDoc,
      docType: mainDoc.doctype,
      isNodeDoc: mainDoc.doctype === 'Node',
      referencedDoc: null,
      children: [],
      parent: null,
      relationships: [],
      relatedDocs: new Map() // Map of docname -> document
    };

    if (context.isNodeDoc) {
      // Branch 1: Main document IS a Node
      const nodeDoc = context.mainDoc;
      
      console.log('Processing Node document:', nodeDoc.name);
      console.log('Node data:', nodeDoc.data);

      // Get the referenced business document
      if (includeReferencedDocs && nodeDoc.data.node_ref_docname) {
        console.log('Getting referenced document:', nodeDoc.data.node_ref_docname);
        try {
          context.referencedDoc = await this.getDoc(nodeDoc.data.node_ref_docname);
          console.log('Retrieved referenced doc:', context.referencedDoc ? context.referencedDoc.name : 'null');
        } catch (error) {
          console.warn(`Referenced document not found: ${nodeDoc.data.node_ref_docname}`, error);
        }
      }

      // Get child nodes and their contexts
      if (includeChildren) {
        console.log('Getting child nodes for:', nodeDoc.name);
        const childNodes = await this.getChildNodes(nodeDoc.name);
        console.log('Found child nodes:', childNodes.length);
        
        for (const childNode of childNodes) {
          const childContext = {
            node: childNode,
            referencedDoc: null,
            relationshipType: childNode.data.relationship_type || 'default'
          };

          // Filter by relationship type if specified
          if (relationshipTypes && !relationshipTypes.includes(childContext.relationshipType)) {
            continue;
          }

          // Get referenced document for child node
          if (includeReferencedDocs && childNode.data.node_ref_docname) {
            try {
              childContext.referencedDoc = await this.getDoc(childNode.data.node_ref_docname);
              // Store in related docs map for easy lookup
              context.relatedDocs.set(childNode.data.node_ref_docname, childContext.referencedDoc);
            } catch (error) {
              console.warn(`Child referenced document not found: ${childNode.data.node_ref_docname}`);
            }
          }

          context.children.push(childContext);
          context.relationships.push({
            type: childContext.relationshipType,
            parentNode: nodeDoc.name,
            childNode: childNode.name,
            metadata: childNode.data
          });
        }
      }

      // Get parent node if exists
      if (includeParent && nodeDoc.data.parent) {
        try {
          context.parent = await this.getNode(nodeDoc.data.parent);
          
          // Get parent's referenced document too
          if (includeReferencedDocs && context.parent.data.node_ref_docname) {
            const parentReferencedDoc = await this.getDoc(context.parent.data.node_ref_docname);
            context.relatedDocs.set(context.parent.data.node_ref_docname, parentReferencedDoc);
          }
        } catch (error) {
          console.warn(`Parent node not found: ${nodeDoc.data.parent}`);
        }
      }

    } else {
      // Branch 2: Main document is NOT a Node - find its Node references
      const businessDoc = context.mainDoc;
      
      console.log('Processing business document:', businessDoc.name);

      // Find all Node references to this business document
      const nodeReferences = await this.getNodeByRef(businessDoc.doctype, businessDoc.name);
      console.log('Found node references:', nodeReferences.length);
      
      context.nodeReferences = nodeReferences;

      // Process each Node reference
      for (const nodeRef of nodeReferences) {
        // Get children for this node reference
        if (includeChildren) {
          const childNodes = await this.getChildNodes(nodeRef.name);
          
          for (const childNode of childNodes) {
            const childContext = {
              node: childNode,
              referencedDoc: null,
              relationshipType: childNode.data.relationship_type || 'default',
              viaNodeReference: nodeRef.name
            };

            // Filter by relationship type
            if (relationshipTypes && !relationshipTypes.includes(childContext.relationshipType)) {
              continue;
            }

            // Get referenced document for child node
            if (includeReferencedDocs && childNode.data.node_ref_docname) {
              try {
                childContext.referencedDoc = await this.getDoc(childNode.data.node_ref_docname);
                context.relatedDocs.set(childNode.data.node_ref_docname, childContext.referencedDoc);
              } catch (error) {
                console.warn(`Child referenced document not found: ${childNode.data.node_ref_docname}`);
              }
            }

            context.children.push(childContext);
            context.relationships.push({
              type: childContext.relationshipType,
              parentNode: nodeRef.name,
              childNode: childNode.name,
              metadata: childNode.data,
              viaNodeReference: nodeRef.name
            });
          }
        }

        // Get parent for this node reference
        if (includeParent && nodeRef.data.parent) {
          try {
            const parentNode = await this.getNode(nodeRef.data.parent);
            
            if (!context.parent) { // Only set first parent found
              context.parent = parentNode;
              
              // Get parent's referenced document
              if (includeReferencedDocs && parentNode.data.node_ref_docname) {
                const parentReferencedDoc = await this.getDoc(parentNode.data.node_ref_docname);
                context.relatedDocs.set(parentNode.data.node_ref_docname, parentReferencedDoc);
              }
            }
          } catch (error) {
            console.warn(`Parent node not found: ${nodeRef.data.parent}`);
          }
        }
      }
    }

    return context;

  } catch (error) {
    console.error('getContext error:', error);
    throw error;
  }
};

/**
 * @func getContextByType
 * @description Get context filtered by relationship types
 */
pb.getContextByType = async function (docName, relationshipTypes, options = {}) {
  return await this.getContext(docName, {
    ...options,
    relationshipTypes: Array.isArray(relationshipTypes) ? relationshipTypes : [relationshipTypes]
  });
};

/**
 * @func getWorkflowContext
 * @description Get workflow-specific context for a document
 */
pb.getWorkflowContext = async function (docName, workflowName = null) {
  const relationshipTypes = workflowName 
    ? [`workflow_step_${workflowName}`, 'workflow_step']
    : ['workflow_step', 'approval_step', 'workflow_next'];
    
  return await this.getContextByType(docName, relationshipTypes);
};

/**
 * @func getRelationshipContext  
 * @description Get business relationship context (assignments, ownership, etc.)
 */
pb.getRelationshipContext = async function (docName) {
  const relationshipTypes = [
    'assigned_to', 'owned_by', 'belongs_to', 'contains', 
    'user_assigned_to_task', 'invoice_to_customer'
  ];
  
  return await this.getContextByType(docName, relationshipTypes);
};