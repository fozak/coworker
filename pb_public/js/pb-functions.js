// pb-document-lib.js v1.02\
// // ==============================================
// 🎯 PocketBase Frappe Database Functions
// Name-based operations (names are globally unique IDs)
// ==============================================

(function() {
   function initPocketBaseFrappeLib() {
    if (typeof pb === 'undefined' || typeof PocketBase === 'undefined') {
      console.warn('PocketBase not ready, retrying in 100ms...');
      setTimeout(initPocketBaseFrappeLib, 100);
      return;
    }
  
  // Global config
  window.MAIN_COLLECTION = window.MAIN_COLLECTION || 'item';

  // ==============================================
  // 📋 Document Database Operations
  // ==============================================

  pb.getDoc = async function(name) {
    const records = await this.collection(window.MAIN_COLLECTION).getFullList({
      filter: `name = "${name}"`
    });
    return records.length > 0 ? records[0] : null;
  };

  pb.createDoc = async function(doctype, data = {}) {
    // Step 1: Create with temp name
    const tempDoc = await this.collection(window.MAIN_COLLECTION).create({
      doctype,
      name: `temp-${Date.now()}`,
      data
    });
    
    // Step 2: Update with proper name
    const finalName = `${doctype.replace(/\s+/g, '-')}-${tempDoc.id}`;
    await this.collection(window.MAIN_COLLECTION).update(tempDoc.id, {
      name: finalName
    });
    
    return { ...tempDoc, name: finalName };
  };

  pb.updateDoc = async function(name, data) {
    const doc = await this.getDoc(name);
    if (!doc) throw new Error(`Document not found: ${name}`);
    
    return await this.collection(window.MAIN_COLLECTION).update(doc.id, { data });
  };

  pb.deleteDoc = async function(name) {
    const doc = await this.getDoc(name);
    if (!doc) throw new Error(`Document not found: ${name}`);
    
    return await this.collection(window.MAIN_COLLECTION).delete(doc.id);
  };

  pb.listDocs = async function(doctype, filter = '') {
    let fullFilter = `doctype = "${doctype}"`;
    if (filter) fullFilter += ` && (${filter})`;
    
    return await this.collection(window.MAIN_COLLECTION).getFullList({ 
      filter: fullFilter 
    });
  };

  // ==============================================
  // 👥 Child Table Database Operations
  // ==============================================

  pb.createChild = async function(childDoctype, parentName, parentDoctype, parentField, data = {}) {
    const childData = {
      parent: parentName,
      parenttype: parentDoctype,
      parentfield: parentField,
      ...data
    };
    
    return await this.createDoc(childDoctype, childData);
  };

  pb.listChildren = async function(childDoctype, parentName) {
    return await this.collection(window.MAIN_COLLECTION).getFullList({
      filter: `doctype = "${childDoctype}" && data.parent = "${parentName}"`
    });
  };

  pb.updateChild = async function(childName, fieldName, value) {
    const child = await this.getDoc(childName);
    if (!child) throw new Error(`Child document not found: ${childName}`);
    
    const newData = { ...child.data, [fieldName]: value };
    return await this.collection(window.MAIN_COLLECTION).update(child.id, { data: newData });
  };

  pb.deleteChildren = async function(childNames) {
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

pb.getSchema = async function(doctype) {
    const schemaResult = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
       filter: `doctype = "Schema" && meta.for_doctype = "${doctype}"`
     });
         
    return schemaResult.items.length > 0 ? schemaResult.items[0].data : null;
};

  // ==============================================
  // 🔗 Link Field Database Operations
  // ==============================================

  pb.getLinkOptions = async function(doctype, titleField = 'subject') {
    const records = await this.collection(window.MAIN_COLLECTION).getFullList({
      filter: `doctype = "${doctype}"`
    });
    
    return records.map(record => ({
      value: record.name,
      text: record.data[titleField] || record.name
    }));
  };

  pb.getDynamicLinkOptions = async function(doctype, titleField = 'subject') {
    return await this.getLinkOptions(doctype, titleField);
  };

  // ==============================================
  // ⚡ Fetch From Database Operations
  // ==============================================

  pb.processFetchFrom = async function(fetchFromPath, sourceValue) {
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

  pb.processFetchFromBatch = async function(fetchFromFields, formData) {
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

  pb.search = async function(doctype, searchTerm, fields = ['name']) {
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

  pb.batchUpdate = async function(updates) {
    const promises = updates.map(async ({ name, data }) => {
      const doc = await this.getDoc(name);
      if (doc) {
        return this.collection(window.MAIN_COLLECTION).update(doc.id, { data });
      }
    });
    return await Promise.allSettled(promises);
  };

  pb.batchDelete = async function(names) {
    const promises = names.map(async (name) => {
      const doc = await this.getDoc(name);
      if (doc) {
        return this.collection(window.MAIN_COLLECTION).delete(doc.id);
      }
    });
    return await Promise.allSettled(promises);
  };

  pb.batchCreate = async function(doctype, dataArray) {
    const promises = dataArray.map(data => this.createDoc(doctype, data));
    return await Promise.allSettled(promises);
  };

  // ==============================================
  // 🎯 React-Friendly Composite Operations
  // ==============================================

  // Load everything needed for a form (React-friendly)
  pb.loadFormData = async function(doctype, recordName = null) {
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

  // Load child table data (React-friendly)
  pb.loadChildTableData = async function(childDoctype, parentName) {
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

  // Handle fetch_from updates for React forms
  pb.handleFetchFromUpdates = async function(changedField, newValue, schema, currentFormData) {
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

  // ==============================================
  // 📊 Analytics & Reporting Database Operations
  // ==============================================

  pb.getDocCount = async function(doctype, filter = '') {
    let fullFilter = `doctype = "${doctype}"`;
    if (filter) fullFilter += ` && (${filter})`;
    
    const result = await this.collection(window.MAIN_COLLECTION).getList(1, 1, { 
      filter: fullFilter 
    });
    return result.totalItems;
  };

  pb.getFieldValues = async function(doctype, fieldname, filter = '') {
    let fullFilter = `doctype = "${doctype}"`;
    if (filter) fullFilter += ` && (${filter})`;
    
    const records = await this.collection(window.MAIN_COLLECTION).getFullList({
      filter: fullFilter,
      fields: `data.${fieldname}`
    });
    
    return records.map(r => r.data?.[fieldname]).filter(v => v !== undefined);
  };

  // ==============================================
  // 🔧 Utility Database Operations
  // ==============================================

  pb.docExists = async function(name) {
    try {
      const doc = await this.getDoc(name);
      return !!doc;
    } catch {
      return false;
    }
  };

  pb.getLastModified = async function(name) {
    const doc = await this.getDoc(name);
    return doc?.updated || null;
  };

  pb.duplicateDoc = async function(sourceName, doctype = null, newData = {}) {
    const sourceDoc = await this.getDoc(sourceName);
    if (!sourceDoc) throw new Error(`Source document not found: ${sourceName}`);
    
    const targetDoctype = doctype || sourceDoc.doctype;
    const duplicatedData = { ...sourceDoc.data, ...newData };
    return await this.createDoc(targetDoctype, duplicatedData);
  };

  // ==============================================
  // 🔄 Name Resolution Helpers
  // ==============================================

  // Convert name to PocketBase ID (for internal operations)
  pb.resolveToId = async function(name) {
    const doc = await this.getDoc(name);
    return doc?.id || null;
  };

  // Convert PocketBase ID to name (for external references)
  pb.resolveToName = async function(id) {
    try {
      const doc = await this.collection(window.MAIN_COLLECTION).getOne(id);
      return doc?.name || null;
    } catch {
      return null;
    }
  };

  // ==============================================
// 📋 ERPNext Select Field Helper Functions
// Add this to your pb-document-lib.js
// ==============================================

// Parse ERPNext Select field options (newline-separated string to array)
pb.parseSelectOptions = function(optionsString) {
  if (!optionsString || typeof optionsString !== 'string') {
    return [];
  }
  
  return optionsString
    .split('\n')
    .map(option => option.trim())
    .filter(option => option.length > 0)
    .map(option => ({
      value: option,
      text: option
    }));
};

// Get all select field options for a schema
pb.getSelectFieldOptions = function(schema) {
  if (!schema?.fields) return {};
  
  const selectOptions = {};
  
  schema.fields.forEach(field => {
    if (field.fieldtype === 'Select' && field.options) {
      selectOptions[field.fieldname] = this.parseSelectOptions(field.options);
    }
  });
  
  return selectOptions;
};

// Enhanced loadFormData to include Select options
pb.loadFormDataWithSelects = async function(doctype, recordName = null) {
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

// ==============================================
// 📋 Schema Creation Function for PocketBase
// ==============================================

pb.createSchema = async function(for_doctype, data = {}) {
  try {
    // Step 1: Create with temp name and doctype = "Schema"
    const tempDoc = await this.collection(window.MAIN_COLLECTION).create({
      doctype: "Schema",
      name: `temp-${Date.now()}`,
      data,
      meta: {
        "doctype": "Schema",
        "for_doctype": for_doctype,
        "public": true
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

  // ==============================================
  // 🔄 Document Copy Utility with Mapping
  // ==============================================

  pb.getFieldValue = function(doc, fieldPath) {
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

  pb.createDocFrom = async function(sourceName, targetDoctype, {
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


//added 
pb.runCode = async function(name) {
  const record = await this.getDoc(name);
  if (!record || !record.data?.code) {
    throw new Error("Code not found");
  }

  // This will execute the code inside the current scope
  eval(record.data.code);
};


//commit-workflow-2
// ==============================================
// 🔄 WORKFLOW & APPROVAL OPERATIONS
// ==============================================

pb.getWorkflow = async function(doctype) {
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

pb.getWorkflowState = async function(docName) {
  const doc = await this.getDoc(docName);
  if (!doc) return null;
  
  // Get the workflow for this doctype
  const workflow = await this.getWorkflow(doc.doctype);
  if (!workflow) return doc.data?.status || 'Draft';
  
  // Use the workflow state field if specified, otherwise fall back to common fields
  const stateField = workflow.workflow_state_field || 'workflow_state';
  return doc.data?.[stateField] || doc.data?.status || 'Draft';
};

pb.getAvailableTransitions = async function(doctype, currentState, userRole = null) {
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

pb.executeWorkflowTransition = async function(docName, transitionAction, comments = '', userRole = null) {
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

// ==============================================
// 


// Initialize context
if (!pb.context) {
  pb.context = {};
}




  console.log('✅ PocketBase Frappe Database Functions loaded!');
  console.log(`📋 Collection: ${window.MAIN_COLLECTION}`);
   }
initPocketBaseFrappeLib();
})();