# Architecture
## Bottom-top

### v5 Bare-bone Parent-Relationship-Child 

I am storing Frappe like doctypes and data in json in Pocketbase
like
ParentTemplate
      |
      v
Relationship (universal table)
      |
      v
ChildTemplate


await pb.getSchema("Parent Template")
{
    "actions": [],
    "allow_import": 1,
    "autoname": "",
    "creation": "",
    "description": "",
    "doctype": "Parent Template",
    "document_type": "System",
    "engine": "",
    "field_order": [
        "name",
        "json_data",
        "relationship_children",
        "read",
        "write",
        "share",
        "submit",
        "everyone",
        "notify_by_email"
    ],
    "fields": [
        {
            "fieldname": "name",
            "fieldtype": "Data",
            "in_list_view": 1,
            "label": "Name",
            "search_index": 1
        },
        {
            "fieldname": "json_data",
            "fieldtype": "JSON",
            "in_list_view": 0,
            "label": "Json Data",
            "reqd": 0,
            "search_index": 1
        },
        {
            "fieldname": "relationship_children",
            "fieldtype": "Table",
            "options": "Relationship",
            "label": "Relationship Children",
            "reqd": 1,
            "search_index": 1
        },
        {
            "default": "0",
            "fieldname": "read",
            "fieldtype": "Check",
            "label": "Read"
        },
        {
            "default": "0",
            "fieldname": "write",
            "fieldtype": "Check",
            "label": "Write"
        },
        {
            "default": "0",
            "fieldname": "share",
            "fieldtype": "Check",
            "label": "Share"
        },
        {
            "default": "0",
            "fieldname": "everyone",
            "fieldtype": "Check",
            "label": "Everyone",
            "search_index": 1
        },
        {
            "default": "1",
            "fieldname": "notify_by_email",
            "fieldtype": "Check",
            "label": "Notify by email",
            "print_hide": 1
        },
        {
            "default": "0",
            "fieldname": "submit",
            "fieldtype": "Check",
            "label": "Submit"
        }
    ],
    "in_create": 1,
    "links": [],
    "modified": "",
    "modified_by": "Administrator",
    "module": "Core",
    "name": "",
    "naming_rule": "",
    "owner": "Administrator",
    "permissions": [
        {
            "create": 1,
            "delete": 1,
            "export": 1,
            "import": 1,
            "read": 1,
            "report": 1,
            "role": "System Manager",
            "share": 1,
            "write": 1
        }
    ],
    "read_only": 1,
    "sort_field": "creation",
    "sort_order": "DESC",
    "states": [],
    "track_changes": 1
}

Sample relationship
{
  "name": "Relationship-xf4eyxkdc6kqsjn",
  "parent": "Parent-Template-h5qxt3pqh4ny61s",
  "parentfield": "relationship_children",
  "parenttype": "Parent Template",
  "relationship_ref_docname": "Child-Template-309ohnr7k883amy",
  "relationship_ref_doctype": "Child Template"
}




 Separate typed relationships from non-typed.
- intoduce Relationship universal doctype 
- keep bottom-top relationships
- filter out the existing Linked doctypes
- Add manually Relationship table to each schema (temp solution)


{
      "fieldname": "relationship_parent",
      "fieldtype": "Table",
      "in_list_view": 0,
      "label": "relationship Children",
      "options": "Relationship",
      "reqd": 1,
      "search_index": 1
    },

  Tested with Task schema - it works

// ANY doctype automatically gets assignment capability
// Via the universal relationship_parent table
{
  relationship_ref_doctype: "User",
  relationship_ref_docname: "john.doe@company.com",
  relationship_type: "assigned_to"  // Optional: categorize relationship
}

# Security and User management

## v5 
https://chatgpt.com/c/68b8cd16-5e60-8333-929b-86b066637aaf

2 collections in Pocketbase: @users (system) and @item
- collection @users is extended with @user.name field name is generated and used as universal ID like User-ckbhibwpthfnt8k

then the flow on CREATING new user
1) Create user using standard PB (@user.name is empty) if success
2) generate @user.name form pb-function.js, assign to @user.name like  //id generation - it is loaded already

pb.generateId = async function () {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 15; i++) {  // 15 characters
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

3) Generate user doctype in @item collection (for future User-related data, write=Admin). DO NOT use standard createDoc() as we need to use earlier created @user.name

- API rules on @user collection:
List/Search rule:   (@request.auth.name = data._owner && "Owner" ~ data._allowed_roles) || (data._allowed_roles != [] && !("Owner" ~ data._allowed_roles) && @request.auth.roles ~ data._allowed_roles)
View rule:          same
Update rule:        same
Delete rule:        same
Create rule:        id = @request.auth.id ( → anyone registed can create)

- API rules on @item
List/Search rule:   id = @request.auth.id
View rule:          id = @request.auth.id
Update rule:        id = @request.auth.id
Delete rule:        - to define- nobody is deleting, just changing docstatus
Create rule:        (empty → anyone can create)

So at the end of user provisioning we have 
- created record in collections @users with not empty @users.name @user.roles
- created record in collection @item with doctype = User and record.name = @users.name (access TDB) 

After that user who is the owner should be able to access own records. 
- TODO 5.1 create pb.createUser function based on the above flow and existing id generation (assume its loaded). Outcome of this: 
```js version 1 
pb.createUser = async function(email, password, roles = ["Owner"]) {
  try {
    // Step 1: Generate universal ID and name for the user
    const generatedId = await pb.generateId();
    const universalName = `User-${generatedId}`;
    
    // Step 2: Create the user in users collection with universal name
    const user = await pb.collection("users").create({
      email: email,
      password: password,
      passwordConfirm: password,
      name: universalName,
      roles: roles
    });
    
    // Step 3: Create corresponding item record using the SAME id and name
    const item = await pb.collection("item").create({
      doctype: "User",
      id: generatedId,
      name: universalName,
      data: {
        _owner: user.id,
        _allowed_roles: roles,        // Use the same roles passed in
        name: universalName,
        email: email
      }
    });
    
    // Step 4: Return both results
    return { user, item };
    
  } catch (err) {
    // Enhanced error handling
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


```

testing v3.1
--- Continue testing https://chatgpt.com/c/68b8cd16-5e60-8333-929b-86b066637aaf
---Part is tested (@request.auth.name = data._owner && "Owner" ~ data._allowed_roles) for Task-ib4zxxvuqdlyjsp 

## v4
https://chatgpt.com/c/68b9ebd9-15dc-8326-b61b-2a2f7c5334c2
going into FieldFSM, FormFSM, and 
## v3

https://chatgpt.com/c/68b88d87-c3bc-8333-a9b1-fdf0ce623e6c
https://aistudio.google.com/prompts/12B8mmdu3pt_181qw7q8wRqHOn1d2CZto
https://chatgpt.com/c/68b8cd16-5e60-8333-929b-86b066637aaf


-- WORKING------------------------------------------------------
TODO: get roles from targetDocument.workflow.currentState.currentRole. so it still like currentState=Draft->currentRole=Owner, after Tansition Role =role(currentState), and the currentState is defined in workflow_state field
TODO: assign   data.allowed_role = "Owner" && (@request.auth.name = data.owner || @request.auth.name ~ data._assign)

TODO: share - so we basiccaly accumulate the user names - potentaiikly the challenge is share where we need to go deeper

TODO: move everything into data? from meta. 

v3 NOT checked -yet 

(@request.auth.name = data.owner && "Owner" ~ data._allowed_roles)
||
(data._allowed_roles != [] && !("Owner" ~ data._allowed_roles) && @request.auth.roles ~ data._allowed_roles)


testing v3.1
--- Continue testing https://chatgpt.com/c/68b8cd16-5e60-8333-929b-86b066637aaf
---Part is tested (@request.auth.name = data._owner && "Owner" ~ data._allowed_roles) for Task-ib4zxxvuqdlyjsp 






(@request.auth.name = data.owner && meta.allowed_role = "Owner") //* THIS IS TESTED
||
(meta.allowed_role != "Owner" && meta.allowed_role != "" && @request.auth.roles ~ meta.allowed_role)

(the SAME (@request.auth.name = data.owner && meta.allowed_role = "Owner")
||
(meta.allowed_role != "Owner" && meta.allowed_role != "" && @request.auth.roles ~ meta.allowed_role))

Vision: // discussion https://chatgpt.com/c/68b8cd16-5e60-8333-929b-86b066637aaf 
        // https://claude.ai/chat/279daf8a-2c66-4dc9-92bb-37cb674a8130
_assign: ["User-rutbfbf45445","User-rutbfbf454dfv"] = write access
_share  ["User-rutbfbf45445":write,"User-rutbfbf454dfv":read]  - trickier for rules 
await pb.updateDoc("TASK-2025-00010", {"_allowed_roles": ["Manager","Accountant"]});
decision in _allowed_roles

so basically we just collect usernames unless it is workflow_state = "Draft", defined by allowed_roles = ["Owner"], 
once its submitted, workflow_state = "Submitted", then individual usernames access in not relevant, and everythign is defined by roles = 
workflow.currentState.role

- the logic of removing and assigning Owner to allowed_roles: while changing 
- REMOVing Owner should be LAST operation of currentUser, as by removing it, he is locking record. 
 await pb.updateDoc("TASK-2025-00011", { allowed_roles: workflow.currentState.role }); - this will lock the record for the USER with Owner
-------

https://aistudio.google.com/prompts/12B8mmdu3pt_181qw7q8wRqHOn1d2CZto
The Recommended Best Practice
Here is the optimal architecture that combines the strengths of both systems:
Keep email as the unique key in @users. This is non-negotiable for PocketBase auth.
Add a profileId field to @users. This should be a Relation type field pointing to the item collection. Set it to be "Required" and "Non-empty". This is your primary, database-enforced link.
Optionally, but recommended, copy item.name into the users.name field. Treat this as a convenience for administration and debugging, not as the structural link.
Updated @users Collection Schema:
email: (Email, Required, Unique) - For login.
password: (Password) - For login.
profileId: (Relation to item, Required, Non-empty) - The unbreakable link to the user's profile.
name: (Text) - A copy of item.name for easy reference.
roles: (JSON) - The synchronized list of roles for fast API rule checks.
Updated Hook Logic Snippet:
code
```JavaScript
// Inside your onRecordAfterCreate hook for 'item' doctype 'User'

const newUserProfile = e.record;

const newUserAuthRecord = new Record(usersCollection, {
    // ... other fields
    "email": newUserProfile.get('data')?.email,
    "profileId": newUserProfile.getId(), // The REAL link
    "name": newUserProfile.get('name'),    // The CONVENIENCE copy
    "roles": []
});
// ... save record
```
This design gives you the best of everything: rock-solid PocketBase authentication, a flexible Frappe-style data model, an unbreakable link between them (profileId), and a convenient reference (name) for making your life easier as a developer and administrator.

## Last Reference model
v2
```js
/* TODO:check docstatus?  Task with docstatus = 0 should see only owner
/* TODO:check if general permissions enough or we need from roles like ?
*/


meta.is_public = 1 ||       /*  for tables in frappe - very importan    */
data.owner ?= @request.auth.email || /*second place as oweners very ofter use own docs*/
(@request.auth.doctype ?~ data.doctype)|| /*3rd place as users has allowed doctypes like Task*/
 (meta.users ~ @request.auth.email) || /* Directly shared with email kept in meta  */
@request.auth.admin = true || /*admin on last place as it is rare)
 ```

## Scoping

I see 2 distrinct groups Frappe Doctypes and Erpnext doctypes
  ### Frappe doc case:


## @todo
- [x] FIXED: decided on security model for records (@decisions.security.1-3)
- [] TODO: Test @snippet.request.auth.id with real records
- [] TODO: Understand how to manage childrecords security https://claude.ai/chat/ad082e08-4c1f-41ac-af71-f0b6b22e522a

## @decisions.security:


1) Keep the hybrid security for records. Add record.user and list names=emails directly for like _assign or _share case
2) use data.owner field to allow owner to access
3) use Frappe roles in @collection.users.doctype 

                      ## My access rule become: 
                      #TODO - no CUSTOMER role in persmissions for documents - otherwise Customer gets access to all. He should be Owner
                      #TODO - to implement Docshare https://chatgpt.com/c/68b45ad8-9e28-8330-a4cd-799bafcbe2b4

                      ```js @snippet.request.auth.id
                      @request.auth.id != "" && (
                          data.owner ?= @request.auth.email //TODO: OWNER role instead this is no longer good. Workflow defines ||
                          users ~ @request.auth.email // TODO: how to implement ||
                          @request.auth.doctype ?~ data.doctype // TODO: to DELETE No need coming back 
                          @request.auth.roles ~ data.allowed_roles //
                      )
                      ```
                      
                      - the SQL to form the list (in view collection in Pocketbase ): 

                      ```js
                      -- Optimized query using CTE to pre-compute schema permissions
                      WITH schema_perms AS (
                          SELECT
                              json_extract(s.data, '$.name') AS doctype_name,
                              json_extract(p.value, '$.role') AS role
                          FROM item s
                          JOIN json_each(s.data, '$.permissions') AS p
                          WHERE s.doctype = 'Schema'
                            AND (
                                json_extract(p.value, '$.read') = 1 OR
                                json_extract(p.value, '$.write') = 1 OR
                                json_extract(p.value, '$.create') = 1 OR
                                json_extract(p.value, '$.delete') = 1
                            )
                          GROUP BY doctype_name, role
                      )
                      SELECT
                          u.name AS id,
                          u.name AS user_name,
                          json_group_array(DISTINCT sp.doctype_name) AS permitted_doctypes
                      FROM item u
                      JOIN item r
                          ON r.doctype = 'Has Role'
                        AND json_extract(r.data, '$.parent') = u.name
                      JOIN schema_perms sp
                          ON sp.role = json_extract(r.data, '$.role')
                      WHERE u.doctype = 'User'
                      GROUP BY u.name;
                      ```
4) 


new_document_created
│
└── check if Workflow exists for this.doc.doctype AND is_active = 1
    │
    ├── YES → Workflow active
    │   │
    │   └── docstatus initially set to 0 (Draft)

Security and docstatus


new_document_created
│
└── check if Workflow exists for this.doc.doctype AND is_active = 1
    │
    ├── YES → Workflow active
    │   │
    │   └── docstatus initially set to 0 (Draft)
    │       │
    │       └── Workflow state = workflow.default_state
    │           │
    │           ├── User actions follow workflow transitions (not standard submit/cancel)
    │           │
    │           ├── Each transition may:
    │           │   - Change workflow state (e.g., Draft → Review → Approved)
    │           │   - Optionally change docstatus (e.g., move to 1 on "Submit for Approval")
    │           │
    │           └── Final workflow state may set docstatus = 1 (Submitted) or 2 (Cancelled)
    │               │
    │               └── Read-only behavior depends on workflow state rules, not just docstatus
    │
    └── NO → No active workflow
        │
        └── check is_submittable?
            │
            ├── is_submittable = 0
            │   │
            │   └── docstatus = 0 (Draft)
            │       │
            │       └── Fully editable, no submit/cancel
            │
            └── is_submittable = 1
                │
                └── docstatus = 0 (Draft)
                    │
                    ├── User chooses "Submit"
                    │   │
                    │   └── docstatus → 1 (Submitted)
                    │       │
                    │       ├── Becomes read-only
                    │       │
                    │       ├── User can "Cancel" → docstatus → 2 (Cancelled, read-only)
                    │       │
                    │       └── No return to Draft; must create a new document
                    │
                    └── User chooses "Save" only
                        │
                        └── Remains Draft (editable)




TODO how to interlink the workflow, flow and enclosed doctype 

Decision - store in polymorphic junction Has Role etc
https://claude.ai/chat/4215bd3d-e409-4d06-a235-081d65e1a825


Desision - store everything in system settings record
system-settings.collection = 'item' 
add to system-setting, schema -> collection


Version 4
the goal was to reimplement some elements of ERPnext on base of PocketBase
- 1 collection for documents - item
- default collection for users
- records in item 

Implemented 
- Storing documents and schemas in 1 collection with links to each other using item.meta
- Rendering form based on document and its schema 
- Securty based on item.meta and rules
- login based on pocketbase js sdk
- UI for seaching and storing selected documents with rendering 


Version 3
- Added code doctype 

Give me standalong html page page that 
1) Select all records from item collection that  doctype=Code. Records have this structure
{collectionId: 'pbc_940982958', collectionName: 'item', created: '2025-07-17 16:39:57.850Z', data: {…}, doctype: 'Code', …}
collectionId
: 
"pbc_940982958"
collectionName
: 
"item"
created
: 
"2025-07-17 16:39:57.850Z"
data
: 
{actions: Array(0), allow_import: 1, allow_rename: 1, autoname: 'naming_series:', code: '', …}
doctype
: 
"Code"
id
: 
"ds0mm3oz2rrlljs"
meta
: 
doctype
: 
"Code"
for_doctype
: 
"Project"
[[Prototype]]
: 
Object
name
: 
"CODE-0001"
updated
: 
"2025-07-17 16:40:49.988Z"
[[Prototype]]
: 
Object
2) when user select 1 record of this type it loads current record data.code (data is json field) into like monaco editor allowing to read and edit code. 
3) code input has Save button, and its saving it back into current record data.code
4) as code doctype record has the meta: (meta for_doctype : 
"Project") then it loads all records (idsonly) of this doctype (Project) and allows to select 1 record of this doctype. 
5) it has ran button. On run, it loads selected doctype, rans code over it with eval(), the code in widget will reference data inside itself, so no need to take care of it, just eval() 
use like    <script>
        let pb = null;
        let currentRecord = null;
        // Auto-connect on page load
        window.onload = function() {
            connectToPocketBase();
        };
        // Connect to PocketBase
        async function connectToPocketBase() {
            const statusDiv = document.getElementById('status');
            
            try {
                pb = new PocketBase('http://127.0.0.1:8090/');
                
                // Test connection by fetching records
                const records = await pb.collection('item').getList(1, 50);

So this is a kind of dynamic widjet testing tool 
 html that has input Window for js code and 2 buttons save and load. 



this is possible to mock global objects and use 
- https://chatgpt.com/c/68751c97-2254-8007-9097-46241b24bb15 
- https://claude.ai/chat/7f0eaf96-a570-49b5-a847-2ad953af017e






store all data 1 pocketbase collection - items v2

- items.id - pocketbase ids
- items.schema (json) - schema Using Erpnext doctypes json  (like task.json). then items.schema.name = Task
- items.code (text) - code that reads schema, displays UI and saving result into items.data
- items.data (json) - data, generated from schema on client side and saves
- items.children [itemid1, itemid2] - establishing relationships in between items
- items.users - [userid1, userid2] - pocketbase users collection ids

<!--S  SCHEMAS----->
special type of item -> schema for doctype. doctype = "Schema", the link to Schema is defined bi-directonally in each doctype like doctype = "Task", then in its meta.schema = "SCHEMA-0001"
in "SCHEMA-0001" meta.for_doctype = "Task" (should be further thinking on setting up default schemas)


<!--U -UI--->
summary - everything is possible 
OPEN - access rights needs exploration and simplification  

<!----------v2--->
all data and schemas are from ERPnext and stored in 1 collection item in PocketBase
item.name - used as id for all db operations - TASK-2025-00027 
item.doctype - text, doctype type - Task
item.meta - json, storing the doctype, and schema id of doctype schema 
{
  "doctype": "Task",
  "schema": "SCHEMA-0001"
}
item.data - json, json data of doc (Erpnext format)
{
  "_assign": null,
  "_comments": null,
  "_liked_by": null,
  "_seen": "[\"Administrator\"]",
  "_user_tags": null,
  "act_end_date": null,
  "act_start_date": null,
  "actual_time": 0,
  "closing_date": null,
  "color": "#39E4A5",
  "company": "Expo (Demo)",
  "completed_by": null,
  "completed_on": null,
  "creation": "2025-06-11 12:34:12.818353",
  "custom_attach": null,
  "custom_itemgroup": null,
  "custom_new_check": 0,
  "department": null,
  "depends_on_tasks": "",
  "description": "<div class=\"ql-editor read-mode\"><p><img src=\"/private/files/vYfr6wt.jpg?fid=3e162b69a8\" style=\"\" width=\"272\"></p></div>",
  "docstatus": 0,
  "duration": 0,
  "exp_end_date": "2025-06-11",
  "exp_start_date": "2025-06-11",
  "expected_time": 0,
  "idx": 1,
  "is_group": 1,
  "is_milestone": 0,
  "is_template": 0,
  "issue": null,
  "lft": 53,
  "modified": "2025-06-11 21:28:44.330211",
  "modified_by": "Administrator",
  "name": "TASK-2025-00027",
  "old_parent": "",
  "owner": "Administrator",
  "parent_task": null,
  "priority": "Low",
  "progress": 0,
  "project": "PROJ-0009",
  "project_code": null,
  "review_date": null,
  "rgt": 54,
  "start": 0,
  "status": "Overdue",
  "subject": "Interior inspections for 18-point inspections",
  "task_code": null,
  "task_weight": 0,
  "template_task": "TASK-2025-00020",
  "total_billing_amount": 0,
  "total_costing_amount": 0,
  "total_expense_claim": 0,
  "type": null,
  "workflow_state": null
}

in the same collection 'item', stored the SCHEMA for this doctype 
{
  "collectionId": "pbc_940982958",
  "collectionName": "item",
  "created": "2025-07-14 13:59:41.446Z",
  "data": {
    "actions": [],
    "allow_import": 1,
    "autoname": "TASK-.YYYY.-.#####",
    "creation": "2013-01-29 19:25:50",
    "doctype": "DocType",
    "document_type": "Setup",
    "engine": "InnoDB",
    "field_order": [
      "subject",
      "project",
      "issue",
      "type",
      "color",
      "is_group",
      "is_template",
      "column_break0",
      "status",
      "priority",
      "task_weight",
      "parent_task",
      "completed_by",
      "completed_on",
      "sb_timeline",
      "exp_start_date",
      "expected_time",
      "start",
      "column_break_11",
      "exp_end_date",
      "progress",
      "duration",
      "is_milestone",
      "sb_details",
      "description",
      "sb_depends_on",
      "depends_on",
      "depends_on_tasks",
      "sb_actual",
      "act_start_date",
      "actual_time",
      "column_break_15",
      "act_end_date",
      "sb_costing",
      "total_costing_amount",
      "column_break_20",
      "total_billing_amount",
      "sb_more_info",
      "review_date",
      "closing_date",
      "column_break_22",
      "department",
      "company",
      "lft",
      "rgt",
      "old_parent",
      "template_task"
    ],
    "fields": [
      {
        "allow_in_quick_entry": 1,
        "fieldname": "subject",
        "fieldtype": "Data",
        "in_global_search": 1,
        "in_standard_filter": 1,
        "label": "Subject",
        "reqd": 1,
        "search_index": 1
      },
      {
        "allow_in_quick_entry": 1,
        "bold": 1,
        "fieldname": "project",
        "fieldtype": "Link",
        "in_global_search": 1,
        "in_list_view": 1,
        "in_standard_filter": 1,
        "label": "Project",
        "oldfieldname": "project",
        "oldfieldtype": "Link",
        "options": "Project",
        "remember_last_selected_value": 1,
        "search_index": 1
      },
      {
        "fieldname": "issue",
        "fieldtype": "Link",
        "label": "Issue",
        "options": "Issue"
      },
      {
        "fieldname": "type",
        "fieldtype": "Link",
        "label": "Type",
        "options": "Task Type"
      },
      {
        "bold": 1,
        "default": "0",
        "fieldname": "is_group",
        "fieldtype": "Check",
        "in_list_view": 1,
        "label": "Is Group"
      },
      {
        "fieldname": "column_break0",
        "fieldtype": "Column Break",
        "oldfieldtype": "Column Break",
        "print_width": "50%",
        "width": "50%"
      },
      {
        "bold": 1,
        "fieldname": "status",
        "fieldtype": "Select",
        "in_list_view": 1,
        "in_standard_filter": 1,
        "label": "Status",
        "no_copy": 1,
        "oldfieldname": "status",
        "oldfieldtype": "Select",
        "options": "Open\nWorking\nPending Review\nOverdue\nTemplate\nCompleted\nCancelled"
      },
      {
        "fieldname": "priority",
        "fieldtype": "Select",
        "in_list_view": 1,
        "in_standard_filter": 1,
        "label": "Priority",
        "oldfieldname": "priority",
        "oldfieldtype": "Select",
        "options": "Low\nMedium\nHigh\nUrgent",
        "search_index": 1
      },
      {
        "fieldname": "color",
        "fieldtype": "Color",
        "label": "Color"
      },
      {
        "bold": 1,
        "fieldname": "parent_task",
        "fieldtype": "Link",
        "ignore_user_permissions": 1,
        "label": "Parent Task",
        "options": "Task",
        "search_index": 1
      },
      {
        "collapsible": 1,
        "collapsible_depends_on": "exp_start_date",
        "fieldname": "sb_timeline",
        "fieldtype": "Section Break",
        "label": "Timeline"
      },
      {
        "bold": 1,
        "fieldname": "exp_start_date",
        "fieldtype": "Datetime",
        "label": "Expected Start Date",
        "oldfieldname": "exp_start_date",
        "oldfieldtype": "Date"
      },
      {
        "default": "0",
        "fieldname": "expected_time",
        "fieldtype": "Float",
        "label": "Expected Time (in hours)",
        "oldfieldname": "exp_total_hrs",
        "oldfieldtype": "Data"
      },
      {
        "fetch_from": "type.weight",
        "fieldname": "task_weight",
        "fieldtype": "Float",
        "label": "Weight"
      },
      {
        "fieldname": "column_break_11",
        "fieldtype": "Column Break"
      },
      {
        "bold": 1,
        "fieldname": "exp_end_date",
        "fieldtype": "Datetime",
        "label": "Expected End Date",
        "oldfieldname": "exp_end_date",
        "oldfieldtype": "Date",
        "search_index": 1
      },
      {
        "fieldname": "progress",
        "fieldtype": "Percent",
        "label": "% Progress",
        "no_copy": 1
      },
      {
        "default": "0",
        "fieldname": "is_milestone",
        "fieldtype": "Check",
        "in_list_view": 1,
        "label": "Is Milestone"
      },
      {
        "fieldname": "sb_details",
        "fieldtype": "Section Break",
        "label": "Details",
        "oldfieldtype": "Section Break"
      },
      {
        "fieldname": "description",
        "fieldtype": "Text Editor",
        "label": "Task Description",
        "oldfieldname": "description",
        "oldfieldtype": "Text Editor",
        "print_width": "300px",
        "width": "300px"
      },
      {
        "fieldname": "sb_depends_on",
        "fieldtype": "Section Break",
        "label": "Dependencies",
        "oldfieldtype": "Section Break"
      },
      {
        "fieldname": "depends_on",
        "fieldtype": "Table",
        "label": "Dependent Tasks",
        "options": "Task Depends On"
      },
      {
        "fieldname": "depends_on_tasks",
        "fieldtype": "Code",
        "hidden": 1,
        "label": "Depends on Tasks",
        "read_only": 1
      },
      {
        "fieldname": "sb_actual",
        "fieldtype": "Section Break",
        "oldfieldtype": "Column Break",
        "print_width": "50%",
        "width": "50%"
      },
      {
        "fieldname": "act_start_date",
        "fieldtype": "Date",
        "label": "Actual Start Date (via Timesheet)",
        "oldfieldname": "act_start_date",
        "oldfieldtype": "Date",
        "read_only": 1
      },
      {
        "fieldname": "actual_time",
        "fieldtype": "Float",
        "label": "Actual Time in Hours (via Timesheet)",
        "read_only": 1
      },
      {
        "fieldname": "column_break_15",
        "fieldtype": "Column Break"
      },
      {
        "fieldname": "act_end_date",
        "fieldtype": "Date",
        "label": "Actual End Date (via Timesheet)",
        "oldfieldname": "act_end_date",
        "oldfieldtype": "Date",
        "read_only": 1
      },
      {
        "collapsible": 1,
        "fieldname": "sb_costing",
        "fieldtype": "Section Break",
        "label": "Costing"
      },
      {
        "fieldname": "total_costing_amount",
        "fieldtype": "Currency",
        "label": "Total Costing Amount (via Timesheet)",
        "oldfieldname": "actual_budget",
        "oldfieldtype": "Currency",
        "options": "Company:company:default_currency",
        "read_only": 1
      },
      {
        "fieldname": "column_break_20",
        "fieldtype": "Column Break"
      },
      {
        "fieldname": "total_billing_amount",
        "fieldtype": "Currency",
        "label": "Total Billable Amount (via Timesheet)",
        "read_only": 1
      },
      {
        "collapsible": 1,
        "fieldname": "sb_more_info",
        "fieldtype": "Section Break",
        "label": "More Info"
      },
      {
        "depends_on": "eval:doc.status == \"Closed\" || doc.status == \"Pending Review\"",
        "fieldname": "review_date",
        "fieldtype": "Date",
        "label": "Review Date",
        "oldfieldname": "review_date",
        "oldfieldtype": "Date"
      },
      {
        "depends_on": "eval:doc.status == \"Closed\"",
        "fieldname": "closing_date",
        "fieldtype": "Date",
        "label": "Closing Date",
        "oldfieldname": "closing_date",
        "oldfieldtype": "Date"
      },
      {
        "fieldname": "column_break_22",
        "fieldtype": "Column Break"
      },
      {
        "fieldname": "department",
        "fieldtype": "Link",
        "label": "Department",
        "options": "Department"
      },
      {
        "fetch_from": "project.company",
        "fieldname": "company",
        "fieldtype": "Link",
        "label": "Company",
        "options": "Company",
        "remember_last_selected_value": 1
      },
      {
        "fieldname": "lft",
        "fieldtype": "Int",
        "hidden": 1,
        "label": "lft",
        "read_only": 1
      },
      {
        "fieldname": "rgt",
        "fieldtype": "Int",
        "hidden": 1,
        "label": "rgt",
        "read_only": 1
      },
      {
        "fieldname": "old_parent",
        "fieldtype": "Data",
        "hidden": 1,
        "ignore_user_permissions": 1,
        "label": "Old Parent",
        "read_only": 1
      },
      {
        "depends_on": "eval: doc.status == \"Completed\"",
        "fieldname": "completed_by",
        "fieldtype": "Link",
        "label": "Completed By",
        "no_copy": 1,
        "options": "User"
      },
      {
        "default": "0",
        "fieldname": "is_template",
        "fieldtype": "Check",
        "label": "Is Template"
      },
      {
        "depends_on": "is_template",
        "fieldname": "start",
        "fieldtype": "Int",
        "label": "Begin On (Days)"
      },
      {
        "depends_on": "is_template",
        "fieldname": "duration",
        "fieldtype": "Int",
        "label": "Duration (Days)"
      },
      {
        "depends_on": "eval: doc.status == \"Completed\"",
        "fieldname": "completed_on",
        "fieldtype": "Date",
        "label": "Completed On",
        "mandatory_depends_on": "eval: doc.status == \"Completed\""
      },
      {
        "fieldname": "template_task",
        "fieldtype": "Data",
        "hidden": 1,
        "label": "Template Task"
      }
    ],
    "icon": "fa fa-check",
    "idx": 1,
    "is_tree": 1,
    "links": [],
    "max_attachments": 5,
    "modified": "2024-05-24 12:36:12.214577",
    "modified_by": "Administrator",
    "module": "Projects",
    "name": "Task",
    "naming_rule": "Expression (old style)",
    "nsm_parent_field": "parent_task",
    "owner": "Administrator",
    "permissions": [
      {
        "create": 1,
        "delete": 1,
        "email": 1,
        "print": 1,
        "read": 1,
        "report": 1,
        "role": "Projects User",
        "share": 1,
        "write": 1
      }
    ],
    "quick_entry": 1,
    "search_fields": "subject",
    "show_name_in_global_search": 1,
    "show_preview_popup": 1,
    "sort_field": "creation",
    "sort_order": "DESC",
    "states": [],
    "timeline_field": "project",
    "title_field": "subject",
    "track_seen": 1
  },
  "doctype": "Schema",
  "id": "a6v04us71cjkpp7",
  "meta": {
    "doctype": "Schema"
  },
  "name": "SCHEMA-0001",
  "updated": "2025-07-14 13:59:41.446Z"
}




child-parent relationships are established in childen by have ids in childer items.data.parent_id_project, where in parent_id_{doctype} {doctype} is doctype of parent and value is id

async function getChildrenByParent(parentId) {
      // Get the parent record to determine its type
      const parentRecord = await pb.collection('items').getOne(parentId);
      const parentType = parentRecord.data.name.toLowerCase();
      
      const filter = `data.parent_id_${parentType} = "${parentId}"`;
      return await pb.collection('items').getFullList({ filter });
    }

how to simplify the user management knowing I am unsing ERPdoctypes,I want to have very relaxed access rights, I want to propagate by default access to all parent-child 

<!--Storing schemas -->

Decision 
// Step 1: Get the schema template for "User"
const schema = await pb.collection('items').getFirstListItem(
  'schema.name = "User" && schema.doctype = "Schema"'
);

// Step 2: Create the new item referencing that schema
const newItem = await pb.collection('items').create({
  schema: {
    id: schema.id,             // Reference to the full schema template
    name: schema.schema.name   // Usually "User"
  },

});

<!--Storing Code -->
const schema = await pb.collection('items').getFirstListItem(
  'schema.doctype = "Code"'
);

<!--Use all fields in doctypes definitions-->
Nested tables = children:
- Use TABLE field tp link parent->child link (now only child->parent like parent_id_project in items.data)
- Use all logic including list_view of child 
fix the naming serieas and names(subject, project_name, or even missing name)
Best practice when building your own Doctypes
Use title or subject as a descriptive label.

Set name to a custom naming series or field (via autoname).

Use title_field in the DocType to show a clean title in lists.

{
  "autoname": "field:subject",
  "title_field": "subject"
}

<!--Users and user managment-->
async function getChildrenByParent(parentId) {
      // Get the parent record to determine its type
      const parentRecord = await pb.collection('items').getOne(parentId);
      const parentType = parentRecord.data.name.toLowerCase();
      
      const filter = `data.parent_id_${parentType} = "${parentId}"`;
      return await pb.collection('items').getFullList({ filter });
    }

<!--issues-->
- items.schema (issue IS-missing universal data) (json) is document specific, and lacks  universal non-document spesific like assigned_to, files_attached, workflow related and tagging etc
- 

<!--data.users section --> 
<!--issue with ACL -->

Exactly, you nailed a common tricky point:

---

# Frond End 

## Frontend v8

 const context = {
      currentUser: null,
      selectedTarget: testTarget,
      selectedTargetSchema: null,
      field.options1(childTable): childSchema,
      field.options1(childTable): childSchema
      ...
      selectedTargetSchema: null, //this is for Target document, but how about the childDocs
      selectedTargetWorkflow: null
    };

it is make sense to load all schemas for scope (which ones?) 

const context = {
  currentUser: null,

  selectedTarget: { ...doc },               // e.g. a Sales Invoice
  selectedTargetSchema: schemas["Sales Invoice"],

  schemas,                                  // all schemas in one place

  selectedTargetWorkflow: { ...workflow }
};


## Frontend v7
https://claude.ai/chat/1647f6ae-746b-422d-8a51-7e8f3319de41 

## Frontend v6 
Archetypes 
https://claude.ai/chat/8c7d17fd-e7f0-4c0a-9ab2-027698049c8d
https://claude.ai/chat/8c7d17fd-e7f0-4c0a-9ab2-027698049c8d

no think i was wrong. most of Frappe fields are archetypical, so I will reference the archetype in PARENT, next to the field, or even better, flag non_archetypical = "Special Email style" for styles that are NOT mainstream

Brilliant insight! You're absolutely right - most fields are archetypal, so we should only override when needed. This is much more efficient.

The Archetypal Approach
Core Principle
Default: Use field archetype styling (Email = email archetype, Password = password archetype)
Override: Only when you need custom styling via non_archetypal flag
DocType Structure
LoginForm DocType
json
{
  "doctype": "LoginForm",
  "fields": [
    {
      "fieldname": "email",
      "fieldtype": "Data", 
      "label": "Email",
      // Uses default "email" archetype automatically
    },
    {
      "fieldname": "password",
      "fieldtype": "Password",
      "label": "Password", 
      // Uses default "password" archetype automatically
    },
    {
      "fieldname": "company_email", 
      "fieldtype": "Data",
      "label": "Company Email",
      "non_archetypal": "Corporate Email Style"  // 👈 Override only when needed
    }
  ]
}
Archetype System
Built-in Archetypes
javascript
const FIELD_ARCHETYPES = {
  // Data field archetypes
  'email': {
    css_class: 'form-group email-field',
    input_css_class: 'form-control email-input rounded border-blue-200',
    placeholder: 'Enter email address',
    icon: 'mail',
    attributes: { autoComplete: 'username', type: 'email' }
  },
  
  'phone': {
    css_class: 'form-group phone-field', 
    input_css_class: 'form-control phone-input rounded border-green-200',
    placeholder: 'Enter phone number',
    icon: 'phone',
    attributes: { autoComplete: 'tel', type: 'tel' }
  },
  
  'name': {
    css_class: 'form-group name-field',
    input_css_class: 'form-control name-input rounded border-gray-200', 
    placeholder: 'Enter full name',
    icon: 'user',
    attributes: { autoComplete: 'name' }
  },

  // Password archetypes
  'password': {
    css_class: 'form-group password-field',
    input_css_class: 'form-control password-input rounded border-red-200',
    placeholder: '••••••••',
    icon: 'lock', 
    attributes: { autoComplete: 'current-password' }
  },
  
  'new-password': {
    css_class: 'form-group new-password-field',
    input_css_class: 'form-control new-password-input rounded border-orange-200',
    placeholder: 'Create strong password',
    icon: 'key',
    attributes: { autoComplete: 'new-password' }
  },

  // Select archetypes  
  'country': {
    css_class: 'form-group country-field',
    input_css_class: 'form-control country-select rounded border-purple-200',
    icon: 'globe'
  }
};
Smart Style Resolution
javascript
const useFieldStyle = (field) => {
  // 1. If non_archetypal is set, load that custom style
  if (field.non_archetypal) {
    return useCustomStyle(field.non_archetypal);
  }
  
  // 2. Try to detect archetype from fieldname
  const archetype = detectArchetype(field.fieldname, field.fieldtype);
  if (archetype && FIELD_ARCHETYPES[archetype]) {
    return { style: FIELD_ARCHETYPES[archetype], loading: false };
  }
  
  // 3. Fallback to fieldtype default
  const fieldtypeDefault = FIELD_ARCHETYPES[field.fieldtype.toLowerCase()];
  return { style: fieldtypeDefault || getDefaultStyle(), loading: false };
};

const detectArchetype = (fieldname, fieldtype) => {
  // Smart detection based on field name patterns
  const patterns = {
    'email': /email|e_mail|mail_id/i,
    'phone': /phone|mobile|contact|tel/i, 
    'name': /name|full_name|user_name/i,
    'password': /password|pwd|pass/i,
    'new-password': /new_password|confirm_password|repeat_password/i,
    'country': /country|nation/i
  };
  
  for (const [archetype, pattern] of Object.entries(patterns)) {
    if (pattern.test(fieldname)) {
      return archetype;
    }
  }
  
  return null;
};
Benefits
✅ 90% Zero Config
Most fields get perfect styling automatically
No need to specify styles for common patterns
✅ Smart Detection
email field → email archetype
mobile_phone field → phone archetype
user_password field → password archetype
✅ Minimal Override
Only specify non_archetypal when you need something special
Keep 90% of forms clean and simple
✅ Consistent UX
All email fields look the same across app
All phone fields have consistent behavior
Familiar patterns for users
Example Usage
javascript
// 90% of fields - zero configuration
{
  fieldname: "email",        // → auto-detects email archetype  
  fieldtype: "Data",
  label: "Email"
}

// 10% of fields - custom styling when needed
{
  fieldname: "admin_email",
  fieldtype: "Data", 
  label: "Admin Email",
  non_archetypal: "Admin Email Special"  // → loads custom style
}
This approach is much more scalable - you get beautiful, consistent forms with minimal configuration, but full customization power when needed! 🎯










## Frontend v5
 TODO: add styles and action functions, generate context https://claude.ai/chat/f0e82e8d-01ca-486b-851a-c099f64fee70 

 ```js and context.js they are NOT integrated
 import React, { useState } from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';

// Style variants - could come from theme/config
const STYLE_VARIANTS = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  
  // Badge variants
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

const WorkflowToolbar = ({ context, onAction }) => {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const { user, document, schema, workflow, userFlow } = context;

  // Get workflow actions based on current state and user roles
  const getWorkflowActions = () => {
    if (!userFlow?.current_state || !workflow?.transitions) return [];
    
    return workflow.transitions
      .filter(t => t.from_state === userFlow.current_state)
      .filter(t => t.allowed_roles.some(role => user.roles.includes(role)))
      .filter(t => !t.condition || evaluateCondition(t.condition, { document, user }))
      .sort((a, b) => (a.idx || 0) - (b.idx || 0))
      .map(transition => {
        const actionConfig = workflow.actions.find(a => a.name === transition.action);
        return actionConfig ? { transition, actionConfig } : null;
      })
      .filter(Boolean);
  };

  // Get document actions based on schema permissions
  const getDocumentActions = () => {
    if (!schema?.permissions) return [];
    
    const userPermissions = schema.permissions.filter(p => 
      user.roles.includes(p.role) && 
      (!p.conditions || evaluateCondition(p.conditions, { document, user }))
    );
    
    const actions = [];
    const canWrite = userPermissions.some(p => p.write);
    const canCancel = userPermissions.some(p => p.cancel);
    
    // Standard document actions - could be configurable
    if (canWrite && !document.via_workflow) {
      actions.push({ name: 'edit', label: 'Edit', icon: 'edit', variant: 'secondary' });
    }
    if (canCancel && !['cancelled', 'rejected'].includes(document.workflow_state)) {
      actions.push({ name: 'cancel', label: 'Cancel', icon: 'x-circle', variant: 'danger' });
    }
    
    // Always available actions
    actions.push(
      { name: 'duplicate', label: 'Duplicate', icon: 'copy', variant: 'secondary' },
      { name: 'print', label: 'Print', icon: 'printer', variant: 'secondary' },
      { name: 'email', label: 'Email', icon: 'mail', variant: 'secondary' }
    );
    
    return actions;
  };

  const evaluateCondition = (condition, context) => {
    if (!condition) return true;
    try {
      return new Function('document', 'user', `return ${condition}`)(context.document, context.user);
    } catch (e) {
      console.warn('Condition evaluation failed:', condition, e);
      return false;
    }
  };

  const getCurrentState = () => {
    return workflow?.states?.find(s => s.name === userFlow?.current_state);
  };

  const handleAction = async (actionData) => {
    const { actionConfig } = actionData;
    
    // Handle confirmation
    if (actionConfig?.confirmation_message) {
      if (!window.confirm(actionConfig.confirmation_message)) return;
    }
    
    // Handle comment requirement
    let comment = null;
    if (actionConfig?.requires_comment) {
      comment = window.prompt('Please add a comment:');
      if (!comment?.trim()) return;
    }
    
    // Call parent handler
    await onAction({
      type: 'workflow',
      ...actionData,
      comment
    });
  };

  const handleDocumentAction = async (action) => {
    await onAction({
      type: 'document',
      action,
      document,
      user
    });
  };

  const workflowActions = getWorkflowActions();
  const documentActions = getDocumentActions();
  const primaryAction = workflowActions[0];
  const secondaryActions = [...workflowActions.slice(1), ...documentActions];
  const currentState = getCurrentState();

  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      {/* Document Info */}
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {document.name}
          </h1>
          <div className="flex items-center space-x-2 mt-1">
            {/* Status Badge */}
            {currentState && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                STYLE_VARIANTS[currentState.style?.variant] || STYLE_VARIANTS.draft
              }`}>
                {currentState.style?.icon && (
                  <span className="mr-1">{currentState.style.icon}</span>
                )}
                {currentState.label}
              </span>
            )}
            <span className="text-sm text-gray-500">
              Modified {new Date(document.modified).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Primary Workflow Action */}
        {primaryAction && (
          <button
            onClick={() => handleAction(primaryAction)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              STYLE_VARIANTS[primaryAction.actionConfig.style?.variant] || STYLE_VARIANTS.primary
            }`}
          >
            {primaryAction.actionConfig.style?.icon && (
              <span className="mr-2">{primaryAction.actionConfig.style.icon}</span>
            )}
            {primaryAction.actionConfig.label}
          </button>
        )}

        {/* Actions Dropdown */}
        {secondaryActions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showActionsMenu && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowActionsMenu(false)}
                />
                
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    {/* Secondary Workflow Actions */}
                    {workflowActions.slice(1).map((actionData, index) => (
                      <button
                        key={`workflow-${actionData.actionConfig.name}-${index}`}
                        onClick={() => {
                          handleAction(actionData);
                          setShowActionsMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        {actionData.actionConfig.style?.icon && (
                          <span className="mr-2">{actionData.actionConfig.style.icon}</span>
                        )}
                        {actionData.actionConfig.label}
                      </button>
                    ))}
                    
                    {/* Divider */}
                    {workflowActions.length > 1 && documentActions.length > 0 && (
                      <div className="border-t border-gray-200 my-1" />
                    )}
                    
                    {/* Document Actions */}
                    {documentActions.map((action, index) => (
                      <button
                        key={`doc-${action.name}-${index}`}
                        onClick={() => {
                          handleDocumentAction(action);
                          setShowActionsMenu(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Universal Document Page Component
const DocumentPage = ({ contextLoader, actionHandler, children }) => {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadContext = async () => {
      try {
        const ctx = await contextLoader();
        setContext(ctx);
      } catch (error) {
        console.error('Failed to load context:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadContext();
  }, [contextLoader]);

  const handleAction = async (actionData) => {
    try {
      await actionHandler(actionData);
      // Refresh context after action
      const updatedContext = await contextLoader();
      setContext(updatedContext);
    } catch (error) {
      console.error('Action failed:', error);
      alert(`Action failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Failed to load document context</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WorkflowToolbar 
        context={context} 
        onAction={handleAction} 
      />
      <div className="p-4">
        {children(context, handleAction)}
      </div>
    </div>
  );
};

// Usage Example - Zero Hardcoding
const SalesInvoiceView = ({ documentName }) => {
  const contextLoader = async () => {
    // This would be your API calls to load all context
    const [user, document, schema, workflow, userFlow] = await Promise.all([
      fetch(`/api/user/current`).then(r => r.json()),
      fetch(`/api/documents/${documentName}`).then(r => r.json()),
      fetch(`/api/schemas/SalesInvoice`).then(r => r.json()),
      fetch(`/api/workflows/SalesInvoiceWorkflow`).then(r => r.json()),
      fetch(`/api/user-flows/current?document=${documentName}`).then(r => r.json())
    ]);
    
    return { user, document, schema, workflow, userFlow };
  };

  const actionHandler = async (actionData) => {
    if (actionData.type === 'workflow') {
      return await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
    } else {
      return await fetch('/api/document/action', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
    }
  };

  return (
    <DocumentPage 
      contextLoader={contextLoader}
      actionHandler={actionHandler}
    >
      {(context, handleAction) => (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Invoice Details</h2>
          <p>Customer: {context.document.customer}</p>
          <p>Amount: ${context.document.total_amount}</p>
          <p>Status: {context.userFlow?.current_state}</p>
        </div>
      )}
    </DocumentPage>
  );
};

export default SalesInvoiceView;

```


 https://chatgpt.com/c/68a48123-ca60-8327-9e4c-19239d789506
## Fronted v4
 TODO: refactor - (https://claude.ai/chat/b18c5ec8-8c4a-49be-beaf-b7a3e813db92)
 TODO: consider conditional workflow https://claude.ai/chat/b18c5ec8-8c4a-49be-beaf-b7a3e813db92 

 {
  "workflow_name": "UserOnboarding",
  "states": [
    {
      "name": "ProfileSetup",
      "component_type": "form",
      "doctype": "Schema",
      "for_doctype": "Profile",
      "is_active": true
    },
    {
      "name": "Dashboard",
      "component_type": "info",
      "doctype": null,
      "message": "Welcome to your Dashboard",
      "is_active": true
    }
  ],
  "actions": [
    {
      "name": "submit_profile",
      "label": "Submit Profile",
      "type": "submit",
      "button_class": "btn btn-primary",
      "requires_comment": false,
      "api": {
        "cmd": "frappe.core.doctype.profile.profile.update_profile",
        "params": ["profile_data"]
      },
      "is_active": true
    }
  ],
  "transitions": [
    {
      "name": "ProfileSetup_to_Dashboard",
      "state": "ProfileSetup",
      "action": "submit_profile",
      "next_state": "Dashboard",
      "allowed": ["Employee", "Admin"],
      "condition": null,
      "idx": 1
    }
  ]
}

 
```mermaid
erDiagram
    %% Core Workflow Documents
    WORKFLOW {
        string id PK
        string workflow_name
        string description
        string document_type FK "DocType lookup - no longer updated"
        boolean is_active
        datetime created
        datetime modified
    }
    
     {
        string id PK
        string user_id FK "User lookup"
        string workflow FK "Workflow lookup"
        string current_state FK "Workflow State lookup"
        string document "Current active document ID"
        json generated_documents "Map of state->document_id"
        json history "Array of transitions"
        json accumulated_data "Cross-state data"
        datetime created
        datetime modified
    }
    
    %% Table Child Documents
    WORKFLOW_DOCUMENT_STATE {
        string id PK
        string parent FK "Workflow"
        string state FK "Workflow State lookup"
        string allow_edit FK "Role lookup"
        string next_action_email_template FK "Email Template lookup"
        int idx "Sort order"
    }
    
    WORKFLOW_TRANSITION {
        string id PK
        string parent FK "Workflow"
        string state FK "Workflow State lookup - from state"
        string action FK "Workflow Action Master lookup"
        string next_state FK "Workflow State lookup - to state"
        string allowed FK "Role lookup"
        string condition "Evaluation condition"
        int idx "Sort order"
    }
    
    %% Master Data / Lookup Documents
    WORKFLOW_STATE {
        string id PK
        string state_name
        string component_type "form|info"
        string doctype "Schema or actual doctype"
        string for_doctype "If doctype=Schema, target doctype"
        string message "For info states"
        json style_config "UI styling"
        boolean is_active
    }
    
    WORKFLOW_ACTION_MASTER {
        string id PK
        string action_name
        string action_label
        string action_type "submit|approve|reject|custom"
        string button_class "CSS classes"
        boolean requires_comment
        boolean is_active
    }
    
    ROLE {
        string id PK
        string role_name
        string description
        json permissions
        boolean is_active
    }
    
    EMAIL_TEMPLATE {
        string id PK
        string template_name
        string subject
        text body
        string template_type
        json variables
        boolean is_active
    }
    
    DOCTYPE {
        string id PK
        string name
        string module
        boolean is_submittable
        boolean is_single
        json fields_config
        boolean is_active
    }
    
    SCHEMA {
        string id PK
        string name
        string doctype "Always 'Schema'"
        json meta "Contains for_doctype"
        json fields "Field definitions"
        boolean is_active
        datetime created
        datetime modified
    }
    
    USER {
        string id PK
        string username
        string email
        json roles "Array of role IDs"
        boolean is_active
    }
    
    %% Generated Business Documents (Examples)
    LOGIN_DOCUMENT {
        string id PK
        string user FK "User who created"
        string email
        string login_method
        datetime login_time
        string workflow_state
        boolean via_workflow
    }
    
    PROFILE_SETUP {
        string id PK
        string user FK
        string full_name
        string department
        string phone
        json preferences
        string workflow_state
        boolean via_workflow
    }
    
    SALES_INVOICE {
        string id PK
        string customer
        decimal total_amount
        string status
        datetime invoice_date
        string workflow_state
        string approved_by FK "User"
    }
    
    %% Relationships
    WORKFLOW ||--o{ WORKFLOW_DOCUMENT_STATE : "has states"
    WORKFLOW ||--o{ WORKFLOW_TRANSITION : "has transitions"
    WORKFLOW ||--o{  : "used in"
    
     }o--|| WORKFLOW : "follows"
     }o--|| USER : "belongs to"
     }o--|| WORKFLOW_STATE : "current state"
    
    WORKFLOW_DOCUMENT_STATE }o--|| WORKFLOW_STATE : "references state"
    WORKFLOW_DOCUMENT_STATE }o--|| ROLE : "allow edit role"
    WORKFLOW_DOCUMENT_STATE }o--|| EMAIL_TEMPLATE : "email template"
    
    WORKFLOW_TRANSITION }o--|| WORKFLOW_STATE : "from state"
    WORKFLOW_TRANSITION }o--|| WORKFLOW_STATE : "to next_state"
    WORKFLOW_TRANSITION }o--|| WORKFLOW_ACTION_MASTER : "action"
    WORKFLOW_TRANSITION }o--|| ROLE : "allowed role"
    
    %% Schema as Document Relationship
    WORKFLOW_STATE }o--|| SCHEMA : "uses (if state.doctype='Schema')"
    SCHEMA }o--|| DOCTYPE : "defines creation for (meta.for_doctype)"
    
    USER }o--o{ ROLE : "has roles"
    
    %% Generated Documents linked to User Flow
     ||--o{ LOGIN_DOCUMENT : "generates (via workflow)"
     ||--o{ PROFILE_SETUP : "generates (via workflow)"
     ||--o{ SALES_INVOICE : "works with (existing)"
    
    %% Document Creation Flow
    LOGIN_DOCUMENT }o--|| USER : "created by"
    PROFILE_SETUP }o--|| USER : "created by"
    SALES_INVOICE }o--|| USER : "approved by"
    
    %% Styling for different document types
    classDef coreWorkflow fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef userTracking fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef tableChild fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef masterData fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef businessDoc fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef systemDoc fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    
    class WORKFLOW coreWorkflow
    class  userTracking
    class WORKFLOW_DOCUMENT_STATE,WORKFLOW_TRANSITION tableChild
    class WORKFLOW_STATE,WORKFLOW_ACTION_MASTER,ROLE,EMAIL_TEMPLATE,DOCTYPE masterData
    class LOGIN_DOCUMENT,PROFILE_SETUP,SALES_INVOICE businessDoc
    class SCHEMA,USER systemDoc
```


prompt: I am changing the approach a little bit from Frappe workflow documents which in my case are stored in Pcketbase. I need reacvt UI load completely based on correspondent workflow I have most of functions implemented. Do not give code just comment on implementation. stead of updating workflow_state in 1 doctype in Frappe we update current_state and history in User Flow document
ChatGPT said:
Exactly — that’s the core difference in your approach.
Traditional Frappe workflow:
Each document has a workflow_state field.
Users performing actions directly update that field on the document.
Multi-user or multi-document tracking can get tricky because state lives in the document itself.
Your refactored approach:
The workflow logic lives in the master workflow (read-only).
Each user has a User Flow document:
{
  "user_id": "user_123",
  "workflow_name": "MultiDoctypeWorkflow",
  "current_state": "ProfileSetup",
  "history": [
    {"state": "Login", "action": "login", "timestamp": "2025-08-18T12:00:00Z"}
  ]
}
When a user performs an action:
The backend updates only their User Flow (current_state + history).
Any document-centric report (like which users have approved or completed steps) is derived from all User Flow documents; it is not directly written by users.
Advantages:
No need for users to have write access to the actual document (unless the action also updates document data).
Multi-user approvals are easy to track: each user has their own flow.
Master workflow remains immutable — a single source of truth.
Reduces conflicts and keeps a minimal, clean architecture. My widget code is ```js widget v3 async function initDynamicWorkflowWidget(targetDoctype, targetName) {   await loadReact();   const { useState, useEffect } = React;    function WorkflowWidget() {     const [currentStateName, setCurrentStateName] = useState(null);     const [workflow, setWorkflow] = useState(null);     const [schema, setSchema] = useState(null);     const [workflowData, setWorkflowData] = useState({});      // Load workflow and initial state     useEffect(() => {       async function loadWorkflow() {         const wf = await pb.getWorkflow(targetDoctype);         const initialStateName = await pb.getWorkflowState(targetName);         setWorkflow(wf);         setCurrentStateName(initialStateName);       }       loadWorkflow();     }, []);      // Load schema for the current state's doctype if it's a form     useEffect(() => {       if (!workflow || !currentStateName) return;        const currentState = workflow.states.find(s => s.state === currentStateName);       if (!currentState) return;        if (currentState.componentType === "form") {         pb.getSchema(currentState.doctype)           .then(sch => setSchema(sch))           .catch(err => console.error("Error loading schema:", err));       } else {         setSchema(null);       }     }, [workflow, currentStateName]);      // Handle actions / transitions     const handleAction = async (action, payload) => {       if (!workflow) return;        const nextStateName = workflow.transitions[currentStateName]         ?.find(t => t.action === action)?.next;       if (!nextStateName) return;        // Example: login action       if (action === "login") {         const auth = await pb.collection("users").authWithPassword(payload.email, payload.password);         setWorkflowData(prev => ({ ...prev, user: auth.record }));       }        // Store form data for current state       setWorkflowData(prev => ({ ...prev, [currentStateName]: payload }));        // Move to next state       setCurrentStateName(nextStateName);     };      if (!workflow || !currentStateName) return React.createElement("div", null, "Loading...");      const currentState = workflow.states.find(s => s.state === currentStateName);      // Render form or info dynamically     if (currentState.componentType === "form") {       return React.createElement(UniversalFrappeForm, {         schema,         initialData: workflowData[currentStateName] || {},         onSubmit: (data) => handleAction(currentState.submitAction, data)       });     }      if (currentState.componentType === "info") {       return React.createElement("div", null, currentState.message || "");     }      return React.createElement("div", null, "Unknown componentType");   }    // Render container   const container = document.getElementById("workflow-widget-container") || (() => {     const c = document.createElement("div");     c.id = "workflow-widget-container";     document.body.appendChild(c);     return c;   })();    ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget)); } ``` refactoring suggesiotns are here’s a breakdown of which functions or parts could be refactored and why, given your multi-doctype, per-user workflow setup:
1. useEffect loading workflow and initial state
useEffect(() => {
  async function loadWorkflow() {
    const wf = await pb.getWorkflow(targetDoctype);
    const initialStateName = await pb.getWorkflowState(targetName);
    setWorkflow(wf);
    setCurrentStateName(initialStateName);
  }
  loadWorkflow();
}, []);
Analysis:
Works fine for single-doctype workflows.
In a multi-doctype / per-user model:
targetDoctype may no longer represent the initial state’s doctype.
pb.getWorkflowState(targetName) must return the user-specific current state (from ) instead of just document workflow_state.
Refactor suggestion:
Make loadWorkflow accept a user ID and fetch the current state from the  document.
Still minimal; the hook itself can stay.
2. useEffect loading schema for current state
useEffect(() => {
  if (!workflow || !currentStateName) return;
  const currentState = workflow.states.find(s => s.state === currentStateName);
  if (!currentState) return;
  if (currentState.componentType === "form") {
    pb.getSchema(currentState.doctype)
      .then(sch => setSchema(sch))
      .catch(err => console.error("Error loading schema:", err));
  } else {
    setSchema(null);
  }
}, [workflow, currentStateName]);
Analysis:
Works as-is.
No changes needed — schema is always fetched from the current state’s doctype.
Already supports multi-doctype workflows.
3. handleAction function
const handleAction = async (action, payload) => {
  if (!workflow) return;
  const nextStateName = workflow.transitions[currentStateName]
    ?.find(t => t.action === action)?.next;
  if (!nextStateName) return;
  // Example: login action
  if (action === "login") {
    const auth = await pb.collection("users").authWithPassword(payload.email, payload.password);
    setWorkflowData(prev => ({ ...prev, user: auth.record }));
  }
  // Store form data for current state
  setWorkflowData(prev => ({ ...prev, [currentStateName]: payload }));
  // Move to next state
  setCurrentStateName(nextStateName);
};
Analysis:
Main candidate for refactoring.
Currently only updates local workflowData and currentStateName.
For multi-user, multi-document workflow:
Needs to update the backend:
User flow (current_state, history)
Document workflow (current_state, users_per_state, state_history)
Must handle multi-user approval checks before allowing a transition.
Refactor suggestion:
Replace local setCurrentStateName(nextStateName) with a call to a backend API that:
Validates action against master workflow.
Updates  document.
Updates document_workflow (for multi-user steps).
The rest of the local state (workflowData) can stay as temporary UI state.
4. Rendering section
if (currentState.componentType === "form") {
  return React.createElement(UniversalFrappeForm, {
    schema,
    initialData: workflowData[currentStateName] || {},
    onSubmit: (data) => handleAction(currentState.submitAction, data)
  });
}
if (currentState.componentType === "info") {
  return React.createElement("div", null, currentState.message || "");
}
Analysis:
No changes required — it already dynamically renders based on the doctype schema and state component type.
Multi-doctype workflows are fully compatible because schema is fetched per state.
5. workflowData state
Currently stores temporary form data per state.
Can stay as-is; backend persists the actual data.
Might consider clearing state on transition for memory if needed.
✅ Summary: Functions that need refactoring
Function / Section	Reason for refactor	Minimal change suggestion
loadWorkflow (useEffect)	Must fetch user-specific current state from 	Add user_id parameter and fetch current_state from  document
handleAction	Currently only updates local state, doesn’t persist	Call backend API to update  + document workflow, validate transitions


Approach: 

Your refactoring analysis is spot-on. Here's my commentary on your implementation approach:
Architecture Assessment
Strengths of your User Flow approach:

Clean separation of concerns: workflow definition vs. user progress tracking
Multi-user workflows become trivial since each user has their own flow document
Audit trail is built-in through the history array
No document write permission complexity
Master workflow remains immutable and reusable

The two key refactors you've identified are exactly right:
1. Initial State Loading
Your current loadWorkflow assumes a single document state. With User Flow documents, you need:
// Instead of: pb.getWorkflowState(targetName) 
// You need: pb.getUserFlowState(userId, workflowName)
This shifts from "what state is this document in?" to "what state is this user in for this workflow?"
2. handleAction - The Critical Refactor
This is where your architecture change has the biggest impact. Currently it's pure client-side state management, but you need:

Backend validation: Check if user can perform this action from their current state
Multi-user coordination: For approval steps, check if enough users have completed the action
Persistent updates: Update both  and potentially document_workflow
Error handling: What if the action fails due to business rules?

Additional Considerations
State Synchronization: Since multiple users might be working on the same workflow, you'll want to consider how to handle real-time updates when other users complete actions that affect the overall document state.
Data Persistence Strategy: Your workflowData local state works well for form drafts, but you might want to consider when/how to persist intermediate form data to PocketBase (auto-save vs. explicit save).
Permission Model: With User Flow documents, you can implement fine-grained permissions - users only need read access to master workflows and write access to their own User Flow documents.
Your widget code structure is actually quite solid for this transition - the rendering logic doesn't need to change at all, which speaks to good separation of concerns in your original design.

## Scoping v3
### TODO: refactor workflow_state by document into user-flow.current_state



```json user-flow doctype
{
  "user_id": "user_123",
  "workflow_name": "MultiDoctypeWorkflow",
  "current_state": "ProfileSetup",
  "history": [
    {"state": "Login", "action": "login", "timestamp": "2025-08-18T12:00:00Z"}
  ]
}
```

- decided to use more universal logic assuming there is UniversalFrappe form renderer. 
- form schema and fields are derives from doctype schema

```js widget v3
async function initDynamicWorkflowWidget(targetDoctype, targetName) {
  await loadReact();
  const { useState, useEffect } = React;

  function WorkflowWidget() {
    const [currentStateName, setCurrentStateName] = useState(null);
    const [workflow, setWorkflow] = useState(null);
    const [schema, setSchema] = useState(null);
    const [workflowData, setWorkflowData] = useState({});

    // Load workflow and initial state
    useEffect(() => {
      async function loadWorkflow() {
        const wf = await pb.getWorkflow(targetDoctype);
        const initialStateName = await pb.getWorkflowState(targetName);
        setWorkflow(wf);
        setCurrentStateName(initialStateName);
      }
      loadWorkflow();
    }, []);

    // Load schema for the current state's doctype if it's a form
    useEffect(() => {
      if (!workflow || !currentStateName) return;

      const currentState = workflow.states.find(s => s.state === currentStateName);
      if (!currentState) return;

      if (currentState.componentType === "form") {
        pb.getSchema(currentState.doctype)
          .then(sch => setSchema(sch))
          .catch(err => console.error("Error loading schema:", err));
      } else {
        setSchema(null);
      }
    }, [workflow, currentStateName]);

    // Handle actions / transitions
    const handleAction = async (action, payload) => {
      if (!workflow) return;

      const nextStateName = workflow.transitions[currentStateName]
        ?.find(t => t.action === action)?.next;
      if (!nextStateName) return;

      // Example: login action
      if (action === "login") {
        const auth = await pb.collection("users").authWithPassword(payload.email, payload.password);
        setWorkflowData(prev => ({ ...prev, user: auth.record }));
      }

      // Store form data for current state
      setWorkflowData(prev => ({ ...prev, [currentStateName]: payload }));

      // Move to next state
      setCurrentStateName(nextStateName);
    };

    if (!workflow || !currentStateName) return React.createElement("div", null, "Loading...");

    const currentState = workflow.states.find(s => s.state === currentStateName);

    // Render form or info dynamically
    if (currentState.componentType === "form") {
      return React.createElement(UniversalFrappeForm, {
        schema,
        initialData: workflowData[currentStateName] || {},
        onSubmit: (data) => handleAction(currentState.submitAction, data)
      });
    }

    if (currentState.componentType === "info") {
      return React.createElement("div", null, currentState.message || "");
    }

    return React.createElement("div", null, "Unknown componentType");
  }

  // Render container
  const container = document.getElementById("workflow-widget-container") || (() => {
    const c = document.createElement("div");
    c.id = "workflow-widget-container";
    document.body.appendChild(c);
    return c;
  })();

  ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget));
}
```

## Frontend v2 (do not use)) 
- I used to have v1 of logic: 
### v1 logic

 I got v2 of approach:
```js react renderer widget code
async function initDynamicWorkflowWidget(targetDoctype, targetName) {
  // Load React/ReactDOM
  await loadReact();

  const { useState, useEffect } = React;

  function WorkflowWidget() {
    const [currentState, setCurrentState] = useState(null);
    const [workflow, setWorkflow] = useState(null);
    const [workflowData, setWorkflowData] = useState({});

    useEffect(() => {
      async function loadWorkflow() {
        const wf = await pb.getWorkflow(targetDoctype);
        const stateName = await pb.getWorkflowState(targetName);
        setWorkflow(wf);
        setCurrentState(stateName);
      }
      loadWorkflow();
    }, []);

    const handleAction = async (action, payload) => {
      // Let backend decide next state
      const nextState = workflow.transitions[currentState]
        ?.find(t => t.action === action)?.next;
      if (!nextState) return;

      // Optionally call server action (login, save, approve...)
      if (action === "login") {
        const auth = await pb.collection("users").authWithPassword(payload.email, payload.password);
        // Optionally store session or data in workflowData
        setWorkflowData(prev => ({ ...prev, user: auth.record }));
      }

      setCurrentState(nextState);
    };

    if (!workflow || !currentState) return React.createElement("div", null, "Loading...");

    const stateConfig = workflow.states.find(s => s.state === currentState);

    let Renderer;
    if (stateConfig.componentType === "form") {
      Renderer = ({ fields, submitAction }) =>
        React.createElement("form", {
          onSubmit: e => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.target));
            handleAction(submitAction, values);
          }
        },
          fields.map(f =>
            React.createElement("input", { key: f.name, name: f.name, type: f.type, placeholder: f.placeholder, required: true })
          ),
          React.createElement("button", { type: "submit" }, "Submit")
        );
    } else if (stateConfig.componentType === "info") {
      Renderer = ({ message }) => React.createElement("div", null, message);
    } else {
      Renderer = () => React.createElement("div", null, `Unknown componentType`);
    }

    return React.createElement(Renderer, stateConfig);
  }

  const container = document.getElementById("workflow-widget-container") || (() => {
    const c = document.createElement("div");
    c.id = "workflow-widget-container";
    document.body.appendChild(c);
    return c;
  })();

  ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget));
}
```
where State is like
```json States proposal
{
  "states": [
    {
      "state": "Login",
      "componentType": "form",
      "fields": [
        {"name": "email", "type": "email", "placeholder": "Email"},
        {"name": "password", "type": "password", "placeholder": "Password"}
      ],
      "submitAction": "login"
    },
    {
      "state": "Dashboard",
      "componentType": "info",
      "message": "Welcome to your dashboard"
    }
  ],
  "transitions": {
    "Login": [
      {"action": "login", "next": "Dashboard"}
    ]
  }
}
```

however i recognized the duplication of logic here 
- the pb.getWorkflow(doctype) anyhow linking the doctype to Workflow. and each docype has 1 schema in 
my pocketbase implementation where form fields anyhow defined (Exacly Frappe schema in json) like 
schema is Frappe json: 

```json Schema example
{
 "actions": [],
 "allow_import": 1,
 "autoname": "TASK-.YYYY.-.#####",
 "creation": "2013-01-29 19:25:50",
 "doctype": "DocType",
 "document_type": "Setup",
 "engine": "InnoDB",
 "field_order": [
  "subject",
  "project",
  "issue",
  "type",
  "color",
  "is_group",
  "is_template",
  "column_break0",
  "status",
  "priority",
  "task_weight",
  "parent_task",
  "completed_by",
  "completed_on",
  "sb_timeline",
  "exp_start_date",
  "expected_time",
  "start",
  "column_break_11",
  "exp_end_date",
  "progress",
  "duration",
  "is_milestone",
  "sb_details",
  "description",
  "sb_depends_on",
  "depends_on",
  "depends_on_tasks",
  "sb_actual",
  "act_start_date",
  "actual_time",
  "column_break_15",
  "act_end_date",
  "sb_costing",
  "total_costing_amount",
  "column_break_20",
  "total_billing_amount",
  "sb_more_info",
  "review_date",
  "closing_date",
  "column_break_22",
  "department",
  "company",
  "lft",
  "rgt",
  "old_parent",
  "template_task"
 ],
 "fields": [
  {
   "allow_in_quick_entry": 1,
   "fieldname": "subject",
   "fieldtype": "Data",
   "in_global_search": 1,
   "in_standard_filter": 1,
   "label": "Subject",
   "reqd": 1,
   "search_index": 1
  },
  {
   "allow_in_quick_entry": 1,
   "bold": 1,
   "fieldname": "project",
   "fieldtype": "Link",
   "in_global_search": 1,
   "in_list_view": 1,
   "in_standard_filter": 1,
   "label": "Project",
   "oldfieldname": "project",
   "oldfieldtype": "Link",
   "options": "Project",
   "remember_last_selected_value": 1,
   "search_index": 1
  },
  {
   "fieldname": "issue",
   "fieldtype": "Link",
   "label": "Issue",
   "options": "Issue"
  },...
  ```
I have already function for schema extraction: pb.getSchema = async function (doctype) {
      const schemaResult = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
        filter: `doctype = "Schema" && meta.for_doctype = "${doctype}"`
      });

      return schemaResult.items.length > 0 ? schemaResult.items[0].data : null;
    };
so why to rebuilt the form like this inside the State docype> "componentType": "form",
      "fields": [
        {"name": "email", "type": "email", "placeholder": "Email"},
        {"name": "password", "type": "password", "placeholder": "Password"}
      ],. I  have for every doctype the schema

please help me to keep the best of v2 while retaining the best of last approach. give widget and example State json. 

### v0
- Dont give code, just advice, is using Frappe workflow for react UI on-change is giving advantates
- I am using Frappe workflow documents and related inside PocketBase in 1 collection
Workflow [tabWorkflow]
│
├─ states → Workflow Document State
│   ├─ state → Workflow State
│   ├─ allow_edit → Role
│   └─ next_action_email_template → Email Template
│
└─ transitions → Workflow Transition
    ├─ state → Workflow State
    ├─ action → Workflow Action Master
    └─ allowed → Role

Document [tab<YourDocType>]
└─ workflow_state → current Workflow State
- I have already these workflow functions
### Workflow functions

```js Workflow functions
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
  ```


- If I store the full React component (JSX/JS code) directly in Workflow Document State.component

Example
```js
{
  "doc_status": "2",
  "parent": "Workflow-qpnwdsymw3cy9qm",
  "parentfield": "states",
  "parenttype": "Workflow",
  "state": "Rejected"
  "component": "function MyLoginPage({ currentState }) { 
  return React.createElement('div', null, 
    React.createElement('h2', null, 'Login Page'),
    React.createElement('p', null, `State: ${currentState}`)
  );}"
}
```

```js
async function loadReact() {
  if (!window.React || !window.ReactDOM) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js');
  }
  return { React: window.React, ReactDOM: window.ReactDOM };
}

loadReact().then(async ({ React, ReactDOM }) => {
  const { useState, useEffect } = React;

  function WorkflowWidget() {
    const [currentState, setCurrentState] = useState(null);
    const [Component, setComponent] = useState(() => () => React.createElement('div', null, 'Loading...'));

    useEffect(() => {
      async function load() {
        const wf = await pb.getWorkflow(selectedTarget.doctype);
        const stateName = await pb.getWorkflowState(selectedTarget.name);
        setCurrentState(stateName);

        const stateObj = wf.states.find(s => s.state === stateName);
        if (stateObj?.component) {
          // Assuming `component` field contains full React component as a string
          const Comp = new Function('React', `"use strict"; return ${stateObj.component}`)(React);
          setComponent(() => Comp);
        }
      }
      load();
    }, []);

    return React.createElement(Component, { currentState });
  }

  const container = document.getElementById('workflow-widget-container') || (() => {
    const c = document.createElement('div');
    c.id = 'workflow-widget-container';
    document.body.appendChild(c);
    return c;
  })();

  ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget));
});

```

C:\python\frappe\frappe\workflow\doctype\workflow_state


## The Problem Recap

* **Users can self-register** via public registration — no admin needed.
* But **non-admin users cannot list or query all users** because listing users is an admin-level permission.
* Therefore, if you want to let non-admin users assign or select other users (e.g., in your `items.users` field), they **cannot get the full user list from PocketBase directly**.
* This makes things like dropdown user selectors or assigning users difficult for non-admin clients.

---

## How to Overcome This?

### 1. **Expose a Custom API Endpoint for User Listing**

* Create a **custom backend or cloud function** that:

  * Authenticates the caller (checks their role or permissions).
  * Retrieves a **safe, filtered list of users** (e.g., only active users, or a subset).
  * Returns user info needed for selection (e.g., `id`, `name`, `email`).
* Your non-admin clients call this endpoint to get the user list for assignment.
* This backend uses admin-level credentials to read users but only exposes a limited, controlled view.

---

### 2. **Use PocketBase Collection Rules for Limited Access**

* PocketBase's default **Users collection is admin-only**, but you can create a **separate "profiles" collection** that contains public info of users.
* When users register:

  * Use PocketBase hooks or client code to **create or sync a "profile" record** with publicly visible info.
* Then:

  * Non-admin users can read this `profiles` collection without admin rights.
  * Use this collection to populate user selectors and assign users in `items.users`.
* This keeps sensitive user data protected but allows non-admin access to basic user info.

---

### 3. **Embed User Info in the Client After Signup**

* If your app is closed or limited in scale:

  * When a user signs up, store their basic info locally or share it securely with other users in the app.
  * This is only feasible in small or trusted environments.
* Not recommended for larger or public apps.

---

## Example Workflow Using Profiles Collection

1. User signs up via public registration.
2. A PocketBase hook or client logic creates a corresponding record in the `profiles` collection with `{ userId, displayName, email }`.
3. Non-admin users have read access to `profiles`.
4. When assigning users to an item, your client fetches from `profiles` collection instead of `users`.
5. Use the `userId` from profiles to assign to `items.users`.

---

## Summary

| Solution                    | Description                                     |
| --------------------------- | ----------------------------------------------- |
| Custom Backend API          | Controlled user list returned to clients        |
| Separate Public Profiles    | Mirror minimal user info in a public collection |
| Client-side User Info Cache | Share or cache user info within the app         |

---

If you want, I can help with:

* How to set up a `profiles` collection and sync it on signup.
* Sample PocketBase hook code or API design.
* Collection rule configurations.

Just let me know!

<!--descision --->
- to use the hybrid approach (items.users and items.data.users)
- 
Great question — since you're already thinking deeply about architecture, here's a grounded recommendation based on how PocketBase works **today (as of 2025)** and your use case.

---

## 🧠 Recommendation: **Hybrid Approach (Lean PB Relations + Rich `data.users`)**

| Layer                     | Role                                                      |
| ------------------------- | --------------------------------------------------------- |
| `items.users` (relation)  | **Access gate** — who can fetch/see the item              |
| `items.data.users` (JSON) | **Role + permission logic** — what they can do in the app |

---

## ✅ Why This Hybrid Approach Is Ideal for PocketBase

| Reason                  | Explanation                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 🔒 **Native filtering** | PocketBase lets you filter by relation: `users ~ "user123"` — fast and enforced server-side                        |
| 🧠 **Flexible logic**   | Your `data.users` can support roles, timestamps, custom fields, invitations, etc.                                  |
| ✍️ **Easier UI**        | You can build admin/collaborator interfaces from `data.users`, not just a flat ID list                             |
| ⚙️ **Scoped access**    | PB rules can restrict writes (only owners can write), while your app handles collaboration nuance                  |
| 🧪 **Scalable**         | You can later move to a dedicated `user_roles` collection if things get complex, but you don’t have to start there |

---

## ✅ What to Avoid

| Approach                                                | Why Not                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Only using `users` relation                             | No room for roles/permissions, and you'll need hacks for UI or logic                                |
| Only using `data.users`                                 | You lose PB's built-in filtering and security layers — all access control must be in your app       |
| Complex `users[]` + per-role fields (`owner`, `editor`) | You'll duplicate the logic and make updates hard to maintain                                        |
| Building a full ACL system in a separate collection     | Overkill unless you’re doing enterprise-level multi-tenant auth — more boilerplate, harder to debug |

---

## 🛠 What You Should Do

### 🗃 Your `items` Schema (PocketBase)

| Field   | Type                    | Notes                                               |
| ------- | ----------------------- | --------------------------------------------------- |
| `users` | `Relation[]` to `users` | Determines **who can access** the item              |
| `data`  | `JSON`                  | Contains `data.users` for **roles and permissions** |

```json
"data": {
  "title": "Form A",
  "users": [
    { "id": "user123", "role": "owner", "access": "write" },
    { "id": "user456", "role": "collaborator", "access": "read" }
  ]
}
```

---

### ✅ Server-Side Rules Example

```sql
@request.auth.id != "" && users ~ @request.auth.id
```

> Only allow access if the current user is listed in `users` relation.

---

### 🧩 Bonus: Optional Metadata on Relation

If needed later, you can introduce `data.user_metadata`, like:

```json
"user_metadata": {
  "user123": { "invitedAt": "2025-07-08", "status": "active" },
  "user456": { "invitedAt": "2025-07-09", "status": "pending" }
}
```

---

## 🚦 Final Recommendation

Stick to:

* ✅ `users` relation: enforced by PocketBase (fast + secure)
* ✅ `data.users`: for role-based logic (flexible + future-proof)
* ❌ Don't try to cram roles into relation
* ❌ Avoid splitting roles into separate fields like `editorIds`, `viewerIds` — it doesn’t scale

---

If you’d like, I can give you:

* A PocketBase schema definition (JSON)
* A helper that syncs `data.users` → `users[]`
* Sample permission check code for client or hooks

Let me know which part you'd like to build next.




PocketBase collection 'code' 
js code stored in code like 
pb.collection('code').create({
  code: "console.log('code');",
  schema: { type: "form", fields: ["question"] },
  data: { question: "What is your name?" }
});

schema is Frappe json: 
{
 "actions": [],
 "allow_import": 1,
 "autoname": "TASK-.YYYY.-.#####",
 "creation": "2013-01-29 19:25:50",
 "doctype": "DocType",
 "document_type": "Setup",
 "engine": "InnoDB",
 "field_order": [
  "subject",
  "project",
  "issue",
  "type",
  "color",
  "is_group",
  "is_template",
  "column_break0",
  "status",
  "priority",
  "task_weight",
  "parent_task",
  "completed_by",
  "completed_on",
  "sb_timeline",
  "exp_start_date",
  "expected_time",
  "start",
  "column_break_11",
  "exp_end_date",
  "progress",
  "duration",
  "is_milestone",
  "sb_details",
  "description",
  "sb_depends_on",
  "depends_on",
  "depends_on_tasks",
  "sb_actual",
  "act_start_date",
  "actual_time",
  "column_break_15",
  "act_end_date",
  "sb_costing",
  "total_costing_amount",
  "column_break_20",
  "total_billing_amount",
  "sb_more_info",
  "review_date",
  "closing_date",
  "column_break_22",
  "department",
  "company",
  "lft",
  "rgt",
  "old_parent",
  "template_task"
 ],
 "fields": [
  {
   "allow_in_quick_entry": 1,
   "fieldname": "subject",
   "fieldtype": "Data",
   "in_global_search": 1,
   "in_standard_filter": 1,
   "label": "Subject",
   "reqd": 1,
   "search_index": 1
  },
  {
   "allow_in_quick_entry": 1,
   "bold": 1,
   "fieldname": "project",
   "fieldtype": "Link",
   "in_global_search": 1,
   "in_list_view": 1,
   "in_standard_filter": 1,
   "label": "Project",
   "oldfieldname": "project",
   "oldfieldtype": "Link",
   "options": "Project",
   "remember_last_selected_value": 1,
   "search_index": 1
  },
  {
   "fieldname": "issue",
   "fieldtype": "Link",
   "label": "Issue",
   "options": "Issue"
  },
  {
   "fieldname": "type",
   "fieldtype": "Link",
   "label": "Type",
   "options": "Task Type"
  },
  {
   "bold": 1,
   "default": "0",
   "fieldname": "is_group",
   "fieldtype": "Check",
   "in_list_view": 1,
   "label": "Is Group"
  },
  {
   "fieldname": "column_break0",
   "fieldtype": "Column Break",
   "oldfieldtype": "Column Break",
   "print_width": "50%",
   "width": "50%"
  },
  {
   "bold": 1,
   "fieldname": "status",
   "fieldtype": "Select",
   "in_list_view": 1,
   "in_standard_filter": 1,
   "label": "Status",
   "no_copy": 1,
   "oldfieldname": "status",
   "oldfieldtype": "Select",
   "options": "Open\nWorking\nPending Review\nOverdue\nTemplate\nCompleted\nCancelled"
  },
  {
   "fieldname": "priority",
   "fieldtype": "Select",
   "in_list_view": 1,
   "in_standard_filter": 1,
   "label": "Priority",
   "oldfieldname": "priority",
   "oldfieldtype": "Select",
   "options": "Low\nMedium\nHigh\nUrgent",
   "search_index": 1
  },
  {
   "fieldname": "color",
   "fieldtype": "Color",
   "label": "Color"
  },
  {
   "bold": 1,
   "fieldname": "parent_task",
   "fieldtype": "Link",
   "ignore_user_permissions": 1,
   "label": "Parent Task",
   "options": "Task",
   "search_index": 1
  },
  {
   "collapsible": 1,
   "collapsible_depends_on": "exp_start_date",
   "fieldname": "sb_timeline",
   "fieldtype": "Section Break",
   "label": "Timeline"
  },
  {
   "bold": 1,
   "fieldname": "exp_start_date",
   "fieldtype": "Datetime",
   "label": "Expected Start Date",
   "oldfieldname": "exp_start_date",
   "oldfieldtype": "Date"
  },
  {
   "default": "0",
   "fieldname": "expected_time",
   "fieldtype": "Float",
   "label": "Expected Time (in hours)",
   "oldfieldname": "exp_total_hrs",
   "oldfieldtype": "Data"
  },
  {
   "fetch_from": "type.weight",
   "fieldname": "task_weight",
   "fieldtype": "Float",
   "label": "Weight"
  },
  {
   "fieldname": "column_break_11",
   "fieldtype": "Column Break"
  },
  {
   "bold": 1,
   "fieldname": "exp_end_date",
   "fieldtype": "Datetime",
   "label": "Expected End Date",
   "oldfieldname": "exp_end_date",
   "oldfieldtype": "Date",
   "search_index": 1
  },
  {
   "fieldname": "progress",
   "fieldtype": "Percent",
   "label": "% Progress",
   "no_copy": 1
  },
  {
   "default": "0",
   "fieldname": "is_milestone",
   "fieldtype": "Check",
   "in_list_view": 1,
   "label": "Is Milestone"
  },
  {
   "fieldname": "sb_details",
   "fieldtype": "Section Break",
   "label": "Details",
   "oldfieldtype": "Section Break"
  },
  {
   "fieldname": "description",
   "fieldtype": "Text Editor",
   "label": "Task Description",
   "oldfieldname": "description",
   "oldfieldtype": "Text Editor",
   "print_width": "300px",
   "width": "300px"
  },
  {
   "fieldname": "sb_depends_on",
   "fieldtype": "Section Break",
   "label": "Dependencies",
   "oldfieldtype": "Section Break"
  },
  {
   "fieldname": "depends_on",
   "fieldtype": "Table",
   "label": "Dependent Tasks",
   "options": "Task Depends On"
  },
  {
   "fieldname": "depends_on_tasks",
   "fieldtype": "Code",
   "hidden": 1,
   "label": "Depends on Tasks",
   "read_only": 1
  },
  {
   "fieldname": "sb_actual",
   "fieldtype": "Section Break",
   "oldfieldtype": "Column Break",
   "print_width": "50%",
   "width": "50%"
  },
  {
   "fieldname": "act_start_date",
   "fieldtype": "Date",
   "label": "Actual Start Date (via Timesheet)",
   "oldfieldname": "act_start_date",
   "oldfieldtype": "Date",
   "read_only": 1
  },
  {
   "fieldname": "actual_time",
   "fieldtype": "Float",
   "label": "Actual Time in Hours (via Timesheet)",
   "read_only": 1
  },
  {
   "fieldname": "column_break_15",
   "fieldtype": "Column Break"
  },
  {
   "fieldname": "act_end_date",
   "fieldtype": "Date",
   "label": "Actual End Date (via Timesheet)",
   "oldfieldname": "act_end_date",
   "oldfieldtype": "Date",
   "read_only": 1
  },
  {
   "collapsible": 1,
   "fieldname": "sb_costing",
   "fieldtype": "Section Break",
   "label": "Costing"
  },
  {
   "fieldname": "total_costing_amount",
   "fieldtype": "Currency",
   "label": "Total Costing Amount (via Timesheet)",
   "oldfieldname": "actual_budget",
   "oldfieldtype": "Currency",
   "options": "Company:company:default_currency",
   "read_only": 1
  },
  {
   "fieldname": "column_break_20",
   "fieldtype": "Column Break"
  },
  {
   "fieldname": "total_billing_amount",
   "fieldtype": "Currency",
   "label": "Total Billable Amount (via Timesheet)",
   "read_only": 1
  },
  {
   "collapsible": 1,
   "fieldname": "sb_more_info",
   "fieldtype": "Section Break",
   "label": "More Info"
  },
  {
   "depends_on": "eval:doc.status == \"Closed\" || doc.status == \"Pending Review\"",
   "fieldname": "review_date",
   "fieldtype": "Date",
   "label": "Review Date",
   "oldfieldname": "review_date",
   "oldfieldtype": "Date"
  },
  {
   "depends_on": "eval:doc.status == \"Closed\"",
   "fieldname": "closing_date",
   "fieldtype": "Date",
   "label": "Closing Date",
   "oldfieldname": "closing_date",
   "oldfieldtype": "Date"
  },
  {
   "fieldname": "column_break_22",
   "fieldtype": "Column Break"
  },
  {
   "fieldname": "department",
   "fieldtype": "Link",
   "label": "Department",
   "options": "Department"
  },
  {
   "fetch_from": "project.company",
   "fieldname": "company",
   "fieldtype": "Link",
   "label": "Company",
   "options": "Company",
   "remember_last_selected_value": 1
  },
  {
   "fieldname": "lft",
   "fieldtype": "Int",
   "hidden": 1,
   "label": "lft",
   "read_only": 1
  },
  {
   "fieldname": "rgt",
   "fieldtype": "Int",
   "hidden": 1,
   "label": "rgt",
   "read_only": 1
  },
  {
   "fieldname": "old_parent",
   "fieldtype": "Data",
   "hidden": 1,
   "ignore_user_permissions": 1,
   "label": "Old Parent",
   "read_only": 1
  },
  {
   "depends_on": "eval: doc.status == \"Completed\"",
   "fieldname": "completed_by",
   "fieldtype": "Link",
   "label": "Completed By",
   "no_copy": 1,
   "options": "User"
  },
  {
   "default": "0",
   "fieldname": "is_template",
   "fieldtype": "Check",
   "label": "Is Template"
  },
  {
   "depends_on": "is_template",
   "fieldname": "start",
   "fieldtype": "Int",
   "label": "Begin On (Days)"
  },
  {
   "depends_on": "is_template",
   "fieldname": "duration",
   "fieldtype": "Int",
   "label": "Duration (Days)"
  },
  {
   "depends_on": "eval: doc.status == \"Completed\"",
   "fieldname": "completed_on",
   "fieldtype": "Date",
   "label": "Completed On",
   "mandatory_depends_on": "eval: doc.status == \"Completed\""
  },
  {
   "fieldname": "template_task",
   "fieldtype": "Data",
   "hidden": 1,
   "label": "Template Task"
  }
 ],
 "icon": "fa fa-check",
 "idx": 1,
 "is_tree": 1,
 "links": [],
 "max_attachments": 5,
 "modified": "2024-05-24 12:36:12.214577",
 "modified_by": "Administrator",
 "module": "Projects",
 "name": "Task",
 "naming_rule": "Expression (old style)",
 "nsm_parent_field": "parent_task",
 "owner": "Administrator",
 "permissions": [
  {
   "create": 1,
   "delete": 1,
   "email": 1,
   "print": 1,
   "read": 1,
   "report": 1,
   "role": "Projects User",
   "share": 1,
   "write": 1
  }
 ],
 "quick_entry": 1,
 "search_fields": "subject",
 "show_name_in_global_search": 1,
 "show_preview_popup": 1,
 "sort_field": "creation",
 "sort_order": "DESC",
 "states": [],
 "timeline_field": "project",
 "title_field": "subject",
 "track_seen": 1
}

execution on client like:
currentRecord = await pb.collection('code').getOne(recordId); 
eval(currentRecord.code);

so architecure is 
1) user saving widget code in currentRecord.code (mostly React code)
2) user saving schema in currentRecord.schema
3) browser renders it, after user click on Save button, it goes to currentRecord.data

currentRecord.data is 

other

search 

const tasks2 = pb.collection('items').getFullList({
  filter: 'data.project ~ "[a-z0-9]{15}"'
});
<!--Parent child-->

-Issue in initial version: 
links child->parent was establblished in items.data field "project": "xh1o0yu55vlorl5", from items.schema like: (items.data): 

{
  "act_end_date": "",
  "act_start_date": "",
  "actual_time": "",
  "closing_date": "",
  "color": "",
  "company": "",
  "completed_by": "",
  "completed_on": "",
  "department": "",
  "depends_on": "",
  "description": "Edited 2",
  "duration": "",
  "exp_end_date": "2025-07-09T11:30",
  "exp_start_date": "2025-07-10T11:58",
  "expected_time": "",
  "is_group": false,
  "is_milestone": false,
  "is_template": false,
  "issue": "",
  "name": "Task",
  "parent_task": "",
  "priority": "High",
  "progress": "",
  "project": "xh1o0yu55vlorl5",
  "review_date": "",
  "start": "",
  "status": "Pending Review",
  "subject": "Task2 - the same project",
  "task_weight": "",
  "total_billing_amount": "",
  "total_costing_amount": "",
  "type": ""
}

with part of code: 

(function() {
  const recordId = window.WIDGET_RECORD_ID;
  const pb = window.pb;
  
  async function init() {
    const currentRecord = await pb.collection('items').getOne(recordId);
    window.currentRecord = currentRecord;
    window.schema = currentRecord.schema;
    window.initialData = currentRecord.data || {};
    renderTaskForm();
  }
  
  function renderTaskForm() {
    const containerId = 'widgetContainer';
    const schema = window.schema;
    const initialData = window.initialData || {};
    const recordId = window.currentRecord?.id;
    
    async function renderForm(schema, data = {}, containerId) {
      const fields = schema.fields || [];
      const fieldOrder = schema.field_order || [];
      const container = document.getElementById(containerId);
      container.innerHTML = '';
      const fieldMap = Object.fromEntries(fields.map(f => [f.fieldname, f]));
      
      for (const fieldname of fieldOrder) {
        const field = fieldMap[fieldname];
        if (!field || field.hidden) continue;
        if (['Section Break', 'Column Break'].includes(field.fieldtype)) continue;
        
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';
        
        const label = document.createElement('label');
        label.innerText = field.label || fieldname;
        
        let input;
        
        switch (field.fieldtype) {
          case 'Data':
          case 'Int':
          case 'Float':
          case 'Currency':
            input = document.createElement('input');
            input.type = 'text';
            break;
            
          case 'Link':
            input = document.createElement('select');
            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.innerText = '-- Select --';
            input.appendChild(emptyOption);
            
            // If field has options, fetch records where data.name matches options
            if (field.options) {
              try {
                const records = await pb.collection('items').getFullList({
                  filter: `data.name = "${field.options}"`
                });
                
                records.forEach(record => {
                  const option = document.createElement('option');
                  option.value = record.id;
                  option.innerText = record.data.name || record.id;
                  input.appendChild(option);
                });
              } catch (error) {
                console.error(`Error fetching options for ${field.fieldname}:`, error);
              }
            }
            break;
            
          case 'Text Editor':
            input = document.createElement('textarea');
            break;
            
          case 'Date':
          case 'Datetime':
            input = document.createElement('input');
            input.type = 'datetime-local';
            break;
            
          case 'Check':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!data[field.fieldname];
            break;
            
          case 'Select':
            input = document.createElement('select');
            const options = (field.options || '').split('\n');
            options.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt;
              option.innerText = opt;
              input.appendChild(option);
            });
            input.value = data[field.fieldname] || '';
            break;
            
          case 'Percent':
            input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 100;
            break;
            
          default:
            input = document.createElement('input');
            input.type = 'text';
        }
        
        input.name = field.fieldname;
        input.id = field.fieldname;
        
        if (field.fieldtype !== 'Check' && data[field.fieldname]) {
          input.value = data[field.fieldname];
        }
        
        wrapper.appendChild(label);
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(input);
        container.appendChild(wrapper);
      }
    }
    
    function getFormData(schema) {
      const result = {};
      (schema.fields || []).forEach(field => {
        if (!field || field.hidden) return;
        const el = document.getElementById(field.fieldname);
        if (!el) return;
        
        if (field.fieldtype === 'Check') {
          result[field.fieldname] = el.checked;
        } else {
          result[field.fieldname] = el.value;
        }
      });
      return result;
    }
    
    async function saveData() {
      const formData = getFormData(schema);
      
      // Always preserve the record name from the schema
      formData.name = window.currentRecord.schema.name;
      
      await pb.collection('items').update(recordId, { data: formData });
      alert('Form data saved.');
    }
    
    // Initial render (now async)
    renderForm(schema, initialData, containerId).then(() => {
      // Add save button after form is rendered
      const saveBtn = document.createElement('button');
      saveBtn.innerText = 'Save';
      saveBtn.onclick = saveData;
      document.getElementById(containerId).appendChild(saveBtn);
    });
  }
  
  // Initialize
  init();
})();

<!--Replaced by https://claude.ai/chat/36bfd7ec-ffd5-4e8c-8497-ed8d0ed62f61 v4-->

(function() {
  const recordId = window.WIDGET_RECORD_ID;
  const pb = window.pb;
  
  async function init() {
    const currentRecord = await pb.collection('items').getOne(recordId);
    window.currentRecord = currentRecord;
    window.schema = currentRecord.schema;
    window.initialData = currentRecord.data || {};
    renderTaskForm();
  }
  
  function renderTaskForm() {
    const containerId = 'widgetContainer';
    const schema = window.schema;
    const initialData = window.initialData || {};
    const recordId = window.currentRecord?.id;
    
    async function renderForm(schema, data = {}, containerId) {
      const fields = schema.fields || [];
      const fieldOrder = schema.field_order || [];
      const container = document.getElementById(containerId);
      container.innerHTML = '';
      const fieldMap = Object.fromEntries(fields.map(f => [f.fieldname, f]));
      
      for (const fieldname of fieldOrder) {
        const field = fieldMap[fieldname];
        if (!field || field.hidden) continue;
        if (['Section Break', 'Column Break'].includes(field.fieldtype)) continue;
        
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';
        
        const label = document.createElement('label');
        label.innerText = field.label || fieldname;
        
        let input;
        
        switch (field.fieldtype) {
          case 'Data':
          case 'Int':
          case 'Float':
          case 'Currency':
            input = document.createElement('input');
            input.type = 'text';
            break;
            
          case 'Link':
            input = document.createElement('select');
            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.innerText = '-- Select --';
            input.appendChild(emptyOption);
            
            // If field has options, fetch records where data.name matches options
            if (field.options) {
              try {
                const records = await pb.collection('items').getFullList({
                  filter: `data.name = "${field.options}"`
                });
                
                records.forEach(record => {
                  const option = document.createElement('option');
                  // Store the record ID as value, but we'll change the field name during save
                  option.value = record.id;
                  option.innerText = record.data.name || record.id;
                  // Store the parent name for later use
                  option.setAttribute('data-parent-name', record.data.name);
                  input.appendChild(option);
                });
              } catch (error) {
                console.error(`Error fetching options for ${field.fieldname}:`, error);
              }
            }
            break;
            
          case 'Text Editor':
            input = document.createElement('textarea');
            break;
            
          case 'Date':
          case 'Datetime':
            input = document.createElement('input');
            input.type = 'datetime-local';
            break;
            
          case 'Check':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!data[field.fieldname];
            break;
            
          case 'Select':
            input = document.createElement('select');
            const options = (field.options || '').split('\n');
            options.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt;
              option.innerText = opt;
              input.appendChild(option);
            });
            input.value = data[field.fieldname] || '';
            break;
            
          case 'Percent':
            input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 100;
            break;
            
          default:
            input = document.createElement('input');
            input.type = 'text';
        }
        
        input.name = field.fieldname;
        input.id = field.fieldname;
        
        if (field.fieldtype !== 'Check' && data[field.fieldname]) {
          input.value = data[field.fieldname];
        }
        
        wrapper.appendChild(label);
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(input);
        container.appendChild(wrapper);
      }
    }
    
    function getFormData(schema) {
      const result = {};
      (schema.fields || []).forEach(field => {
        if (!field || field.hidden) return;
        const el = document.getElementById(field.fieldname);
        if (!el) return;
        
        if (field.fieldtype === 'Check') {
          result[field.fieldname] = el.checked;
        } else if (field.fieldtype === 'Link' && el.value) {
          // For Link fields, get the selected option and its parent name
          const selectedOption = el.options[el.selectedIndex];
          if (selectedOption && selectedOption.getAttribute('data-parent-name')) {
            const parentName = selectedOption.getAttribute('data-parent-name');
            const fieldName = `parent_id_${parentName.toLowerCase()}`;
            result[fieldName] = el.value; // Store the record ID
          }
        } else {
          result[field.fieldname] = el.value;
        }
      });
      return result;
    }
    
    async function saveData() {
      const formData = getFormData(schema);
      
      // Always preserve the record name from the schema
      formData.name = window.currentRecord.schema.name;
      
      await pb.collection('items').update(recordId, { data: formData });
      alert('Form data saved.');
    }
    
    // Initial render (now async)
    renderForm(schema, initialData, containerId).then(() => {
      // Add save button after form is rendered
      const saveBtn = document.createElement('button');
      saveBtn.innerText = 'Save';
      saveBtn.onclick = saveData;
      document.getElementById(containerId).appendChild(saveBtn);
    });
  }
  
  // Initialize
  init();
})();

<!--Example of v4-->
async function getChildrenByParent(parentId) {
  // Get the parent record to determine its type
  const parentRecord = await pb.collection('items').getOne(parentId);
  const parentType = parentRecord.data.name.toLowerCase(); // assuming data.name contains the type
  
  const filter = `data.parent_id_${parentType} = "${parentId}"`;
  return await pb.collection('items').getFullList({ filter });
}

// Usage - just need the parent ID
const children = await getChildrenByParent("xh1o0yu55vlorl5");

<!--added child table--->
(function() {
  const recordId = window.WIDGET_RECORD_ID;
  const pb = window.pb;
  
  async function init() {
    const currentRecord = await pb.collection('items').getOne(recordId);
    window.currentRecord = currentRecord;
    window.schema = currentRecord.schema;
    window.initialData = currentRecord.data || {};
    renderTaskForm();
  }
  
  function renderTaskForm() {
    const containerId = 'widgetContainer';
    const schema = window.schema;
    const initialData = window.initialData || {};
    const recordId = window.currentRecord?.id;
    
    async function renderForm(schema, data = {}, containerId) {
      const fields = schema.fields || [];
      const fieldOrder = schema.field_order || [];
      const container = document.getElementById(containerId);
      container.innerHTML = '';
      const fieldMap = Object.fromEntries(fields.map(f => [f.fieldname, f]));
      
      for (const fieldname of fieldOrder) {
        const field = fieldMap[fieldname];
        if (!field || field.hidden) continue;
        if (['Section Break', 'Column Break'].includes(field.fieldtype)) continue;
        
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';
        
        const label = document.createElement('label');
        label.innerText = field.label || fieldname;
        
        let input;
        
        switch (field.fieldtype) {
          case 'Data':
          case 'Int':
          case 'Float':
          case 'Currency':
            input = document.createElement('input');
            input.type = 'text';
            break;
            
          case 'Link':
            input = document.createElement('select');
            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.innerText = '-- Select --';
            input.appendChild(emptyOption);
            
            // If field has options, fetch records where data.name matches options
            if (field.options) {
              try {
                const records = await pb.collection('items').getFullList({
                  filter: `data.name = "${field.options}"`
                });
                
                records.forEach(record => {
                  const option = document.createElement('option');
                  // Store the record ID as value, but we'll change the field name during save
                  option.value = record.id;
                  option.innerText = record.data.name || record.id;
                  // Store the parent name for later use
                  option.setAttribute('data-parent-name', record.data.name);
                  input.appendChild(option);
                });
              } catch (error) {
                console.error(`Error fetching options for ${field.fieldname}:`, error);
              }
            }
            break;
            
          case 'Text Editor':
            input = document.createElement('textarea');
            break;
            
          case 'Date':
          case 'Datetime':
            input = document.createElement('input');
            input.type = 'datetime-local';
            break;
            
          case 'Check':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!data[field.fieldname];
            break;
            
          case 'Select':
            input = document.createElement('select');
            const options = (field.options || '').split('\n');
            options.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt;
              option.innerText = opt;
              input.appendChild(option);
            });
            input.value = data[field.fieldname] || '';
            break;
            
          case 'Percent':
            input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 100;
            break;
            
          default:
            input = document.createElement('input');
            input.type = 'text';
        }
        
        input.name = field.fieldname;
        input.id = field.fieldname;
        
        if (field.fieldtype !== 'Check' && data[field.fieldname]) {
          input.value = data[field.fieldname];
        }
        
        wrapper.appendChild(label);
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(input);
        container.appendChild(wrapper);
      }
    }
    
    function getFormData(schema) {
      const result = {};
      (schema.fields || []).forEach(field => {
        if (!field || field.hidden) return;
        const el = document.getElementById(field.fieldname);
        if (!el) return;
        
        if (field.fieldtype === 'Check') {
          result[field.fieldname] = el.checked;
        } else if (field.fieldtype === 'Link' && el.value) {
          // For Link fields, get the selected option and its parent name
          const selectedOption = el.options[el.selectedIndex];
          if (selectedOption && selectedOption.getAttribute('data-parent-name')) {
            const parentName = selectedOption.getAttribute('data-parent-name');
            const fieldName = `parent_id_${parentName.toLowerCase()}`;
            result[fieldName] = el.value; // Store the record ID
          }
        } else {
          result[field.fieldname] = el.value;
        }
      });
      return result;
    }
    
    async function getChildrenByParent(parentId) {
      // Get the parent record to determine its type
      const parentRecord = await pb.collection('items').getOne(parentId);
      const parentType = parentRecord.data.name.toLowerCase();
      
      const filter = `data.parent_id_${parentType} = "${parentId}"`;
      return await pb.collection('items').getFullList({ filter });
    }
    
    async function renderChildrenTable(parentId, containerId) {
      try {
        const children = await getChildrenByParent(parentId);
        
        if (children.length === 0) {
          return; // No children to display
        }
        
        // Group children by their data.name (type)
        const groupedChildren = {};
        children.forEach(child => {
          const childType = child.data.name || 'Unknown';
          if (!groupedChildren[childType]) {
            groupedChildren[childType] = [];
          }
          groupedChildren[childType].push(child);
        });
        
        const container = document.getElementById(containerId);
        
        // Create children section
        const childrenSection = document.createElement('div');
        childrenSection.style.marginTop = '30px';
        childrenSection.style.borderTop = '2px solid #ccc';
        childrenSection.style.paddingTop = '20px';
        
        const title = document.createElement('h3');
        title.innerText = 'Related Records';
        title.style.marginBottom = '15px';
        childrenSection.appendChild(title);
        
        // Create table for each group
        Object.keys(groupedChildren).forEach(groupName => {
          const group = groupedChildren[groupName];
          
          const groupTitle = document.createElement('h4');
          groupTitle.innerText = `${groupName} (${group.length})`;
          groupTitle.style.marginTop = '20px';
          groupTitle.style.marginBottom = '10px';
          childrenSection.appendChild(groupTitle);
          
          const table = document.createElement('table');
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.style.marginBottom = '20px';
          
          // Create table header
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          
          // Get all unique field names from the group
          const allFields = new Set();
          group.forEach(item => {
            if (item.data) {
              Object.keys(item.data).forEach(key => {
                if (key !== 'name' && !key.startsWith('parent_id_')) {
                  allFields.add(key);
                }
              });
            }
          });
          
          // Add ID column
          const idHeader = document.createElement('th');
          idHeader.innerText = 'ID';
          idHeader.style.border = '1px solid #ddd';
          idHeader.style.padding = '8px';
          idHeader.style.backgroundColor = '#f2f2f2';
          headerRow.appendChild(idHeader);
          
          // Add field columns
          allFields.forEach(field => {
            const th = document.createElement('th');
            th.innerText = field;
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);
          });
          
          thead.appendChild(headerRow);
          table.appendChild(thead);
          
          // Create table body
          const tbody = document.createElement('tbody');
          
          group.forEach(item => {
            const row = document.createElement('tr');
            
            // ID column
            const idCell = document.createElement('td');
            idCell.innerText = item.id;
            idCell.style.border = '1px solid #ddd';
            idCell.style.padding = '8px';
            row.appendChild(idCell);
            
            // Field columns
            allFields.forEach(field => {
              const cell = document.createElement('td');
              cell.innerText = item.data[field] || '';
              cell.style.border = '1px solid #ddd';
              cell.style.padding = '8px';
              row.appendChild(cell);
            });
            
            tbody.appendChild(row);
          });
          
          table.appendChild(tbody);
          childrenSection.appendChild(table);
        });
        
        container.appendChild(childrenSection);
        
      } catch (error) {
        console.error('Error rendering children table:', error);
      }
    }
    
    async function saveData() {
      const formData = getFormData(schema);
      
      // Always preserve the record name from the schema
      formData.name = window.currentRecord.schema.name;
      
      await pb.collection('items').update(recordId, { data: formData });
      alert('Form data saved.');
    }
    
    // Initial render (now async)
    renderForm(schema, initialData, containerId).then(async () => {
      // Add save button after form is rendered
      const saveBtn = document.createElement('button');
      saveBtn.innerText = 'Save';
      saveBtn.onclick = saveData;
      document.getElementById(containerId).appendChild(saveBtn);
      
      // Render children table
      await renderChildrenTable(recordId, containerId);
    });
  }
  
  // Initialize
  init();
})();

- Sets of documents 

I couldn't find any evidence of an official discussion or feature request in ERPNext forums or GitHub proposing a **universal "document set" or "collection" type** that could group arbitrary documents with quantities or metadata. The approach you're advocating is still best implemented as a **custom doctype or app**, rather than a native ERPNext feature. Here’s what I found:

---

### 🔍 Search Results

* **GitHub Issue #29226**: A year ago someone requested the ability to *change a document's doctype on the fly* (for GTD-style workflows), suggesting higher flexibility — but that idea was closed without expanding into a general collection mechanism ([github.com][1]).
* **Forum & Reddit posts**: Many discussions on customizing doctypes, linking documents, or creating wrappers, but nothing about a universal set-of-documents doctype .

---

### 🚧 Conclusion

ERPNext doesn't include any form of built-in **generic set or collection doctype** that can reference multiple other document types with quantities or metadata.

---

### ✅ Your Best Course of Action

To implement this fully and cleanly:

1. **Create a custom doctype**, e.g., `Document Set`, with a **Link to Doctype**.
2. Add a child table `Document Set Entry` with:

   * `docname` (Data or Dynamic Link)
   * `doctype_name`
   * `qty`
   * `meta_json` (optional)
3. If needed, add a script or button to **expand or apply the set** into another document (like Sales Order, Task List, etc.).

This gives you the **flexibility and reusability** you want, and it neatly sidesteps the lack of native support in ERPNext.

---

Would you like me to draft the JSON schema and example scripts for this kind of universal collection mechanism?

[1]: https://github.com/frappe/erpnext/issues/29226?utm_source=chatgpt.com "Change Doctype · Issue #29226 · frappe/erpnext · GitHub"

---
Single query
"in_list_view": 1// SINGLE QUERY MINIMAL VERSION
(async () => {
  const pb = new PocketBase('http://127.0.0.1:8090');
  const itemSetId = 'SET-2025-00001';
  
  // ONE QUERY TO GET EVERYTHING
  const docs = await pb.collection('item').getFullList(1000, {
    filter: `(name="${itemSetId}" && doctype="Item Set") || 
             (data.parent="${itemSetId}" && doctype="Line Item" && data.parenttype="Item Set") ||
             (doctype="Item Price" && data.selling=1)`
  });
  
  // Separate and build lookups
  const itemSet = docs.find(d => d.name === itemSetId && d.doctype === "Item Set");
  const lineItems = docs.filter(d => d.doctype === "Line Item");
  const prices = new Map(docs.filter(d => d.doctype === "Item Price")
    .map(p => [p.data.item_code, p]));
  
  // Get child names and fetch them
  const childNames = [...new Set(lineItems.map(l => l.data.child).filter(Boolean))];
  const childDocs = childNames.length ? await pb.collection('item').getFullList(200, {
    filter: childNames.map(name => `name="${name}"`).join(' || ')
  }) : [];
  
  const childMap = new Map(childDocs.map(d => [d.name, d]));
  
  // Resolve
  const resolvedLineItems = lineItems.map(line => ({
    lineItem: line,
    childDoc: childMap.get(line.data.child) || null,
    priceEntry: line.data.is_priced && childMap.get(line.data.child) ? 
      prices.get(childMap.get(line.data.child).data?.item_code || childMap.get(line.data.child).name) || null : null
  }));
  
  console.log(JSON.stringify({ itemSet, lineItems: resolvedLineItems }, null, 2));
})();
Promise {<pending>}
VM286:35 {
  "itemSet": {
    "collectionId": "pbc_940982958",
    "collectionName": "item",
    "created": "2025-07-15 18:05:17.242Z",
    "data": {
      "doctype": "Item Set",
      "name": "SET-2025-00001",
      "set_name": "Brake Service Kit",
      "price_list": "Retail USD",
      "item_group": "Brakes"
    },
    "doctype": "Item Set",
    "id": "3susp3yzbzadsjo",
    "meta": null,
    "name": "SET-2025-00001",
    "updated": "2025-07-15 18:05:17.242Z"
  },
  "lineItems": [
    {
      "lineItem": {
        "collectionId": "pbc_940982958",
        "collectionName": "item",
        "created": "2025-07-15 18:09:25.618Z",
        "data": {
          "doctype": "Line Item",
          "name": "LINE-2025-00001",
          "parent": "SET-2025-00001",
          "parenttype": "Item Set",
          "parentfield": "entries",
          "doctype_name": "Task",
          "child": "TASK-2025-00027",
          "qty": 1,
          "is_priced": 0,
          "price": null,
          "label": "Front Brake Insp"
        },
        "doctype": "Line Item",
        "id": "frfn79vl8eo3kb8",
        "meta": null,
        "name": "LINE-2025-00001",
        "updated": "2025-07-15 18:12:11.015Z"
      },
      "childDoc": {
        "collectionId": "pbc_940982958",
        "collectionName": "item",
        "created": "2025-07-12 20:43:08.625Z",
        "data": {
          "_assign": null,
          "_comments": null,
          "_liked_by": null,
          "_seen": "[\"Administrator\"]",
          "_user_tags": null,
          "act_end_date": null,
          "act_start_date": null,
          "actual_time": 0,
          "closing_date": null,
          "color": "#39E4A5",
          "company": "Expo (Demo)",
          "completed_by": null,
          "completed_on": null,
          "creation": "2025-06-11 12:34:12.818353",
          "custom_attach": null,
          "custom_itemgroup": null,
          "custom_new_check": 0,
          "department": null,
          "depends_on_tasks": "",
          "description": "<div class=\"ql-editor read-mode\"><p><img src=\"/private/files/vYfr6wt.jpg?fid=3e162b69a8\" style=\"\" width=\"272\"></p></div>",
          "docstatus": 0,
          "duration": 0,
          "exp_end_date": "2025-06-11",
          "exp_start_date": "2025-06-11",
          "expected_time": 0,
          "idx": 1,
          "is_group": 1,
          "is_milestone": 0,
          "is_template": 0,
          "issue": null,
          "lft": 53,
          "modified": "2025-06-11 21:28:44.330211",
          "modified_by": "Administrator",
          "name": "TASK-2025-00027",
          "old_parent": "",
          "owner": "Administrator",
          "parent_task": null,
          "priority": "Low",
          "progress": 0,
          "project": "PROJ-0009",
          "project_code": null,
          "review_date": null,
          "rgt": 54,
          "start": 0,
          "status": "Overdue",
          "subject": "Interior inspections for 18-point inspections",
          "task_code": null,
          "task_weight": 0,
          "template_task": "TASK-2025-00020",
          "total_billing_amount": 0,
          "total_costing_amount": 0,
          "total_expense_claim": 0,
          "type": null,
          "workflow_state": null
        },
        "doctype": "Task",
        "id": "a8a3vvdb2zf6bun",
        "meta": {
          "doctype": "Task",
          "schema": "SCHEMA-0001"
        },
        "name": "TASK-2025-00027",
        "updated": "2025-07-14 14:13:28.014Z"
      },
      "priceEntry": null
    },
    {
      "lineItem": {
        "collectionId": "pbc_940982958",
        "collectionName": "item",
        "created": "2025-07-15 18:11:48.137Z",
        "data": {
          "doctype": "Line Item",
          "name": "LINE-2025-00002",
          "parent": "SET-2025-00001",
          "parenttype": "Item Set",
          "parentfield": "entries",
          "doctype_name": "Item",
          "child": "SKU009",
          "qty": 2,
          "is_priced": 1,
          "price": 120,
          "label": "Brake Pad Set"
        },
        "doctype": "Line Item",
        "id": "swploj8bmxjpxrq",
        "meta": null,
        "name": "LINE-2025-00002",
        "updated": "2025-07-15 18:12:19.435Z"
      },
      "childDoc": {
        "collectionId": "pbc_940982958",
        "collectionName": "item",
        "created": "2025-07-15 16:13:10.445Z",
        "data": {
          "_assign": null,
          "_comments": null,
          "_liked_by": null,
          "_user_tags": null,
          "allow_alternative_item": 0,
          "allow_negative_stock": 0,
          "asset_category": null,
          "asset_naming_series": null,
          "auto_create_assets": 0,
          "batch_number_series": null,
          "brand": null,
          "country_of_origin": null,
          "create_new_batch": 0,
          "creation": "2025-04-14 12:43:43.558210",
          "custom_geolocation": null,
          "custom_projects": null,
          "customer": null,
          "customer_code": "",
          "customs_tariff_number": null,
          "default_bom": null,
          "default_item_manufacturer": null,
          "default_manufacturer_part_no": null,
          "default_material_request_type": "Purchase",
          "delivered_by_supplier": 0,
          "description": "Headphones",
          "disabled": 0,
          "docstatus": 0,
          "enable_deferred_expense": 0,
          "enable_deferred_revenue": 0,
          "end_of_life": "2099-12-31",
          "grant_commission": 1,
          "has_batch_no": 0,
          "has_expiry_date": 0,
          "has_serial_no": 0,
          "has_variants": 0,
          "idx": 0,
          "image": "https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg",
          "include_item_in_manufacturing": 1,
          "inspection_required_before_delivery": 0,
          "inspection_required_before_purchase": 0,
          "is_customer_provided_item": 0,
          "is_fixed_asset": 0,
          "is_grouped_asset": 0,
          "is_purchase_item": 1,
          "is_sales_item": 1,
          "is_stock_item": 1,
          "is_sub_contracted_item": 0,
          "item_code": "SKU009",
          "item_group": "Demo Item Group",
          "item_name": "Headphones",
          "last_purchase_rate": 700,
          "lead_time_days": 0,
          "max_discount": 0,
          "min_order_qty": 0,
          "modified": "2025-04-14 12:43:50.587212",
          "modified_by": "mbl.acc4@gmail.com",
          "name": "SKU009",
          "naming_series": "STO-ITEM-.YYYY.-",
          "no_of_months": 0,
          "no_of_months_exp": 0,
          "opening_stock": 0,
          "over_billing_allowance": 0,
          "over_delivery_receipt_allowance": 0,
          "owner": "mbl.acc4@gmail.com",
          "purchase_uom": null,
          "quality_inspection_template": null,
          "retain_sample": 0,
          "safety_stock": 0,
          "sales_uom": null,
          "sample_quantity": 0,
          "serial_no_series": null,
          "shelf_life_in_days": 0,
          "standard_rate": 0,
          "stock_uom": "Nos",
          "total_projected_qty": 0,
          "valuation_method": "",
          "valuation_rate": 700,
          "variant_based_on": "Item Attribute",
          "variant_of": null,
          "warranty_period": null,
          "weight_per_unit": 0,
          "weight_uom": null
        },
        "doctype": "Item",
        "id": "t1af6zbo95mp99r",
        "meta": {
          "doctype": "Item"
        },
        "name": "SKU009",
        "updated": "2025-07-15 16:13:10.445Z"
      },
      "priceEntry": {
        "collectionId": "pbc_940982958",
        "collectionName": "item",
        "created": "2025-07-15 16:17:46.360Z",
        "data": {
          "_assign": null,
          "_comments": null,
          "_liked_by": null,
          "_user_tags": null,
          "batch_no": null,
          "brand": null,
          "buying": 0,
          "creation": "2025-04-14 12:43:49.058814",
          "currency": "USD",
          "customer": null,
          "docstatus": 0,
          "idx": 0,
          "item_code": "SKU009",
          "item_description": "Headphones",
          "item_name": "Headphones",
          "lead_time_days": 0,
          "modified": "2025-04-14 12:43:49.058814",
          "modified_by": "mbl.acc4@gmail.com",
          "name": "k5i10fk8as",
          "note": null,
          "owner": "mbl.acc4@gmail.com",
          "packing_unit": 0,
          "price_list": "Standard Selling",
          "price_list_rate": 300,
          "reference": null,
          "selling": 1,
          "supplier": null,
          "uom": "Nos",
          "valid_from": "2025-04-14",
          "valid_upto": null
        },
        "doctype": "Item Price",
        "id": "jo9b3qrhz9j9qy8",
        "meta": {
          "doctype": "Item Price"
        },
        "name": "k5i10fk8as",
        "updated": "2025-07-15 16:17:46.360Z"
      }
    }
  ]
}
Client.ts:346 Fetch finished loading: GET "http://127.0.0.1:8090/api/collections/item/records?page=1&perPage=1000&skipTotal=1&filter=(name%3D%22SET-2025-00001%22%20%26%26%20doctype%3D%22Item%20Set%22)%20%7C%7C%20%0A%20%20%20%20%20%20%20%20%20%20%20%20%20(data.parent%3D%22SET-2025-00001%22%20%26%26%20doctype%3D%22Line%20Item%22%20%26%26%20data.parenttype%3D%22Item%20Set%22)%20%7C%7C%0A%20%20%20%20%20%20%20%20%20%20%20%20%20(doctype%3D%22Item%20Price%22%20%26%26%20data.selling%3D1)".
send @ Client.ts:346
getList @ CrudService.ts:80
getList @ RecordService.ts:196
request @ CrudService.ts:254
_getFullList @ CrudService.ts:268
getFullList @ CrudService.ts:39
getFullList @ RecordService.ts:180
(anonymous) @ VM286:7
(anonymous) @ VM286:36
Client.ts:346 Fetch finished loading: GET "http://127.0.0.1:8090/api/collections/item/records?page=1&perPage=200&skipTotal=1&filter=name%3D%22TASK-2025-00027%22%20%7C%7C%20name%3D%22SKU009%22".
send @ Client.ts:346
getList @ CrudService.ts:80
getList @ RecordService.ts:196
request @ CrudService.ts:254
_getFullList @ CrudService.ts:268
getFullList @ CrudService.ts:39
getFullList @ RecordService.ts:180
(anonymous) @ VM286:21
await in (anonymous)
(anonymous) @ VM286:36


Security
Excellent follow-up.

In the **embedded JSON approach** (e.g., `project` doc with embedded `tasks[]`), if you now want to **limit access to specific child elements** (e.g., only some tasks within a project), this gets trickier — because PocketBase cannot filter inside JSON arrays directly via access rules.

But let’s walk through the **real options**:

---

## ✅ Option 1: **Manually Filter Children on Read**

If your **access is per-project**, but child visibility varies **per user**, do this:

* **Store full list of children (e.g., `tasks[]`) inside the project**
* **Include access metadata per child**:

  ```json
  "tasks": [
    {
      "id": "task-1",
      "title": "Design",
      "allowed_users": ["user-a", "user-b"]
    },
    {
      "id": "task-2",
      "title": "Dev",
      "allowed_users": ["user-a"]
    }
  ]
  ```

Then:

* On the **server or client side**, filter out the child entries:

  ```js
  const visibleTasks = tasks.filter(task => task.allowed_users.includes(currentUserId))
  ```

This keeps everything in one parent doc and avoids denormalization — **but filtering happens in your application**, not inside PocketBase.

---

## 🚫 Option 2: **Filtering Inside JSON from PocketBase**

Does *not* work reliably — PocketBase does not support filtering like:

```sql
tasks[].allowed_users ?~ @request.auth.id
```

So you **cannot use access rules** to auto-filter children inside a JSON array.

---

## ✅ Option 3: **Split Children into Separate Documents (When Needed)**

If per-child permissions are core to your model (e.g., different users see different tasks), the cleanest approach is:

* Store `project` as one document
* Store `task` as separate documents with a `project_id` field
* Add `allowed_users` or `accessible_by` field to each task

Then:

```sql
doctype = "task" && accessible_by ?~ @request.auth.id
```

This is **the most flexible** solution for child-level permissions — but yes, you lose the single-document convenience.

---

## 🧠 Hybrid Strategy (Recommended for Many Cases)

* Store project + tasks in a single document for users who can see **all tasks**.
* If you need **per-user or per-role visibility** for children, switch that project to **"expanded mode"**:

  * Project stays a doc
  * Tasks break out into their own docs with proper access filters

In effect: **embedded-by-default**, **normalized-when-needed**.

---

## 🔐 Summary of Access Patterns

| Access Need                          | Best Approach                                   | Filtering Happens Where    |
| ------------------------------------ | ----------------------------------------------- | -------------------------- |
| Full access to parent and children   | Embedded JSON (`tasks[]`)                       | 1 query (project)          |
| Varying access per child             | Add `allowed_users` to each task                | App-side (filter manually) |
| Need to query/filter/search children | Separate documents                              | PocketBase filter          |
| Want mix of both                     | Hybrid: embed by default, normalize when needed | Both                       |

---

### Final Thoughts

Embedding is awesome when:

* You control access at the parent level
* You want speed and simplicity

But if you want **granular control over children**, you’ll either:

* Filter them manually after fetch
* Or store them separately with per-record access

---

Would you like a demo schema or script that does embedded filtering by user ID? Or would you prefer to explore hybrid setup code next?


Ah, now I understand the issue! Even in a single collection, you still need to enforce the hierarchical access control. You have tasks that belong to projects, and you only want tasks from projects you have access to.

In your single collection, you'd need to store the access control information at each level. For example:

```sql
// Instead of just storing the direct user
user = @request.auth.id

// You need to store the "effective owner" or access path
doctype = "task" && project_owner = @request.auth.id
```

**But this requires denormalization:**

When you create a task, you'd need to populate fields like:
- `project_id` (the project this task belongs to)
- `project_owner` (copied from the project document)
- `customer_id` (copied from the project's customer)
- `customer_owner` (copied from the customer document)

**Alternative approach - Use the project reference:**

If you store `project_id` on your tasks, you could try:
```sql
// This might work if PocketBase allows lookup within same collection
doctype = "task" && project_id.user = @request.auth.id
```

But I suspect PocketBase's same-collection relationship traversal might also be limited.

**Most practical solution:**
Denormalize the access control by storing the effective permissions directly on each document:

```sql
doctype = "task" && accessible_by ?~ @request.auth.id
```

Where `accessible_by` is an array populated with all users who should have access to this task (project owner, customer owner, etc.).

Is this the kind of access control structure you're dealing with?

# Other
## naming 

### entities withfield-based 

91 results - 87 files

accounts\doctype\accounting_dimension\accounting_dimension.json:
  2   "actions": [],
  3:  "autoname": "field:label",
  4   "creation": "2019-05-04 18:13:37.002352",

accounts\doctype\accounting_period\accounting_period.json:
  2   "actions": [],
  3:  "autoname": "field:period_name",
  4   "creation": "2018-04-13 18:50:14.672323",

accounts\doctype\bank\bank.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:bank_name",
  6   "creation": "2018-04-07 16:59:59.496668",

accounts\doctype\bank_account_subtype\bank_account_subtype.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:account_subtype",
  6   "creation": "2018-10-25 15:46:08.054586",

accounts\doctype\bank_account_type\bank_account_type.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:account_type",
  6   "creation": "2018-10-25 15:45:45.789963",

accounts\doctype\cheque_print_template\cheque_print_template.json:
  2   "actions": [],
  3:  "autoname": "field:bank_name",
  4   "creation": "2016-05-04 14:35:00.402544",

accounts\doctype\coupon_code\coupon_code.json:
  3   "allow_import": 1,
  4:  "autoname": "field:coupon_name",
  5   "creation": "2018-01-22 14:34:39.701832",

accounts\doctype\finance_book\finance_book.json:
  3   "allow_import": 1,
  4:  "autoname": "field:finance_book_name",
  5   "creation": "2018-04-13 17:42:43.252224",

accounts\doctype\fiscal_year\fiscal_year.json:
  3   "allow_import": 1,
  4:  "autoname": "field:year",
  5   "creation": "2013-01-22 16:50:25",

accounts\doctype\journal_entry_template\journal_entry_template.json:
  2   "actions": [],
  3:  "autoname": "field:template_title",
  4   "creation": "2020-04-09 01:32:51.332301",

accounts\doctype\loyalty_program\loyalty_program.json:
  2   "actions": [],
  3:  "autoname": "field:loyalty_program_name",
  4   "creation": "2018-01-23 06:23:05.731431",

accounts\doctype\mode_of_payment\mode_of_payment.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:mode_of_payment",
  6   "creation": "2012-12-04 17:49:20",

accounts\doctype\monthly_distribution\monthly_distribution.json:
  2   "actions": [],
  3:  "autoname": "field:distribution_id",
  4   "creation": "2013-01-10 16:34:05",

accounts\doctype\payment_term\payment_term.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:payment_term_name",
  6   "creation": "2017-08-10 15:24:54.876365",

accounts\doctype\payment_terms_template\payment_terms_template.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:template_name",
  6   "creation": "2017-08-10 15:34:28.058054",

accounts\doctype\share_type\share_type.json:
  2   "actions": [],
  3:  "autoname": "field:title",
  4   "creation": "2017-12-28 14:55:20.950877",

accounts\doctype\shipping_rule\shipping_rule.json:
  3   "allow_import": 1,
  4:  "autoname": "field:label",
  5   "creation": "2013-06-25 11:48:03",

accounts\doctype\subscription_plan\subscription_plan.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:plan_name",
  5   "creation": "2018-02-24 11:31:23.066506",

accounts\doctype\tax_category\tax_category.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:title",
  5   "creation": "2022-01-19 01:09:28.920486",

assets\doctype\asset_category\asset_category.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:asset_category_name",
  6   "creation": "2016-03-01 17:41:39.778765",

assets\doctype\asset_maintenance\asset_maintenance.json:
  2   "actions": [],
  3:  "autoname": "field:asset_name",
  4   "creation": "2017-10-19 16:50:22.879545",

assets\doctype\asset_maintenance_team\asset_maintenance_team.json:
  2   "actions": [],
  3:  "autoname": "field:maintenance_team_name",
  4   "creation": "2017-10-20 11:43:47.712616",

assets\doctype\asset_shift_factor\asset_shift_factor.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:shift_name",
  5   "creation": "2023-11-27 18:16:03.980086",

assets\doctype\location\location.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:location_name",
  6   "creation": "2018-05-07 12:49:22.595974",

assets\doctype\maintenance_team_member\maintenance_team_member.json:
  2   "actions": [],
  3:  "autoname": "field:team_member",
  4   "creation": "2016-10-26 10:56:04.534717",

buying\doctype\supplier_scorecard\supplier_scorecard.json:
  2   "actions": [],
  3:  "autoname": "field:supplier",
  4   "creation": "2017-05-29 01:40:54.786555",

buying\doctype\supplier_scorecard_criteria\supplier_scorecard_criteria.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:criteria_name",
  5   "creation": "2017-05-29 01:32:43.064891",

buying\doctype\supplier_scorecard_standing\supplier_scorecard_standing.json:
  2   "actions": [],
  3:  "autoname": "field:standing_name",
  4   "creation": "2017-05-29 01:36:47.893639",

buying\doctype\supplier_scorecard_variable\supplier_scorecard_variable.json:
  2   "actions": [],
  3:  "autoname": "field:variable_label",
  4   "creation": "2017-05-29 01:30:34.688389",

crm\doctype\competitor\competitor.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:competitor_name",
  5   "creation": "2021-10-21 10:28:52.071316",

crm\doctype\contract_template\contract_template.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:title",
  5   "creation": "2018-04-16 06:44:48.791312",

crm\doctype\market_segment\market_segment.json:
  2   "actions": [],
  3:  "autoname": "field:market_segment",
  4   "creation": "2018-10-01 09:59:14.479509",

crm\doctype\opportunity_lost_reason\opportunity_lost_reason.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:lost_reason",
  5   "creation": "2018-12-28 14:48:51.044975",

crm\doctype\prospect\prospect.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:company_name",
  6   "creation": "2021-08-19 00:21:06.995448",

crm\doctype\sales_stage\sales_stage.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:stage_name",
  5   "creation": "2018-10-01 09:28:16.399518",

manufacturing\doctype\plant_floor\plant_floor.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:floor_name",
  5   "creation": "2023-10-06 15:06:07.976066",

manufacturing\doctype\routing\routing.json:
  2   "actions": [],
  3:  "autoname": "field:routing_name",
  4   "creation": "2018-07-15 11:03:24.191613",

manufacturing\doctype\workstation\workstation.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:workstation_name",
  6   "creation": "2013-01-10 16:34:17",

manufacturing\doctype\workstation_type\workstation_type.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:workstation_type",
  6   "creation": "2022-11-04 17:03:23.334818",

projects\doctype\activity_type\activity_type.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:activity_type",
  6   "creation": "2013-03-05 10:14:59",

projects\doctype\project_type\project_type.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:project_type",
  5   "creation": "2017-07-18 13:32:46.031115",

quality_management\doctype\quality_feedback_template\quality_feedback_template.json:
  2   "actions": [],
  3:  "autoname": "field:template",
  4   "creation": "2019-05-26 21:17:24.283061",

quality_management\doctype\quality_goal\quality_goal.json:
  2   "actions": [],
  3:  "autoname": "field:goal",
  4   "creation": "2018-10-02 12:17:41.727541",

quality_management\doctype\quality_procedure\quality_procedure.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:quality_procedure_name",
  5   "creation": "2018-10-06 00:06:29.756804",

regional\doctype\lower_deduction_certificate\lower_deduction_certificate.json:
  2   "actions": [],
  3:  "autoname": "field:certificate_no",
  4   "creation": "2020-03-10 23:12:10.072631",

regional\doctype\south_africa_vat_settings\south_africa_vat_settings.json:
  2   "actions": [],
  3:  "autoname": "field:company",
  4   "creation": "2021-07-08 22:34:33.668015",

regional\doctype\uae_vat_settings\uae_vat_settings.json:
  2   "actions": [],
  3:  "autoname": "field:company",
  4   "creation": "2020-09-25 12:48:51.463265",

selling\doctype\industry_type\industry_type.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:industry",
  6   "creation": "2012-03-27 14:36:09",

selling\doctype\sales_partner_type\sales_partner_type.json:
  2   "actions": [],
  3:  "autoname": "field:sales_partner_type",
  4   "creation": "2018-06-11 13:15:57.404716",

setup\doctype\branch\branch.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:branch",
  6   "creation": "2013-01-10 16:34:13",

setup\doctype\brand\brand.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:brand",
  6   "creation": "2013-02-22 01:27:54",

setup\doctype\company\company.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:company_name",
  6   "creation": "2022-01-25 10:29:55.938239",

setup\doctype\customer_group\customer_group.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:customer_group_name",
  6   "creation": "2013-01-10 16:34:23",

setup\doctype\designation\designation.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:designation_name",
  6   "creation": "2013-01-10 16:34:13",

setup\doctype\employee_group\employee_group.json:
  2   "actions": [],
  3:  "autoname": "field:employee_group_name",
  4   "creation": "2018-11-19 12:33:31.351364",

setup\doctype\holiday_list\holiday_list.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:holiday_list_name",
  6   "creation": "2013-01-10 16:34:14",

setup\doctype\incoterm\incoterm.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:code",
  5   "creation": "2022-11-17 15:17:34.717467",

setup\doctype\item_group\item_group.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:item_group_name",
  6   "creation": "2013-03-28 10:35:29",

setup\doctype\party_type\party_type.json:
  2   "actions": [],
  3:  "autoname": "field:party_type",
  4   "creation": "2016-12-26 11:26:51.508286",

setup\doctype\print_heading\print_heading.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:print_heading",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\quotation_lost_reason\quotation_lost_reason.json:
  3   "allow_import": 1,
  4:  "autoname": "field:order_lost_reason",
  5   "creation": "2013-01-10 16:34:24",

setup\doctype\sales_partner\sales_partner.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:partner_name",
  6   "creation": "2013-04-12 15:34:06",

setup\doctype\sales_person\sales_person.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:sales_person_name",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\supplier_group\supplier_group.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:supplier_group_name",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\terms_and_conditions\terms_and_conditions.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:title",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\territory\territory.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:territory_name",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\uom\uom.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:uom_name",
  6   "creation": "2013-01-10 16:34:24",

setup\doctype\vehicle\vehicle.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:license_plate",
  5   "creation": "2016-09-03 03:33:27.680331",

stock\doctype\batch\batch.json:
  3   "allow_import": 1,
  4:  "autoname": "field:batch_id",
  5   "creation": "2013-03-05 14:50:38",

stock\doctype\customs_tariff_number\customs_tariff_number.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:tariff_number",
  5   "creation": "2017-03-24 15:30:36.314639",

stock\doctype\inventory_dimension\inventory_dimension.json:
  2   "actions": [],
  3:  "autoname": "field:dimension_name",
  4   "creation": "2022-06-17 13:04:16.554051",

stock\doctype\inventory_dimension\test_inventory_dimension.py:
  529  				"naming_rule": "By fieldname",
  530: 				"autoname": "field:store_name",
  531  				"fields": [{"label": "Store Name", "fieldname": "store_name", "fieldtype": "Data"}],

  558  				"naming_rule": "By fieldname",
  559: 				"autoname": "field:shelf_name",
  560  				"fields": [{"label": "Shelf Name", "fieldname": "shelf_name", "fieldtype": "Data"}],

  587  				"naming_rule": "By fieldname",
  588: 				"autoname": "field:rack_name",
  589  				"fields": [{"label": "Rack Name", "fieldname": "rack_name", "fieldtype": "Data"}],

  616  				"naming_rule": "By fieldname",
  617: 				"autoname": "field:pallet_name",
  618  				"fields": [{"label": "Pallet Name", "fieldname": "pallet_name", "fieldtype": "Data"}],

  639  				"naming_rule": "By fieldname",
  640: 				"autoname": "field:site_name",
  641  				"fields": [{"label": "Site Name", "fieldname": "site_name", "fieldtype": "Data"}],

stock\doctype\item\item.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:item_code",
  6   "creation": "2013-05-03 10:45:46",

stock\doctype\item_attribute\item_attribute.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:attribute_name",
  6   "creation": "2014-09-26 03:49:54.899170",

stock\doctype\manufacturer\manufacturer.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:short_name",
  6   "creation": "2016-01-17 11:04:52.761731",

stock\doctype\price_list\price_list.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:price_list_name",
  6   "creation": "2013-01-25 11:35:09",

stock\doctype\quality_inspection_parameter\quality_inspection_parameter.json:
  2   "actions": [],
  3:  "autoname": "field:parameter",
  4   "creation": "2020-12-28 17:06:00.254129",

stock\doctype\quality_inspection_parameter_group\quality_inspection_parameter_group.json:
  2   "actions": [],
  3:  "autoname": "field:group_name",
  4   "creation": "2021-02-04 18:44:12.223295",

stock\doctype\quality_inspection_template\quality_inspection_template.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:quality_inspection_template_name",
  6   "creation": "2018-01-24 16:23:41.691127",

stock\doctype\serial_no\serial_no.json:
  3   "allow_import": 1,
  4:  "autoname": "field:serial_no",
  5   "creation": "2013-05-16 10:59:15",

stock\doctype\shipment_parcel_template\shipment_parcel_template.json:
  2   "actions": [],
  3:  "autoname": "field:parcel_template_name",
  4   "creation": "2020-07-09 11:43:43.470339",

stock\doctype\uom_category\uom_category.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:category_name",
  5   "creation": "2018-04-30 17:27:14.742005",

telephony\doctype\call_log\call_log.json:
  2   "actions": [],
  3:  "autoname": "field:id",
  4   "creation": "2022-02-21 11:54:58.414784",

telephony\doctype\telephony_call_type\telephony_call_type.json:
  3   "allow_rename": 1,
  4:  "autoname": "field:call_type",
  5   "creation": "2022-02-25 16:13:37.321312",

telephony\doctype\voice_call_settings\voice_call_settings.json:
  2   "actions": [],
  3:  "autoname": "field:user",
  4   "creation": "2020-12-08 16:52:40.590146",

tests\test_webform.py:
  74  			"custom": 1,
  75: 			"autoname": "field:po",
  76  			"fields": [

utilities\doctype\video\video.json:
  4   "allow_rename": 1,
  5:  "autoname": "field:title",
  6   "creation": "2018-10-17 05:47:13.087395",

## FIX form etc SELECT
https://claude.ai/chat/1647f6ae-746b-422d-8a51-7e8f3319de41
