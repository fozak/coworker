/* almost always we have currentUser so we have without currentDocument:
*/
{
 "user": {
   "name": "user124@example.com",
   "username": "user124",
   "email": "user124@example.com",
   "full_name": "John Smith",
   "roles": ["Owner", "Sales User"],
   "created": "2024-01-15T10:30:00Z",
   "modified": "2024-08-19T14:22:00Z"
 },
 "roles": [
   {
     "name": "Owner",
     "description": "Document owner with create and edit permissions",
     "created": "2024-01-01T00:00:00Z"
   },
   {
     "name": "Sales User", 
     "description": "Sales team member with document creation rights",
     "created": "2024-01-01T00:00:00Z"
   }
 ]
}

/* for CurrentUser we have special additional document in additional User Flow document user-flow.json: 
*/ 

{
  "user_flow": {
    "name": "user_flow_001",
    "user": "user124@example.com",
    "workflow": "SalesInvoiceWorkflow",
    "current_state": "pending_l1_approval",
    "document": "SINV-2024-001",
    "history": [
      {
        "from_state": "draft",
        "to_state": "pending_l1_approval",
        "action": "submit",
        "timestamp": "2024-08-19T10:30:00Z",
        "comment": null,
        "user": "user124@example.com"
      }
    ],
    "generated_documents": {
      "draft": "SINV-2024-001"
    },
    "accumulated_data": {
      "customer": "Customer Inc",
      "total_amount": 1500.00,
      "invoice_date": "2024-08-19"
    },
    "created": "2024-08-19T10:00:00Z",
    "modified": "2024-08-19T10:30:00Z"
  }
}


/*what else we might know for currentUser without targetDocument or CurrentDocument
- We have multiple worklows which are is_active with the same Action Roles as user 
*/

{
 "workflow_name": "SalesInvoiceWorkflow",
 "description": "Sales Invoice approval workflow with L1 and L2 approvals",
 "is_active": true,
 "states": [
   {
     "name": "draft",
     "label": "Draft",
     "description": "Invoice is being prepared",
     "component_type": "form",
     "for_doctype": "SalesInvoice",
     "style": {
       "variant": "draft",
       "icon": "edit-3"
     }
   },
   {
     "name": "pending_l1_approval",
     "label": "Pending L1 Approval",
     "description": "Waiting for sales manager approval",
     "component_type": "info",
     "for_doctype": "SalesInvoice",
     "style": {
       "variant": "warning",
       "icon": "user-check"
     }
   },
   {
     "name": "approved",
     "label": "Approved",
     "description": "Invoice has been approved",
     "component_type": "info",
     "for_doctype": "SalesInvoice",
     "style": {
       "variant": "success",
       "icon": "check-circle-2"
     }
   },
   {
     "name": "rejected",
     "label": "Rejected",
     "description": "Invoice has been rejected",
     "component_type": "info", 
     "for_doctype": "SalesInvoice",
     "style": {
       "variant": "danger",
       "icon": "x-circle"
     }
   }
 ],
 "transitions": [
   {
     "from_state": "draft",
     "action": "submit",
     "next_state": "pending_l1_approval",
     "allowed_roles": ["Owner", "Sales User"],
     "condition": "data.total_amount > 0",
     "idx": 1
   }
 ],
 "actions": [
   {
     "name": "submit",
     "label": "Submit for Approval",
     "action_type": "submit",
     "requires_comment": false,
     "confirmation_message": "Submit this invoice for approval?",
     "style": {
       "variant": "primary",
       "icon": "send",
       "size": "md"
     }
   },
   {
     "name": "approve_l1",
     "label": "Approve (L1)",
     "action_type": "approve",
     "requires_comment": false,
     "confirmation_message": null,
     "style": {
       "variant": "success",
       "icon": "check",
       "size": "md"
     }
   },
   {
     "name": "reject",
     "label": "Reject",
     "action_type": "reject",
     "requires_comment": true,
     "confirmation_message": "Are you sure you want to reject this invoice?",
     "style": {
       "variant": "danger",
       "icon": "x-circle",
       "size": "md"
     }
   }
 ]
}

/* After getting current doc*/
{
 "document": {
   "name": "SINV-2024-001",
   "doctype": "SalesInvoice",
   "owner": "user124@example.com",
   "creation": "2024-08-19T10:00:00Z",
   "modified": "2024-08-19T10:30:00Z",
   "modified_by": "user124@example.com",
   "workflow_state": "pending_l1_approval",
   "via_workflow": true,
   "customer": "Customer Inc",
   "invoice_date": "2024-08-19",
   "total_amount": 1500.00,
   "items": [
     {
       "item_code": "ITEM-001",
       "item_name": "Product A",
       "qty": 10,
       "rate": 150.00,
       "amount": 1500.00
     }
   ],
   "status": "Draft"
 },
 "schema": {
   "name": "SalesInvoice",
   "doctype": "Schema",
   "for_doctype": "SalesInvoice",
   "fields": [
     {
       "fieldname": "customer",
       "label": "Customer",
       "fieldtype": "Link",
       "required": true,
       "read_only_roles": ["Sales Manager"],
       "editable_roles": ["Owner", "Sales User"]
     },
     {
       "fieldname": "invoice_date", 
       "label": "Invoice Date",
       "fieldtype": "Date",
       "required": true,
       "editable_roles": ["Owner", "Sales User"]
     },
     {
       "fieldname": "total_amount",
       "label": "Total Amount", 
       "fieldtype": "Currency",
       "required": true,
       "read_only": true,
       "visible_roles": ["Owner", "Sales User", "Sales Manager", "Finance Manager"]
     },
     {
       "fieldname": "items",
       "label": "Items",
       "fieldtype": "Table",
       "required": true,
       "editable_roles": ["Owner", "Sales User"]
     },
     {
       "fieldname": "workflow_state",
       "label": "Status",
       "fieldtype": "Data", 
       "read_only": true,
       "visible_roles": ["Owner", "Sales User", "Sales Manager", "Finance Manager"]
     }
   ],
   "permissions": [
     {
       "role": "Owner",
       "read": true,
       "write": true,
       "submit": true,
       "cancel": true,
       "conditions": "owner == user"
     },
     {
       "role": "Sales User",
       "read": true,
       "write": true,
       "submit": true,
       "conditions": null
     },
     {
       "role": "Sales Manager", 
       "read": true,
       "write": false,
       "approve": true,
       "conditions": null
     },
     {
       "role": "Finance Manager",
       "read": true,
       "write": false, 
       "approve": true,
       "conditions": null
     }
   ]
 }
}

/*2 scenarios on currentDocument route or on Flow(Workflow route)
* - currentDocument route then we can match the doctype->schema = get.Schema(doctype) and match schema.roles = user.roles and build context 
* 2 - visit the workflow list UI and see the list of documents that has pending action where schema.roles = user.roles for each document
*/ 

/* Questions 

e covering the main angles well! Here are a few additional considerations you might want to think about:
Missing Angles to Consider:
1. Multiple Active User Flows
json// User might have multiple workflows running simultaneously
{
  "active_user_flows": [
    {
      "name": "user_flow_001",
      "workflow": "SalesInvoiceWorkflow", 
      "current_state": "pending_l1_approval",
      "document": "SINV-2024-001"
    },
    {
      "name": "user_flow_002", 
      "workflow": "PurchaseOrderWorkflow",
      "current_state": "draft",
      "document": "PO-2024-001"
    }
  ]
}
2. Cross-Document Dependencies
json// Some workflows might depend on other documents
{
  "condition": "related_document('PO-2024-001').status == 'approved'"
}
3. Delegated/Proxy Actions
json{
  "user_permissions": {
    "acting_on_behalf_of": ["manager@example.com"],
    "delegated_roles": ["Sales Manager"] // Temporary role assignment
  }
}
4. Workflow Assignments/Tasks
json// Documents assigned to user for action
{
  "pending_assignments": [
    {
      "document": "SINV-2024-001",
      "workflow": "SalesInvoiceWorkflow", 
      "assigned_by": "sales@example.com",
      "due_date": "2024-08-20",
      "priority": "high"
    }
  ]
}
5. Time-based Conditions
json{
  "condition": "user.department == 'sales' && current_time() > '09:00'"
}
6. Document Ownership vs Role Permissions
json// User created the document but might not have approval rights
{
  "document_owner": "user124@example.com",
  "current_approver_roles": ["Sales Manager"] // User doesn't have this
}
Your two main scenarios (document route + workflow list) cover the core use cases perfectly. These additional angles are mostly edge cases that you can handle later if needed.RetryClaude does not have the ability to run the code it generates yet.DDfor 1 there is no contradiction, when user visiting each document he gets related actions. correct?  for 6. we introduce dumb role: Ower, check if works with this logicEditYes, you're absolutely right on both points!
1. Multiple Active User Flows - No Contradiction
javascript// User visits SINV-2024-001
currentDocument = "SINV-2024-001"
userFlow = getUserFlow(user, "SalesInvoiceWorkflow") 
// Gets actions for pending_l1_approval state

// User visits PO-2024-001  
currentDocument = "PO-2024-001"
userFlow = getUserFlow(user, "PurchaseOrderWorkflow")
// Gets actions for draft state
Each document visit shows only the relevant actions for that specific document's workflow state. No contradiction - clean separation.
6. Owner Role Solves Ownership vs Permissions
json{
  "transitions": [
    {
      "from_state": "draft",
      "action": "submit", 
      "allowed_roles": ["Owner", "Sales User"], // Owner can always submit their own docs
      "condition": "data.total_amount > 0"
    },
    {
      "from_state": "pending_l1_approval", 
      "action": "approve_l1",
      "allowed_roles": ["Sales Manager"], // Only managers can approve
      "condition": null
    }
  ]
}
Logic:

Document creator automatically gets "Owner" role for that specific document
"Owner" role allows basic actions (submit, edit, cancel)
Approval roles ("Sales Manager") are separate from ownership
User can be "Owner" of their documents + have other system roles

This is elegant! Owner role bridges the gap between "I created this document" and "What can I do with it?"
Your approach handles both scenarios perfectly without any additional complexity.*/
