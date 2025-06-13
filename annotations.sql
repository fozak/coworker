--https://chatgpt.com/c/683676a6-4f80-8007-9ae8-048163216573

SELECT
    ia.itemID AS attachmentItemID,
    ia.parentItemID AS attachmentParentItemID,
    ia.contentType,
    ia.path,
    ann.itemID AS annotationItemID,
    ann.type,
    ann.authorName,
    ann.text AS annotationText,
    ann.comment,
    ann.color,
    ann.pageLabel,
    ann.sortIndex,
    ann.position
FROM
    itemAttachments ia
JOIN
    itemAnnotations ann ON ann.parentItemID = ia.itemID
ORDER BY
    ia.itemID, ann.sortIndex;
