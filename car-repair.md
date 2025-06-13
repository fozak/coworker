
I want to create car repair shop workfolow in ERPnext as following
1) For each car repair I create project like

Project Name
Toyota Camry VIN: 4T1BF1FK8HU123456
title
PROJ-0004

For every workflow step I use 
TASK linked with project.

I will try tro recreate Tekmetrik Workflow as 


Mapping Tekmetric Workflow to ERPNext Modules
Tekmetric Step	ERPNext Module / Feature	Notes
Vehicle Check-In & Inspection	Custom Doctype (Inspection Report) or Quotation	Record observations + photos
Estimate & Approval	Quotation / Sales Order	Use standard ERPNext Quotation workflow
Work Order Creation	Manufacturing Work Order	Use BOM for parts + labor
Parts Procurement	Stock Entries / Purchase Orders	For parts ordering and inventory management
Repair Execution	Work Order Operations + Timesheets	Track labor and parts consumption
Quality Check	Custom Inspection / Final Check Doctype	Optional, for internal QC
Delivery & Payment	Sales Invoice	Final billing and payment


Step 2 Creaste Task Vehicle Check-In & Inspection -> 

Task TASK-2025-00009 Vehicle Check-In & Inspection
Project PROJ-0004 
DocType needed VEHICLE (?)

📂 Vehicle Inspection (Parent Task: TASK-2025-00009)
├── 🔧 Brakes Inspection (TASK-2025-00010)
├── 🔧 Tires Inspection (TASK-2025-00011)
├── 🔧 Battery Inspection (TASK-2025-00012)


