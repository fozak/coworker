pb.getSchema = async function (doctype) {
  try {
    const schemaResult = await this.collection(window.MAIN_COLLECTION).getList(1, 1, {
      filter: `doctype = "Schema" && data._schema_doctype = "${doctype}"`
    });
    return schemaResult.items.length > 0 ? schemaResult.items[0].data : null;
  } catch (error) {
    console.error(`Error fetching schema for doctype "${doctype}":`, error);
    return null;
  }
};