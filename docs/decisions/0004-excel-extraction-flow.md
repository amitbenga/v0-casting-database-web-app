_to_write="""# ADR 0004: Excel Extraction Flow for Roles

**Date**: 2026-02-14

**Status**: Proposed

## Context

Currently, roles can be created manually or extracted from script files (PDF, DOCX, etc.). However, casting data often originates from simple spreadsheets, especially in early stages of production. Providing a way to import roles directly from Excel files would streamline the workflow for casting directors and producers.

## Decision

We will integrate Excel file parsing into the existing 
"Scripts" tab, treating Excel as another source format for role extraction.

1.  **UI Integration**:
    -   The file upload input in the "Scripts" tab will be updated to accept Excel formats (`.xlsx`, `.xls`, `.csv`).
    -   The existing UI for removing the Excel import from the "Roles" tab will be handled by the v0 team.

2.  **Parsing and Mapping**:
    -   A new client-side parsing module will be implemented to handle Excel files. It will use a library like `xlsx` (SheetJS) to read the file content in the browser.
    -   After parsing, the system will present a **preview and mapping UI**. This UI will display the detected columns from the Excel sheet and allow the user to map them to the target role fields:
        -   **`role_name`** (Required): The user must select which column contains the role names.
        -   **`replicas_count`** (Optional): The user can select a column containing the number of replicas for each role.
        -   **`notes`** (Optional): The user can select a column for role descriptions or notes.

3.  **Extraction Pipeline**:
    -   Once the user confirms the mapping, the client-side code will process the Excel rows and transform them into the same `ParsedScriptBundle` format used by the existing script parser.
    -   This standardized object will then be passed to the `ScriptPreviewDialog`.

4.  **Backend Processing**:
    -   The extracted roles will go through the exact same approval and application pipeline as roles extracted from text-based scripts.
    -   When saved to the database, these roles will be stored in the `project_roles` table with `source = 'script'` (or a new source type like `'excel'` if more specific tracking is desired; for now, `'script'` is sufficient to indicate it was from a file).
    -   Conflict detection (`role_conflicts`) will not be applicable for Excel imports unless a specific column for scene information is added and mapped, which is out of scope for the initial implementation.

## Consequences

### Positive

-   **Improved Workflow**: Users can now import roles from a common and easy-to-use format, saving significant manual data entry time.
-   **Leverages Existing Pipeline**: By transforming the Excel data into the existing `ParsedScriptBundle` format, we reuse the entire backend and preview logic, reducing implementation complexity.
-   **Flexible**: The column mapping UI makes the feature robust, as it does not depend on a rigid Excel template.

### Negative

-   **New Dependency**: A client-side library for parsing Excel files (e.g., `xlsx`) will need to be added to the project.
-   **UI Complexity**: The mapping UI adds a new step and complexity to the script import process, but this is a necessary trade-off for flexibility.
