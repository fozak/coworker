// pb-functions-INIT-v5.js https://claude.ai/chat/bd4efbeb-5aec-47c9-b2c3-5617a28bb335
/* works with the rule
we miggrate to this
@request.auth.name = data._owner 
|| @request.auth.roles ?~ data._allowed_roles 
|| @request.auth.roles ?~ data._allowed_roles_read
|| @request.auth.name ~ data._allowed_users
|| @request.auth.name ~ data._allowed_users_read


Why This Order Makes Sense:
Most documents will be accessed by:

Owner (most common) → Check 1 catches this immediately
Team members via roles (common) → Checks 2-3
Specific shared users (less common) → Checks 4-5

Performance Impact:
js// Document owned by User-A
{
  _owner: "User-A",
  _allowed_roles: ["Manager"],
  _allowed_roles_read: ["Viewer"],
  _allowed_users: ["User-B"],
  _allowed_users_read: ["User-C", "User-D", "User-E", "User-F"]
}


from this:
@request.auth.name = data._owner || @request.auth.roles ?~ data._allowed_roles
Key Change in Your Code:
DON'T set "Owner" as default in _allowed_roles:
jspb.createDoc = async function (doctype, data = {}) {
  const generatedId = await this.generateId();
  const finalName = `${doctype.replace(/\s+/g, '-')}-${generatedId}`;
  
  const currentUser = window.currentUser;
  
  const docData = {
    ...data,
    name: finalName
  };
  
  if (currentUser) {
    docData._owner = currentUser.name;
    // Don't set default _allowed_roles - leave it empty or only set if explicitly passed
    if (data._allowed_roles) {
      docData._allowed_roles = data._allowed_roles;
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
How It Works:
Default document (private):
js{
  _owner: "User-A",
  _allowed_roles: null  // or undefined, or empty array
}

Only owner has access ✓

Explicitly shared:
js{
  _owner: "User-A",
  _allowed_roles: ["Manager", "Editor"]
}

Owner has access ✓
Users with Manager OR Editor role have access ✓ */

pb.createDoc = async function (doctype, data = {}) {
  // Allow ID override, otherwise generate new one
  const generatedId = data.id || await this.generateId();
  
  // Allow name override, otherwise generate from doctype + ID
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
      
      if (schema && schema.permissions) {
        const writeRoles = [];
        const readRoles = [];
        
        schema.permissions.forEach(perm => {
          if (perm.role) {
            if (perm.write === 1 || perm.create === 1) {
              writeRoles.push(perm.role);
            } else if (perm.read === 1) {
              readRoles.push(perm.role);
            }
          }
        });
        
        if (writeRoles.length > 0) {
          docData._allowed_roles = writeRoles;
        }
        if (readRoles.length > 0) {
          docData._allowed_roles_read = readRoles;
        }
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
    id: generatedId,  // Uses provided ID or generated one
    name: finalName,
    data: docData
  });
  
  return doc;
};
