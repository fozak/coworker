// ============================================================================
// COMPACT FRAPPE FORM WIDGET with TanStack Table
// ============================================================================

(function() {
  if (!pb || !selectedTarget) {
    console.error('PocketBase or selectedTarget not found');
    return;
  }

  pb.autoCancellation(false);

  // Load dependencies
  const deps = [
    { url: 'https://cdn.tailwindcss.com', type: 'script' },
    { url: 'https://unpkg.com/react@18/umd/react.production.min.js', type: 'script' },
    { url: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', type: 'script' },
    { url: 'https://unpkg.com/@tanstack/react-table@8.10.7/build/umd/index.production.js', type: 'script' }
  ];

  async function loadDeps() {
    for (const dep of deps) {
      if (dep.type === 'script' && !document.querySelector(`script[src="${dep.url}"]`)) {
        await new Promise((resolve, reject) => {
          const el = document.createElement('script');
          el.src = dep.url;
          el.onload = resolve;
          el.onerror = reject;
          document.head.appendChild(el);
        });
      }
    }
  }

  loadDeps().then(() => {
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } = window.TanStackReactTable;
    const { useState, useEffect, useCallback, useMemo } = React;

    // ============================================================================
    // MAIN DATA GRID with TanStack Table
    // ============================================================================
    function DataGrid({ doctype }) {
      const [data, setData] = useState([]);
      const [globalFilter, setGlobalFilter] = useState('');
      const [rowSelection, setRowSelection] = useState({});

      useEffect(() => {
        pb.listDocs(doctype).then(setData);
      }, [doctype]);

      const columns = useMemo(() => {
        if (!data.length) return [];
        const schema = data[0]._schema; // assuming you attach schema
        const visibleFields = schema?.fields?.filter(f => f.in_list_view) || [];
        
        return [
          {
            id: 'select',
            header: ({ table }) => (
              <input type="checkbox" checked={table.getIsAllRowsSelected()} 
                onChange={table.getToggleAllRowsSelectedHandler()} />
            ),
            cell: ({ row }) => (
              <input type="checkbox" checked={row.getIsSelected()} 
                onChange={row.getToggleSelectedHandler()} />
            ),
            size: 40
          },
          {
            accessorKey: 'name',
            header: 'Name',
            cell: info => (
              <a href="#" className="text-blue-600 hover:underline"
                onClick={e => { e.preventDefault(); window.selectExistingRecord?.(info.row.original.id); }}>
                {pb.getDisplayName(info.row.original, schema)}
              </a>
            )
          },
          ...visibleFields.map(f => ({
            accessorKey: `data.${f.fieldname}`,
            header: f.label,
            cell: info => {
              const val = info.getValue();
              if (f.fieldtype === 'Check') return val ? '✓' : '✗';
              if (f.fieldtype === 'Select') return <span className={`px-2 py-1 rounded text-xs bg-${pb.getSelectBadgeColor(val)}-100`}>{val}</span>;
              return val || '';
            }
          }))
        ];
      }, [data]);

      const table = useReactTable({
        data,
        columns,
        state: { globalFilter, rowSelection },
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: true
      });

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {Object.keys(rowSelection).length > 0 && (
              <span className="text-sm bg-blue-100 px-2 py-1 rounded">
                {Object.keys(rowSelection).length} selected
              </span>
            )}
            <input
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search..."
              className="ml-auto px-3 py-1 border rounded text-sm"
            />
          </div>
          <div className="overflow-auto max-h-96 border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                        onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (header.column.getIsSorted() === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={row.getIsSelected() ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2 border-t">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ============================================================================
    // CHILD TABLE with TanStack Table
    // ============================================================================
    function ChildTable({ field, parentName }) {
      const [data, setData] = useState([]);
      const [schema, setSchema] = useState(null);

      useEffect(() => {
        pb.loadChildTableData(field.options, parentName).then(({ schema, records }) => {
          setSchema(schema);
          setData(records);
        });
      }, [field.options, parentName]);

      const columns = useMemo(() => {
        if (!schema) return [];
        const visibleFields = schema.fields.filter(f => f.in_list_view);
        return [
          { accessorKey: 'name', header: 'Name', size: 120 },
          ...visibleFields.map(f => ({
            accessorKey: `data.${f.fieldname}`,
            header: f.label,
            cell: ({ getValue, row, column }) => {
              const val = getValue();
              const isReadOnly = !!f.fetch_from;
              
              if (f.fieldtype === 'Check') {
                return <input type="checkbox" checked={!!val} disabled={isReadOnly}
                  onChange={e => updateCell(row.original.id, f.fieldname, e.target.checked ? 1 : 0)} />;
              }
              
              return (
                <div contentEditable={!isReadOnly} suppressContentEditableWarning
                  className={`px-2 py-1 min-w-20 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'border border-transparent hover:border-gray-300'}`}
                  onBlur={e => updateCell(row.original.id, f.fieldname, e.textContent)}>
                  {val || ''}
                </div>
              );
            }
          }))
        ];
      }, [schema]);

      const updateCell = useCallback(async (rowId, fieldName, value) => {
        const row = data.find(r => r.id === rowId);
        await pb.updateChild(row.name, fieldName, value);
        setData(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldName]: value } } : r));
      }, [data]);

      const addRow = useCallback(async () => {
        const newChild = await pb.createChild(field.options, parentName, selectedTarget.doctype, field.fieldname);
        setData(prev => [...prev, newChild]);
      }, [field, parentName]);

      const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="font-medium">{field.label}</label>
            <button onClick={addRow} className="ml-auto px-3 py-1 bg-blue-600 text-white rounded text-sm">Add Row</button>
          </div>
          <div className="overflow-auto max-h-64 border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th key={h.id} className="px-2 py-1 text-left">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="border-t">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ============================================================================
    // FORM FIELD
    // ============================================================================
    function FormField({ field, value, onChange, formData, linkOptions = {}, selectOptions = {} }) {
      if (field.fieldtype === 'Table') {
        return <ChildTable field={field} parentName={selectedTarget.name} />;
      }

      const options = field.fieldtype === 'Link' ? linkOptions[field.fieldname] || [] : 
                     field.fieldtype === 'Select' ? selectOptions[field.fieldname] || [] : [];

      const isReadOnly = !!field.fetch_from;

      return (
        <div className="space-y-1">
          <label className="text-sm font-medium">{field.label}</label>
          {field.fieldtype === 'Select' || field.fieldtype === 'Link' ? (
            <select value={value || ''} onChange={e => onChange(field.fieldname, e.target.value)}
              disabled={isReadOnly} className="w-full px-3 py-2 border rounded">
              <option value="">-- Select --</option>
              {options.map(opt => <option key={opt.value} value={opt.value}>{opt.displayName || opt.text}</option>)}
            </select>
          ) : field.fieldtype === 'Check' ? (
            <input type="checkbox" checked={!!value} onChange={e => onChange(field.fieldname, e.target.checked ? 1 : 0)}
              disabled={isReadOnly} />
          ) : field.fieldtype === 'Text' ? (
            <textarea value={value || ''} onChange={e => onChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly} rows={3} className="w-full px-3 py-2 border rounded" />
          ) : (
            <input type="text" value={value || ''} onChange={e => onChange(field.fieldname, e.target.value)}
              readOnly={isReadOnly} className="w-full px-3 py-2 border rounded" />
          )}
        </div>
      );
    }

    // ============================================================================
    // MAIN FORM
    // ============================================================================
    function FrappeForm() {
      const [state, setState] = useState({ schema: null, formData: {}, linkOptions: {}, selectOptions: {}, loading: true });

      useEffect(() => {
        pb.loadFormDataWithSelects(selectedTarget.doctype, selectedTarget.name)
          .then(({ schema, record, linkOptions, selectOptions }) => 
            setState({ schema, formData: record?.data || {}, linkOptions, selectOptions, loading: false }));
      }, []);

      const onChange = useCallback((fieldName, value) => {
        setState(prev => {
          const newData = { ...prev.formData, [fieldName]: value };
          clearTimeout(window._saveTimeout);
          window._saveTimeout = setTimeout(() => pb.updateDoc(selectedTarget.name, newData), 1000);
          return { ...prev, formData: newData };
        });
      }, []);

      if (state.loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

      return (
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <h1 className="text-2xl font-bold">{selectedTarget.doctype}</h1>
          <DataGrid doctype={selectedTarget.doctype} />
          <div className="grid grid-cols-2 gap-4">
            {(state.schema?.field_order || []).map(fn => {
              const field = state.schema.fields.find(f => f.fieldname === fn);
              return field ? <FormField key={fn} field={field} value={state.formData[fn]} 
                onChange={onChange} formData={state.formData} linkOptions={state.linkOptions} selectOptions={state.selectOptions} /> : null;
            })}
          </div>
        </div>
      );
    }

    // Render
    const root = document.getElementById('app') || (() => { 
      const el = document.createElement('div'); 
      el.id = 'app'; 
      document.body.appendChild(el); 
      return el; 
    })();
    ReactDOM.createRoot(root).render(<FrappeForm />);

  }).catch(console.error);
})();