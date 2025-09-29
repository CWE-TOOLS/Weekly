# Task Edit Commit Process to Google Sheets Backend

This document extracts and documents the complete process for committing task description edits from the Weekly Schedule Viewer application to the Google Sheets backend. This allows for implementation of similar functionality in other projects.

## Overview

The application allows users to edit task descriptions in a project modal view and commit those changes to a "staging" sheet in Google Sheets using the Google Sheets API. The process involves authentication via service account, data modification via batchUpdate API, and UI feedback.

## Prerequisites

### Google Sheets Setup
- **Primary Sheet**: "Primary Live List 2" - Contains the main task data
- **Staging Sheet**: "Staging - Project Details" - Stores edited descriptions by project
- **Service Account**: Configured with Google Sheets API access
- **Spreadsheet ID**: `1ReBnudzH_QAY6e45wwpf_sHd2OF1Akkppm0S7NmZ_ws`

### Authentication Credentials
- Service account JSON with private key
- Client email: `sheet-writer@test-1-468219.iam.gserviceaccount.com`
- API Key: `AIzaSyA0i2Mr7kVirmM72ggu_L7_3XAB3_EAsNw` (for read-only operations)

## Process Flow

### 1. User Interface Setup

#### Edit Mode Activation
```javascript
// Password protection for editing
const EDIT_PASSWORD = 'cwe'; // Simple password gate
let isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';
```

#### Modal Structure
- Project view modal (`#project-modal`) displays task cards
- Edit button (`#edit-plan-btn`) toggles edit mode
- Save/Cancel buttons for committing changes
- Loading overlay during save operations

### 2. Edit Mode Entry (enterEditMode function)

```javascript
function enterEditMode() {
    // Hide edit button, show save/cancel
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';

    // Convert descriptions to editable textareas
    const descriptions = document.querySelectorAll('#project-schedule-grid .task-description');
    descriptions.forEach(desc => {
        const taskId = desc.closest('.project-task-card').dataset.taskId;
        const originalText = desc.innerHTML;
        originalDescriptions.set(taskId, originalText);

        const textarea = document.createElement('textarea');
        textarea.className = 'edit-description';
        textarea.value = desc.textContent.trim() === 'Staging Missing' ? '' : desc.textContent.trim();
        desc.replaceWith(textarea);
    });
}
```

### 3. Authentication System

#### JWT Generation (generateJWT function)
```javascript
function base64UrlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateJWT() {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: SERVICE_ACCOUNT.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = encodedHeader + '.' + encodedPayload;

    // Sign with private key (RSA-SHA256)
    const signature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
    return message + '.' + encodedSignature;
}
```

#### Access Token Retrieval (getAccessToken function)
```javascript
async function getAccessToken() {
    if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedAccessToken;
    }

    const jwt = await generateJWT();
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    const data = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    return cachedAccessToken;
}
```

### 4. Save Process (saveChanges function)

#### Change Detection
```javascript
const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
const changedTasks = [];
textareas.forEach(textarea => {
    const taskId = textarea.closest('.project-task-card').dataset.taskId;
    const originalText = originalDescriptions.get(taskId);
    const originalStripped = stripHtml(originalText).trim();
    const newText = textarea.value.trim();

    // Update local task data
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
        task.description = newText;
    }

    // Check if changed
    if (newText !== originalStripped) {
        changedTasks.push({task, newText});
    }
});
```

#### Staging Sheet Update (saveToStaging function)
```javascript
async function saveToStaging(projectName, changedTasks) {
    const sheetId = await getSheetId(STAGING_SHEET_NAME);
    const stagingData = await getStagingData();
    const headers = stagingData[0] || [];

    // Find or create project column
    let projectCol = headers.indexOf(projectName);
    const requests = [];

    if (projectCol === -1) {
        // Insert new column after D (index 4)
        requests.push({
            "insertDimension": {
                "range": {
                    "sheetId": sheetId,
                    "dimension": "COLUMNS",
                    "startIndex": 4,
                    "endIndex": 5
                },
                "inheritFromBefore": false
            }
        });
        requests.push({
            "updateCells": {
                "range": {
                    "sheetId": sheetId,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 4,
                    "endColumnIndex": 5
                },
                "rows": [{
                    "values": [{
                        "userEnteredValue": { "stringValue": projectName }
                    }]
                }],
                "fields": "userEnteredValue"
            }
        });
        projectCol = 4;
    }

    // Update changed descriptions
    changedTasks.forEach(({task, newText}) => {
        const deptDay = task.department + ' ' + task.dayNumber;
        const rowIndex = departmentDayMapping[deptDay];
        if (rowIndex !== undefined) {
            requests.push({
                "updateCells": {
                    "range": {
                        "sheetId": sheetId,
                        "startRowIndex": rowIndex - 1,
                        "endRowIndex": rowIndex,
                        "startColumnIndex": projectCol,
                        "endColumnIndex": projectCol + 1
                    },
                    "rows": [{
                        "values": [{
                            "userEnteredValue": { "stringValue": newText }
                        }]
                    }],
                    "fields": "userEnteredValue"
                }
            });
        }
    });

    if (requests.length > 0) {
        const accessToken = await getAccessToken();
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ requests })
        });
    }
}
```

### 5. Department-Day Mapping

```javascript
const departmentDayMapping = {
    "Mill 1": 5, "Mill 2": 8, "Mill 3": 11, "Mill 4": 14,
    "Form Out 1": 17, "Form Out 2": 20, "Form Out 3": 23, "Form Out 4": 26,
    "Cast 1": 29, "Cast 2": 32,
    "Demold 1": 37, "Demold 2": 40, "Demold 3": 43,
    "Crating 1": 49, "Crating 2": 52,
    "Finish 1": 61, "Finish 2": 64, "Finish 3": 67, "Finish 4": 70, "Finish 5": 73,
    "Seal 1": 76, "Seal 2": 79, "Seal 3": 82, "Seal 4": 85,
    "Special 1": 88, "Special 2": 91, "Special 3": 94, "Special 4": 96, "Special 5": 100,
    "Ship 1": 102, "Ship 2": 105,
    "Load 1": 55, "Load 2": 58
};
```

### 6. UI Feedback and Cleanup

```javascript
// Show success notification
const successNotif = document.getElementById('project-success-notification');
successNotif.style.display = 'block';
setTimeout(() => {
    successNotif.style.display = 'none';
}, 2500);

// Trigger data refresh
await fetchTasks();

// Exit edit mode
exitEditMode();
```

## Error Handling

- Authentication failures are caught and logged
- API errors show user feedback via button state changes
- Network issues prevent saving and show error states
- Invalid data is handled gracefully with fallbacks

## Security Considerations

- Password-protected edit access (`EDIT_PASSWORD`)
- Service account credentials stored client-side (consider moving to backend)
- Write operations scoped to specific sheet and columns
- Read-only API key used for data fetching

## Implementation in Other Projects

### 1. Setup Requirements
- Google Cloud Project with Sheets API enabled
- Service account with spreadsheet access
- Spreadsheet with appropriate sheet structure

### 2. Authentication Implementation
- Implement JWT generation using Web Crypto API or server-side library
- Cache access tokens with appropriate expiry handling
- Handle token refresh automatically

### 3. API Integration
```javascript
// Generic batch update function
async function updateSheetCells(spreadsheetId, requests) {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ requests })
    });
    return response.json();
}
```

### 4. UI Components
- Modal system for editing interface
- Loading states and error feedback
- Success notifications with auto-dismiss

### 5. Data Mapping
- Implement department-day mapping for your specific sheet structure
- Handle dynamic column creation for new projects
- Validate data integrity before submission

## Key Technical Details

- **API Endpoint**: `https://sheets.googleapis.com/v4/spreadsheets/{id}:batchUpdate`
- **Authentication**: JWT Bearer token flow
- **Operations**: Insert dimensions, update cells
- **Error Handling**: HTTP status codes and error messages
- **Performance**: Batch operations reduce API calls
- **Data Flow**: Client-side editing → Staging sheet → Data refresh

This process provides a complete pattern for implementing collaborative editing workflows with Google Sheets as the backend persistence layer.