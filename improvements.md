 # Improvements and Refactoring Suggestions

 This document outlines areas of duplication or poor design decisions identified in the codebase, along with recommended refactoring steps.

 ## 1) OAuth Flow & State Management
 - **Inconsistent State Encoding/Decoding**
   - Duplicate manual use of `btoa`/`atob` vs shared `encodeState`/`decodeState` helpers.
 - **Un-signed “state” Parameter**
   - Raw AuthRequest embedded in OAuth `state` without HMAC signing or integrity protection.
 - **Duplicate OAuth Parameters**
   - `access_type: offline` and `prompt: consent` hard-coded in both authorization URL builder and token fetcher.
 - **Hard-coded Scopes & URLs**
   - Scopes string and Google OAuth endpoints repeated verbatim in multiple modules.

 ## 2) Cookie Handling
 - **Manual Cookie Parsing/Building**
   - Custom split/parse logic instead of a shared util or library for cookie handling.
 - **Unused Options API**
   - `cookieName` and `cookieSecret` in `ApprovalDialogOptions` are never applied in rendering or parsing.

 ## 3) Tool Definitions (src/tools)
 - **Repeated Field-Mapping Logic**
   - Tools like `list_directory` and `search_files` each reconstruct MCP payloads from `DriveFile` fields.
 - **Duplicated Move/Rename Logic**
   - `move-files` contains near-identical branches for rename vs move operations, including directory listing and file lookup.
 - **Parent-Directory Creation**
   - Recursive parent-creation in `create-folders` duplicates logic that could be shared by other operations.

 ## 4) GoogleDriveAdapter (src/services)
 - **Query-Builder Duplication**
   - Building Google Drive query strings (‘in parents’, `trashed=false`, filters) in multiple methods (`listDirectory`, `searchFiles`, tree builder).
 - **Mixed Concerns: Caching & Conversion**
   - Path↔ID cache management and model conversion live in the same class, blending cache, fetch, and mapping logic.

 ## 5) Miscellaneous
 - **Manual Tool Registration**
   - Each tool must be explicitly imported and registered in `index.ts` rather than discovered automatically.
 - **Large Inline HTML/CSS Block**
   - `renderApprovalDialog` contains several hundred lines of template and styles, impacting readability.

 ## Why This Matters
 - Reduces maintenance burden by centralizing shared logic.
 - Improves security by ensuring state and cookies are consistently signed and verified.
 - Enhances readability and reduces risk of drift when defaults change.

 ## Next Steps
 1. Centralize OAuth constants (URLs, scopes, default params) into a single module.
 2. Consolidate state encoding/signing into a shared helper; apply it consistently.
 3. Replace custom cookie parsing with a small util or off-the-shelf library.
 4. Abstract DriveFile→MCP payload mapping to eliminate repetitive switch/case logic.
 5. DRY up path resolution and file-lookup logic in move/rename tools, and consider a shared PathResolver.