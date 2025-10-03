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
    
    // Step 2: Create User document with SAME ID
    const userDoc = await pb.createDoc("User", {
      id: generatedId,          // ← Use same ID
      name: universalName,      // ← Use same name
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
