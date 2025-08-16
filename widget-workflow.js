/* https://chatgpt.com/c/689fa5cb-974c-8326-9952-339f21be56cb */
(function() {
  if (!pb || !selectedTarget) {
    console.error('PocketBase or selectedTarget not found');
    return;
  }

  pb.autoCancellation(false);

  // Load CSS
  ['https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/css/bootstrap.min.css'].forEach(href => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  // Disable AMD
  const prevDefine = window.define;
  window.define = undefined;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadReact() {
    if (window.React && window.ReactDOM) return { React: window.React, ReactDOM: window.ReactDOM };
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js');
      if (!window.React || !window.ReactDOM) throw new Error('React failed to load');
      return { React, ReactDOM };
    } finally {
      if (prevDefine) window.define = prevDefine;
    }
  }

  loadReact().then(({ React, ReactDOM }) => {
    const { useState, useEffect } = React;

    function WorkflowWidget() {
      const [workflow, setWorkflow] = useState(null);
      const [currentState, setCurrentState] = useState(null);
      const [availableTransitions, setAvailableTransitions] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        async function loadWorkflowData() {
          try {
            const wf = await pb.getWorkflow(selectedTarget.doctype);
            if (!wf) throw new Error('No workflow for this document type');
            setWorkflow(wf);

            const state = await pb.getWorkflowState(selectedTarget.name) || wf.states[0]?.state || null;
            setCurrentState(state);

            const transitions = await pb.getAvailableTransitions(selectedTarget.doctype, state);
            setAvailableTransitions(transitions);
          } catch (err) {
            console.error(err);
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
        loadWorkflowData();
      }, []);

      const handleTransition = async (action) => {
        try {
          setLoading(true);
          const nextState = await pb.executeWorkflowTransition(selectedTarget.name, action, 'Transition via widget');
          setCurrentState(nextState);
          const transitions = await pb.getAvailableTransitions(selectedTarget.doctype, nextState);
          setAvailableTransitions(transitions);
        } catch (err) {
          console.error(err);
          alert(`Transition failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      if (loading) return React.createElement('div', { className: 'text-center p-2' }, 'Loading workflow...');
      if (error) return React.createElement('div', { className: 'alert alert-danger' }, error);
      if (!workflow) return React.createElement('div', null, 'No workflow loaded');

      return React.createElement('div', { className: 'workflow-widget card p-3 mb-3' }, [
        React.createElement('h5', { key: 'state', className: 'mb-3' }, `Current State: ${currentState}`),

        availableTransitions.length
          ? React.createElement('div', { key: 'buttons', className: 'btn-group-vertical d-grid gap-2' },
              availableTransitions.map(t =>
                React.createElement('button', {
                  key: t.action,
                  className: `btn btn-sm ${t.action.toLowerCase().includes('approve') ? 'btn-success' :
                             t.action.toLowerCase().includes('reject') ? 'btn-danger' : 'btn-primary'}`,
                  onClick: () => handleTransition(t.action),
                  disabled: loading
                }, `${t.action} → ${t.next_state}`)
              )
            )
          : React.createElement('p', { key: 'no-actions', className: 'text-muted mb-0' }, 'No actions available in this state.')
      ]);
    }

    let container = document.getElementById('workflow-widget-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'workflow-widget-container';
      document.body.appendChild(container);
    }

    try {
      if (ReactDOM.createRoot) {
        ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget));
      } else {
        ReactDOM.render(React.createElement(WorkflowWidget), container);
      }
    } catch (renderError) {
      console.error('Render error:', renderError);
      container.innerHTML = `<div class="alert alert-danger">Failed to render workflow widget: ${renderError.message}</div>`;
    }

  }).catch(err => {
    console.error('Failed to load React:', err);
    const container = document.getElementById('workflow-widget-container') || document.body;
    container.innerHTML = `<div class="alert alert-danger">Failed to load React: ${err.message}</div>`;
  });

})();


/*older versionchanged by: https://chatgpt.com/c/689fa5cb-974c-8326-9952-339f21be56cb
(function() {
  if (!pb || !selectedTarget) {
    console.error('PocketBase or selectedTarget not found');
    return;
  }

  pb.autoCancellation(false);

  // Load CSS
  const cssLinks = ['https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/css/bootstrap.min.css'];
  cssLinks.forEach(href => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  // Disable AMD
  const prevDefine = window.define;
  window.define = undefined;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadReact() {
    if (window.React && window.ReactDOM) {
      return { React: window.React, ReactDOM: window.ReactDOM };
    }

    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js');

      if (!window.React || !window.ReactDOM) {
        throw new Error('React libraries failed to load properly');
      }

      return { React: window.React, ReactDOM: window.ReactDOM };
    } finally {
      if (prevDefine) window.define = prevDefine;
    }
  }

  loadReact().then(({ React, ReactDOM }) => {
    const { useState, useEffect } = React;

    function WorkflowWidget() {
      const [workflow, setWorkflow] = useState(null);
      const [currentState, setCurrentState] = useState('Draft');
      const [availableTransitions, setAvailableTransitions] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        async function loadWorkflowData() {
          try {
            const wf = await pb.getWorkflow(selectedTarget.doctype);
            if (!wf) throw new Error('No active workflow for this document type.');
            setWorkflow(wf);

            const state = await pb.getWorkflowState(selectedTarget.name);
            setCurrentState(state);

            // Use the pb.getAvailableTransitions function instead of looking in states
            const transitions = await pb.getAvailableTransitions(selectedTarget.doctype, state);
            setAvailableTransitions(transitions);
          } catch (err) {
            console.error(err);
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
        loadWorkflowData();
      }, []);

      const handleTransition = async (action) => {
        try {
          setLoading(true);
          const nextState = await pb.executeWorkflowTransition(selectedTarget.name, action, 'Transition via widget');
          setCurrentState(nextState);
          
          // Get available transitions for the new state
          const transitions = await pb.getAvailableTransitions(selectedTarget.doctype, nextState);
          setAvailableTransitions(transitions);
        } catch (err) {
          console.error(err);
          alert(`Transition failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      if (loading) {
        return React.createElement('div', { className: 'text-center p-2' }, 'Loading workflow...');
      }

      if (error) {
        return React.createElement('div', { className: 'alert alert-danger' }, error);
      }

      if (!availableTransitions.length) {
        return React.createElement('div', { className: 'workflow-widget card p-3 mb-3' }, [
          React.createElement('h5', { key: 'state', className: 'mb-2' }, `Current State: ${currentState}`),
          React.createElement('p', { key: 'no-actions', className: 'text-muted mb-0' }, 'No actions available in this state.')
        ]);
      }

      return React.createElement('div', { className: 'workflow-widget card p-3 mb-3' }, [
        React.createElement('h5', { key: 'state', className: 'mb-3' }, `Current State: ${currentState}`),
        React.createElement('div', { key: 'buttons', className: 'btn-group-vertical d-grid gap-2' },
          availableTransitions.map(t =>
            React.createElement('button', {
              key: t.action,
              className: `btn btn-sm ${t.action.toLowerCase() === 'approve' ? 'btn-success' : 
                         t.action.toLowerCase() === 'reject' ? 'btn-danger' : 'btn-primary'}`,
              onClick: () => handleTransition(t.action),
              disabled: loading
            }, `${t.action} → ${t.next_state}`)
          )
        )
      ]);
    }

    let container = document.getElementById('workflow-widget-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'workflow-widget-container';
      document.body.appendChild(container);
    }

    try {
      if (ReactDOM.createRoot) {
        ReactDOM.createRoot(container).render(React.createElement(WorkflowWidget));
      } else {
        ReactDOM.render(React.createElement(WorkflowWidget), container);
      }
    } catch (renderError) {
      console.error('Render error:', renderError);
      container.innerHTML = `<div class="alert alert-danger">Failed to render workflow widget: ${renderError.message}</div>`;
    }

  }).catch(err => {
    console.error('Failed to load React:', err);
    const container = document.getElementById('workflow-widget-container') || document.body;
    container.innerHTML = `<div class="alert alert-danger">Failed to load React: ${err.message}</div>`;
  });

})();*/