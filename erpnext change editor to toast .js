// 1. Define the createEditor function with sanitizing
function createEditor() {
  if (!document.getElementById('toast-editor-container')) {
    // Create container div fixed at bottom
    let container = document.createElement('div');
    container.id = 'toast-editor-container';
    container.style = 'position:fixed;bottom:0;left:0;right:0;height:400px;z-index:9999;background:#fff;border-top:1px solid #ccc;';
    document.body.appendChild(container);

    // Create Save button
    let btn = document.createElement('button');
    btn.textContent = 'Save to ERPNext';
    btn.style = 'position:absolute;top:10px;right:20px;z-index:10000;padding:8px 12px;cursor:pointer;';
    container.appendChild(btn);

    // Simple HTML sanitizer using DOMParser
    function sanitizeHtml(html) {
      try {
        let doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.innerHTML || '<p><br></p>';
      } catch (e) {
        return '<p><br></p>';
      }
    }

    // Get current description content and sanitize it
    let initialContent = '';
    if (cur_frm && cur_frm.doc && typeof cur_frm.doc.description === 'string') {
      initialContent = sanitizeHtml(cur_frm.doc.description.trim());
      if (!initialContent || initialContent === '') {
        initialContent = '<p><br></p>';
      }
    } else {
      initialContent = '<p><br></p>';
    }

    // Initialize Toast UI Editor with sanitized initial content
    window.toastEditor = new toastui.Editor({
      el: container,
      height: '350px',
      initialEditType: 'wysiwyg',
      previewStyle: 'vertical',
      initialValue: initialContent
    });

    // Save button click: set edited HTML back to ERPNext field
    btn.onclick = function() {
      let content = window.toastEditor.getHTML();
      cur_frm.set_value('description', content);
      alert('Content saved to description field!');
    };
  }
}

// 2. Load Toast UI Editor CSS if not loaded yet
if (!document.querySelector('link[href="https://uicdn.toast.com/editor/latest/toastui-editor.min.css"]')) {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://uicdn.toast.com/editor/latest/toastui-editor.min.css';
  document.head.appendChild(link);
}

// 3. Load Toast UI Editor JS and call createEditor after loading
var script = document.createElement('script');
script.src = 'https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js';
script.onload = function() {
  console.log('Toast UI Editor loaded');
  createEditor();
};
document.body.appendChild(script);

/**  if you need to save

If you want to automatically save on some event or bypass manual click, here are options:
Auto-save on editor change:

js
Copy
Edit
window.toastEditor.on('change', () => {
  let content = window.toastEditor.getHTML();
  cur_frm.set_value('description', content);
});
This keeps ERPNext field updated live as you type.

Programmatic save from console:

js
Copy
Edit
let content = window.toastEditor.getHTML();
cur_frm.set_value('description', content);
Trigger ERPNext save after setting value (less common):

js
Copy
Edit
cur_frm.save();
If you want me to add auto-save on change or any other feature, just say!