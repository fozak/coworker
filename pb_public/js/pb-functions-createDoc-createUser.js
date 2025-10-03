// ============================================================================
// v7 need to use getSchema to fetch schema details
// ============================================================================

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