//v7. formfield 

// ============================================================================
// POCKETBASE CLIENT INITIALIZATION
// ============================================================================

window.pb = window.pb || new PocketBase("http://127.0.0.1:8090/");
// DISABLE auto-cancellation properly in UMD build
window.pb.autoCancellation(false);


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

/* Create new user (registration/self-provisioning)
* @func createUser
* @description Create a new user with auth and User document, with schema-based permissions
* https://claude.ai/chat/84da077c-6dcd-43ee-a70c-e731ae8ca4a7 
* @todo CREATE AND UPDATE @request.auth.id = "" && @request.data.roles = ["Owner"] && @request.data.roles:length = 1
*/

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
 * @func validateChildData v1
 * @description Validate child table data against schema, including Link field existence checks
 * @throws Error if validation fails
 * @ai https://claude.ai/chat/0fb0ffa0-4cde-4e16-812f-3ca8b1eaa1eb 
 */
pb.validateChildData = async function (childDoctype, data) {
  const schema = await this.getSchema(childDoctype);
  
  if (!schema) {
    throw new Error(`Schema not found for doctype: ${childDoctype}`);
  }
  
  const fields = schema.fields || [];
  const errors = [];
  
  for (const field of fields) {
    const fieldname = field.fieldname;
    const fieldtype = field.fieldtype;
    const value = data[fieldname];
    
    if (field.reqd && !value) {
      errors.push(`Required field missing: ${field.label || fieldname}`);
      continue;
    }
    
    if (!value) continue;
    
    // Validate Link fields
    if (fieldtype === 'Link') {
      const linkedDoctype = field.options;
      
      if (!linkedDoctype) {
        errors.push(`Link field "${fieldname}" has no target doctype specified in schema`);
        continue;
      }
      
      // Query specifically by doctype AND name
      const linkedDocs = await this.collection(window.MAIN_COLLECTION).getFullList({
        filter: `doctype = "${linkedDoctype}" && name = "${value}"`
      });
      
      if (linkedDocs.length === 0) {
        errors.push(
          `Invalid ${field.label || fieldname}: "${value}" does not exist in ${linkedDoctype}`
        );
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed for ${childDoctype}:\n- ${errors.join('\n- ')}`);
  }
  
  return true;
};

/**
 * @func createChild v2
 * @description Create a child document linked to a parent, whith validation
 * @ai https://claude.ai/chat/0fb0ffa0-4cde-4e16-812f-3ca8b1eaa1eb
 * 
 */
pb.createChild = async function (childDoctype, parentName, parentDoctype, parentField, data = {}) {
  // Validate the data before creating
  await this.validateChildData(childDoctype, data);  //added
  
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


// ====== Context building helper functions ======
/**
 * @func getAllChildren
 * @description Get all children of any type for a parent
 */
pb.getAllChildren = async function(parentName) {
  return await this.collection(window.MAIN_COLLECTION).getFullList({
    filter: `data.parent = "${parentName}"`
  });
};



/**
 * @func getDocContextWithLinks
 * @description Build complete document context with optimized link resolution
 * @param {string} name - Document name (globally unique identifier)
 * @param {Object} options - Configuration options
 * @returns {Object} Full document with children and resolved links
 */
pb.getDocContextWithLinks = async function(name, options = {}) {
  const { 
    resolveLinks = true, 
    maxDepth = 1,
    _depth = 0
  } = options;
  
  if (_depth >= maxDepth) return null;
  
  // Known reference doctypes that don't need resolution
  const REFERENCE_DOCTYPES = new Set([
    'Currency', 'UOM', 'Language', 'Country', 
    'Territory', 'Fiscal Year', 'Letter Head'
  ]);
  
  // Cache for deduplication
  const linkCache = new Map();
  
  // 1. Get parent document - doctype comes from here
  const parentDoc = await this.getDoc(name);
  if (!parentDoc) throw new Error(`Document not found: ${name}`);
  
  const doctype = parentDoc.doctype;
  
  // 2. Get schema
  const schema = await this.getSchema(doctype);
  if (!schema) throw new Error(`Schema not found: ${doctype}`);
  
  // 3. Get all children in one query
  const allChildren = await this.getAllChildren(name);
  
  // 4. Build base context
  const context = {
    doctype: doctype,
    name: name,
    ...parentDoc.data
  };
  
  // 5. Helper to check if field should be resolved
  const shouldResolveField = (fieldname, linkedDoctype, parentSchema) => {
    // Skip reference doctypes
    if (REFERENCE_DOCTYPES.has(linkedDoctype)) return false;
    
    // Resolve if there are fetch_from fields that reference it
    const hasFetchFrom = parentSchema.fields.some(f => 
      f.fetch_from && f.fetch_from.startsWith(`${fieldname}.`)
    );
    
    return hasFetchFrom;
  };
  
  // 6. Collect all link values to resolve (parent + children)
  const linksToResolve = new Map(); // Map<doctype, Set<names>>
  
  if (resolveLinks && _depth < maxDepth) {
    // Collect parent link fields
    const parentLinkFields = schema.fields.filter(f => 
      f.fieldtype === 'Link' && shouldResolveField(f.fieldname, f.options, schema)
    );
    
    for (const field of parentLinkFields) {
      const linkValue = context[field.fieldname];
      if (linkValue) {
        if (!linksToResolve.has(field.options)) {
          linksToResolve.set(field.options, new Set());
        }
        linksToResolve.get(field.options).add(linkValue);
      }
    }
    
    // Collect child link fields from all children
    const tableFields = schema.fields.filter(f => f.fieldtype === 'Table');
    
    for (const field of tableFields) {
      const childDoctype = field.options;
      const childSchema = await this.getSchema(childDoctype);
      
      if (childSchema) {
        const childLinkFields = childSchema.fields.filter(f => 
          f.fieldtype === 'Link' && shouldResolveField(f.fieldname, f.options, childSchema)
        );
        
        const children = allChildren.filter(c => c.doctype === childDoctype);
        
        for (const child of children) {
          for (const linkField of childLinkFields) {
            const linkValue = child.data[linkField.fieldname];
            if (linkValue) {
              if (!linksToResolve.has(linkField.options)) {
                linksToResolve.set(linkField.options, new Set());
              }
              linksToResolve.get(linkField.options).add(linkValue);
            }
          }
        }
      }
    }
  }
  
  // 7. Batch fetch all links grouped by doctype
  for (const [linkedDoctype, names] of linksToResolve) {
    if (names.size === 0) continue;
    
    const nameArray = Array.from(names);
    const filter = nameArray.map(n => `name = "${n}"`).join(' || ');
    
    const linkedDocs = await this.collection(window.MAIN_COLLECTION).getFullList({
      filter: `doctype = "${linkedDoctype}" && (${filter})`
    });
    
    // Populate cache
    for (const doc of linkedDocs) {
      linkCache.set(doc.name, doc.data);
    }
  }
  
  // 8. Apply resolved links to parent
  if (resolveLinks && _depth < maxDepth) {
    const parentLinkFields = schema.fields.filter(f => 
      f.fieldtype === 'Link' && shouldResolveField(f.fieldname, f.options, schema)
    );
    
    for (const field of parentLinkFields) {
      const linkValue = context[field.fieldname];
      if (linkValue && linkCache.has(linkValue)) {
        context[`${field.fieldname}_doc`] = linkCache.get(linkValue);
      }
    }
  }
  
  // 9. Organize and apply resolved links to children
  const tableFields = schema.fields.filter(f => f.fieldtype === 'Table');
  
  for (const field of tableFields) {
    const fieldname = field.fieldname;
    const childDoctype = field.options;
    
    const children = allChildren.filter(child => child.doctype === childDoctype);
    context[fieldname] = [];
    
    for (const child of children) {
      const childData = { ...child.data };
      
      if (resolveLinks && _depth < maxDepth) {
        const childSchema = await this.getSchema(childDoctype);
        if (childSchema) {
          const childLinkFields = childSchema.fields.filter(f => 
            f.fieldtype === 'Link' && shouldResolveField(f.fieldname, f.options, childSchema)
          );
          
          for (const linkField of childLinkFields) {
            const linkValue = childData[linkField.fieldname];
            if (linkValue && linkCache.has(linkValue)) {
              childData[`${linkField.fieldname}_doc`] = linkCache.get(linkValue);
            }
          }
        }
      }
      
      context[fieldname].push(childData);
    }
  }
  
  return context;
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
 * @func loadChildTableData v2 
 * @description Load schema and records for a child table (React-friendly)
 */

pb.loadChildTableData = async function (childDoctype, parentName) {
  const promises = [
    this.getSchema(childDoctype),
    this.listChildren(childDoctype, parentName)
  ];

  const [schema, records] = await Promise.all(promises);

  return {
    schema: schema,        // Changed from childSchema
    records: records       // Changed from childRecords
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


// ============================================================================
// PB-FUNCTIONS.JS - PocketBase Helper Library
// Complete CRUD operations with Bootstrap 4.6.2 styling configuration
// ============================================================================

  
  pb.BS = {
    // Form Controls
    input: {
      base: 'form-control',
      sm: 'form-control-sm',
      lg: 'form-control-lg',
      bold: 'font-weight-bold',
      readOnly: 'form-control-plaintext'
    },
    
    // Buttons
    button: {
      primary: 'btn btn-primary btn-sm',
      secondary: 'btn btn-secondary btn-sm',
      danger: 'btn btn-danger btn-sm',
      success: 'btn btn-success btn-sm',
      warning: 'btn btn-warning btn-sm',
      info: 'btn btn-info btn-sm',
      light: 'btn btn-light btn-sm',
      dark: 'btn btn-dark btn-sm',
      link: 'btn btn-link btn-sm',
      xs: 'btn btn-sm px-2 py-1'
    },
    
    // Tables
    table: {
      base: 'table table-sm table-hover',
      striped: 'table-striped',
      bordered: 'table-bordered',
      borderless: 'table-borderless',
      responsive: 'table-responsive',
      head: 'thead-dark',
      headLight: 'thead-light',
      active: 'table-active',
      primary: 'table-primary',
      secondary: 'table-secondary',
      success: 'table-success',
      danger: 'table-danger',
      warning: 'table-warning',
      info: 'table-info'
    },
    
    // Grid/Columns (Bootstrap 4)
    col: {
      auto: 'col',
      full: 'col-12',
      half: 'col-6',
      third: 'col-4',
      twoThirds: 'col-8',
      quarter: 'col-3',
      threeQuarters: 'col-9',
      // Responsive columns
      sm6: 'col-sm-6',
      sm4: 'col-sm-4',
      md4: 'col-md-4',
      md6: 'col-md-6',
      lg3: 'col-lg-3',
      lg4: 'col-lg-4',
      lg6: 'col-lg-6'
    },
    
    // Badges
    badge: {
      primary: 'badge badge-primary',
      secondary: 'badge badge-secondary',
      success: 'badge badge-success',
      danger: 'badge badge-danger',
      warning: 'badge badge-warning',
      info: 'badge badge-info',
      light: 'badge badge-light',
      dark: 'badge badge-dark',
      pill: 'badge-pill'
    },
    
    // Alerts
    alert: {
      primary: 'alert alert-primary',
      secondary: 'alert alert-secondary',
      success: 'alert alert-success',
      danger: 'alert alert-danger',
      warning: 'alert alert-warning',
      info: 'alert alert-info',
      light: 'alert alert-light',
      dark: 'alert alert-dark',
      dismissible: 'alert-dismissible fade show'
    },
    
    // Text utilities
    text: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
      muted: 'text-muted',
      primary: 'text-primary',
      secondary: 'text-secondary',
      success: 'text-success',
      danger: 'text-danger',
      warning: 'text-warning',
      info: 'text-info',
      light: 'text-light',
      dark: 'text-dark',
      white: 'text-white',
      // Sizes
      small: 'small',
      lead: 'lead',
      // Decorations
      lowercase: 'text-lowercase',
      uppercase: 'text-uppercase',
      capitalize: 'text-capitalize',
      // Weights
      bold: 'font-weight-bold',
      bolder: 'font-weight-bolder',
      normal: 'font-weight-normal',
      light: 'font-weight-light',
      lighter: 'font-weight-lighter',
      italic: 'font-italic',
      monospace: 'text-monospace'
    },
    
    // Background colors
    bg: {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      success: 'bg-success',
      danger: 'bg-danger',
      warning: 'bg-warning',
      info: 'bg-info',
      light: 'bg-light',
      dark: 'bg-dark',
      white: 'bg-white',
      transparent: 'bg-transparent'
    },
    
    // Display utilities
    display: {
      none: 'd-none',
      inline: 'd-inline',
      inlineBlock: 'd-inline-block',
      block: 'd-block',
      table: 'd-table',
      tableCell: 'd-table-cell',
      tableRow: 'd-table-row',
      flex: 'd-flex',
      inlineFlex: 'd-inline-flex',
      // Responsive display
      smNone: 'd-none d-sm-block',
      mdNone: 'd-none d-md-block',
      lgNone: 'd-none d-lg-block',
      smBlock: 'd-sm-block',
      mdBlock: 'd-md-block',
      lgBlock: 'd-lg-block'
    },
    
    // Flexbox utilities
    flex: {
      row: 'flex-row',
      rowReverse: 'flex-row-reverse',
      column: 'flex-column',
      columnReverse: 'flex-column-reverse',
      wrap: 'flex-wrap',
      nowrap: 'flex-nowrap',
      wrapReverse: 'flex-wrap-reverse',
      fill: 'flex-fill',
      grow0: 'flex-grow-0',
      grow1: 'flex-grow-1',
      shrink0: 'flex-shrink-0',
      shrink1: 'flex-shrink-1'
    },
    
    // Justify content
    justify: {
      start: 'justify-content-start',
      end: 'justify-content-end',
      center: 'justify-content-center',
      between: 'justify-content-between',
      around: 'justify-content-around'
    },
    
    // Align items
    align: {
      start: 'align-items-start',
      end: 'align-items-end',
      center: 'align-items-center',
      baseline: 'align-items-baseline',
      stretch: 'align-items-stretch'
    },
    
    // Spacing (Bootstrap 4 scale: 0-5)
    spacing: {
      // Margin
      m0: 'm-0', m1: 'm-1', m2: 'm-2', m3: 'm-3', m4: 'm-4', m5: 'm-5',
      mt0: 'mt-0', mt1: 'mt-1', mt2: 'mt-2', mt3: 'mt-3', mt4: 'mt-4', mt5: 'mt-5',
      mb0: 'mb-0', mb1: 'mb-1', mb2: 'mb-2', mb3: 'mb-3', mb4: 'mb-4', mb5: 'mb-5',
      ml0: 'ml-0', ml1: 'ml-1', ml2: 'ml-2', ml3: 'ml-3', ml4: 'ml-4', ml5: 'ml-5',
      mr0: 'mr-0', mr1: 'mr-1', mr2: 'mr-2', mr3: 'mr-3', mr4: 'mr-4', mr5: 'mr-5',
      mx0: 'mx-0', mx1: 'mx-1', mx2: 'mx-2', mx3: 'mx-3', mx4: 'mx-4', mx5: 'mx-5',
      my0: 'my-0', my1: 'my-1', my2: 'my-2', my3: 'my-3', my4: 'my-4', my5: 'my-5',
      // Padding
      p0: 'p-0', p1: 'p-1', p2: 'p-2', p3: 'p-3', p4: 'p-4', p5: 'p-5',
      pt0: 'pt-0', pt1: 'pt-1', pt2: 'pt-2', pt3: 'pt-3', pt4: 'pt-4', pt5: 'pt-5',
      pb0: 'pb-0', pb1: 'pb-1', pb2: 'pb-2', pb3: 'pb-3', pb4: 'pb-4', pb5: 'pb-5',
      pl0: 'pl-0', pl1: 'pl-1', pl2: 'pl-2', pl3: 'pl-3', pl4: 'pl-4', pl5: 'pl-5',
      pr0: 'pr-0', pr1: 'pr-1', pr2: 'pr-2', pr3: 'pr-3', pr4: 'pr-4', pr5: 'pr-5',
      px0: 'px-0', px1: 'px-1', px2: 'px-2', px3: 'px-3', px4: 'px-4', px5: 'px-5',
      py0: 'py-0', py1: 'py-1', py2: 'py-2', py3: 'py-3', py4: 'py-4', py5: 'py-5',
      // Auto margins
      mAuto: 'm-auto',
      mtAuto: 'mt-auto',
      mbAuto: 'mb-auto',
      mlAuto: 'ml-auto',
      mrAuto: 'mr-auto',
      mxAuto: 'mx-auto',
      myAuto: 'my-auto'
    },
    
    // Form groups and layout
    form: {
      group: 'form-group',
      row: 'form-row',
      inline: 'form-inline',
      label: 'form-label',
      text: 'form-text',
      check: 'form-check',
      checkInput: 'form-check-input',
      checkLabel: 'form-check-label',
      checkInline: 'form-check-inline'
    },
    
    // Cards
    card: {
      base: 'card',
      header: 'card-header',
      body: 'card-body',
      footer: 'card-footer',
      title: 'card-title',
      subtitle: 'card-subtitle',
      text: 'card-text',
      img: 'card-img',
      imgTop: 'card-img-top',
      imgBottom: 'card-img-bottom',
      imgOverlay: 'card-img-overlay'
    },
    
    // Borders
    border: {
      base: 'border',
      top: 'border-top',
      bottom: 'border-bottom',
      left: 'border-left',
      right: 'border-right',
      none: 'border-0',
      primary: 'border-primary',
      secondary: 'border-secondary',
      success: 'border-success',
      danger: 'border-danger',
      warning: 'border-warning',
      info: 'border-info',
      light: 'border-light',
      dark: 'border-dark',
      white: 'border-white'
    },
    
    // Rounded corners
    rounded: {
      base: 'rounded',
      top: 'rounded-top',
      bottom: 'rounded-bottom',
      left: 'rounded-left',
      right: 'rounded-right',
      circle: 'rounded-circle',
      pill: 'rounded-pill',
      none: 'rounded-0',
      sm: 'rounded-sm',
      lg: 'rounded-lg'
    },
    
    // Shadows
    shadow: {
      none: 'shadow-none',
      sm: 'shadow-sm',
      base: 'shadow',
      lg: 'shadow-lg'
    },
    
    // Spinner/Loading
    spinner: 'spinner-border spinner-border-sm',
    spinnerGrow: 'spinner-grow spinner-grow-sm',
    
    // Misc utilities
    util: {
      clearfix: 'clearfix',
      float: {
        left: 'float-left',
        right: 'float-right',
        none: 'float-none'
      },
      overflow: {
        auto: 'overflow-auto',
        hidden: 'overflow-hidden'
      },
      position: {
        static: 'position-static',
        relative: 'position-relative',
        absolute: 'position-absolute',
        fixed: 'position-fixed',
        sticky: 'position-sticky'
      },
      cursor: {
        pointer: 'cursor-pointer'
      },
      userSelect: {
        none: 'user-select-none'
      },
      stretched: 'stretched-link',
      truncate: 'text-truncate',
      visible: 'visible',
      invisible: 'invisible',
      screenReader: 'sr-only'
    }
  };

 


  // ============================================================================

  pb.getSelectBadgeColor = function(value) {
    if (!value) return 'secondary';
    
    const lowerValue = value.toLowerCase();
    
    // Status mappings to Bootstrap badge colors
    if (['draft', 'pending', 'open'].includes(lowerValue)) return 'warning';
    if (['submitted', 'approved', 'completed', 'active'].includes(lowerValue)) return 'success';
    if (['cancelled', 'rejected', 'closed', 'inactive'].includes(lowerValue)) return 'danger';
    if (['hold', 'suspended'].includes(lowerValue)) return 'info';
    
    return 'primary';
  };

  // ============================================================================
  // FORM FIELD CONFIG BUILDER
  // ============================================================================

  pb.createFormFieldConfig = function(field, value, formData, selectOptions, dynamicLinkOptions, permissions = {}) {
    const isBold = field.in_list_view || field.reqd;
    const isReadOnly = !!field.fetch_from || field.read_only || permissions.readOnly;
    const hasAutoFill = !!field.fetch_from;
    
    // Determine input type and options
    let inputType = 'text';
    let options = [];
    let isDynamicLinkReady = true;
    let dependentField = null;
    
    if (field.fieldtype === 'Select') {
      inputType = 'select';
      options = selectOptions[field.fieldname] || [];
    } else if (field.fieldtype === 'Link') {
      inputType = 'select';
      options = dynamicLinkOptions[field.fieldname] || [];
    } else if (field.fieldtype === 'Dynamic Link') {
      inputType = 'select';
      dependentField = field.options;
      const dependentValue = formData[dependentField];
      
      if (dependentValue && dynamicLinkOptions[field.fieldname]) {
        options = dynamicLinkOptions[field.fieldname];
        isDynamicLinkReady = true;
      } else {
        options = [];
        isDynamicLinkReady = false;
      }
    } else if (field.fieldtype === 'Check') {
      inputType = 'checkbox';
    } else if (field.fieldtype === 'Text' || field.fieldtype === 'Small Text' || field.fieldtype === 'Long Text') {
      inputType = 'textarea';
    } else if (field.fieldtype === 'Int' || field.fieldtype === 'Float' || field.fieldtype === 'Currency') {
      inputType = 'number';
    } else if (field.fieldtype === 'Date') {
      inputType = 'date';
    } else if (field.fieldtype === 'Datetime') {
      inputType = 'datetime-local';
    } else if (field.fieldtype === 'Time') {
      inputType = 'time';
    }
    
    // Build CSS classes using Bootstrap config
    const cssClass = [
      inputType === 'checkbox' ? pb.BS.form.checkInput : pb.BS.input.base,
      isBold ? pb.BS.text.bold : '',
      isReadOnly ? pb.BS.input.readOnly : ''
    ].filter(Boolean).join(' ');
    
    const displayCss = [
      pb.BS.input.readOnly,
      isBold ? pb.BS.text.bold : ''
    ].filter(Boolean).join(' ');
    
    return {
      // Field metadata
      fieldname: field.fieldname,
      label: field.label || field.fieldname,
      fieldtype: field.fieldtype,
      
      // Value
      value: value !== undefined && value !== null ? value : '',
      
      // Input configuration
      inputType,
      options,
      
      // State flags
      isReadOnly,
      isDynamicLinkReady,
      hasAutoFill,
      dependentField,
      showDependencyHint: inputType === 'select' && !isDynamicLinkReady && dependentField,
      
      // CSS classes (Bootstrap 4.6.2)
      cssClass,
      displayCss,
      labelCss: field.reqd ? `${pb.BS.form.label} ${pb.BS.text.danger}` : pb.BS.form.label,
      wrapperCss: pb.BS.form.group,
      helpCss: `${pb.BS.form.text} ${pb.BS.text.muted}`,
      
      // Field properties
      placeholder: field.placeholder || `Enter ${field.label || field.fieldname}...`,
      required: !!field.reqd,
      disabled: isReadOnly
    };
  };

  // ============================================================================
  // FETCH FROM FUNCTIONS
  // ============================================================================

  pb.handleFetchFromUpdates = async function(triggerFieldName, triggerValue, schema, currentData) {
    const updates = {};
    
    if (!schema || !schema.fields) return updates;
    
    const fetchFromFields = schema.fields.filter(f => 
      f.fetch_from && f.fetch_from.startsWith(`${triggerFieldName}.`)
    );
    
    if (fetchFromFields.length === 0) return updates;
    
    try {
      const sourceDoc = await pb.getDoc(triggerValue);
      if (!sourceDoc) return updates;
      
      fetchFromFields.forEach(field => {
        const parts = field.fetch_from.split('.');
        if (parts.length >= 2) {
          const sourceField = parts[1];
          const sourceValue = sourceDoc.data[sourceField];
          if (sourceValue !== undefined) {
            updates[field.fieldname] = sourceValue;
          }
        }
      });
    } catch (error) {
      console.error('Error handling fetch_from updates:', error);
    }
    
    return updates;
  };

  pb.processFetchFromBatch = async function(fetchFromFields, currentData) {
    const updates = {};
    
    for (const field of fetchFromFields) {
      if (!field.fetch_from) continue;
      
      const parts = field.fetch_from.split('.');
      if (parts.length < 2) continue;
      
      const linkFieldName = parts[0];
      const sourceFieldName = parts[1];
      const linkValue = currentData[linkFieldName];
      
      if (!linkValue) continue;
      
      try {
        const sourceDoc = await pb.getDoc(linkValue);
        if (sourceDoc && sourceDoc.data[sourceFieldName] !== undefined) {
          updates[field.fieldname] = sourceDoc.data[sourceFieldName];
        }
      } catch (error) {
        console.error(`Error processing fetch_from for ${field.fieldname}:`, error);
      }
    }
    
    return updates;
  };

  // ============================================================================
  // DYNAMIC LINK FUNCTIONS
  // ============================================================================

  pb.processDynamicLinkUpdate = async function(changedFieldName, newValue, schema, currentLinkOptions) {
    const linkOptions = { ...currentLinkOptions };
    const clearedFields = [];
    
    if (!schema || !schema.fields) return { linkOptions, clearedFields };
    
    // Find Dynamic Link fields that depend on the changed field
    const dependentFields = schema.fields.filter(f => 
      f.fieldtype === 'Dynamic Link' && f.options === changedFieldName
    );
    
    for (const field of dependentFields) {
      if (newValue) {
        // Load new options for this Dynamic Link field
        try {
          const options = await pb.getDynamicLinkOptions(newValue, schema.title_field || 'name');
          linkOptions[field.fieldname] = options;
        } catch (error) {
          console.error(`Error loading dynamic link options for ${field.fieldname}:`, error);
          linkOptions[field.fieldname] = [];
        }
      } else {
        // Clear options if source field is empty
        linkOptions[field.fieldname] = [];
      }
      
      // Mark this field for clearing
      clearedFields.push(field.fieldname);
    }
    
    return { linkOptions, clearedFields };
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  pb.getDisplayName = function(record, schema) {
    if (!record) return '';
    
    if (schema && schema.title_field && record.data[schema.title_field]) {
      return record.data[schema.title_field];
    }
    
    return record.name || '';
  };

  pb.processFieldValue = function(value, fieldtype) {
    if (fieldtype === 'Check') {
      return value ? 1 : 0;
    }
    if (fieldtype === 'Int') {
      return value ? parseInt(value, 10) : 0;
    }
    if (fieldtype === 'Float' || fieldtype === 'Currency') {
      return value ? parseFloat(value) : 0;
    }
    return value;
  };

  // ============================================================================
  // FORM DATA LOADER
  // ============================================================================

  pb.loadFormDataWithSelects = async function(doctype, name) {
    try {
      const schema = await pb.getSchema(doctype);
      if (!schema) throw new Error('Schema not found');
      
      const record = await pb.getDoc(name);
      const formData = record?.data || {};
      
      // Get Select field options from schema
      const selectOptions = pb.getSelectFieldOptions(schema);
      
      // Load Link field options
      const linkOptions = {};
      const linkFields = schema.fields.filter(f => f.fieldtype === 'Link');
      
      for (const field of linkFields) {
        const options = await pb.getLinkOptions(field.options, schema.title_field || 'name');
        linkOptions[field.fieldname] = options;
      }
      
      // Load Dynamic Link options for fields that already have a source value
      const dynamicLinkFields = schema.fields.filter(f => f.fieldtype === 'Dynamic Link');
      
      for (const field of dynamicLinkFields) {
        const sourceField = field.options;
        const sourceValue = formData[sourceField];
        
        if (sourceValue) {
          const options = await pb.getDynamicLinkOptions(sourceValue, schema.title_field || 'name');
          linkOptions[field.fieldname] = options;
        } else {
          linkOptions[field.fieldname] = [];
        }
      }
      
      return {
        schema,
        record,
        formData,
        linkOptions,
        selectOptions
      };
    } catch (error) {
      console.error('Error loading form data:', error);
      throw error;
    }
  };

  // ============================================================================
  // EXPORT
  // ============================================================================

  /* Auto-cancellation control
  pb.autoCancellation = function(enabled) {
    if (window.pb && window.pb.autoCancellation) {
      window.pb.autoCancellation(enabled);
    }
  };
  */




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



console.log('✅ PocketBase Frappe Database Functions loaded!');
console.log(`📋 Collection: ${window.MAIN_COLLECTION}`);


// ============================================================================
// REACT UI COMPONENTS
// Requires: React, ReactDOM, TanStack Table loaded in parent HTML
// Uses pb.BS configuration for Bootstrap 4.6.2 styling
// ============================================================================

pb.components = pb.components || {};

// ============================================================================
// BASE TABLE COMPONENT
// Shared table logic for both Main Grid and Child Table
// ============================================================================
pb.components.BaseTable = function({ 
  data = [],
  columns = [],
  loading = false,
  error = null,
  showPagination = true,
  showSearch = true,
  showSelection = false,
  onRowClick = null,
  headerContent = null,
  footerContent = null
}) {
  const { createElement: e, useState } = React;
  const { 
    useReactTable, 
    getCoreRowModel, 
    getSortedRowModel, 
    getFilteredRowModel, 
    getPaginationRowModel, 
    flexRender 
  } = window.TanStackReactTable;
  
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    enableRowSelection: showSelection,
    initialState: { pagination: { pageSize: 20 } }
  });

  // Loading state
  if (loading) {
    return e('div', { 
      className: `${pb.BS.display.flex} ${pb.BS.justify.center} ${pb.BS.align.center} ${pb.BS.spacing.p4}` 
    },
      e('div', { className: pb.BS.spinner })
    );
  }

  // Error state
  if (error) {
    return e('div', { className: pb.BS.alert.danger },
      e('strong', {}, 'Error: '),
      error
    );
  }

  // Empty state
  if (data.length === 0) {
    return e('div', { className: pb.BS.card.base },
      e('div', { className: `${pb.BS.card.body} ${pb.BS.text.center} ${pb.BS.text.muted}` },
        'No records found'
      )
    );
  }

  return e('div', { className: pb.BS.card.base }, [
    // Header
    headerContent && e('div', { 
      key: 'header', 
      className: `${pb.BS.card.header} ${pb.BS.display.flex} ${pb.BS.justify.between} ${pb.BS.align.center}` 
    }, headerContent),
    
    // Search
    showSearch && e('div', { 
      key: 'search', 
      className: `${pb.BS.card.body} ${pb.BS.border.bottom}` 
    },
      e('input', {
        type: 'text',
        className: `${pb.BS.input.base} ${pb.BS.input.sm}`,
        placeholder: 'Search all columns...',
        value: globalFilter || '',
        onChange: ev => setGlobalFilter(ev.target.value)
      })
    ),

    // Table
    e('div', { key: 'table', className: pb.BS.table.responsive },
      e('table', { className: `${pb.BS.table.base} ${pb.BS.table.striped} ${pb.BS.spacing.mb0}` }, [
        // Header
        e('thead', { key: 'head', className: pb.BS.table.head },
          table.getHeaderGroups().map(hg =>
            e('tr', { key: hg.id },
              hg.headers.map(h =>
                e('th', {
                  key: h.id,
                  className: pb.BS.util.cursor.pointer,
                  onClick: h.column.getToggleSortingHandler(),
                  style: { cursor: 'pointer', userSelect: 'none' }
                }, [
                  flexRender(h.column.columnDef.header, h.getContext()),
                  e('span', { key: 'sort', className: pb.BS.spacing.ml1 },
                    h.column.getIsSorted() === 'asc' ? '↑' :
                    h.column.getIsSorted() === 'desc' ? '↓' : ''
                  )
                ])
              )
            )
          )
        ),
        // Body
        e('tbody', { key: 'body' },
          table.getRowModel().rows.map(row =>
            e('tr', {
              key: row.id,
              className: `${row.getIsSelected() ? pb.BS.table.active : ''} ${onRowClick ? pb.BS.util.cursor.pointer : ''}`,
              onClick: onRowClick ? () => onRowClick(row.original) : undefined,
              style: onRowClick ? { cursor: 'pointer' } : {}
            },
              row.getVisibleCells().map(cell =>
                e('td', { key: cell.id },
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                )
              )
            )
          )
        )
      ])
    ),

    // Footer
    footerContent && e('div', { 
      key: 'footer', 
      className: `${pb.BS.card.footer} ${pb.BS.bg.light} ${pb.BS.text.muted}` 
    }, footerContent),

    // Pagination
    showPagination && e('div', { 
      key: 'pagination', 
      className: `${pb.BS.card.footer} ${pb.BS.display.flex} ${pb.BS.justify.between} ${pb.BS.align.center}` 
    }, [
      e('small', { key: 'info', className: pb.BS.text.muted },
        `Showing ${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to ${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} of ${data.length}`
      ),
      e('div', { key: 'controls', className: 'btn-group btn-group-sm' }, [
        e('button', {
          key: 'first',
          onClick: () => table.setPageIndex(0),
          disabled: !table.getCanPreviousPage(),
          className: pb.BS.button.secondary
        }, '⏮'),
        e('button', {
          key: 'prev',
          onClick: () => table.previousPage(),
          disabled: !table.getCanPreviousPage(),
          className: pb.BS.button.secondary
        }, '←'),
        e('button', { 
          key: 'page', 
          className: `${pb.BS.button.secondary} disabled`,
          disabled: true
        }, `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`),
        e('button', {
          key: 'next',
          onClick: () => table.nextPage(),
          disabled: !table.getCanNextPage(),
          className: pb.BS.button.secondary
        }, '→'),
        e('button', {
          key: 'last',
          onClick: () => table.setPageIndex(table.getPageCount() - 1),
          disabled: !table.getCanNextPage(),
          className: pb.BS.button.secondary
        }, '⏭')
      ])
    ])
  ]);
};

// ============================================================================
// MAIN GRID - List all documents of a doctype
// ============================================================================
pb.components.MainGrid = function({ doctype, pb }) {
  const { createElement: e, useState, useEffect, useMemo } = React;
  
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [records, schemaData] = await Promise.all([
          pb.listDocs(doctype),
          pb.getSchema(doctype)
        ]);
        setData(records);
        setSchema(schemaData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [doctype, pb]);

  const columns = useMemo(() => {
    if (!schema) return [];
    
    const visibleFields = schema.fields?.filter(f => f.in_list_view) || [];
    
    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue, row }) => e('a', {
          href: '#',
          className: `${pb.BS.text.primary} ${pb.BS.text.bold}`,
          onClick: ev => {
            ev.preventDefault();
            window.selectExistingRecord?.(row.original.id);
          }
        }, pb.getDisplayName(row.original, schema))
      },
      ...visibleFields.map(f => ({
        accessorKey: `data.${f.fieldname}`,
        header: f.label || f.fieldname,
        cell: ({ getValue }) => {
          const val = getValue();
          
          if (val === null || val === undefined) {
            return e('span', { className: pb.BS.text.muted }, '—');
          }
          
          if (f.fieldtype === 'Check') {
            return val ? '✓' : '✗';
          }
          
          if (f.fieldtype === 'Select') {
            const badgeColor = pb.getSelectBadgeColor(val);
            const badgeClass = pb.BS.badge[badgeColor] || pb.BS.badge.secondary;
            return e('span', { className: badgeClass }, val);
          }
          
          if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
            return new Date(val).toLocaleDateString();
          }
          
          return String(val);
        }
      }))
    ];
  }, [schema, pb, e]);

  return e(pb.components.BaseTable, {
    data,
    columns,
    loading,
    error,
    showPagination: true,
    showSearch: true,
    showSelection: false,
    headerContent: e('h6', { className: pb.BS.spacing.mb0 }, 
      `${doctype} `,
      e('span', { className: pb.BS.badge.info }, data.length)
    )
  });
};

// ============================================================================
// CHILD TABLE - Editable rows for parent document
// ============================================================================
pb.components.ChildTable = function({ field, parentName, pb }) {
  const { createElement: e, useState, useEffect, useCallback, useMemo } = React;
  
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rowSelection, setRowSelection] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await pb.loadChildTableData(field.options, parentName);
        setSchema(result.schema);
        setData(result.records);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [field.options, parentName, pb]);

  const updateCell = useCallback(async (rowId, fieldName, value) => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    
    try {
      await pb.updateChild(row.name, fieldName, value);
      
      if (schema) {
        const updates = await pb.handleFetchFromUpdates(
          fieldName, 
          value, 
          schema, 
          { ...row.data, [fieldName]: value }
        );
        const finalData = { ...row.data, [fieldName]: value, ...updates };
        setData(prev => prev.map(r => 
          r.id === rowId ? { ...r, data: finalData } : r
        ));
      } else {
        setData(prev => prev.map(r => 
          r.id === rowId ? { ...r, data: { ...r.data, [fieldName]: value } } : r
        ));
      }
    } catch (err) {
      console.error('Update failed:', err);
    }
  }, [data, schema, pb]);

  const addRow = useCallback(async () => {
    try {
      const newChild = await pb.createChild(
        field.options, 
        parentName, 
        window.selectedTarget.doctype, 
        field.fieldname
      );
      setData(prev => [...prev, newChild]);
    } catch (err) {
      console.error('Add row failed:', err);
    }
  }, [field, parentName, pb]);

  const deleteSelected = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection);
    const names = selectedIds
      .map(id => data.find(r => r.id === id)?.name)
      .filter(Boolean);
    
    if (names.length === 0) return;
    
    try {
      await pb.deleteChildren(names);
      setData(prev => prev.filter(r => !rowSelection[r.id]));
      setRowSelection({});
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [rowSelection, data, pb]);

  const columns = useMemo(() => {
    if (!schema) return [];
    
    const visibleFields = schema.fields.filter(f => f.in_list_view);
    
    return [
      {
        id: 'select',
        header: ({ table }) => e('input', {
          type: 'checkbox',
          className: pb.BS.form.checkInput,
          checked: table.getIsAllRowsSelected(),
          onChange: table.getToggleAllRowsSelectedHandler()
        }),
        cell: ({ row }) => e('input', {
          type: 'checkbox',
          className: pb.BS.form.checkInput,
          checked: row.getIsSelected(),
          onChange: row.getToggleSelectedHandler()
        }),
        size: 40
      },
      {
        accessorKey: 'name',
        header: 'Name',
        size: 150,
        cell: ({ getValue }) => e('small', { 
          className: `${pb.BS.text.muted} ${pb.BS.text.monospace}` 
        }, getValue())
      },
      ...visibleFields.map(f => ({
        accessorKey: `data.${f.fieldname}`,
        header: f.label || f.fieldname,
        cell: ({ getValue, row }) => {
          const val = getValue();
          const isReadOnly = !!f.fetch_from;
          
          // Checkbox field
          if (f.fieldtype === 'Check') {
            return e('div', { className: pb.BS.form.check },
              e('input', {
                type: 'checkbox',
                className: pb.BS.form.checkInput,
                checked: !!val,
                disabled: isReadOnly,
                onChange: ev => updateCell(
                  row.original.id, 
                  f.fieldname, 
                  ev.target.checked ? 1 : 0
                )
              })
            );
          }
          
          // Select dropdown field
          if (f.fieldtype === 'Select' && !isReadOnly) {
            const options = pb.parseSelectOptions(f.options);
            return e('select', {
              value: val || '',
              onChange: ev => updateCell(row.original.id, f.fieldname, ev.target.value),
              className: `${pb.BS.input.base} ${pb.BS.input.sm}`
            }, [
              e('option', { key: 'empty', value: '' }, '—'),
              ...options.map(opt => 
                e('option', { key: opt.value, value: opt.value }, opt.text)
              )
            ]);
          }
          
          // Editable text field
          return e('div', {
            contentEditable: !isReadOnly,
            suppressContentEditableWarning: true,
            className: `${pb.BS.spacing.px2} ${pb.BS.spacing.py1} ${isReadOnly ? `${pb.BS.bg.light} ${pb.BS.text.muted}` : ''}`,
            style: { 
              minWidth: '80px',
              cursor: isReadOnly ? 'not-allowed' : 'text'
            },
            onBlur: ev => !isReadOnly && updateCell(
              row.original.id, 
              f.fieldname, 
              ev.target.textContent
            ),
            title: isReadOnly ? `Auto-filled from: ${f.fetch_from}` : ''
          }, val || '');
        }
      }))
    ];
  }, [schema, updateCell, pb, e]);

  return e(pb.components.BaseTable, {
    data,
    columns,
    loading,
    error,
    showPagination: false,
    showSearch: false,
    showSelection: true,
    headerContent: [
      e('span', { key: 'label', className: pb.BS.text.bold }, field.label),
      e('div', { key: 'actions', className: `${pb.BS.spacing.mlAuto} ${pb.BS.display.flex}`, style: { gap: '0.5rem' } }, [
        Object.keys(rowSelection).length > 0 && e('button', {
          key: 'delete',
          onClick: deleteSelected,
          className: pb.BS.button.danger
        }, `Delete (${Object.keys(rowSelection).length})`),
        e('button', {
          key: 'add',
          onClick: addRow,
          className: pb.BS.button.primary
        }, '+ Add Row')
      ])
    ],
    footerContent: e('small', {}, 
      `${data.length} row${data.length !== 1 ? 's' : ''}`
    )
  });
};


// ============================================================================
// FORM FIELD COMPONENT
// Place this AFTER the ChildTable component and BEFORE "EXPORT TO GLOBAL NAMESPACE"
// ============================================================================

pb.components.FormField = function({ field, value, onChange, selectOptions, linkOptions, formData, parentName }) {
  const { createElement: e } = React;
  
  // Handle Table fields by rendering ChildTable component
  if (field.fieldtype === 'Table') {
    return e(pb.components.ChildTable, {
      field: field,
      parentName: parentName || window.selectedTarget?.name,
      pb: window.pb
    });
  }
  
  // Build field configuration using pb helper
  const config = pb.createFormFieldConfig(
    field,
    value,
    formData || {},
    selectOptions || {},
    linkOptions || {},
    { write: true }
  );
  
  // Handle field value change
  const handleChange = (newValue) => {
    const processedValue = pb.processFieldValue(newValue, field.fieldtype);
    onChange(field.fieldname, processedValue);
  };
  
  // Render based on input type
  const renderInput = () => {
    // SELECT/LINK/DYNAMIC LINK fields
    if (config.inputType === 'select') {
      return e('select', {
        value: config.value || '',
        onChange: ev => handleChange(ev.target.value),
        disabled: config.disabled || !config.isDynamicLinkReady,
        className: config.cssClass,
        required: config.required
      }, [
        e('option', { key: 'empty', value: '' }, config.placeholder),
        ...config.options.map(opt =>
          e('option', { 
            key: opt.value, 
            value: opt.value 
          }, opt.displayName || opt.text || opt.value)
        )
      ]);
    }
    
    // CHECKBOX field
    if (config.inputType === 'checkbox') {
      return e('div', { className: pb.BS.form.check },
        e('input', {
          type: 'checkbox',
          checked: !!config.value,
          onChange: ev => handleChange(ev.target.checked),
          disabled: config.disabled,
          className: pb.BS.form.checkInput,
          id: `field-${field.fieldname}`
        }),
        e('label', {
          className: pb.BS.form.checkLabel,
          htmlFor: `field-${field.fieldname}`
        }, config.label)
      );
    }
    
    // TEXTAREA field
    if (config.inputType === 'textarea') {
      return e('textarea', {
        value: config.value || '',
        onChange: ev => handleChange(ev.target.value),
        readOnly: config.isReadOnly,
        className: config.cssClass,
        rows: 3,
        placeholder: config.placeholder,
        required: config.required
      });
    }
    
    // TEXT/NUMBER/DATE/etc fields
    return e('input', {
      type: config.inputType,
      value: config.value || '',
      onChange: ev => handleChange(ev.target.value),
      readOnly: config.isReadOnly,
      className: config.cssClass,
      placeholder: config.placeholder,
      required: config.required,
      step: config.inputType === 'number' ? 'any' : undefined
    });
  };
  
  // Don't show label for checkbox (it's shown inside the input rendering)
  const showLabel = config.inputType !== 'checkbox';
  
  return e('div', { className: config.wrapperCss }, [
    // Label (skip for checkbox)
    showLabel && e('label', { 
      key: 'label',
      className: config.labelCss,
      htmlFor: `field-${field.fieldname}`
    }, [
      config.label,
      config.required && e('span', { 
        key: 'req',
        className: pb.BS.text.danger 
      }, ' *')
    ]),
    
    // Input
    e('div', { key: 'input' }, renderInput()),
    
    // Help text for auto-filled fields
    config.hasAutoFill && e('small', { 
      key: 'help',
      className: config.helpCss
    }, `Auto-filled from: ${field.fetch_from}`),
    
    // Dependency hint for Dynamic Links
    config.showDependencyHint && e('small', { 
      key: 'dependency',
      className: `${config.helpCss} ${pb.BS.text.warning}`
    }, `Select ${config.dependentField} first`)
  ]);
};


// ============================================================================
// EXPORT TO GLOBAL NAMESPACE
// ============================================================================
if (typeof window !== 'undefined') {
  window.pb = window.pb || {};
  window.pb.components = pb.components;
}