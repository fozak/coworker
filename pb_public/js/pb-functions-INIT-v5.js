// ============================================================================
// POCKETBASE CLIENT INITIALIZATION
// ============================================================================

window.pb = window.pb || new PocketBase("http://127.0.0.1:8090/");

// Global config
window.MAIN_COLLECTION = window.MAIN_COLLECTION || 'item';
window.currentUser = null;  // Initialize global user state


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


// ============================================================================
// CRUD OPERATIONS - CREATE
// ============================================================================

// Updated createDoc to handle both scenarios
pb.createDoc = async function (doctype, data = {}) {
  const generatedId = await this.generateId();
  const finalName = `${doctype.replace(/\s+/g, '-')}-${generatedId}`;
  
  const currentUser = window.currentUser;
  
  // Build data object based on auth state
  const docData = {
    ...data,
    name: finalName
  };
  
  // Only add ownership fields if user is authenticated
  if (currentUser) {
    docData._owner = currentUser.name;
    docData._allowed_roles = data._allowed_roles || currentUser.roles || ["Owner"];
  }
  // For anonymous users, don't set _owner or rely on PocketBase rules
  
  const doc = await this.collection(window.MAIN_COLLECTION).create({
    doctype,
    id: generatedId,
    name: finalName,
    data: docData
  });
  
  return doc;
};


// ============================================================================
// CONNECTION & INITIALIZATION
// ============================================================================

// Connect function with auth initialization
async function connectToPocketBase() {
  const statusDiv = document.getElementById('status');
  
  try {
    // Step 1: Initialize auth state first
    const authStatus = await initializeAuth();
    
    // Step 2: Test connection (works for both auth and anon users)
    await pb.collection(window.MAIN_COLLECTION).getList(1, 1);
    
    // Step 3: Update UI based on auth status
    if (authStatus.authenticated) {
      statusDiv.textContent = `Connected as ${authStatus.user.name}`;
      statusDiv.className = 'mt-2 p-2 rounded text-sm bg-green-100 text-green-800';
    } else {
      statusDiv.textContent = 'Connected (Anonymous)';
      statusDiv.className = 'mt-2 p-2 rounded text-sm bg-blue-100 text-blue-800';
    }
    
    // Step 4: Load app functionality
    await loadRenderCode();
    setupSearch();
    
    return authStatus;
    
  } catch (error) {
    console.error('Connection failed:', error);
    statusDiv.textContent = 'Failed to connect';
    statusDiv.className = 'mt-2 p-2 rounded text-sm bg-red-100 text-red-800';
    throw error;
  }
}

// Start the app
connectToPocketBase().then(authStatus => {
  console.log('App initialized:', authStatus);
});