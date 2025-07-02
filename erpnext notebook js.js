//using ERPnext functionality and customer portal for custom forms version 1.

//selected Doctype for storing custom form, for example Issue

/*Customizing Issue Doctype 
 add "custom_text" field to store js widget and data.
For example, "console.log('Hello from widget!');"
*/

/*Add ERPnext web form /app/web-form/issuenew based on Issue Doctype */

/* add custom js scipt to /app/web-form/issuenew  form 
console.log('I am loading');

widgetCode = frappe.web_form.get_field('custom_text').value;
    
eval(widgetCode);
*/ 

/* Include into the js 

const newWidget = get_from_widget();";

    // Set it in the web form
frappe.web_form.set_value('custom_text', newWidget);
*/
