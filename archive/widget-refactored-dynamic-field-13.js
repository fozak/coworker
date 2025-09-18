(function() {
  // Ensure pb object and selectedTarget are available from the environment
  if (!pb || !selectedTarget) {
    console.error('PocketBase (pb) or selectedTarget not found. Make sure pb-functions.js is loaded and selectedTarget is set.');
    return;
  }

  // It's good practice to disable auto-cancellation for long-running UI operations
  pb.autoCancellation(false);

  // Load CSS for Bootstrap styling
  const cssLinks = ['https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/css/bootstrap.min.css'];
  cssLinks.forEach(href => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  // Temporarily disable AMD for compatibility with some UMD builds
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
      // Restore AMD define function if it existed
      if (prevDefine) window.define = prevDefine;
    }
  }

  loadReact().then(({ React, ReactDOM }) => {
    const { useState, useEffect, useCallback, useMemo } = React;

    // Main Data Grid Component
    function MainDataGrid({ schema }) {
      const [rows, setRows] = useState([]);
      const [selectedRows, setSelectedRows] = useState(new Set());
      const [sortField, setSortField] = useState('');
      const [sortDir, setSortDir] = useState('asc');
      const [filter, setFilter] = useState('');

      const loadData = useCallback(async () => {
        const records = await pb.listDocs(selectedTarget.doctype);
        setRows(records);
      }, []);

      useEffect(() => { loadData(); }, [loadData]);

      const visibleFields = schema?.fields?.filter(f => f.in_list_view) || [];
      const filteredRows = rows.filter(row =>
        !filter || [row.name, row.doctype, ...Object.values(row.data || {})].some(v =>
          String(v).toLowerCase().includes(filter.toLowerCase())
        )
      );
      
      const sortedRows = sortField ? [...filteredRows].sort((a, b) => {
        let aVal = sortField === 'name' ? a.name : sortField === 'doctype' ? a.doctype : a.data?.[sortField];
        let bVal = sortField === 'name' ? b.name : sortField === 'doctype' ? b.doctype : b.data?.[sortField];
        return sortDir === 'asc' ? String(aVal || '').localeCompare(String(bVal || '')) : String(bVal || '').localeCompare(String(aVal || ''));
      }) : filteredRows;

      return React.createElement('div', { style: { marginTop: '20px' } }, [
        React.createElement('h5', { key: 'title' }, `${selectedTarget.doctype} Records`),
        React.createElement('div', { key: 'controls', className: 'mb-2 d-flex gap-2' }, [
          selectedRows.size > 0 && React.createElement('span', { key: 'selected', className: 'badge badge-info' }, `${selectedRows.size} selected`),
          React.createElement('input', { key: 'filter', className: 'form-control form-control-sm ml-auto', style: { width: '200px' }, placeholder: 'Filter records...', value: filter, onChange: e => setFilter(e.target.value) })
        ]),
        React.createElement('div', { key: 'table', className: 'table-responsive', style: { maxHeight: '400px', overflowY: 'auto' } },
          React.createElement('table', { className: 'table table-sm table-striped' }, [
            React.createElement('thead', { key: 'head', className: 'thead-dark sticky-top' },
              React.createElement('tr', {}, [
                React.createElement('th', { key: 'check', style: { width: '30px' } },
                  React.createElement('input', { type: 'checkbox', onChange: e => setSelectedRows(e.target.checked ? new Set(rows.map(r => r.id)) : new Set()) })
                ),
                React.createElement('th', { key: 'name', style: { cursor: 'pointer' }, onClick: () => { setSortField('name'); setSortDir(sortField === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); } }, 'Name'),
                React.createElement('th', { key: 'doctype', style: { cursor: 'pointer' }, onClick: () => { setSortField('doctype'); setSortDir(sortField === 'doctype' && sortDir === 'asc' ? 'desc' : 'asc'); } }, 'Doctype'),
                ...visibleFields.map(f => React.createElement('th', { key: f.fieldname, style: { cursor: 'pointer' }, onClick: () => { setSortField(f.fieldname); setSortDir(sortField === f.fieldname && sortDir === 'asc' ? 'desc' : 'asc'); } }, f.label))
              ])
            ),
            React.createElement('tbody', { key: 'body' },
              sortedRows.map(row => React.createElement('tr', { key: row.id, className: selectedRows.has(row.id) ? 'table-active' : '' }, [
                React.createElement('td', { key: 'check' },
                  React.createElement('input', { type: 'checkbox', checked: selectedRows.has(row.id), onChange: e => setSelectedRows(prev => { const next = new Set(prev); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next; }) })
                ),
                React.createElement('td', { key: 'name' },
                  React.createElement('a', { href: '#', className: 'text-primary', 
                    onClick: e => { e.preventDefault(); window.selectExistingRecord && window.selectExistingRecord(row.id); } 
                  }, pb.getDisplayName(row, schema))
                ),
                React.createElement('td', { key: 'doctype' }, row.doctype),
                ...visibleFields.map(f => React.createElement('td', { key: f.fieldname },
                  f.fieldtype === 'Check' ? (row.data?.[f.fieldname] ? '✓' : '✗') : 
                  f.fieldtype === 'Select' ? React.createElement('span', { 
                    className: `badge badge-${pb.getSelectBadgeColor(row.data?.[f.fieldname])}` 
                  }, row.data?.[f.fieldname] || '') : 
                  (row.data?.[f.fieldname] || '')
                ))
              ]))
            )
          ])
        )
      ]);
    }

    // Child Table Component
    function ChildTable({ field, formData, selectOptions = {} }) {
      const [childRows, setChildRows] = useState([]);
      const [childSchema, setChildSchema] = useState(null);
      const [selectedRows, setSelectedRows] = useState(new Set());
      const [sortField, setSortField] = useState('');
      const [sortDir, setSortDir] = useState('asc');
      const [filter, setFilter] = useState('');
      const [childSelectOptions, setChildSelectOptions] = useState({});

      const loadChildData = useCallback(async () => {
        try {
          const { schema, records } = await pb.loadChildTableData(field.options, selectedTarget.name);
          setChildSchema(schema);
          setChildRows(records);
          
          if (schema) {
            const selectOpts = pb.getSelectFieldOptions(schema);
            setChildSelectOptions(selectOpts);
          }
        } catch (err) {
          console.error('Error loading child data:', err);
        }
      }, [field.options]);

      const addRow = useCallback(async () => {
        const newChild = await pb.createChild(field.options, selectedTarget.name, selectedTarget.doctype, field.fieldname);
        setChildRows(prev => [...prev, newChild]);
      }, [field]);

      const deleteSelected = useCallback(async () => {
        const names = Array.from(selectedRows).map(id => childRows.find(r => r.id === id)?.name).filter(Boolean);
        await pb.deleteChildren(names);
        setChildRows(prev => prev.filter(row => !selectedRows.has(row.id)));
        setSelectedRows(new Set());
      }, [selectedRows, childRows]);

      const updateCell = useCallback(async (rowId, fieldName, value) => {
        const row = childRows.find(r => r.id === rowId);
        await pb.updateChild(row.name, fieldName, value);
        
        if (childSchema) {
          const updates = await pb.handleFetchFromUpdates(fieldName, value, childSchema, { ...row.data, [fieldName]: value });
          
          if (Object.keys(updates).length > 0) {
            const finalData = { ...row.data, [fieldName]: value, ...updates };
            await pb.updateDoc(row.name, finalData);
            setChildRows(prev => prev.map(r => r.id === rowId ? { ...r, data: finalData } : r));
          } else {
            setChildRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldName]: value } } : r));
          }
        }
      }, [childRows, childSchema]);

      const renderEditableCell = useCallback((row, field) => {
        const currentValue = row.data[field.fieldname] || '';
        const isReadOnly = !!field.fetch_from;
        
        if (field.fieldtype === 'Select' && !isReadOnly) {
          const options = childSelectOptions[field.fieldname] || [];
          return React.createElement('select', {
            className: 'form-control form-control-sm',
            value: currentValue,
            onChange: e => updateCell(row.id, field.fieldname, e.target.value),
            style: { minWidth: '120px' }
          }, [
            React.createElement('option', { key: 'empty', value: '' }, '-- Select --'),
            ...options.map(opt => React.createElement('option', { key: opt.value, value: opt.value }, opt.displayName || opt.text))
          ]);
        }
        
        if (field.fieldtype === 'Check') {
          return React.createElement('input', {
            type: 'checkbox',
            checked: !!currentValue,
            onChange: e => updateCell(row.id, field.fieldname, e.target.checked ? 1 : 0),
            disabled: isReadOnly
          });
        }
        
        return React.createElement('div', {
          contentEditable: !isReadOnly,
          suppressContentEditableWarning: true,
          onBlur: e => updateCell(row.id, field.fieldname, e.target.textContent),
          style: {
            minWidth: '80px',
            padding: '4px',
            border: isReadOnly ? 'none' : '1px solid transparent',
            backgroundColor: isReadOnly ? '#f8f9fa' : 'transparent',
            cursor: isReadOnly ? 'not-allowed' : 'text'
          },
          title: isReadOnly ? `Auto-fetched from: ${field.fetch_from}` : ''
        }, currentValue);
      }, [childSelectOptions, updateCell]);

      useEffect(() => { loadChildData(); }, [loadChildData]);

      if (!childSchema) return React.createElement('div', { className: 'text-muted' }, 'Loading...');

      const visibleFields = childSchema.fields.filter(f => f.in_list_view);
      const filteredRows = childRows.filter(row =>
        !filter || Object.values(row.data).some(v => String(v).toLowerCase().includes(filter.toLowerCase()))
      );
      const sortedRows = sortField ? [...filteredRows].sort((a, b) => {
        const aVal = a.data[sortField] || '';
        const bVal = b.data[sortField] || '';
        return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      }) : filteredRows;

      return React.createElement('div', { className: 'form-group mb-4' }, [
        React.createElement('label', { key: 'label', className: 'form-label' }, field.label),
        React.createElement('div', { key: 'controls', className: 'mb-2 d-flex gap-2' }, [
          React.createElement('button', { key: 'add', className: 'btn btn-sm btn-primary', onClick: addRow }, 'Add Row'),
          selectedRows.size > 0 && React.createElement('button', { key: 'delete', className: 'btn btn-sm btn-danger', onClick: deleteSelected }, `Delete (${selectedRows.size})`),
          React.createElement('input', { key: 'filter', className: 'form-control form-control-sm ml-auto', style: { width: '200px' }, placeholder: 'Filter...', value: filter, onChange: e => setFilter(e.target.value) })
        ]),
        React.createElement('div', { key: 'table', className: 'table-responsive', style: { maxHeight: '300px', overflowY: 'auto' } },
          React.createElement('table', { className: 'table table-sm table-hover' }, [
            React.createElement('thead', { key: 'head', className: 'thead-light sticky-top' },
              React.createElement('tr', {}, [
                React.createElement('th', { key: 'check', style: { width: '30px' } },
                  React.createElement('input', { type: 'checkbox', onChange: e => setSelectedRows(e.target.checked ? new Set(childRows.map(r => r.id)) : new Set()) })
                ),
                React.createElement('th', { key: 'name', style: { width: '120px', cursor: 'pointer' }, onClick: () => { setSortField('name'); setSortDir(sortField === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); } }, 'Name'),
                ...visibleFields.map(f => React.createElement('th', { key: f.fieldname, style: { cursor: 'pointer' }, onClick: () => { setSortField(f.fieldname); setSortDir(sortField === f.fieldname && sortDir === 'asc' ? 'desc' : 'asc'); } }, f.label))
              ])
            ),
            React.createElement('tbody', { key: 'body' },
              sortedRows.map(row => React.createElement('tr', { key: row.id, className: selectedRows.has(row.id) ? 'table-active' : '' }, [
                React.createElement('td', { key: 'check' },
                  React.createElement('input', { type: 'checkbox', checked: selectedRows.has(row.id), onChange: e => setSelectedRows(prev => { const next = new Set(prev); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next; }) })
                ),
                React.createElement('td', { key: 'name' },
                  React.createElement('a', { href: '#', className: 'text-primary', 
                    onClick: e => { e.preventDefault(); window.selectExistingRecord && window.selectExistingRecord(row.id); } 
                  }, pb.getDisplayName(row, childSchema))
                ),
                ...visibleFields.map(f => React.createElement('td', { key: f.fieldname }, renderEditableCell(row, f)))
              ]))
            )
          ])
        )
      ]);
    }

    // Form Field Component with Dynamic Link Support
    function FormField({ field, value, onChange, formData, linkOptions, selectOptions, schema, permissions = {} }) {
      if (field.fieldtype === 'Table') {
        return React.createElement(ChildTable, { field, formData, selectOptions });
      }

      const [dynamicLinkOptions, setDynamicLinkOptions] = useState(linkOptions);
      
      // THIS IS THE KEY: Calling the function from your pb-functions.js library
      const config = pb.createFormFieldConfig(field, value, formData, selectOptions, dynamicLinkOptions, permissions);

      const handleChange = useCallback(async (e) => {
        const rawValue = config.inputType === 'checkbox' ? e.target.checked : e.target.value;
        const processedValue = pb.processFieldValue(rawValue, field.fieldtype);

        onChange(field.fieldname, processedValue);

        if (schema) {
          const { linkOptions: updatedLinkOptions, clearedFields } = await pb.processDynamicLinkUpdate(
            field.fieldname, 
            processedValue, 
            schema, 
            dynamicLinkOptions
          );
          
          if (Object.keys(updatedLinkOptions).length !== Object.keys(dynamicLinkOptions).length ||
              JSON.stringify(updatedLinkOptions) !== JSON.stringify(dynamicLinkOptions)) {
            setDynamicLinkOptions(updatedLinkOptions);
            
            clearedFields.forEach(fieldName => {
              onChange(fieldName, null);
            });
          }

          if (field.fieldtype === 'Link' || field.fieldtype === 'Dynamic Link') {
            setTimeout(async () => {
              const updates = await pb.handleFetchFromUpdates(field.fieldname, processedValue, schema, { ...formData, [field.fieldname]: processedValue });
              Object.entries(updates).forEach(([fieldname, value]) => {
                onChange(fieldname, value);
              });
            }, 10);
          }
        }
      }, [field, onChange, formData, schema, config, dynamicLinkOptions]);

      return React.createElement('div', { className: 'form-group mb-3' }, [
        React.createElement('label', {
          key: 'label',
          className: 'form-label',
          title: config.hasAutoFill ? `Auto-fetched from: ${field.fetch_from}` : 
                 config.dependentField ? `Depends on: ${config.dependentField}` : ''
        }, [
          field.label,
          config.hasAutoFill && React.createElement('small', {
            key: 'fetch-indicator',
            className: 'text-muted ml-2',
            style: { fontSize: '0.8em' }
          }, '(auto-filled)'),
          config.showDependencyHint && React.createElement('small', {
            key: 'dependency-hint',
            className: 'text-warning ml-2',
            style: { fontSize: '0.8em' }
          }, `(select ${config.dependentField} first)`)
        ]),

        config.inputType === 'select'
          ? React.createElement('select', {
              key: 'select',
              className: config.cssClass,
              value: config.value,
              onChange: handleChange,
              disabled: config.isReadOnly || !config.isDynamicLinkReady
            }, [
              React.createElement('option', { key: 'empty', value: '' }, config.placeholder),
              ...config.options.map(opt => React.createElement('option', { 
                key: opt.value, 
                value: opt.value 
              }, opt.displayName || opt.text))
            ])
          : config.inputType === 'textarea'
          ? React.createElement('textarea', {
              key: 'textarea',
              className: config.cssClass,
              value: config.value,
              onChange: handleChange,
              rows: 3,
              readOnly: config.isReadOnly,
              placeholder: field.placeholder || `Enter ${field.label}...`
            })
          : config.inputType === 'checkbox'
          ? React.createElement('div', { key: 'checkbox-wrapper', className: 'form-check' }, [
              React.createElement('input', {
                key: 'checkbox',
                type: 'checkbox',
                className: 'form-check-input',
                checked: !!config.value,
                onChange: handleChange,
                disabled: config.isReadOnly
              }),
              React.createElement('label', { key: 'checkbox-label', className: 'form-check-label' }, 
                config.value ? 'Yes' : 'No'
              )
            ])
          : React.createElement('input', {
              key: 'input',
              type: config.inputType,
              className: config.cssClass,
              value: config.value,
              onChange: handleChange,
              readOnly: config.isReadOnly,
              placeholder: field.placeholder || `Enter ${field.label}...`
            }),

        field.fieldtype === 'Select' && config.value && React.createElement('div', { key: 'value-badge', className: 'mt-1' },
          React.createElement('span', { 
            className: `badge badge-${pb.getSelectBadgeColor(config.value)}` 
          }, config.value)
        ),

        field.fieldtype === 'Dynamic Link' && config.showDependencyHint && React.createElement('div', {
          key: 'dependency-status',
          className: 'mt-1'
        }, [
          React.createElement('small', {
            className: 'text-muted'
          }, `Waiting for ${config.dependentField} selection...`)
        ])
      ]);
    }

    // Main Form Component
    function UniversalFrappeForm() {
      const [formState, setFormState] = useState({
        schema: null,
        formData: {},
        linkOptions: {},
        selectOptions: {},
        loading: true,
        error: null,
        saving: false,
        saveStatus: null
      });

// USE THIS NEW saveToDatabase:
// This version correctly lists `selectedTarget.name` as a dependency.
const saveToDatabase = useCallback(async (dataToSave) => {
    try {
        setFormState(prev => ({ ...prev, saving: true, saveStatus: null }));
        // Correctly calls the update function from your pb library
        await pb.updateDoc(selectedTarget.name, dataToSave);
        setFormState(prev => ({ ...prev, saveStatus: 'saved', saving: false }));
        setTimeout(() => setFormState(prev => ({ ...prev, saveStatus: null })), 2000);
    } catch (err) {
        console.error('Save error:', err);
        setFormState(prev => ({ ...prev, saveStatus: 'error', saving: false }));
        setTimeout(() => setFormState(prev => ({ ...prev, saveStatus: null })), 3000);
    }
}, [selectedTarget.name]); // <-- THE FIX: Now React knows this function depends on the selected target.

const onChange = useCallback((fieldName, value) => {
    // Use the "updater function" to guarantee you have the latest state.
    setFormState(prevState => {
        // 1. Create the new, updated form data.
        const newFormData = { ...prevState.formData, [fieldName]: value };

        // 2. Clear any pending save from a previous keystroke.
        clearTimeout(window.formSaveTimeout);

        // 3. Schedule a new save for the updated data.
        window.formSaveTimeout = setTimeout(() => {
            saveToDatabase(newFormData);
        }, 1000);

        // 4. Return the new state for the UI to update instantly.
        return { ...prevState, formData: newFormData };
    });
}, [saveToDatabase]); 

      const loadData = useCallback(async () => {
        try {
          const { schema, record, linkOptions, selectOptions, formData } = await pb.loadFormDataWithSelects(selectedTarget.doctype, selectedTarget.name);
          
          setFormState({
            schema,
            formData: record?.data || formData,
            linkOptions,
            selectOptions,
            loading: false,
            error: null,
            saving: false,
            saveStatus: null
          });
        } catch (err) {
          console.error('Error loading data:', err);
          setFormState(prev => ({
            ...prev,
            error: `Failed to load form: ${err.message}`,
            loading: false
          }));
        }
      }, []);

      useEffect(() => {
        if (!formState.schema?.fields) return;
        const dynamicFields = formState.schema.fields.filter(f => f.fieldtype === 'Dynamic Link');
        dynamicFields.forEach(async (field) => {
          const sourceValue = formState.formData[field.options];
          if (sourceValue && !formState.linkOptions[field.fieldname]) {
            try {
              const options = await pb.getDynamicLinkOptions(sourceValue, formState.schema.title_field || 'subject');
              setFormState(prev => ({
                ...prev,
                linkOptions: { ...prev.linkOptions, [field.fieldname]: options }
              }));
            } catch (err) {
              console.warn(`Failed to load dynamic options for ${field.fieldname}:`, err);
            }
          }
        });
      }, [formState.formData, formState.schema?.fields, formState.linkOptions]);

      useEffect(() => {
        if (!formState.schema?.fields || formState.loading) return;
        const processFetchFromFields = async () => {
          const fetchFromFields = formState.schema.fields.filter(f => f.fetch_from);
          if (fetchFromFields.length === 0) return;
          const updates = await pb.processFetchFromBatch(fetchFromFields, formState.formData);
          if (Object.keys(updates).length > 0) {
            setFormState(prev => ({
              ...prev,
              formData: { ...prev.formData, ...updates }
            }));
          }
        };
        processFetchFromFields();
      }, [formState.schema?.fields, formState.loading]);

      useEffect(() => {
        loadData();
      }, [loadData]);

      if (formState.loading) {
        return React.createElement('div', { className: 'text-center p-4' },
          React.createElement('div', { className: 'spinner-border' },
            React.createElement('span', { className: 'sr-only' }, 'Loading...')
          )
        );
      }
      if (formState.error) {
        return React.createElement('div', { className: 'alert alert-danger' }, formState.error);
      }
      if (!formState.schema) return null;

      const fieldsMap = Object.fromEntries(formState.schema.fields.map(f => [f.fieldname, f]));
      const fieldOrder = formState.schema.field_order || [];

      return React.createElement('div', { className: 'form-layout' }, [
        formState.saveStatus && React.createElement('div', {
          key: 'status',
          className: `alert ${formState.saveStatus === 'saved' ? 'alert-success' : 'alert-danger'} mb-3`
        }, [
          formState.saving && React.createElement('span', { key: 'spinner', className: 'spinner-border spinner-border-sm me-2' }),
          formState.saveStatus === 'saved' ? '✓ Saved' : formState.saveStatus === 'error' ? '✗ Save failed' : 'Saving...'
        ]),
        React.createElement('div', { key: 'schema-info', className: 'alert alert-info mb-3' }, [
          React.createElement('strong', { key: 'title' }, `${selectedTarget.doctype} Form`),
          React.createElement('br', { key: 'br' }),
          React.createElement('small', { key: 'details' }, 
            `Record: ${selectedTarget.name} | Fields: ${formState.schema.fields.length} | Select Fields: ${Object.keys(formState.selectOptions).length}`
          )
        ]),
        React.createElement(MainDataGrid, { key: 'main-grid', schema: formState.schema }),
        React.createElement('div', { key: 'form-fields', className: 'card' }, [
          React.createElement('div', { key: 'card-header', className: 'card-header' }, 
            React.createElement('h6', { className: 'mb-0' }, 'Form Fields')
          ),
          React.createElement('div', { key: 'card-body', className: 'card-body' }, 
            fieldOrder.map(fieldName => {
              const field = fieldsMap[fieldName];
              return field ? React.createElement(FormField, {
                key: fieldName,
                field,
                value: formState.formData[fieldName],
                onChange,
                formData: formState.formData,
                linkOptions: formState.linkOptions,
                selectOptions: formState.selectOptions,
                schema: formState.schema
              }) : null;
            }).filter(Boolean)
          )
        ])
      ]);
    }

    // Render the main component
    let container = document.getElementById('universal-form-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'universal-form-container';
      document.body.appendChild(container);
    }

    try {
      if (ReactDOM.createRoot) {
        ReactDOM.createRoot(container).render(React.createElement(UniversalFrappeForm));
      } else {
        ReactDOM.render(React.createElement(UniversalFrappeForm), container);
      }
    } catch (renderError) {
      console.error('Render error:', renderError);
      container.innerHTML = `<div class="alert alert-danger">Failed to render form: ${renderError.message}</div>`;
    }

  }).catch(err => {
    console.error('Failed to load React:', err);
    const container = document.getElementById('universal-form-container') || document.body;
    container.innerHTML = `<div class="alert alert-danger">Failed to load React: ${err.message}</div>`;
  });
})();