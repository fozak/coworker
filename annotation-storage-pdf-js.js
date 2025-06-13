
//https://aistudio.google.com/prompts/1RJWOa52O2QJaPH-ah9U6swCuEwitArou

//PDFViewerApplication.pdfDocument.annotationStorage

function printAnnotationsFromStorage() {
  if (PDFViewerApplication.pdfDocument && PDFViewerApplication.pdfViewer) {
    const storage = PDFViewerApplication.pdfDocument.annotationStorage;
    if (storage) {
      console.log("Annotations in Storage:");
      for (const [key, value] of storage) {
        console.log(`  Annotation ID: ${key}`);
        console.log(`  Annotation Data:`, value);
      }
    } else {
      console.log("Annotation storage is not available.");
    }
  } else {
    console.log("PDF Document or PDFViewer is not yet initialized.");
  }
}

printAnnotationsFromStorage();

// this also load json

function removeAnnotationById(annotationId) {
  if (!PDFViewerApplication.pdfDocument || !PDFViewerApplication.pdfViewer) {
    console.warn("PDF Document or PDFViewer is not yet initialized.");
    return;
  }

  const storage = PDFViewerApplication.pdfDocument.annotationStorage;

  if (!storage.has(annotationId)) {
    console.warn(`Annotation with ID "${annotationId}" not found in storage.`);
    return;
  }

    const editor = storage.getRawValue(annotationId);
     if(editor) {
        editor.remove();
        return;
     }

    console.warn(`Annotation with ID "${annotationId}"  was found in storage but could not be retrieved. It might be invalid or corrupted.`);

}

const annotationIdToRemove = "pdfjs_internal_editor_2";
removeAnnotationById(annotationIdToRemove);

//loading 
async function loadAnnotationsFromJson(jsonUrl) {
  if (!PDFViewerApplication.pdfDocument || !PDFViewerApplication.pdfViewer) {
    console.warn("PDF Document or PDFViewer is not yet initialized.");
    return;
  }

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status}`);
    }
    const annotationsData = await response.json();
        const uiManager = PDFViewerApplication.pdfViewer.annotationEditorMode?._uiManager;
        if (!uiManager) {
          console.warn("AnnotationEditorUIManager is not initialized, skipping import for now. Try again when it's ready");
          return
        }

      // Iterate through the annotations and add them to the storage.
    for (const annotationId in annotationsData) {
        if (annotationsData.hasOwnProperty(annotationId)) {
            const annotationData = annotationsData[annotationId];

            if (PDFViewerApplication.pdfDocument.annotationStorage.has(annotationId)){
                console.log(`Annotation ${annotationId} already exist in AnnotationStorage`)
                continue;
            }

            try {
              //Use a getter from UI manager
              const editorType = uiManager._editorTypes?.get(annotationData.annotationType);
              if (!editorType) {
                console.warn(`Unsupported annotationType: ${annotationData.annotationType}`);
                continue;
              }
              const newEditor = await editorType.deserialize(annotationData, PDFViewerApplication.pdfViewer._pages[annotationData.pageIndex], uiManager);
              if (newEditor) {
                PDFViewerApplication.pdfDocument.annotationStorage.setValue(annotationId, newEditor);

                  PDFViewerApplication.pdfViewer._pages[annotationData.pageIndex].annotationEditorLayer.addOrRebuild(newEditor)
                  PDFViewerApplication.pdfViewer.refresh()

              } else {
                console.warn(`Could not deserialize annotation with ID ${annotationId}.`);
              }
            } catch (ex) {
              console.warn(`Could not deserialize annotation with ID ${annotationId}:`, ex);
            }
          }
        }

    PDFViewerApplication.pdfViewer.refresh(); // Redraw to display the annotations
    console.log("Annotations loaded from JSON successfully!");
  } catch (error) {
    console.error("Error loading annotations:", error);
  }
}

// Replace "path/to/your/annotations.json" with the actual URL
const jsonUrl = "annotations.json";
loadAnnotationsFromJson(jsonUrl);