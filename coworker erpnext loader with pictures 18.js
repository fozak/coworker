// Self-contained widget - paste this entire code into your custom_text field
// Your client script only needs: widgetCode = cur_frm.doc.custom_text; eval(widgetCode);

//this only works well in Desk - need to replace desk methods like cur_frm --> frappe.web_form methods
(function() {
  // Widget configuration and data
  const WIDGET_CONFIG = {
      "data": {
            "customerInfo": {
                  "name": "",
                  "phone": "",
                  "email": ""
            },
            "vehicleInfo": {
                  "year": "1989",
                  "make": "Toyota",
                  "model": "",
                  "vin": "",
                  "mileage": ""
            },
            "inspectionItems": {
                  "engine": {
                        "oilLevel": {
                              "status": "attention",
                              "comment": "needs replacement",
                              "photos": []
                        },
                        "coolantLevel": {
                              "status": "attention",
                              "comment": "",
                              "photos": []
                        },
                        "airFilter": {
                              "status": "good",
                              "comment": "",
                              "photos": []
                        }
                  },
                  "brakes": {
                        "frontPads": {
                              "status": "good",
                              "comment": "",
                              "photos": []
                        },
                        "rearPads": {
                              "status": "good",
                              "comment": "",
                              "photos": []
                        },
                        "fluidLevel": {
                              "status": "good",
                              "comment": "",
                              "photos": []
                        }
                  }
            },
            "recommendations": []
      }
};

  // Photo upload utility function
  async function uploadPhoto(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/method/upload_file", {
        method: "POST",
        headers: {
          "X-Frappe-CSRF-Token": frappe.csrf_token,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: formData
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      
      if (result && result.message && result.message.file_url) {
        console.log("✅ Uploaded File URL:", result.message.file_url);
        return result.message.file_url;
      } else {
        throw new Error("Unexpected response structure");
      }
    } catch (error) {
      console.error("❌ Upload failed:", error);
      throw error;
    }
  }

  // Load dependencies
  var loadScript = (src) => {
    return new Promise((resolve) => {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      document.head.appendChild(script);
    });
  };
  console.log('Loading widget dependencies...');
  
  Promise.all([
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js')
  ]).then(() => {
    
    // Initialize or load existing data
    function getWidgetData() {
      try {
        let currentValue = cur_frm.get_field('custom_text').value;
        
        // Try to extract existing data from the current code
        let dataMatch = currentValue.match(/WIDGET_CONFIG\s*=\s*({[\s\S]*?});/);
        if (dataMatch) {
          let extractedConfig = eval('(' + dataMatch[1] + ')');
          return extractedConfig.data;
        }
      } catch (error) {
        console.log('Using default widget data');
      }
      return WIDGET_CONFIG.data;
    }
    
    // Save updated data back to custom_text
    function saveWidgetData(newData) {
      try {
        let currentCode = cur_frm.get_field('custom_text').value;
        
        // Create updated config
        let updatedConfig = {
          data: newData
        };
        
        // Replace the WIDGET_CONFIG data section in the code
        let newCode = currentCode.replace(
          /WIDGET_CONFIG\s*=\s*{[\s\S]*?};/,
          `WIDGET_CONFIG = ${JSON.stringify(updatedConfig, null, 6)};`
        );
        
        // Update the field
        cur_frm.set_value('custom_text', newCode);
        cur_frm.save();
        
        console.log('Widget data saved successfully');
        return true;
      } catch (error) {
        console.error('Failed to save widget data:', error);
        return false;
      }
    }
    
    // Add styles
    if (!document.getElementById('widget-styles')) {
      var style = document.createElement('style');
      style.id = 'widget-styles';
      style.textContent = `
        .inspection-widget{max-width:800px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:12px;background:white;box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:Arial,sans-serif}
        .widget-header{background:#2563eb;color:white;padding:20px;border-radius:8px;margin-bottom:20px;text-align:center}
        .widget-header h2{margin:0;font-size:24px}
        .section{margin-bottom:20px;padding:15px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb}
        .section-title{font-weight:bold;font-size:16px;color:#1f2937;margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid #e5e7eb}
        .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
        .form-group{margin-bottom:10px}
        .form-group label{display:block;margin-bottom:5px;font-weight:600;color:#374151;font-size:14px}
        .form-group input,.form-group textarea,.form-group select{width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;transition:border-color 0.2s}
        .form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.1)}
        .btn{padding:12px 24px;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s}
        .btn-primary{background:#2563eb;color:white}
        .btn-secondary{background:#6b7280;color:white}
        .btn-success{background:#10b981;color:white}
        .btn-danger{background:#ef4444;color:white}
        .btn:hover{opacity:0.9;transform:translateY(-1px)}
        .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .data-display{background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:15px;margin:10px 0}
        .data-display pre{margin:0;font-size:12px;white-space:pre-wrap}
        .inspection-item{border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin-bottom:15px;background:white}
        .inspection-controls{display:flex;gap:10px;align-items:center;margin-bottom:10px}
        .inspection-controls select{flex:0 0 120px}
        .inspection-controls input{flex:1}
        .photo-section{margin-top:10px}
        .photo-upload{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .photo-upload input[type="file"]{display:none}
        .photo-upload label{background:#f3f4f6;border:2px dashed #d1d5db;padding:20px;text-align:center;border-radius:8px;cursor:pointer;transition:all 0.2s;flex:1}
        .photo-upload label:hover{background:#e5e7eb;border-color:#9ca3af}
        .photo-upload label.uploading{background:#fef3c7;border-color:#f59e0b;color:#92400e}
        .photo-gallery{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
        .photo-item{position:relative;display:inline-block}
        .photo-item img{width:100px;height:100px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb}
        .photo-item .remove-btn{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .photo-item .remove-btn:hover{background:#dc2626}
      `;
      document.head.appendChild(style);
    }
    
    // React Component
    const { useState, useEffect } = React;
    
    function VehicleInspectionWidget() {
      const [formData, setFormData] = useState(getWidgetData());
      const [isSaving, setIsSaving] = useState(false);
      const [showData, setShowData] = useState(false);
      const [uploadingPhotos, setUploadingPhotos] = useState({});

      const handleInputChange = (section, field, value) => {
        setFormData(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value
          }
        }));
      };

      const handlePhotoUpload = async (category, item, files) => {
        const uploadKey = `${category}-${item}`;
        setUploadingPhotos(prev => ({ ...prev, [uploadKey]: true }));
        
        try {
          const uploadPromises = Array.from(files).map(file => uploadPhoto(file));
          const uploadedUrls = await Promise.all(uploadPromises);
          
          setFormData(prev => ({
            ...prev,
            inspectionItems: {
              ...prev.inspectionItems,
              [category]: {
                ...prev.inspectionItems[category],
                [item]: {
                  ...prev.inspectionItems[category][item],
                  photos: [...prev.inspectionItems[category][item].photos, ...uploadedUrls]
                }
              }
            }
          }));
          
          frappe.show_alert({
            message: `${files.length} photo(s) uploaded successfully!`,
            indicator: 'green'
          });
        } catch (error) {
          console.error('Photo upload error:', error);
          frappe.show_alert({
            message: 'Failed to upload photos',
            indicator: 'red'
          });
        } finally {
          setUploadingPhotos(prev => ({ ...prev, [uploadKey]: false }));
        }
      };

      const removePhoto = (category, item, photoIndex) => {
        setFormData(prev => ({
          ...prev,
          inspectionItems: {
            ...prev.inspectionItems,
            [category]: {
              ...prev.inspectionItems[category],
              [item]: {
                ...prev.inspectionItems[category][item],
                photos: prev.inspectionItems[category][item].photos.filter((_, index) => index !== photoIndex)
              }
            }
          }
        }));
      };

      const handleSubmit = async () => {
        setIsSaving(true);
        try {
          const success = saveWidgetData(formData);
          if (success) {
            frappe.show_alert({
              message: 'Data saved successfully!',
              indicator: 'green'
            });
          } else {
            frappe.show_alert({
              message: 'Error saving data',
              indicator: 'red'
            });
          }
        } catch (error) {
          console.error('Save error:', error);
          frappe.show_alert({
            message: 'Error saving data',
            indicator: 'red'
          });
        }
        setIsSaving(false);
      };

      const handleReset = () => {
        setFormData(WIDGET_CONFIG.data);
      };

      const renderInspectionCategory = (categoryName, categoryData) => {
        return React.createElement('div', { className: 'section' },
          React.createElement('div', { className: 'section-title' }, 
            categoryName.charAt(0).toUpperCase() + categoryName.slice(1) + ' Inspection'
          ),
          Object.keys(categoryData).map(item => {
            const uploadKey = `${categoryName}-${item}`;
            const isUploading = uploadingPhotos[uploadKey];
            
            return React.createElement('div', { key: item, className: 'inspection-item' },
              React.createElement('label', { style: { fontWeight: 'bold', marginBottom: '10px', display: 'block' } },
                item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
              ),
              
              // Status and comment controls
              React.createElement('div', { className: 'inspection-controls' },
                React.createElement('select', {
                  value: categoryData[item].status,
                  onChange: (e) => setFormData(prev => ({
                    ...prev,
                    inspectionItems: {
                      ...prev.inspectionItems,
                      [categoryName]: {
                        ...prev.inspectionItems[categoryName],
                        [item]: {
                          ...prev.inspectionItems[categoryName][item],
                          status: e.target.value
                        }
                      }
                    }
                  }))
                },
                  React.createElement('option', { value: 'good' }, 'Good'),
                  React.createElement('option', { value: 'attention' }, 'Attention'),
                  React.createElement('option', { value: 'urgent' }, 'Urgent')
                ),
                React.createElement('input', {
                  type: 'text',
                  placeholder: 'Comment...',
                  value: categoryData[item].comment,
                  onChange: (e) => setFormData(prev => ({
                    ...prev,
                    inspectionItems: {
                      ...prev.inspectionItems,
                      [categoryName]: {
                        ...prev.inspectionItems[categoryName],
                        [item]: {
                          ...prev.inspectionItems[categoryName][item],
                          comment: e.target.value
                        }
                      }
                    }
                  }))
                })
              ),
              
              // Photo upload section
              React.createElement('div', { className: 'photo-section' },
                React.createElement('div', { className: 'photo-upload' },
                  React.createElement('input', {
                    type: 'file',
                    id: `photo-${categoryName}-${item}`,
                    accept: 'image/*',
                    multiple: true,
                    onChange: (e) => {
                      if (e.target.files.length > 0) {
                        handlePhotoUpload(categoryName, item, e.target.files);
                      }
                    }
                  }),
                  React.createElement('label', {
                    htmlFor: `photo-${categoryName}-${item}`,
                    className: isUploading ? 'uploading' : ''
                  }, isUploading ? 'Uploading...' : 'Click to upload photos')
                ),
                
                // Photo gallery
                categoryData[item].photos.length > 0 && React.createElement('div', { className: 'photo-gallery' },
                  categoryData[item].photos.map((photoUrl, photoIndex) =>
                    React.createElement('div', { key: photoIndex, className: 'photo-item' },
                      React.createElement('img', {
                        src: photoUrl,
                        alt: `${item} photo ${photoIndex + 1}`,
                        onError: (e) => {
                          e.target.style.border = '2px solid #ef4444';
                          e.target.alt = 'Failed to load image';
                        }
                      }),
                      React.createElement('button', {
                        className: 'remove-btn',
                        onClick: () => removePhoto(categoryName, item, photoIndex),
                        title: 'Remove photo'
                      }, '×')
                    )
                  )
                )
              )
            );
          })
        );
      };

      return React.createElement('div', { className: 'inspection-widget' },
        React.createElement('div', { className: 'widget-header' },
          React.createElement('h2', null, 'Vehicle Inspection Form')
        ),
        
        // Customer Info Section
        React.createElement('div', { className: 'section' },
          React.createElement('div', { className: 'section-title' }, 'Customer Information'),
          React.createElement('div', { className: 'form-grid' },
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Name'),
              React.createElement('input', {
                type: 'text',
                value: formData.customerInfo.name,
                onChange: (e) => handleInputChange('customerInfo', 'name', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Phone'),
              React.createElement('input', {
                type: 'text',
                value: formData.customerInfo.phone,
                onChange: (e) => handleInputChange('customerInfo', 'phone', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Email'),
              React.createElement('input', {
                type: 'email',
                value: formData.customerInfo.email,
                onChange: (e) => handleInputChange('customerInfo', 'email', e.target.value)
              })
            )
          )
        ),
        
        // Vehicle Info Section
        React.createElement('div', { className: 'section' },
          React.createElement('div', { className: 'section-title' }, 'Vehicle Information'),
          React.createElement('div', { className: 'form-grid' },
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Year'),
              React.createElement('input', {
                type: 'text',
                value: formData.vehicleInfo.year,
                onChange: (e) => handleInputChange('vehicleInfo', 'year', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Make'),
              React.createElement('input', {
                type: 'text',
                value: formData.vehicleInfo.make,
                onChange: (e) => handleInputChange('vehicleInfo', 'make', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Model'),
              React.createElement('input', {
                type: 'text',
                value: formData.vehicleInfo.model,
                onChange: (e) => handleInputChange('vehicleInfo', 'model', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'VIN'),
              React.createElement('input', {
                type: 'text',
                value: formData.vehicleInfo.vin,
                onChange: (e) => handleInputChange('vehicleInfo', 'vin', e.target.value)
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', null, 'Mileage'),
              React.createElement('input', {
                type: 'text',
                value: formData.vehicleInfo.mileage,
                onChange: (e) => handleInputChange('vehicleInfo', 'mileage', e.target.value)
              })
            )
          )
        ),
        
        // Inspection Items Sections
        renderInspectionCategory('engine', formData.inspectionItems.engine),
        renderInspectionCategory('brakes', formData.inspectionItems.brakes),
        
        // Action Buttons
        React.createElement('div', { 
          style: { 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'center', 
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '2px solid #e5e7eb'
          } 
        },
          React.createElement('button', {
            className: 'btn btn-primary',
            onClick: handleSubmit,
            disabled: isSaving
          }, isSaving ? 'Saving...' : 'Save Data'),
          
          React.createElement('button', {
            className: 'btn btn-secondary',
            onClick: handleReset
          }, 'Reset Form'),
          
          React.createElement('button', {
            className: 'btn btn-success',
            onClick: () => setShowData(!showData)
          }, showData ? 'Hide Data' : 'Show Data')
        ),
        
        // Data Display (for debugging)
        showData && React.createElement('div', { className: 'data-display' },
          React.createElement('h4', null, 'Current Form Data:'),
          React.createElement('pre', null, JSON.stringify(formData, null, 2))
        )
      );
    }
    
    // Create container and render
    let container = document.getElementById('inspection-widget-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'inspection-widget-container';
      document.body.appendChild(container);
    }
    ReactDOM.render(React.createElement(VehicleInspectionWidget), container);
    
    console.log('Widget loaded successfully!');
  
  }).catch(error => {
    console.error('Failed to load widget dependencies:', error);
  });
})();