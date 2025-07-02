// Load dependencies
var loadScript = (src) => {
    return new Promise((resolve) => {
        var script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.head.appendChild(script);
    });
};

Promise.all([
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js')
]).then(() => {
    // Add styles
    var style = document.createElement('style');
    style.textContent = `.widget-form{max-width:400px;margin:20px;padding:20px;border:1px solid #ddd;border-radius:8px;background:white;box-shadow:0 2px 10px rgba(0,0,0,0.1);font-family:Arial,sans-serif}.form-group{margin-bottom:15px}.form-group label{display:block;margin-bottom:5px;font-weight:bold;color:#333}.form-group input,.form-group textarea{width:100%;padding:8px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box}.form-group textarea{height:80px;resize:vertical}.submit-btn{background:#007bff;color:white;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-size:16px;width:100%}.submit-btn:hover{background:#0056b3}.success-message{color:#28a745;margin-top:10px;text-align:center}`;
    document.head.appendChild(style);
    
    // Create widget
    var widgetCode = `
    const { useState } = React;
    
    function ContactWidget() {
        const [formData, setFormData] = useState({
            name: '', email: '', message: ''
        });
        const [submitted, setSubmitted] = useState(false);
        
        const handleChange = (e) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };
        
        const handleSubmit = (e) => {
            e.preventDefault();
            console.log('Form submitted:', formData);
            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                setFormData({ name: '', email: '', message: '' });
            }, 2000);
        };
        
        return React.createElement('div', { className: 'widget-form' },
            React.createElement('h3', null, 'Contact Form Widget'),
            React.createElement('form', { onSubmit: handleSubmit },
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Name:'),
                    React.createElement('input', {
                        type: 'text', name: 'name', value: formData.name,
                        onChange: handleChange, required: true
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Email:'),
                    React.createElement('input', {
                        type: 'email', name: 'email', value: formData.email,
                        onChange: handleChange, required: true
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Message:'),
                    React.createElement('textarea', {
                        name: 'message', value: formData.message,
                        onChange: handleChange, required: true
                    })
                ),
                React.createElement('button', { type: 'submit', className: 'submit-btn' },
                    'Send Message'),
                submitted && React.createElement('div', { className: 'success-message' },
                    'Message sent successfully!')
            )
        );
    }
    
    var container = document.createElement('div');
    document.body.appendChild(container);
    var root = ReactDOM.createRoot(container);
    root.render(React.createElement(ContactWidget));
    console.log('Widget loaded!');
    `;
    
    eval(widgetCode);
});