def fingerprint_obj(obj):
    """Create a simple fingerprint string for an object for comparison."""
    if obj["type"] == "text_block":
        return f"text:{obj['content'].strip()}"
    elif obj["type"] == "image":
        # Use dimensions + colorspace instead of object_id for images too
        return f"image:{obj.get('width')}_{obj.get('height')}_{obj.get('colorspace')}"
    elif obj["type"] == "annotation":
        # Don't use object_id for annotations - use content + position + type
        subtype = obj.get('subtype', 'unknown')
        content = obj.get('content', '').strip()
        
        # Get position info if available
        position = ""
        if 'rect' in obj and obj['rect']:
            rect = obj['rect']
            if isinstance(rect, (list, tuple)) and len(rect) >= 4:
                # Round coordinates to handle minor differences
                position = f"{round(rect[0])},{round(rect[1])},{round(rect[2])},{round(rect[3])}"
        
        # Create fingerprint without object_id
        return f"annot:{subtype}_{content}_{position}"
    else:
        # fallback fingerprint
        return str(obj)

def compare_pdf_trees(tree1, tree2):
    diffs = {"only_in_pdf1": [], "only_in_pdf2": []}
    # Build dict by page number for quick lookup
    pages1 = {p["page_number"]: p for p in tree1["pages"]}
    pages2 = {p["page_number"]: p for p in tree2["pages"]}
    all_pages = set(pages1.keys()).union(pages2.keys())
    
    for page_num in sorted(all_pages):
        objs1 = pages1.get(page_num, {}).get("objects", [])
        objs2 = pages2.get(page_num, {}).get("objects", [])
        
        # Fingerprint sets for quick diff
        fps1 = {fingerprint_obj(o) for o in objs1}
        fps2 = {fingerprint_obj(o) for o in objs2}
        
        only1 = fps1 - fps2
        only2 = fps2 - fps1
        
        if only1:
            diffs["only_in_pdf1"].append({"page": page_num, "objects": list(only1)})
        if only2:
            diffs["only_in_pdf2"].append({"page": page_num, "objects": list(only2)})
    
    return diffs

if __name__ == "__main__":
    import pprint
    tree1 = get_pdf_objects_tree("pdf1.pdf")
    tree2 = get_pdf_objects_tree("pdf2.pdf")
    diff_tree = compare_pdf_trees(tree1, tree2)
    pprint.pprint(diff_tree)