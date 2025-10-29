        const API_KEY = 'AIzaSyA0i2Mr7kVirmM72ggu_L7_3XAB3_EAsNw';
        const SPREADSHEET_ID = '1ReBnudzH_QAY6e45wwpf_sHd2OF1Akkppm0S7NmZ_ws';
        const SHEET_NAME = 'Primary Live List 2';
        const STAGING_SHEET_NAME = 'Staging - Project Details';

        // Service Account JSON
        let SERVICE_ACCOUNT = {
            "type": "service_account",
            "project_id": "test-1-468219",
            "private_key_id": "fbc2ff13cf04d5fb4b147818628d600e91ed5345",
            "private_key": "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRRGgrL2V2S3R0SVFDMmkKYld4\n4bFhHcFc3NlFqUno5aVpmdkdzSlZBbGJ0L3daalZRRWhvemh2cE0yZ3VVMGN6VnNndkI0cjZNWm8vQUFpZgpremloVFl6MWlOV0QrZ2l5cS83ekNvSVpmV1ZlK2tNUHdl\nldE1QU1lTVR1bmVLME0zS0xGNEp0c0gYVRLaTFlckYKOEwwcU5ueGhOUWtwa0cwM0U5c3J3bzZhOUY5eSt0K3dEVGNsTldRVnR6bGZJTGh4VituQ3RNeng5aTJIaFgvaTMK\nKL0E4Tmhtem5DW5kVUFscEFWSUwyNXlXeC8xakQvVFNTazV6OTUyZUo2Mmt6a256amNvR2ptakdmZ1Y3VDJ1awpFb2NHa29GUFF3SEowUy85NFhVa2pKeXFxRWQ2NUNu\nudlFINTdHZDM1akUwdGlHeVFSUkIxVzkvTXpHMU00QnJsCmRWeFY0ZStGQWdNQkFBRUNnZ0VBQjFaM0pHanYxZGkvb3BhSy9uK1J0R0R6bzNHY3pVVWlkOEVrRjRURklk\nkRFgKZFpVd3hMWnNrWlhwdkJkWUtJS1lM3dSSVM1M0k3U01reUhrcE5ndnk0azE1YU1veFNSd2t0TzBoYjljbTBqbApCSTMzWmZKV1dpSFYxakQxaVV6NDlnT2NkY20w\nwcTBXRzhsYm54YTZFYkwyOHlxTllVeHp3V2YvMldnMThUWFQ3CncvaEYzTVVWWUlpeWNHSWk0VFRjVDgya2RtcVYrTzAyL2diTktTS1VBWEYxTTFCRXNEVEVYWFFUZDJI\nISm5nNnMKY2xaWUROTVFMV1UyZ25ZcW5MVy8rU29MdmR2OHcxaEpKbFdjbUJoVjlvUGVSQ3h4QjhzVXd0M3h2djROak9Qcwp2ZnlncFNYa1JkQUhCd1dXdDBxS2J6bDFz\nzUFd6bUN4cS9GN0RWeGpyd1FLQmdRRDRuRzd4cno1NUdIZUVCM2F4CncvbXdldTdBMzRQUldPMUUzM1lDSFhFOXMvM3VLZlZMa2M0QmV6WE91WGxlV3htdGtlT1E0Y2lw\nwbHRwN0F5MkkKOEY5NDRwSTFqTWRXU3ErbTRzS1FibHRnZVQ1eEJ4bVM5SW84bXM5YUhDT29sb2UzVHlOUXRURllhZDQrNndpdwpBY0JWR0tmY0JDY1YweTUwZVR1aitm\nmL3FHd0tCZ1FEb3MyQ0w4WHFIenRXQjBYdGF4QjNyNSsxYWFEL1JqZGJOCmNObGxmS0FkWkc3NGFXeWNHRGNKNExFNnBSL1h5Q0hJVXg1djBhUHFLank3T0g1VDJCVmJw\nwczJzMUN5K3F6Um0KbXZjUjBWM2JybGJCMXBvZGZVd1dJMllXcDVDVjRGV0R1QUpsWVFnY05wOEpqK1lHRXkzb1lnSlhPTmJXeE1LWAo1RkRhVE84bTN3S0JnRTBIbTFD\nDRExlWXpjSVNXRTI3TS9BWjBjSm1PSjcgZXJ5QWg0L0lWM1Bla1NaZkZ2U3JPWgpmNnp4MGlBMVU2ZXFybkFiTGRsc085SmdEVjNrQkMzVDNLRUdBcXRZN1VLTmJaTlYy\nyMWNJK29NUHpnc1RXaGN3CmNjeUpZd25XZ2kzd1JiakQrbnM5U1FiTjlyQ2ovbE1hbDg5R0RteWJWTWpzWUE1eXFjb0s0Z0pWQW9HQkFObWsKYS9oM3NwS3k4UjZxUHlW\nWMXFFYXNkV0xKZm1jUXNvY1R0VUVtZnRyK3hJdXlqdEt3RTBvNXpZbDhSM3dhd3Y0SwpQNzExNWtsdGw3L0Q1dU9raHRWaC9aeFlGa0YrLzFPNFBMMTloTHVqSTZISWhm\nmeHU1R3NRVUx0L25jdVFObXNyCi81R3lYMU9FQXR0K3F6V2pXcHl1am1IbDE0cW9IUmpUZ291cXlVTWhBb0dBVmhUU1J6Y081RnE1OHNINVJDTEoKckR2UFhCdEtBL0l3\n3a1N3eHUwdHdzQkZhb0hER0YydWQvL3BFVDdvNkI3V1NEQkdJSzcySEtYSXo2eU1TdzBVZwo1QkF5UTYzdjE3UHVjRVpmWUw5eVVET25hLy9jb3FDdlZUd2dXcDJBWDd3\n3MHNublV0d1NWMUtHTVY5bG9kc3JzCk1wVThZRWNpT2s2SU1qYVVUbVNJVE5rPQotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg==",
            "client_email": "sheet-writer@test-1-468219.iam.gserviceaccount.com",
            "client_id": "117725617866432687465",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sheet-writer%40test-1-468219.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        };

        let cachedAccessToken = null;
        let tokenExpiry = null;

        let allTasks = [];
        let filteredTasks = [];
        let currentDate = new Date();
        let allWeekStartDates = []; // Store the start dates of all rendered weeks
        const EDIT_PASSWORD = 'cwe'; // Rudimentary password for unlocking editing
        let currentProjectName = '';
        let currentViewedWeekIndex = -1; // Track the currently viewed week to preserve on refresh
        let lastRenderTimestamp = null; // Track when we last successfully rendered
        let renderCache = null; // Cache the last successful render

        const departmentDayMapping = {
            "Mill 1": 5,
            "Mill 2": 8,
            "Mill 3": 11,
            "Mill 4": 14,
            "Form Out 1": 17,
            "Form Out 2": 20,
            "Form Out 3": 23,
            "Form Out 4": 26,
            "Cast 1": 29,
            "Cast 2": 32,
            "Demold 1": 37,
            "Demold 2": 40,
            "Demold 3": 43,
            "Crating 1": 49,
            "Crating 2": 52,
            "Finish 1": 61,
            "Finish 2": 64,
            "Finish 3": 67,
            "Finish 4": 70,
            "Finish 5": 73,
            "Seal 1": 76,
            "Seal 2": 79,
            "Seal 3": 82,
            "Seal 4": 85,
            "Special 1": 88,
            "Special 2": 91,
            "Special 3": 94,
            "Special 4": 96,
            "Special 5": 100,
            "Ship 1": 102,
            "Ship 2": 105,
            "Load 1": 55,
            "Load 2": 58
        };

        SERVICE_ACCOUNT.private_key = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDh+/evKttIQC2i\nbWxlXGpW76QjRz9iZfvGsJVAlbt/wZjVQEhozhvpM2guU0czVsgvB4r6MZo/AAif\nkzihTYz1iNWD+giyq/7zCoIZfWVe+kMPwetMPSYSTuneK8G3KLFxJss8aTKk1evF\n/0qoNxxNQKpkG03E9srwo6a9F9y+t+wDTclNWQVtzlfILhxW+nCtMzx9i2HhX/i3\n/A8NhmznCZwVALPAVIL25yWx/1jD/TSSk5z952eJ62kzknzjcoGjmjgFfgV7T2uk\nEocGkoFPQwHJ0S/94XUkjJyqqEd65CnvQH57Gd35jE0tiGyQRRB1W9/MzG1M4Brl\ndVxV4e+FAgMBAAECggEAB1Z3JGjv1di/opaK/n+RtGDzo3GczUUid8EkF4TFIdDX\ndZUwxLZskZXpvBdYKIKY3W4RRS53I7SMkyHkpNgvy4k15aMoxSRwktO0hb9cm0jl\nBI33ZfJWWiHV1jD1iUz49gOcdcm0q0WG8lbnxa6EbL28yqNYUxzwWf/2Wg18TXT7\nw/hF3MUVYIiycGIy4TTcT82kdmqV+O02/gbNKSKUAXF1M1BEsDTEXXQTd2HJng6s\nclZYDNMQLWU2gnYqnLW/+SoLvdv8w1hJJlWcmBhV9oPeRCxxB8sUwt3xvv4NjOPs\nvfygpSXkRdAHBwWWt0qKbzl1sPWzmCxq/F7DVxjrwQKBgQD4nG7xrz55GHeEB3ax\nw/mweu7A34PRWO1E33YCHXE9s/3uKfVLkc4BezXOuXleWxmtkeOQ4cipltp7Ay2I\n8F944pI1jMdWSq+m4sKQbltgeT5xBxmS9Io8ms9aHCOoloe3TyNQtTFYad4+6wiw\nAcBVGKfcBCcV0y50eTuj+f/qGwKBgQDos2CL8XqHztWB0XtaxB3r5+1aaD/RjdbN\ncNllfKAdZG74aWycGDcJ4LE6pR/XyCHIUx5v0aPqKjy7OH5T2BVbps2s1Cy+qzRm\nmvcR0V3brlbB1podfUwWI2YWp5CV4FWDuAJlYQgcNp8Jj+YGEy3oYgJXONbWxMKX\n5FDaTO8m3wKBgE0Hm1CDLeYzcISWE27M/AZ0cJmOJ7 eryAh4/IV3PekSZfFvSrOZ\nf6zx0iA1U6eqrnAbLdlsO9JgDV3kBC3T3KEGAqtY7UKNbZNV21cI+oMPzgsTWhcw\nccyJYwnWgi3wRijD+ns9SQbN9rCj/lMal89GDmybVMjsYA5yqcoK4gJVAoGBANmk\na/h3spKy8R6qPyV1qEasdWLJfmcQsocTtUEmftr+xIuyjtKwE0o5zYl8R3wawv4K\nP7115kltl7/D5uOkhtVh/ZxYFkF+/1O4PL19hLujI6HIhfxu5GsQULt/ncuQNmsr\n/5GyX1OEAtt+qzWjWpyujmHl14qoHRjTgouqyUMhAoGAVhTSRzcO5Fq58sH5RCLJ\nrDvPXBtKA/IwkSwxu0twsBFaoHDGF2ud//pET7o6B7WSDBGIK72HKXIz6yMSw0Ug\n5BAyQ63v17PucEZfYL9yUDOna//coqCvVTwgWp2AX7w0snnUtwSV1KGMV9lodsrs\nMpU8YEciOk6IMjaUTmSITNk=\n-----END PRIVATE KEY-----\n`;

        // JWT and OAuth functions for service account authentication
        function base64UrlEncode(str) {
            return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }

        function base64UrlDecode(str) {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4) str += '=';
            return atob(str);
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

            const privateKeyPem = SERVICE_ACCOUNT.private_key.replace(/-----BEGIN PRIVATE KEY-----\n/, '').replace(/\n-----END PRIVATE KEY-----\n/, '').replace(/\n/g, '');
            let privateKeyDer;
            try {
                privateKeyDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));
            } catch (e) {
                console.log('Error with atob:', e.message);
                console.log('privateKeyPem:', privateKeyPem);
                throw e;
            }

            const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                privateKeyDer,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                },
                false,
                ['sign']
            );

            const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(message));
            const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

            return message + '.' + encodedSignature;
        }

        async function getAccessToken() {
            if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
                return cachedAccessToken;
            }

            const jwt = await generateJWT();
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get access token');
            }

            const data = await response.json();
            cachedAccessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000; // Refresh 5 minutes before expiry for better performance
            return cachedAccessToken;
        }

        // Department order for sorting
        const DEPARTMENT_ORDER = [
            'Special Events',
            'Mill',
            'Form Out',
            'Cast',
            'Batch',
            'Demold',
            'Layout',
            'Finish',
            'Seal',
            'Special',
            'Crating',
            'Load',
            'Ship'
        ];

        function normalizeDepartment(dept) {
            if (!dept) return '';
            const normalized = dept.toLowerCase().trim();
            // Handle case-insensitive matching for department names
            if (normalized === 'special events') return 'Special Events';
            if (normalized === 'mill') return 'Mill';
            if (normalized === 'formout' || normalized === 'form out') return 'Form Out';
            if (normalized === 'cast') return 'Cast';
            if (normalized === 'batch') return 'Batch';
            if (normalized === 'demold') return 'Demold';
            if (normalized === 'layout') return 'Layout';
            if (normalized === 'finish') return 'Finish';
            if (normalized === 'seal') return 'Seal';
            if (normalized === 'special') return 'Special';
            if (normalized === 'crating') return 'Crating';
            if (normalized === 'load') return 'Load';
            if (normalized === 'ship') return 'Ship';
            return dept;
        }

        function normalizeDepartmentClass(dept) {
            if (!dept) return '';
            return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }

function parseDate(e){if(!e)return null;const t=e.split("/");if(3===t.length){const[e,r,n]=t.map(Number),a=new Date(n,e-1,r);return isNaN(a)?null:a}const o=e.split("-");if(3===o.length){const[a,i,s]=o.map(Number),c=new Date(a,i-1,s);return isNaN(c)?null:c}return isNaN(new Date(e))?null:new Date(e)}

        function getLocalDateString(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function formatDateToMMDDYYYY(date) {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        }

        function getWeekMonth(monday) {
            const daysInEachMonth = {};
            for (let i = 0; i < 5; i++) { // Mon to Fri
                const date = new Date(monday);
                date.setDate(monday.getDate() + i);
                const month = date.getMonth();
                daysInEachMonth[month] = (daysInEachMonth[month] || 0) + 1;
            }
            let maxDays = 0;
            let majorMonth = monday.getMonth();
            for (const m in daysInEachMonth) {
                if (daysInEachMonth[m] > maxDays) {
                    maxDays = daysInEachMonth[m];
                    majorMonth = parseInt(m);
                }
            }
            return majorMonth;
        }

        function getWeekOfMonth(monday, month) {
            const year = monday.getFullYear();
            let startOfWeek1 = getMonday(new Date(year, month, 1));
            // Find the first Monday whose week has majority days in the month
            while (getWeekMonth(startOfWeek1) !== month) {
                startOfWeek1 = new Date(startOfWeek1.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
            const diffMs = monday - startOfWeek1;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const weekNum = 1 + Math.floor(diffDays / 7);
            return Math.max(1, weekNum);
        }

        async function fetchTasks() {
            const modalOpen = document.getElementById('project-modal').classList.contains('show');
            const silent = modalOpen;

            if (!silent) {
                showLoading(true);
                hideError();
            }

            try {
                // Fetch Google Sheets data
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:Z?key=${API_KEY}`);
                const data = await response.json();

                if (!data.values) {
                    throw new Error('No data found in sheet');
                }

                const sheetsTasks = parseSheetData(data.values);

                // Fetch manual tasks from Supabase
                const manualTasks = await loadManualTasks();

                // Merge tasks, with manual tasks taking precedence for same ID
                const manualTaskIds = new Set(manualTasks.map(t => t.id));
                allTasks = [...sheetsTasks.filter(t => !manualTaskIds.has(t.id)), ...manualTasks];

                calculateProjectDayCounts(allTasks); // Calculate the day counts
                populateDepartmentCheckboxes();
                filterTasks(); // This will call renderWeeklySchedule

                if (!silent) {
                    showLoading(false);
                }
            } catch (error) {
                if (!silent) {
                    showError('Failed to load tasks: ' + error.message);
                    showLoading(false);
                } else {
                    console.error('Silent refresh failed:', error);
                }
            }
        }

        async function getSheetId(sheetName) {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`);
            if (!response.ok) throw new Error('Failed to fetch sheet metadata');
            const data = await response.json();
            const sheet = data.sheets.find(s => s.properties.title === sheetName);
            return sheet ? sheet.properties.sheetId : null;
        }

        async function getStagingData() {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(STAGING_SHEET_NAME)}!A1:ZZ?key=${API_KEY}`);
            if (!response.ok) throw new Error('Failed to fetch staging data');
            const data = await response.json();
            return data.values || [];
        }

        function stripHtml(html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        }

        async function saveToStaging(projectName, changedTasks) {
            try {
                const sheetId = await getSheetId(STAGING_SHEET_NAME);
                if (!sheetId) throw new Error('Staging sheet not found');
                const stagingData = await getStagingData();
                const headers = stagingData[0] || [];
                let projectCol = headers.indexOf(projectName);
                const requests = [];
                if (projectCol === -1) {
                    // Insert column after D (index 3, so startIndex 4)
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
                    // Set header in new column E (index 4)
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
                // Now update the changed descriptions
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
                    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ requests })
                    });
                    if (!response.ok) {
                        const error = await response.text();
                        throw new Error('Failed to update sheet: ' + error);
                    }
                    console.log('Successfully saved to staging sheet');
                    return true;
                }
                return true;
            } catch (error) {
                console.error('Error saving to staging:', error);
                throw error; // Re-throw to handle in caller
            }
        }

        function parseSheetData(rows) {
            const tasks = [];
            const headers = rows[0];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length >= 1) {  // Import incomplete entries
                    const task = {
                             id: `task-${i}`,
                             week: row[0] || '',
                             project: row[1] || '',
                             projectDescription: row[2] || '',
                             description: row[9] || '',
                             date: row[3] || '',
                             department: normalizeDepartment(row[4] || ''),
                             value: row[5] || '',
                             hours: row[6] || '',
                             dayNumber: row[7] || '',
                             totalDays: row[8] || ''
                         };
                    tasks.push(task);
                }
            }

            return tasks;
        }

        function calculateProjectDayCounts(tasks) {
            tasks.forEach(task => {
                const taskDate = parseDate(task.date);
                if (!taskDate) {
                    task.missingDate = true;
                }
                if (task.dayNumber && task.totalDays) {
                    const dayNum = parseInt(task.dayNumber);
                    const total = parseInt(task.totalDays);
                    if (!isNaN(dayNum) && !isNaN(total)) {
                        task.dayCounter = `Day ${dayNum} of ${total}`;
                    } else {
                        task.dayCounter = '';
                    }
                } else {
                    task.dayCounter = '';
                }
            });
        }

        function getSelectedDepartments() {
            const selected = [];
            document.querySelectorAll('#department-list input[type="checkbox"]:checked').forEach(checkbox => {
                selected.push(checkbox.value);
            });
            return selected;
        }

        function populateDepartmentCheckboxes() {
            const uniqueDepartmentsInTasks = new Set(allTasks.map(task => task.department));
            const departments = DEPARTMENT_ORDER;
            const list = document.getElementById('department-list');
            list.innerHTML = ''; // Clear previous list

            const savedDepartments = JSON.parse(localStorage.getItem('selectedDepartments')) || departments;

            departments.forEach(dept => {
                const listItem = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `dept-${normalizeDepartmentClass(dept)}`;
                checkbox.value = dept;
                checkbox.checked = savedDepartments.includes(dept);

                const label = document.createElement('label');
                label.htmlFor = `dept-${normalizeDepartmentClass(dept)}`;
                label.textContent = dept;

                listItem.appendChild(checkbox);
                listItem.appendChild(label);
                list.appendChild(listItem);

                // Add event listener to filter tasks when a checkbox is changed
                listItem.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                    filterTasks();
                    // Save department selection state
                    const selectedDepts = getSelectedDepartments();
                    localStorage.setItem('selectedDepartments', JSON.stringify(selectedDepts));
                });
            });
            updateMultiSelectLabel();
        }

        function updateMultiSelectLabel() {
            const selectedCount = getSelectedDepartments().length;
            const totalCount = document.querySelectorAll('#department-list input[type="checkbox"]').length;
            const label = document.getElementById('multi-select-label');

            if (selectedCount === 0) {
                label.textContent = 'None Selected';
            } else if (selectedCount === totalCount) {
                label.textContent = 'All Departments';
            } else if (selectedCount === 1) {
                label.textContent = getSelectedDepartments()[0];
            } else {
                label.textContent = `${selectedCount} Departments Selected`;
            }
        }

        function filterTasks() {
            const selectedDepartments = getSelectedDepartments();
            localStorage.setItem('selectedDepartments', JSON.stringify(selectedDepartments));

            if (selectedDepartments.length === 0) {
                filteredTasks = [];
            } else {
                const allDeptsSelected = selectedDepartments.length === [...new Set(allTasks.map(task => task.department))].filter(dept => dept).length;
                if (allDeptsSelected) {
                     filteredTasks = [...allTasks];
                } else {
                    filteredTasks = allTasks.filter(task => selectedDepartments.includes(task.department));
                }
            }
            updateMultiSelectLabel();
            renderAllWeeks();
        }

        function showNextWeek() {
            const wrapper = document.getElementById('schedule-wrapper');
            wrapper.scrollBy({ left: wrapper.offsetWidth, behavior: 'smooth' });
        }

        function showPreviousWeek() {
            const wrapper = document.getElementById('schedule-wrapper');
            wrapper.scrollBy({ left: -wrapper.offsetWidth, behavior: 'smooth' });
        }

function getMonday(e){e=new Date(e);const t=e.getDay()||7;return 1!==t&&e.setHours(-24*(t-1)),e.setHours(0,0,0,0),e}

        function renderAllWeeks() {
            showRenderingStatus(true, 'Rendering schedule...');
            const container = document.getElementById('schedule-container');
            const wrapper = document.getElementById('schedule-wrapper');
            container.innerHTML = '';
            allWeekStartDates = [];

            if (filteredTasks.length === 0) {
                container.innerHTML = '<div class="loading">No tasks found for the selected department.</div>';
                return;
            }

            // Group tasks by the Monday of their week
            const tasksByWeek = {};
            let currentMonday = getMonday(new Date()); // Assign early for missing dates
            filteredTasks.forEach(task => {
                let taskDate = parseDate(task.date);
                if (!taskDate) {
                    task.missingDate = true;
                    taskDate = currentMonday; // Assign to current week for display
                }
                const monday = getMonday(taskDate);
                const mondayString = getLocalDateString(monday);
                if (!tasksByWeek[mondayString]) {
                    tasksByWeek[mondayString] = [];
                }
                tasksByWeek[mondayString].push(task);
            });

            // Generate all weeks between the earliest and latest non-empty weeks, including empty ones
            const mondayStrings = Object.keys(tasksByWeek);
            let allMondays = [];
            if (mondayStrings.length === 0) {
                // No tasks, include only current week
                currentMonday = getMonday(new Date());
                const currentMondayString = getLocalDateString(currentMonday);
                allMondays = [currentMonday];
                tasksByWeek[currentMondayString] = [];
            } else {
                mondayStrings.sort();
                const minMonday = new Date(mondayStrings[0] + 'T00:00:00');
                const maxMonday = new Date(mondayStrings[mondayStrings.length - 1] + 'T00:00:00');
                let current = new Date(minMonday);
                while (current <= maxMonday) {
                    const mondayString = getLocalDateString(current);
                    allMondays.push(new Date(current));
                    if (!tasksByWeek[mondayString]) {
                        tasksByWeek[mondayString] = [];
                    }
                    current.setDate(current.getDate() + 7);
                }
                // Include current week if not already included
                currentMonday = getMonday(new Date());
                const currentMondayString = getLocalDateString(currentMonday);
                if (!allMondays.some(d => d.getTime() === currentMonday.getTime())) {
                    allMondays.push(currentMonday);
                    allMondays.sort((a, b) => a - b);
                    if (!tasksByWeek[currentMondayString]) {
                        tasksByWeek[currentMondayString] = [];
                    }
                }
            }
            allWeekStartDates = allMondays;

            // --- Global Calculation for Row Normalization ---
            const maxTasksPerDept = {};
            DEPARTMENT_ORDER.forEach(dept => {
                const deptTasks = filteredTasks.filter(t => t.department === dept);
                if (deptTasks.length === 0) return;

                const tasksByDate = {};
                deptTasks.forEach(task => {
                    let taskDate = parseDate(task.date);
                    if (!taskDate) {
                        task.missingDate = true;
                        taskDate = getMonday(new Date());
                    }
                    const dateString = taskDate.toDateString();
                    if (!tasksByDate[dateString]) tasksByDate[dateString] = [];
                    tasksByDate[dateString].push(task);
                });

                const maxTasks = Math.max(0, ...Object.values(tasksByDate).map(tasks => tasks.length));
                if (maxTasks > 0) {
                    maxTasksPerDept[dept] = maxTasks;
                }
            });
            maxTasksPerDept['Batch'] = 1;
            maxTasksPerDept['Layout'] = 1;

            // Render a grid for each week using the global max tasks count - use document fragment for better performance
            const fragment = document.createDocumentFragment();
            allWeekStartDates.forEach(mondayDate => {
                fragment.appendChild(renderWeekGrid(mondayDate, maxTasksPerDept));
            });
            container.appendChild(fragment);

            // Determine the initial week index, preserving the currently viewed week if set
            if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allWeekStartDates.length) {
                // Try to restore from localStorage first
                const savedWeekIndex = localStorage.getItem('currentViewedWeekIndex');
                const savedScrollPosition = localStorage.getItem('scheduleScrollPosition');

                if (savedWeekIndex && !isNaN(parseInt(savedWeekIndex))) {
                    const restoredIndex = parseInt(savedWeekIndex);
                    if (restoredIndex < allWeekStartDates.length) {
                        currentViewedWeekIndex = restoredIndex;
                    }
                }

                // If no valid saved position, set to current week
                if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allWeekStartDates.length) {
                    currentMonday = getMonday(new Date());
                    currentViewedWeekIndex = allWeekStartDates.findIndex(d => d.getTime() === currentMonday.getTime());
                    if (currentViewedWeekIndex === -1) {
                        currentViewedWeekIndex = allWeekStartDates.findIndex(d => d > currentMonday);
                        if (currentViewedWeekIndex === -1) currentViewedWeekIndex = allWeekStartDates.length - 1;
                    }
                }
            }
            let initialWeekIndex = currentViewedWeekIndex;

            // Performance optimization: Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                // Set the precise width for each grid now that they are in the DOM
                const wrapperWidth = wrapper.clientWidth;
                const grids = container.querySelectorAll('.schedule-grid');
                grids.forEach(grid => {
                    grid.style.width = `${wrapperWidth}px`;
                });

                // Scroll to the target grid
                if (grids[initialWeekIndex]) {
                    const targetScrollLeft = grids[initialWeekIndex].offsetLeft;

                    // Try to restore from localStorage first
                    const savedScrollPosition = localStorage.getItem('scheduleScrollPosition');
                    if (savedScrollPosition && !isNaN(parseFloat(savedScrollPosition))) {
                        const savedPosition = parseFloat(savedScrollPosition);
                        // Only use saved position if it's within reasonable bounds
                        if (savedPosition >= 0 && savedPosition <= wrapper.scrollWidth) {
                            wrapper.scrollLeft = savedPosition;
                            // Update currentViewedWeekIndex based on restored position
                            currentViewedWeekIndex = Math.round(savedPosition / wrapper.offsetWidth);
                        } else {
                            wrapper.scrollLeft = targetScrollLeft;
                        }
                    } else {
                        wrapper.scrollLeft = targetScrollLeft;
                    }
                }

                // Update header after scroll position is set
                const finalWeekIndex = Math.min(currentViewedWeekIndex, allWeekStartDates.length - 1);
                updateWeekDisplayHeader(allWeekStartDates[finalWeekIndex]);

                equalizeAllCardHeights();
                // Reset will-change after optimizations
                wrapper.style.willChange = 'auto';
            });

            // Store successful render state
            lastRenderTimestamp = Date.now();
            renderCache = {
                containerHTML: container.innerHTML,
                scrollPosition: wrapper.scrollLeft,
                weekIndex: currentViewedWeekIndex,
                weekDates: [...allWeekStartDates]
            };

            // Re-enable add card indicators after rendering
            setTimeout(() => {
                enableAddCardIndicators();
                showRenderingStatus(false);
            }, 100);
        }

        function updateWeekDisplayHeader(date) {
            if (!date) return;
            const monday = getMonday(date);
            const month = getWeekMonth(monday);
            const weekNum = getWeekOfMonth(monday, month);
            const weekStart = new Date(monday);
            const weekEnd = new Date(monday);
            weekEnd.setDate(monday.getDate() + 5);
            const weekDisplay = document.getElementById('week-display');
            weekDisplay.textContent = `Week ${weekNum}: ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }

function equalizeAllCardHeights(){const e=document.getElementById("schedule-container"),t=new Set();e.querySelectorAll(".schedule-grid").forEach(e=>{const r=e.dataset.rowClasses||"";r.split(",").forEach(e=>{e&&t.add(e)})}),t.forEach(t=>{const r=e.querySelectorAll(`.${t}`);if(0===r.length)return;let n=0;r.forEach(e=>{const t=e.offsetHeight;t>n&&(n=t)}),n>0&&r.forEach(e=>{e.style.minHeight=`${n}px`})})}

        function equalizeProjectCardHeights() {
            const projectSections = document.querySelectorAll('.project-dept-section');

            projectSections.forEach(section => {
                const cards = section.querySelectorAll('.project-task-card');
                if (cards.length === 0) return;

                // Find max height
                let maxHeight = 0;
                cards.forEach(card => {
                    const originalHeight = card.style.minHeight;
                    card.style.minHeight = 'auto';
                    const currentHeight = card.offsetHeight;
                    if (currentHeight > maxHeight) maxHeight = currentHeight;
                    card.style.minHeight = originalHeight;
                });

                // Apply max height to all cards in this section
                if (maxHeight > 0) {
                    cards.forEach(card => {
                        card.style.minHeight = `${maxHeight}px`;
                    });
                }
            });
        }

        function renderWeekGrid(dateForWeek, maxTasksPerDept) {
            const grid = document.createElement('div');
            grid.className = 'schedule-grid';

            // --- Date Setup ---
            const monday = new Date(dateForWeek);
            monday.setDate(dateForWeek.getDate() - (dateForWeek.getDay() || 7) + 1);
            grid.dataset.mondayDate = getLocalDateString(monday);
            const weekDates = Array.from({ length: 6 }).map((_, i) => {
                const date = new Date(monday);
                date.setDate(monday.getDate() + i);
                return date;
            });

            // Generate batch tasks (Mon-Fri only)
            const batchTasks = [];
            weekDates.forEach((date, i) => {
                if (i < 5) { // Mon to Fri
                    const nextDate = new Date(date);
                    let castingProjects = [];
                    if (i === 4) { // Friday
                        // Get tasks for Saturday
                        const saturday = new Date(date);
                        saturday.setDate(date.getDate() + 1);
                        const saturdayString = saturday.toDateString();
                        const saturdayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                            .map(t => t.project);
                        if (saturdayProjects.length > 0) {
                            castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                        }

                        // Get tasks for Monday
                        const monday = new Date(date);
                        monday.setDate(date.getDate() + 3);
                        const mondayString = monday.toDateString();
                        const mondayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                            .map(t => t.project);
                        if (mondayProjects.length > 0) {
                            castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                        }
                    } else {
                        // For Mon-Thu, get next day's tasks
                        const nextDate = new Date(date);
                        nextDate.setDate(date.getDate() + 1);
                        const nextDateString = nextDate.toDateString();
                        castingProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                            .map(t => t.project);
                    }
                    const batchTask = {
                        id: `batch-${date.toISOString()}`,
                        week: getLocalDateString(getMonday(dateForWeek)),
                        project: 'Batch',
                        description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                        date: getLocalDateString(date),
                        department: 'Batch',
                        value: '',
                        hours: '',
                        dayNumber: '',
                        totalDays: '',
                        dayCounter: '',
                        missingDate: false
                    };
                    batchTasks.push(batchTask);
                }
            });

            // Generate layout tasks (Mon-Fri only)
            const layoutTasks = [];
            weekDates.forEach((date, i) => {
                if (i < 5) { // Mon to Fri
                    const nextDate = new Date(date);
                    let castingProjects = [];
                    if (i === 4) { // Friday
                        // Get tasks for Saturday
                        const saturday = new Date(date);
                        saturday.setDate(date.getDate() + 1);
                        const saturdayString = saturday.toDateString();
                        const saturdayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                            .map(t => t.project);
                        if (saturdayProjects.length > 0) {
                            castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                        }

                        // Get tasks for Monday
                        const monday = new Date(date);
                        monday.setDate(date.getDate() + 3);
                        const mondayString = monday.toDateString();
                        const mondayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                            .map(t => t.project);
                        if (mondayProjects.length > 0) {
                            castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                        }
                    } else {
                        // For Mon-Thu, get next day's tasks
                        const nextDate = new Date(date);
                        nextDate.setDate(date.getDate() + 1);
                        const nextDateString = nextDate.toDateString();
                        castingProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                            .map(t => t.project);
                    }
                    const layoutTask = {
                        id: `layout-${date.toISOString()}`,
                        week: getLocalDateString(getMonday(dateForWeek)),
                        project: 'Layout',
                        description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                        date: getLocalDateString(date),
                        department: 'Layout',
                        value: '',
                        hours: '',
                        dayNumber: '',
                        totalDays: '',
                        dayCounter: '',
                        missingDate: false
                    };
                    layoutTasks.push(layoutTask);
                }
            });

            // --- Header Row ---
let t=`<div class="grid-header">Department</div>`;weekDates.forEach(e=>{const d=e.toDateString()===new Date().toDateString();t+=`<div class="grid-header"><div class="date-container ${d?"today-highlight":""}"><div class="date-weekday">${e.toLocaleDateString("en-US",{weekday:"short"})}</div><div class="date-day">${e.toLocaleDateString("en-US",{day:"numeric"})}</div></div></div>`}),grid.innerHTML=t;

            // --- Data Grouping ---
            const tasksByDept = {};
            // Initialize all departments from DEPARTMENT_ORDER with empty arrays
            DEPARTMENT_ORDER.forEach(dept => {
                tasksByDept[dept] = [];
            });
            filteredTasks.forEach(task => {
                const dept = task.department || 'Other';
                if (!tasksByDept[dept]) tasksByDept[dept] = [];
                tasksByDept[dept].push(task);
            });
            tasksByDept['Batch'] = batchTasks;
            tasksByDept['Layout'] = layoutTasks;
            // Ensure Special Events always exists even if empty
            if (!tasksByDept['Special Events']) {
                tasksByDept['Special Events'] = [];
            }

            // Collect all departments present in tasks, sorted by DEPARTMENT_ORDER priority
            const allDepts = new Set(DEPARTMENT_ORDER);
            Object.keys(tasksByDept).forEach(dept => allDepts.add(dept));
            const sortedDepts = Array.from(allDepts).sort((a, b) => {
                const aIndex = DEPARTMENT_ORDER.indexOf(a);
                const bIndex = DEPARTMENT_ORDER.indexOf(b);
                if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });

            const allRowClasses = new Set();

            // --- Render Department Rows ---
            sortedDepts.forEach(dept => {
                if (tasksByDept[dept] !== undefined) {
                    const deptTasks = tasksByDept[dept];
                    const tasksByDate = {};
                    weekDates.forEach(date => {
                        const dateString = date.toDateString();
                        tasksByDate[dateString] = deptTasks.filter(t => {
                            if (!t.date) return false;
                            const taskDate = parseDate(t.date);
                            return taskDate && taskDate.toDateString() === dateString;
                        });
                    });

                    const maxTasksInRow = maxTasksPerDept[dept] || 0;
                    if (maxTasksInRow === 0) return;

                    // Add department label, spanning all its potential rows
                    const deptLabel = document.createElement('div');
                    deptLabel.className = `department-label department-${normalizeDepartmentClass(dept)}`;
                    if (dept === 'Special Events') {
                        deptLabel.innerHTML = 'Special<br>Events';
                    } else {
                        deptLabel.textContent = dept;
                    }
                    deptLabel.style.gridRow = `span ${maxTasksInRow}`;
                    deptLabel.style.zIndex = '10'; // Ensure department labels stay above dragging cards
                    grid.appendChild(deptLabel);

                    for (let i = 0; i < maxTasksInRow; i++) {
                        const rowClass = `dept-row-${normalizeDepartmentClass(dept)}-${i}`;
                        allRowClasses.add(rowClass);

                        weekDates.forEach(date => {
                            const dateString = date.toDateString();
                            const dayCell = document.createElement('div');
                            dayCell.className = 'grid-cell';

                            const task = tasksByDate[dateString] ? tasksByDate[dateString][i] : undefined;

const d=localStorage.getItem('editingUnlocked')==='true';if(task){const e=task.department!=='Batch'&&task.department!=='Layout',m=task.isManual&&d;dayCell.innerHTML=`<div class="task-card ${rowClass} department-${normalizeDepartmentClass(task.department)} ${m?'':'not-draggable'}" data-task-id="${task.id}" ${m?'draggable="true"':''} title="${m?'Drag to move to different date':'Click for options'}"><div class="task-title">${task.project}</div><div class="project-description">${task.projectDescription||''}</div><div class="task-day-counter">${task.dayCounter||''}</div><div class="task-description">${task.description&&task.description.trim()?task.description:'<span class="missing-description">Staging Missing</span>'}</div>${e?`<div class="task-details">${task.missingDate?'<strong>Date:</strong> Missing<br>':''}<strong>Hours:</strong> ${task.hours}</div>`:''}${d?`<button class="task-plan-btn" data-task-id="${task.id}">Plan</button><button class="task-edit-btn" data-task-id="${task.id}">Edit</button>`:''}${m?`<button class="task-delete-btn" data-task-id="${task.id}" title="Delete this manual task">🗑️</button>`:''}</div>`}else{const year=date.getFullYear(),month=(date.getMonth()+1).toString().padStart(2,'0'),day=date.getDate().toString().padStart(2,'0'),p=`${year}-${month}-${day}`,g=getLocalDateString(getMonday(date));const placeholder=document.createElement('div');placeholder.className=`task-card-placeholder ${rowClass}${d?' add-enabled':''}`;placeholder.dataset.department=dept;placeholder.dataset.date=p;placeholder.dataset.week=g;dayCell.appendChild(placeholder);};
                            grid.appendChild(dayCell);
                        });
                    }
                }
            });

            grid.dataset.rowClasses = [...allRowClasses].join(',');
            return grid;
        }

        function showLoading(show, message = 'Loading tasks...') {
            const loadingElement = document.getElementById('loading');
            if (show) {
                loadingElement.style.display = 'block';
                // Update message if provided
                if (message) {
                    loadingElement.querySelector('div:first-child').textContent = message;
                }
                // Performance monitoring: Track render start time
                window.renderStartTime = performance.now();
                // Auto-hide after 30 seconds to prevent getting stuck
                if (window.loadingTimeout) clearTimeout(window.loadingTimeout);
                window.loadingTimeout = setTimeout(() => {
                    loadingElement.style.display = 'none';
                    console.warn('Loading indicator auto-hidden after timeout');
                }, 30000);
            } else {
                loadingElement.style.display = 'none';
                if (window.loadingTimeout) {
                    clearTimeout(window.loadingTimeout);
                    window.loadingTimeout = null;
                }
                // Performance monitoring: Log render completion time
                if (window.renderStartTime) {
                    const renderTime = performance.now() - window.renderStartTime;
                    console.log(`Render completed in ${renderTime.toFixed(2)}ms`);
                    window.renderStartTime = null;
                }
            }
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }

        function showRenderingStatus(show, message = 'Optimizing layout...') {
            const statusElement = document.getElementById('rendering-status');
            if (show) {
                statusElement.textContent = message;
                statusElement.style.display = 'block';
            } else {
                statusElement.style.display = 'none';
            }
        }

        // Drag and Drop functionality for manual tasks
        let draggedTask = null;
        let dragGhost = null;

        // Add drag and drop event listeners to the schedule wrapper
        document.addEventListener('dragstart', function(e) {
            if (!(e.target instanceof Element)) return;
            const taskCard = e.target.closest('.task-card[draggable="true"]');
            if (taskCard) {
                draggedTask = taskCard.dataset.taskId ? allTasks.find(t => t.id === taskCard.dataset.taskId) : null;
                if (draggedTask) {
                    e.dataTransfer.setData('text/plain', draggedTask.id);
                    e.dataTransfer.effectAllowed = 'move';

                    // Create a custom drag image
                    dragGhost = taskCard.cloneNode(true);
                    dragGhost.classList.add('dragging');
                    dragGhost.style.position = 'absolute';
                    dragGhost.style.top = '-1000px';
                    dragGhost.style.left = '-1000px';
                    dragGhost.style.width = taskCard.offsetWidth + 'px';
                    dragGhost.style.height = taskCard.offsetHeight + 'px';
                    dragGhost.style.opacity = '0.9';
                    dragGhost.style.pointerEvents = 'none';
                    dragGhost.style.transform = 'rotate(2deg)'; // Subtle rotation for visual feedback
                    document.body.appendChild(dragGhost);
                    e.dataTransfer.setDragImage(dragGhost, e.offsetX, e.offsetY);

                    taskCard.style.opacity = '0.3';
                    taskCard.classList.add('dragging');

                    // Add dragging-active class to body for visual feedback
                    document.body.classList.add('dragging-active');
                }
            }
        });

        document.addEventListener('dragend', function(e) {
            if (!(e.target instanceof Element)) return;
            const taskCard = e.target.closest('.task-card[draggable="true"]');
            if (taskCard) {
                taskCard.style.opacity = '1';
                taskCard.classList.remove('dragging');
            }

            // Remove drag ghost
            if (dragGhost && dragGhost.parentNode) {
                dragGhost.parentNode.removeChild(dragGhost);
                dragGhost = null;
            }

            // Remove dragging visual indicators
            document.body.classList.remove('dragging-active');
            document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
                el.classList.remove('drag-over', 'drag-invalid');
            });

            draggedTask = null;
        });

        document.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Provide visual feedback on drop zones
            if (!(e.target instanceof Element)) return;
            const dropTarget = e.target.closest('.task-card-placeholder');
            if (dropTarget && draggedTask) {
                const placeholder = dropTarget;
                const isValidDrop = placeholder.dataset.department === draggedTask.department;

                // Remove previous highlights
                document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
                    el.classList.remove('drag-over', 'drag-invalid');
                });

                // Add current highlight
                if (isValidDrop) {
                    placeholder.classList.add('drag-over');
                } else {
                    placeholder.classList.add('drag-invalid');
                }
            }
        });

        document.addEventListener('dragleave', function(e) {
            // Only remove highlight if actually leaving the drop zone
            if (!(e.target instanceof Element)) return;
            const relatedTarget = e.relatedTarget;
            const placeholder = e.target.closest('.task-card-placeholder');

            if (placeholder && relatedTarget) {
                const isLeavingDropZone = !placeholder.contains(relatedTarget) &&
                                          !relatedTarget.closest('.task-card-placeholder');

                if (isLeavingDropZone) {
                    placeholder.classList.remove('drag-over', 'drag-invalid');
                }
            }
        });

        document.addEventListener('drop', async function(e) {
            e.preventDefault();

            if (!draggedTask) return;

            if (!(e.target instanceof Element)) return;
            const dropTarget = e.target.closest('.task-card-placeholder');
            if (dropTarget) {
                const newDate = dropTarget.dataset.date;
                const newWeek = dropTarget.dataset.week;
                const department = dropTarget.dataset.department;

                // Only allow dropping if department matches
                if (department !== draggedTask.department) {
                    showSuccessNotification('Cannot move task to different department', true);
                    return;
                }

                // Only allow dropping if date is different
                if (newDate === draggedTask.date) {
                    showSuccessNotification('Task is already on this date', true);
                    return;
                }

                try {
                    // Show loading state on original card
                    const originalCard = document.querySelector(`.task-card[data-task-id="${draggedTask.id}"]`);
                    if (originalCard) {
                        originalCard.style.opacity = '0.5';
                        originalCard.style.pointerEvents = 'none';
                    }

                    // Update task locally
                    draggedTask.date = newDate;
                    draggedTask.week = newWeek;

                    // Save to Supabase
                    let supabaseSuccess = false;
                    try {
                        await updateTaskInSupabase(draggedTask);
                        supabaseSuccess = true;
                    } catch (supabaseError) {
                        console.error('Supabase update failed:', supabaseError);
                        // Don't throw here - we want to continue with refresh signal
                    }

                    // Send refresh signal to all clients (don't fail the whole operation if this fails)
                    try {
                        await sendRefreshSignal({
                            action: 'task_moved',
                            taskId: draggedTask.id,
                            newDate: newDate,
                            department: department
                        });
                    } catch (signalError) {
                        console.error('Refresh signal failed:', signalError);
                        // Continue - this is not critical
                    }

                    // Refresh local data
                    await fetchTasks();

                    // Show appropriate success message
                    if (supabaseSuccess) {
                        showSuccessNotification('Task moved successfully!');
                    } else {
                        showSuccessNotification('Task moved locally. Sync to server may have failed.', true);
                    }

                } catch (error) {
                    console.error('Failed to move task:', error);
                    showSuccessNotification('Failed to move task', true);

                    // Restore original card if save failed
                    if (originalCard) {
                        originalCard.style.opacity = '1';
                        originalCard.style.pointerEvents = 'auto';
                    }
                }
            }
        });

        // Function to update task in Supabase
        async function updateTaskInSupabase(task) {
            if (!supabaseClient) {
                await initializeSupabase();
            }

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            try {
                const { error } = await supabaseClient
                    .from(tasksTable)
                    .update({
                        date: task.date,
                        week: task.week,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.id);

                clearTimeout(timeoutId);

                if (error) {
                    throw error;
                }

                console.log('✅ Task updated in Supabase');
                return true;
            } catch (error) {
                clearTimeout(timeoutId);
                console.error('❌ Failed to update task in Supabase:', error);
                throw error;
            }
        }

        // Event listeners
        const dropdown = document.getElementById('multi-select-dropdown');
        const dropdownBtn = document.getElementById('multi-select-btn');
        const dropdownPanel = document.getElementById('multi-select-panel');

        dropdownBtn.addEventListener('click', () => {
            const isOpen = dropdown.classList.toggle('open');
            dropdownBtn.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                dropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });

        document.getElementById('select-all-btn').addEventListener('click', () => {
            document.querySelectorAll('#department-list input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = true;
            });
            filterTasks();
        });

        document.getElementById('select-none-btn').addEventListener('click', () => {
            document.querySelectorAll('#department-list input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
            filterTasks();
        });

        document.getElementById('refresh-btn').addEventListener('click', async () => {
            await sendRefreshSignal({ action: 'refresh_data' });
        });
        document.getElementById('prev-week-btn').addEventListener('click', showPreviousWeek);
        document.getElementById('next-week-btn').addEventListener('click', showNextWeek);

        // Search functionality
        const searchInput = document.getElementById('project-search');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchResults.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const expandIcon = document.getElementById('fullscreen-icon-expand');
        const compressIcon = document.getElementById('fullscreen-icon-compress');

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }

        function updateFullscreenIcon() {
            if (document.fullscreenElement) {
                expandIcon.style.display = 'none';
                compressIcon.style.display = 'block';
            } else {
                expandIcon.style.display = 'block';
                compressIcon.style.display = 'none';
            }
        }

        fullscreenBtn.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', updateFullscreenIcon);

        // Main editing button
        const mainEditingBtn = document.getElementById('main-editing-btn');
        isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';

        function updateMainEditingBtn() {
            const unlockIcon = document.getElementById('unlock-icon');
            const lockIcon = document.getElementById('lock-icon');
            if (isEditingUnlocked) {
                unlockIcon.style.display = 'none';
                lockIcon.style.display = 'block';
                mainEditingBtn.setAttribute('aria-label', 'Lock Editing');
            } else {
                unlockIcon.style.display = 'block';
                lockIcon.style.display = 'none';
                mainEditingBtn.setAttribute('aria-label', 'Unlock Editing');
            }
        }

        mainEditingBtn.addEventListener('click', () => {
            if (isEditingUnlocked) {
                // Lock editing
                isEditingUnlocked = false;
                localStorage.setItem('editingUnlocked', 'false');
                updateMainEditingBtn();
                enableAddCardIndicators(); // Re-disable add card indicators
            } else {
                // Unlock editing
                showPasswordModal();
            }
        });

        // Call on load
        updateMainEditingBtn();

        document.getElementById('schedule-wrapper').addEventListener('scrollend', () => {
            const wrapper = document.getElementById('schedule-wrapper');
            const currentIndex = Math.round(wrapper.scrollLeft / wrapper.offsetWidth);
            currentViewedWeekIndex = currentIndex;

            // Save scroll position to localStorage for persistence
            localStorage.setItem('scheduleScrollPosition', wrapper.scrollLeft.toString());
            localStorage.setItem('currentViewedWeekIndex', currentIndex.toString());

            const currentWeekDate = allWeekStartDates[currentIndex];
            updateWeekDisplayHeader(currentWeekDate);
        });

        // Context Menu Functionality
        let currentTask = null;

        document.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            const taskCard = e.target.closest('.task-card');
            const editBtn = e.target.closest('.task-edit-btn');
            const planBtn = e.target.closest('.task-plan-btn');
            if (planBtn) {
                // Handle plan button click
                e.preventDefault();
                const taskId = planBtn.dataset.taskId;
                const task = allTasks.find(t => t.id === taskId);
                if (task) {
                    showProjectView(task.project);
                }
                return;
            } else if (editBtn) {
                // Handle edit button click
                e.preventDefault();
                const taskId = editBtn.dataset.taskId;
                const task = allTasks.find(t => t.id === taskId);
                if (task) {
                    editTaskInline(task, editBtn.closest('.task-card'));
                }
                return;
            } else if (taskCard) {
                // Don't show context menu if inside the build plan modal or if editing
                if (document.getElementById('project-modal').classList.contains('show') || taskCard.classList.contains('editing')) {
                    return;
                }
                e.preventDefault();
                currentTask = taskCard.dataset.taskId ? allTasks.find(t => t.id === taskCard.dataset.taskId) : null;
                if (currentTask) {
                    showContextMenu(e.clientX / 0.8, e.clientY / 0.8);
                }
                return; // Prevent the hide handler from running
            }

            // Hide menu if click is outside task card and outside menu
            const contextMenu = document.getElementById('context-menu');
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });

        document.getElementById('context-menu').addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            const menuItem = e.target.closest('.context-menu-item');
            const action = menuItem && menuItem.dataset.action;
            if (action === 'build-plan' && currentTask) {
                showProjectView(currentTask.project);
            }
            document.getElementById('context-menu').style.display = 'none';
        });

        // Keyboard support for context menu
        document.addEventListener('keydown', (e) => {
            if (e.keyCode === 93 || (e.shiftKey && e.key === 'F10')) { // Context menu key or Shift+F10
                if (!(e.target instanceof Element)) return;
                const taskCard = e.target.closest('.task-card');
                if (taskCard && !document.getElementById('project-modal').classList.contains('show')) {
                    e.preventDefault();
                    currentTask = taskCard.dataset.taskId ? allTasks.find(t => t.id === taskCard.dataset.taskId) : null;
                    if (currentTask) {
                        const rect = taskCard.getBoundingClientRect();
                        showContextMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    }
                }
            }
        });

        // Event listeners for password modal
        document.getElementById('password-submit').addEventListener('click', () => {
            const password = document.getElementById('password-input').value;
            if (password && password.trim().toLowerCase() === EDIT_PASSWORD.toLowerCase()) {
                isEditingUnlocked = true;
                localStorage.setItem('editingUnlocked', 'true');
                hidePasswordModal();
                updateMainEditingBtn();
                // If project modal is open, update its UI
                const editBtn = document.getElementById('edit-plan-btn');
                const lockBtn = document.getElementById('lock-editing-btn');
                const unlockBtn = document.getElementById('unlock-editing-btn');
                if (unlockBtn) {
                    unlockBtn.style.display = 'none';
                    editBtn.style.display = 'inline-block';
                    lockBtn.style.display = 'inline-block';
                }
                enableAddCardIndicators(); // Enable add card indicators
            } else {
                alert('Incorrect password. Editing remains locked.');
                document.getElementById('password-input').focus();
            }
        });

        document.getElementById('password-cancel').addEventListener('click', hidePasswordModal);
        document.getElementById('password-close').addEventListener('click', hidePasswordModal);
        document.getElementById('password-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('password-modal')) {
                hidePasswordModal();
            }
        });

        document.getElementById('password-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('password-submit').click();
            }
        });

        function showContextMenu(x, y) {
            const contextMenu = document.getElementById('context-menu');
            contextMenu.style.left = `${x}px`;
            contextMenu.style.top = `${y}px`;
            contextMenu.style.display = 'block';

            // Adjust position if menu goes outside viewport
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${x - rect.width}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${y - rect.height}px`;
            }
        }

        // Project View Functionality
        function getProjectSummaries() {
            const projectSummaries = {};
            allTasks.forEach(task => {
                if (!task.project) return;
                if (!projectSummaries[task.project]) {
                    projectSummaries[task.project] = { totalHours: 0, tasks: [] };
                }
                const hours = parseFloat(task.hours);
                if (!isNaN(hours)) {
                    projectSummaries[task.project].totalHours += hours;
                }
                projectSummaries[task.project].tasks.push(task);
            });
            return projectSummaries;
        }

        function performSearch(query) {
            const trimmedQuery = query.trim().toLowerCase();
            const results = document.getElementById('search-results');
            results.innerHTML = '';
            results.style.display = 'none';

            if (!trimmedQuery) return;

            const summaries = getProjectSummaries();
            const matches = [];

            Object.entries(summaries).forEach(([projectName, summary]) => {
                if (projectName.toLowerCase().includes(trimmedQuery)) {
                    matches.push({
                        project: projectName,
                        totalHours: summary.totalHours,
                        tasks: summary.tasks
                    });
                }
            });

            if (matches.length > 0) {
                matches.forEach(match => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <div class="search-result-title">${match.project}</div>
                        <div class="search-result-hours">Total Hours: ${Math.round(match.totalHours)}</div>
                    `;
                    item.addEventListener('click', () => {
                        showProjectView(match.project);
                        document.getElementById('project-search').value = '';
                        results.style.display = 'none';
                    });
                    results.appendChild(item);
                });
                results.style.display = 'block';
            }
        }

        function showProjectView(projectName) {
            currentProjectName = projectName;
            const projectTasks = allTasks.filter(task => task.project === projectName);

            // Calculate total hours
            let totalHours = 0;
            projectTasks.forEach(task => {
                const hours = parseFloat(task.hours);
                if (!isNaN(hours)) {
                    totalHours += hours;
                }
            });

            const modal = document.getElementById('project-modal');
            const title = document.getElementById('project-title');
            const grid = document.getElementById('project-schedule-grid');

            title.textContent = `Build Plan: ${projectName} - Total Hours: ${Math.round(totalHours)}`;
            grid.innerHTML = '';

            // Group tasks by department
            const tasksByDept = {};
            projectTasks.forEach(task => {
                const dept = task.department || 'Other';
                if (!tasksByDept[dept]) tasksByDept[dept] = [];
                tasksByDept[dept].push(task);
            });

            // Sort departments in the same order as main view
            const sortedDepts = DEPARTMENT_ORDER.filter(dept => tasksByDept[dept]);
            if (tasksByDept['Other']) sortedDepts.push('Other');

            // Create a simple list layout instead of complex grid
            sortedDepts.forEach(dept => {
                const deptTasks = tasksByDept[dept].sort((a, b) => {
                    // Sort by date, then by day number
                    const dateA = parseDate(a.date);
                    const dateB = parseDate(b.date);
                    if (dateA && dateB) {
                        const dateDiff = dateA - dateB;
                        if (dateDiff !== 0) return dateDiff;
                    }
                    return parseInt(a.dayNumber || 0) - parseInt(b.dayNumber || 0);
                });

                // Add department section
                const deptSection = document.createElement('div');
                deptSection.className = 'project-dept-section';
                const deptText = dept === 'Special Events' ? 'Special<br>Events' : dept;
                deptSection.innerHTML = `
                    <div class="project-dept-header department-label department-${normalizeDepartmentClass(dept)}">
                        ${deptText}
                    </div>
                    <div class="project-cards-container">
                        ${deptTasks.map((task, index) => {
                            const taskDate = parseDate(task.date);
                            const formattedDate = task.missingDate ? 'No date' : (taskDate ? taskDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            }) : 'No date');

                            return `
                                <div class="project-task-card task-card department-${normalizeDepartmentClass(task.department)}" style="animation-delay: ${index * 0.1}s" data-task-id="${task.id}" title="Click for options">
                                    <div class="task-title">${task.project}</div>
                                    <div class="project-description">${task.projectDescription || ''}</div>
                                    <div class="task-day-counter">${task.dayCounter || ''}</div>
                                    <div class="task-description">${task.description && task.description.trim() ? task.description : '<span class="missing-description">Staging Missing</span>'}</div>
                                    <div class="task-details">
                                        <strong>Date:</strong> ${formattedDate}<br>
                                        <strong>Hours:</strong> ${task.hours}<br>
                                        <strong>Code:</strong> ${task.value}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                grid.appendChild(deptSection);
            });

            modal.classList.add('show');
            document.body.style.overflow = 'hidden';

            // Equalize card heights in project view after a short delay
            setTimeout(() => {
                equalizeProjectCardHeights();
            }, 100);

            // Initialize edit mode
            initializeEditMode();
        }

        function hideProjectView() {
            // Cancel edit mode if active when exiting
            const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
            if (textareas.length > 0) {
                textareas.forEach(textarea => {
                    const taskCard = textarea.closest('.project-task-card');
                    const taskId = taskCard.dataset.taskId;
                    const task = allTasks.find(t => t.id === taskId);
                    const descDiv = document.createElement('div');
                    descDiv.className = 'task-description';
                    descDiv.innerHTML = task && task.description ? task.description : '<span class="missing-description">Staging Missing</span>';
                    textarea.replaceWith(descDiv);
                });
                // Reset buttons to non-edit state
                document.getElementById('edit-plan-btn').style.display = 'inline-block';
                document.getElementById('save-changes-btn').style.display = 'none';
                document.getElementById('cancel-changes-btn').style.display = 'none';
            }

            const modal = document.getElementById('project-modal');
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }

        document.getElementById('project-close').addEventListener('click', hideProjectView);
        document.getElementById('project-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('project-modal')) {
                hideProjectView();
            }
        });

        function initializeEditMode() {
            const unlockBtn = document.getElementById('unlock-editing-btn');
            const editBtn = document.getElementById('edit-plan-btn');
            const lockBtn = document.getElementById('lock-editing-btn');
            const saveBtn = document.getElementById('save-changes-btn');
            const cancelBtn = document.getElementById('cancel-changes-btn');
            let originalDescriptions = new Map();
            let isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';

            // Check unlock status and update UI
            if (isEditingUnlocked) {
                unlockBtn.style.display = 'none';
                editBtn.style.display = 'inline-block';
                lockBtn.style.display = 'inline-block';
            }

            unlockBtn.addEventListener('click', () => {
                showPasswordModal();
            });

            editBtn.addEventListener('click', () => {
                if (!isEditingUnlocked) return;
                enterEditMode();
            });

            saveBtn.addEventListener('click', async () => {
                await saveChanges();
            });

            cancelBtn.addEventListener('click', () => {
                cancelEditMode();
            });

            lockBtn.addEventListener('click', () => {
                isEditingUnlocked = false;
                localStorage.setItem('editingUnlocked', 'false');
                unlockBtn.style.display = 'inline-block';
                editBtn.style.display = 'none';
                lockBtn.style.display = 'none';
                // If currently in edit mode, cancel it
                if (saveBtn.style.display !== 'none') {
                    cancelEditMode();
                }
                // Disable add card indicators when locking editing
                enableAddCardIndicators();
                updateMainEditingBtn();
            });

            function enterEditMode() {
                editBtn.style.display = 'none';
                lockBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';

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

            async function saveChanges() {
                // Set loading state (minimal UI feedback)
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                saveBtn.innerHTML = '<div class="save-loading-spinner"></div>Saving...';
                saveBtn.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                saveBtn.style.cursor = 'not-allowed';

                try {
                    const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
                    const changedTasks = [];
                    textareas.forEach(textarea => {
                        const taskId = textarea.closest('.project-task-card').dataset.taskId;
                        const originalText = originalDescriptions.get(taskId);
                        const originalStripped = stripHtml(originalText).trim();
                        const newText = textarea.value.trim();

                        // Update the task
                        const task = allTasks.find(t => t.id === taskId);
                        if (task) {
                            task.description = newText;
                            // Temp update weekly view cards
                            const weeklyCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                            if (weeklyCard) {
                                const descElement = weeklyCard.querySelector('.task-description');
                                if (descElement) {
                                    descElement.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                                }
                            }
                        }

                        // Replace textarea
                        const descDiv = document.createElement('div');
                        descDiv.className = 'task-description';
                        descDiv.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                        textarea.replaceWith(descDiv);

                        // Check if changed
                        if (newText !== originalStripped) {
                            changedTasks.push({task, newText});
                        }
                    });

                    // Save to staging
                    let syncSuccess = true;
                    if (changedTasks.length > 0) {
                        try {
                            await saveToStaging(currentProjectName, changedTasks);
                        } catch (error) {
                            syncSuccess = false;
                            console.error('Staging sync failed:', error);
                            // Continue with local save - user can retry
                        }
                    }

                    // Local data is already updated, modal will show changes automatically
                    exitEditMode();

                    // Show success notification
                    const successNotif = document.getElementById('project-success-notification');
                    const syncStatus = syncSuccess ? '✅ Changes saved and synced!' : '✅ Changes saved locally. Sync to backend failed - please try again.';
                    successNotif.textContent = syncStatus;
                    successNotif.style.display = 'block';
                    setTimeout(() => {
                        successNotif.style.display = 'none';
                    }, syncSuccess ? 2500 : 5000);

                } catch (error) {
                    console.error('Save failed:', error);
                    // Show error feedback
                    saveBtn.innerHTML = '❌ Save Failed';
                    saveBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                    setTimeout(() => {
                        restoreSaveButton();
                    }, 2000);
                } finally {
                    if (!saveBtn.innerHTML.includes('Failed')) {
                        restoreSaveButton();
                    }
                }
            }

            function restoreSaveButton() {
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
                saveBtn.innerHTML = '💾 Save Changes';
                saveBtn.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                saveBtn.style.cursor = 'pointer';
            }

            function cancelEditMode() {
                const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
                textareas.forEach(textarea => {
                    const taskId = textarea.closest('.project-task-card').dataset.taskId;
                    const originalText = originalDescriptions.get(taskId);

                    const descDiv = document.createElement('div');
                    descDiv.className = 'task-description';
                    descDiv.innerHTML = originalText;
                    textarea.replaceWith(descDiv);
                });

                exitEditMode();
            }

            function exitEditMode() {
                editBtn.style.display = 'inline-block';
                if (isEditingUnlocked) {
                    lockBtn.style.display = 'inline-block';
                }
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                originalDescriptions.clear();
            }
        }


        // Print Modal Functionality
        let currentPrintWeekDates = [];
        let allDepartmentsForPrint = [];
        let currentPrintType = 'week';

        function showPasswordModal() {
            document.getElementById('password-modal').classList.add('show');
            document.body.style.overflow = 'hidden';
            setTimeout(() => document.getElementById('password-input').focus(), 100);
        }

        function hidePasswordModal() {
            document.getElementById('password-modal').classList.remove('show');
            document.body.style.overflow = '';
            document.getElementById('password-input').value = '';
        }

        function showPrintModal() {
            if (allTasks.length === 0) {
                alert('Data is still loading. Please wait for the schedule to load before printing.');
                return;
            }
            const modal = document.getElementById('print-modal');
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            populatePrintOptions();
        }

        function hidePrintModal() {
            // Save current department selection before hiding modal
            const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem('printSelectedDepartments', JSON.stringify(selectedDepts));

            const modal = document.getElementById('print-modal');
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }

        function populatePrintOptions() {
            // Populate week select
            const weekSelect = document.getElementById('print-week-select');
            weekSelect.innerHTML = '';
            allWeekStartDates.forEach((date, index) => {
                const option = document.createElement('option');
                option.value = index.toString();
                const weekStart = new Date(date);
                const weekEnd = new Date(date);
                weekEnd.setDate(date.getDate() + 5);
                const monday = getMonday(date);
                const month = getWeekMonth(monday);
                const weekNum = getWeekOfMonth(monday, month);
                const monthName = new Date(monday.getFullYear(), month, 1).toLocaleDateString('en-US', { month: 'short' });
                option.textContent = `${monthName} Week ${weekNum}: ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                if (index === currentViewedWeekIndex) option.selected = true;
                weekSelect.appendChild(option);
            });

            // Set date input to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowString = tomorrow.toISOString().split('T')[0];
            document.getElementById('print-date-select').value = tomorrowString;

            // Get all departments, filter out invalid ones
            allDepartmentsForPrint = [...new Set(allTasks.map(task => task.department).filter(dept => dept && dept.toLowerCase() !== 'department' && !dept.toLowerCase().includes('link') && !dept.toLowerCase().includes('live')))];
            allDepartmentsForPrint.sort((a, b) => {
                const aIndex = DEPARTMENT_ORDER.indexOf(a);
                const bIndex = DEPARTMENT_ORDER.indexOf(b);
                if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });

            const departmentsGrid = document.querySelector('.departments-grid');
            departmentsGrid.innerHTML = '';
            // Restore saved print department selections
            const savedPrintDepartments = localStorage.getItem('printSelectedDepartments') ? JSON.parse(localStorage.getItem('printSelectedDepartments')) : null;
            // If no saved selection, default to all departments; if empty array, keep empty
            const defaultSelectedDepts = savedPrintDepartments !== null ? savedPrintDepartments : allDepartmentsForPrint;

            allDepartmentsForPrint.forEach(dept => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'department-checkbox';
                checkboxDiv.innerHTML = `
                    <input type="checkbox" id="print-dept-${normalizeDepartmentClass(dept)}" value="${dept}" ${defaultSelectedDepts.includes(dept) ? 'checked' : ''}>
                    <label for="print-dept-${normalizeDepartmentClass(dept)}">${dept}</label>
                `;
                departmentsGrid.appendChild(checkboxDiv);

                // Add event listener to save selection when changed
                const checkbox = checkboxDiv.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', () => {
                    const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked')).map(cb => cb.value);
                    localStorage.setItem('printSelectedDepartments', JSON.stringify(selectedDepts));
                });
            });


            updatePrintTypeDisplay();
        }

        function updatePrintTypeDisplay() {
            currentPrintType = document.querySelector('input[name="print-type"]:checked').value;
            const weekSection = document.getElementById('week-select-section');
            const daySection = document.getElementById('day-select-section');
            if (currentPrintType === 'week') {
                weekSection.style.display = 'block';
                daySection.style.display = 'none';
            } else {
                weekSection.style.display = 'none';
                daySection.style.display = 'block';
            }
        }

        function updateWeekDates() {
            const selectedIndex = parseInt(document.getElementById('print-week-select').value);
            const selectedWeekStart = allWeekStartDates[selectedIndex];
            if (!selectedWeekStart) {
                console.error('Invalid week start date');
                currentPrintWeekDates = [];
                return;
            }
            currentPrintWeekDates = Array.from({ length: 6 }).map((_, i) => {
                const date = new Date(selectedWeekStart);
                date.setDate(selectedWeekStart.getDate() + i);
                return date;
            });
        }

        function generatePrintContent() {
            // Use the externalized print utilities
            const printType = document.querySelector('input[name="print-type"]:checked').value;
            const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked')).map(cb => cb.value);

            if (selectedDepts.length === 0) {
                alert('Please select at least one department.');
                return;
            }

            // Update dates based on print type
            if (printType === 'week') {
                updateWeekDates();
            } else if (printType === 'day') {
                // For day print, set currentPrintWeekDates to contain only the selected date
                const value = document.getElementById('print-date-select').value;
                if (!value) {
                    alert('Please select a date.');
                    return;
                }
                const [year, month, day] = value.split('-').map(Number);
                const selectedDate = new Date(year, month - 1, day);
                currentPrintWeekDates = [selectedDate];
            }

            // Generate print content using external utilities
            const printContent = window.PrintUtils.generatePrintContent(printType, selectedDepts, currentPrintWeekDates, allTasks);

            if (printContent) {
                window.PrintUtils.executePrint(printContent, printType);
            }
        }

        // Keep the old function as backup for now - will be removed after testing
        function generatePrintContent_old() {
            const printType = document.querySelector('input[name="print-type"]:checked').value;
            let selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked')).map(cb => cb.value);

            if (selectedDepts.length === 0) {
                alert('Please select at least one department.');
                return;
            }

            // Store original selection for batch handling
            const originalSelectedDepts = [...selectedDepts];

            // Update currentPrintWeekDates based on selected week
            if (printType === 'week') {
                updateWeekDates();
            }

            // Format selected date for daily print header
            let selectedDateFormatted = '';
            if (printType === 'day') {
                const value = document.getElementById('print-date-select').value;
                const [year, month, day] = value.split('-').map(Number);
                const selectedDate = new Date(year, month - 1, day);
                selectedDateFormatted = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
            }

            // Generate batch tasks for the selected period
            const printBatchTasks = [];
            if (printType === 'week') {
                currentPrintWeekDates.forEach(date => {
                    const nextDate = new Date(date);
                    let castingProjects = [];
                    if (date.getDay() === 5) { // Friday
                        // Get tasks for Saturday
                        const saturday = new Date(date);
                        saturday.setDate(date.getDate() + 1);
                        const saturdayString = saturday.toDateString();
                        const saturdayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                            .map(t => t.project);
                        if (saturdayProjects.length > 0) {
                            castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                        }

                        // Get tasks for Monday
                        const monday = new Date(date);
                        monday.setDate(date.getDate() + 3);
                        const mondayString = monday.toDateString();
                        const mondayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                            .map(t => t.project);
                        if (mondayProjects.length > 0) {
                            castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                        }
                    } else {
                        // For Mon-Thu, get next day's tasks
                        nextDate.setDate(date.getDate() + 1);
                        const nextDateString = nextDate.toDateString();
                        castingProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                            .map(t => t.project);
                    }
                    const batchTask = {
                        id: `batch-${date.toISOString()}`,
                        week: getLocalDateString(getMonday(date)),
                        project: 'Batch',
                        description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                        date: getLocalDateString(date),
                        department: 'Batch',
                        value: '',
                        hours: '',
                        dayNumber: '',
                        totalDays: '',
                        dayCounter: '',
                        missingDate: false
                    };
                    printBatchTasks.push(batchTask);
                });
            } else {
                // For day print, generate batch for the selected date
                const value = document.getElementById('print-date-select').value;
                const [year, month, day] = value.split('-').map(Number);
                const selectedDate = new Date(year, month - 1, day);
                let castingProjects = [];
                if (selectedDate.getDay() === 5) { // Friday
                    // Get tasks for Saturday
                    const saturday = new Date(selectedDate);
                    saturday.setDate(selectedDate.getDate() + 1);
                    const saturdayString = saturday.toDateString();
                    const saturdayProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                        .map(t => t.project);
                    if (saturdayProjects.length > 0) {
                        castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                    }

                    // Get tasks for Monday
                    const monday = new Date(selectedDate);
                    monday.setDate(selectedDate.getDate() + 3);
                    const mondayString = monday.toDateString();
                    const mondayProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                        .map(t => t.project);
                    if (mondayProjects.length > 0) {
                        castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                    }
                } else {
                    // For Mon-Thu, get next day's tasks
                    const nextDate = new Date(selectedDate);
                    nextDate.setDate(selectedDate.getDate() + 1);
                    const nextDateString = nextDate.toDateString();
                    castingProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                        .map(t => t.project);
                }
                const batchTask = {
                    id: `batch-${selectedDate.toISOString()}`,
                    week: getLocalDateString(getMonday(selectedDate)),
                    project: 'Batch',
                    description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                    date: getLocalDateString(selectedDate),
                    department: 'Batch',
                    value: '',
                    hours: '',
                    dayNumber: '',
                    totalDays: '',
                    dayCounter: '',
                    missingDate: false
                };
                printBatchTasks.push(batchTask);
            }

            // Generate layout tasks similar to batch tasks
            const printLayoutTasks = [];
            if (printType === 'week') {
                currentPrintWeekDates.forEach(date => {
                    const nextDate = new Date(date);
                    let castingProjects = [];
                    if (date.getDay() === 5) { // Friday
                        // Get tasks for Saturday
                        const saturday = new Date(date);
                        saturday.setDate(date.getDate() + 1);
                        const saturdayString = saturday.toDateString();
                        const saturdayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                            .map(t => t.project);
                        if (saturdayProjects.length > 0) {
                            castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                        }

                        // Get tasks for Monday
                        const monday = new Date(date);
                        monday.setDate(date.getDate() + 3);
                        const mondayString = monday.toDateString();
                        const mondayProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                            .map(t => t.project);
                        if (mondayProjects.length > 0) {
                            castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                        }
                    } else {
                        // For Mon-Thu, get next day's tasks
                        nextDate.setDate(date.getDate() + 1);
                        const nextDateString = nextDate.toDateString();
                        castingProjects = allTasks
                            .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                            .map(t => t.project);
                    }
                    const layoutTask = {
                        id: `layout-${date.toISOString()}`,
                        week: getLocalDateString(getMonday(date)),
                        project: 'Layout',
                        description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                        date: getLocalDateString(date),
                        department: 'Layout',
                        value: '',
                        hours: '',
                        dayNumber: '',
                        totalDays: '',
                        dayCounter: '',
                        missingDate: false
                    };
                    printLayoutTasks.push(layoutTask);
                });
            } else {
                // For day print, generate layout for the selected date
                const value = document.getElementById('print-date-select').value;
                const [year, month, day] = value.split('-').map(Number);
                const selectedDate = new Date(year, month - 1, day);
                let castingProjects = [];
                if (selectedDate.getDay() === 5) { // Friday
                    // Get tasks for Saturday
                    const saturday = new Date(selectedDate);
                    saturday.setDate(selectedDate.getDate() + 1);
                    const saturdayString = saturday.toDateString();
                    const saturdayProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                        .map(t => t.project);
                    if (saturdayProjects.length > 0) {
                        castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                    }

                    // Get tasks for Monday
                    const monday = new Date(selectedDate);
                    monday.setDate(selectedDate.getDate() + 3);
                    const mondayString = monday.toDateString();
                    const mondayProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                        .map(t => t.project);
                    if (mondayProjects.length > 0) {
                        castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                    }
                } else {
                    // For Mon-Thu, get next day's tasks
                    const nextDate = new Date(selectedDate);
                    nextDate.setDate(selectedDate.getDate() + 1);
                    const nextDateString = nextDate.toDateString();
                    castingProjects = allTasks
                        .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                        .map(t => t.project);
                }
                const layoutTask = {
                    id: `layout-${selectedDate.toISOString()}`,
                    week: getLocalDateString(getMonday(selectedDate)),
                    project: 'Layout',
                    description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                    date: getLocalDateString(selectedDate),
                    department: 'Layout',
                    value: '',
                    hours: '',
                    dayNumber: '',
                    totalDays: '',
                    dayCounter: '',
                    missingDate: false
                };
                printLayoutTasks.push(layoutTask);
            }

            // Filter departments to only those with tasks in the selected period
            selectedDepts = selectedDepts.filter(dept => {
                const deptTasks = allTasks.filter(task => task.department === dept);
                if (printType === 'week') {
                    return currentPrintWeekDates.some(date => {
                        const dateString = date.toDateString();
                        return deptTasks.some(t => {
                            const taskDate = parseDate(t.date);
                            return taskDate && taskDate.toDateString() === dateString;
                        });
                    });
                } else {
                    const value = document.getElementById('print-date-select').value;
                    const [year, month, day] = value.split('-').map(Number);
                    const selectedDate = new Date(year, month - 1, day);
                    const dateString = selectedDate.toDateString();
                    return deptTasks.some(t => {
                        const taskDate = parseDate(t.date);
                        return taskDate && taskDate.toDateString() === dateString;
                    });
                }
            });

            if (selectedDepts.length === 0) {
                alert('No tasks found for the selected departments and date/week.');
                return;
            }

            // Exclude Batch and Layout as they are appended to Cast and Demold respectively
            selectedDepts = selectedDepts.filter(dept => dept !== 'Batch' && dept !== 'Layout');

            // Calculate max tasks overall to determine compactness
            let maxTasksOverall = 0;
            selectedDepts.forEach(dept => {
                const maxTasks = getMaxTasksForDept(dept, printType);
                if (maxTasks > maxTasksOverall) maxTasksOverall = maxTasks;
            });

            // Determine compactness based on department count and max tasks
            const isCompact = selectedDepts.length > 4 || printType === 'day' || maxTasksOverall > 6;

            // Max tasks per dept will be calculated per selected period below

            const printContainer = document.createElement('div');
            printContainer.className = 'print-preview-content';

            selectedDepts.forEach((dept, index) => {
                // Calculate total hours and revenue for the department in the selected period
                let deptTasks = allTasks.filter(task => task.department === dept);
                if (printType === 'week') {
                    deptTasks = deptTasks.filter(task => {
                        const taskDate = parseDate(task.date);
                        return taskDate && currentPrintWeekDates.some(date => date.toDateString() === taskDate.toDateString());
                    });
                } else {
                    const value = document.getElementById('print-date-select').value;
                    const [year, month, day] = value.split('-').map(Number);
                    const selectedDate = new Date(year, month - 1, day);
                    const selectedTimestamp = selectedDate.getTime();
                    deptTasks = deptTasks.filter(task => {
                        const taskDate = parseDate(task.date);
                        if (!taskDate) return false;
                        const taskTimestamp = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate()).getTime();
                        return taskTimestamp === selectedTimestamp;
                    });
                }
                let totalHours = 0;
                deptTasks.forEach(task => {
                    const hours = parseFloat(task.hours);
                    if (!isNaN(hours)) {
                        totalHours += hours;
                    }
                });
                const revenue = Math.round(totalHours * 135);

                // Create summary div for department totals
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'print-dept-summary';
                summaryDiv.textContent = `${dept} - Total Hours: ${Math.round(totalHours)}, Revenue: $${revenue.toLocaleString()}`;

                const pageDiv = document.createElement('div');
                pageDiv.className = 'print-page';
                if (printType === 'day') {
                    pageDiv.classList.add('print-page-day');
                }
                pageDiv.style.display = 'flex';
                pageDiv.style.flexDirection = 'column';

                // Main content container for header and table
                const mainContentDiv = document.createElement('div');
                mainContentDiv.style.display = 'flex';
                mainContentDiv.style.alignItems = 'stretch';
                if (printType === 'day') {
                    mainContentDiv.style.justifyContent = 'flex-end';
                }

                // Department header sidebar
                const deptHeader = document.createElement('div');
                deptHeader.className = `print-department-header department-${normalizeDepartmentClass(dept)}`;
                if (printType === 'day') {
                    deptHeader.classList.add('print-department-header-day');
                }
                deptHeader.innerHTML = `<div style="background-color: var(--color-${normalizeDepartmentClass(dept)}); color: var(--color-${normalizeDepartmentClass(dept)}-text); padding: 8pt; border-radius: 4pt; font-weight: bold; text-align: center; font-size: 12pt; writing-mode: horizontal-tb; text-orientation: mixed;">${dept === 'Special Events' ? dept.replace(' ', '<br>') : dept}</div>`;

                let maxTasks = getMaxTasksForDept(dept, printType);
                let maxTasksInRow = maxTasks;
                let castMax = 0;
                let demoldMax = 0;
                if (dept === 'Cast') {
                    castMax = maxTasks;
                    // let batchMax = getMaxTasksForDept('Batch', printType);
                    // maxTasks += batchMax;
                }
                if (dept === 'Demold') {
                    demoldMax = maxTasks;
                    // let layoutMax = getMaxTasksForDept('Layout', printType);
                    // maxTasks += layoutMax;
                }

                // Table for tasks
                const table = document.createElement('table');
                table.className = 'print-table';
                if (printType === 'day') {
                    table.classList.add('print-table-day', 'daily-print');
                }
                if (isCompact || maxTasks > 6) {
                    table.classList.add('compact');
                }

                if (printType === 'day') {
                    // Day layout: dept header on top, table below, summary below
                    deptHeader.style.width = '100%';
                    deptHeader.style.textAlign = 'center';
                    deptHeader.style.writingMode = 'horizontal-tb';
                    deptHeader.style.textOrientation = 'mixed';
                    deptHeader.style.maxWidth = '800px';
                    deptHeader.style.margin = '0 auto';
                    table.style.width = '100%';
                    table.style.maxWidth = '800px';
                    table.style.margin = '0 auto';
                    summaryDiv.style.width = '100%';
                    summaryDiv.style.maxWidth = '800px';
                    summaryDiv.style.margin = '0 auto';
                    pageDiv.appendChild(deptHeader);
                    pageDiv.appendChild(table);
                    pageDiv.appendChild(summaryDiv);
                } else {
                    // Week layout: dept header left, table right, summary below
                    mainContentDiv.appendChild(deptHeader);
                    mainContentDiv.appendChild(table);
                    pageDiv.appendChild(mainContentDiv);
                    pageDiv.appendChild(summaryDiv);
                }

                // Create thead
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');

                // Date headers
                if (printType === 'week') {
                    currentPrintWeekDates.forEach(date => {
                        const th = document.createElement('th');
                        th.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<br>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                        headerRow.appendChild(th);
                    });
                } else {
                    const value = document.getElementById('print-date-select').value;
                    const [year, month, day] = value.split('-').map(Number);
                    const selectedDate = new Date(year, month - 1, day);
                    const taskHeader = document.createElement('th');
                    taskHeader.textContent = selectedDateFormatted;
                    headerRow.appendChild(taskHeader);

                    const revenueHeader = document.createElement('th');
                    revenueHeader.textContent = 'Revenue';
                    headerRow.appendChild(revenueHeader);

                    const midDayHeader = document.createElement('th');
                    midDayHeader.textContent = 'Mid-Day';
                    headerRow.appendChild(midDayHeader);

                    const endOfDayHeader = document.createElement('th');
                    endOfDayHeader.textContent = 'End of Day';
                    headerRow.appendChild(endOfDayHeader);
                }

                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Create tbody
                const tbody = document.createElement('tbody');

                if (printType === 'week') {
                    for (let row = 0; row < maxTasks; row++) {
                        const tr = document.createElement('tr');

                        // Task cells for each date
                        currentPrintWeekDates.forEach(date => {
                            const dateString = date.toDateString();
                            const tasksForDate = deptTasks.filter(t => {
                                const taskDate = parseDate(t.date);
                                return taskDate && taskDate.toDateString() === dateString;
                            });
                            let task = tasksForDate[row];
                            const td = document.createElement('td');
                            td.className = 'print-grid-cell';
                            if (task) {
                                td.innerHTML = `
                                    <div class="print-task-grid department-${normalizeDepartmentClass(task.department)}">
                                        <div class="print-task-title">${task.project}</div>
                                        <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                        <div class="print-task-details">${(() => {
                                            let hours = parseFloat(task.hours);
                                            let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                            return `${isNaN(hours) ? 0 : Math.round(hours)} hrs | $${revenue.toLocaleString()}`;
                                        })()}</div>
                                    </div>
                                `;
                            }
                            tr.appendChild(td);
                        });

                        tbody.appendChild(tr);
                    }
                } else {
                    for (let row = 0; row < maxTasks; row++) {
                        const tr = document.createElement('tr');

                        // Get the task for this row
                        const value = document.getElementById('print-date-select').value;
                        const [year, month, day] = value.split('-').map(Number);
                        const selectedDate = new Date(year, month - 1, day);
                        const dateString = selectedDate.toDateString();
                        const tasksForDate = deptTasks.filter(t => {
                            const taskDate = parseDate(t.date);
                            return taskDate && taskDate.toDateString() === dateString;
                        });
                        let task = tasksForDate[row];

                        // Task cell
                        const taskCell = document.createElement('td');
                        taskCell.className = 'print-grid-cell';
                        taskCell.style.width = '60%';
                        if (task) {
                            taskCell.innerHTML = `
                                <div class="print-task-grid department-${normalizeDepartmentClass(task.department)}" style="margin: 0 auto; max-width: 180px;">
                                    <div class="print-task-title">${task.project}</div>
                                    <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                    <div class="print-task-details">${(() => {
                                        let hours = parseFloat(task.hours);
                                        let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                        return `${isNaN(hours) ? 0 : Math.round(hours)} hrs | $${revenue.toLocaleString()}`;
                                    })()}</div>
                                </div>
                            `;
                        }
                        tr.appendChild(taskCell);

                        // Revenue cell
                        const revenueCell = document.createElement('td');
                        revenueCell.className = 'print-grid-cell';
                        revenueCell.style.textAlign = 'center';
                        revenueCell.style.fontSize = '0.5rem';
                        revenueCell.style.fontWeight = 'bold';
                        revenueCell.style.width = '13.33%';
                        if (task && task.hours) {
                            let hours = parseFloat(task.hours);
                            let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                            revenueCell.textContent = `$${revenue.toLocaleString()}`;
                        } else {
                            revenueCell.textContent = '';
                        }
                        tr.appendChild(revenueCell);

                        // Mid-Day cell (blank)
                        const midDayCell = document.createElement('td');
                        midDayCell.className = 'print-grid-cell';
                        midDayCell.style.textAlign = 'center';
                        midDayCell.style.width = '13.33%';
                        midDayCell.textContent = '';
                        tr.appendChild(midDayCell);

                        // End of Day cell (blank)
                        const endOfDayCell = document.createElement('td');
                        endOfDayCell.className = 'print-grid-cell';
                        endOfDayCell.style.textAlign = 'center';
                        endOfDayCell.style.width = '13.33%';
                        endOfDayCell.textContent = '';
                        tr.appendChild(endOfDayCell);

                        tbody.appendChild(tr);
                    }
                }

                table.appendChild(tbody);

                // Add revenue row for each day in week print
                if (printType === 'week') {
                    const tfoot = document.createElement('tfoot');
                    const revenueRow = document.createElement('tr');
                    revenueRow.style.borderTop = '2px solid #000';
                    revenueRow.style.fontSize = '0.4rem';

                    currentPrintWeekDates.forEach(date => {
                        const dateString = date.toDateString();
                        const dayTasks = deptTasks.filter(t => {
                            const taskDate = parseDate(t.date);
                            return taskDate && taskDate.toDateString() === dateString;
                        });
                        let dayHours = 0;
                        dayTasks.forEach(task => {
                            const hours = parseFloat(task.hours);
                            if (!isNaN(hours)) dayHours += hours;
                        });
                        const dayRevenue = Math.round(dayHours * 135);
                        const revenueCell = document.createElement('td');
                        revenueCell.textContent = `Daily: $${dayRevenue.toLocaleString()}`;
                        revenueCell.style.fontWeight = 'bold';
                        revenueCell.style.textAlign = 'center';
                        revenueRow.appendChild(revenueCell);
                    });

                    tfoot.appendChild(revenueRow);
                    table.appendChild(tfoot);
                }

                if (dept === 'Cast') {
                    // calculate batchTotalHours = 0; since no hours
                    const batchRevenue = 0;
                    const batchSummaryDiv = document.createElement('div');
                    batchSummaryDiv.className = 'print-dept-summary';
                    batchSummaryDiv.textContent = `Batch - Total Hours: 0`;

                    const batchMainContentDiv = document.createElement('div');
                    batchMainContentDiv.style.display = 'flex';
                    batchMainContentDiv.style.alignItems = 'stretch';
                    if (printType === 'day') {
                        batchMainContentDiv.style.justifyContent = 'flex-end';
                    }

                    const batchDeptHeader = document.createElement('div');
                    batchDeptHeader.className = `print-department-header department-batch`;
                    if (printType === 'day') {
                        batchDeptHeader.classList.add('print-department-header-day');
                    }
                    batchDeptHeader.textContent = 'Batch';

                    const batchTable = document.createElement('table');
                    batchTable.className = 'print-table';
                    if (printType === 'day') {
                        batchTable.classList.add('print-table-day');
                    }
                    if (isCompact || getMaxTasksForDept('Batch', printType) > 6) {
                        batchTable.classList.add('compact');
                    }

                    // Create thead for Batch
                    const batchThead = document.createElement('thead');
                    const batchHeaderRow = document.createElement('tr');

                    if (printType === 'week') {
                        currentPrintWeekDates.forEach(date => {
                            const th = document.createElement('th');
                            th.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<br>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                            batchHeaderRow.appendChild(th);
                        });
                    } else {
                        const taskHeader = document.createElement('th');
                        taskHeader.textContent = selectedDateFormatted;
                        batchHeaderRow.appendChild(taskHeader);

                        const revenueHeader = document.createElement('th');
                        revenueHeader.textContent = 'Revenue';
                        batchHeaderRow.appendChild(revenueHeader);

                        const midDayHeader = document.createElement('th');
                        midDayHeader.textContent = 'Mid-Day';
                        batchHeaderRow.appendChild(midDayHeader);

                        const endOfDayHeader = document.createElement('th');
                        endOfDayHeader.textContent = 'End of Day';
                        batchHeaderRow.appendChild(endOfDayHeader);
                    }

                    batchThead.appendChild(batchHeaderRow);
                    batchTable.appendChild(batchThead);

                    // Create tbody for Batch
                    const batchTbody = document.createElement('tbody');
                    const batchMaxTasks = getMaxTasksForDept('Batch', printType);

                    if (printType === 'week') {
                        for (let row = 0; row < batchMaxTasks; row++) {
                            const tr = document.createElement('tr');
                            currentPrintWeekDates.forEach(date => {
                                const dateString = date.toDateString();
                                const batchTasksForDate = printBatchTasks.filter(t => parseDate(t.date).toDateString() === dateString);
                                const task = batchTasksForDate[row];
                                const td = document.createElement('td');
                                td.className = 'print-grid-cell';
                                if (task) {
                                    td.innerHTML = `
                                        <div class="print-task-card department-batch">
                                            <div class="print-task-title">${task.project}</div>
                                            <div class="print-project-description">${task.projectDescription || ''}</div>
                                            <div class="print-task-day-counter">${task.dayCounter || ''}</div>
                                            <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                            <div class="print-task-details">
                                                ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
                                                <strong>Hours:</strong> ${task.hours} | <strong>Revenue:</strong> $${(() => {
                                                    let hours = parseFloat(task.hours);
                                                    let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                                    return revenue.toLocaleString();
                                                })()}
                                            </div>
                                        </div>
                                    `;
                                }
                                tr.appendChild(td);
                            });
                            batchTbody.appendChild(tr);
                        }
                    } else {
                        for (let row = 0; row < batchMaxTasks; row++) {
                            const tr = document.createElement('tr');
                            const value = document.getElementById('print-date-select').value;
                            const [year, month, day] = value.split('-').map(Number);
                            const selectedDate = new Date(year, month - 1, day);
                            const dateString = selectedDate.toDateString();
                            const batchTasksForDate = printBatchTasks.filter(t => parseDate(t.date).toDateString() === dateString);
                            const task = batchTasksForDate[row];

                            // Task cell
                            const taskCell = document.createElement('td');
                            taskCell.className = 'print-grid-cell';
                            taskCell.style.width = '60%';
                            if (task) {
                                taskCell.innerHTML = `
                                    <div class="print-task-card department-batch" style="margin: 0 auto; max-width: 180px;">
                                        <div class="print-task-title">${task.project}</div>
                                        <div class="print-project-description">${task.projectDescription || ''}</div>
                                        <div class="print-task-day-counter">${task.dayCounter || ''}</div>
                                        <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                        <div class="print-task-details">
                                            ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
                                            <strong>Hours:</strong> ${task.hours} | <strong>Revenue:</strong> $${(() => {
                                                let hours = parseFloat(task.hours);
                                                let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                                return revenue.toLocaleString();
                                            })()}
                                        </div>
                                    </div>
                                `;
                            }
                            tr.appendChild(taskCell);

                            // Revenue cell (empty for batch/layout tasks)
                            const revenueCell = document.createElement('td');
                            revenueCell.className = 'print-grid-cell';
                            revenueCell.style.textAlign = 'center';
                            revenueCell.style.width = '13.33%';
                            revenueCell.textContent = '';
                            tr.appendChild(revenueCell);

                            // Mid-Day cell (blank)
                            const midDayCell = document.createElement('td');
                            midDayCell.className = 'print-grid-cell';
                            midDayCell.style.textAlign = 'center';
                            midDayCell.style.width = '13.33%';
                            midDayCell.textContent = '';
                            tr.appendChild(midDayCell);

                            // End of Day cell (blank)
                            const endOfDayCell = document.createElement('td');
                            endOfDayCell.className = 'print-grid-cell';
                            endOfDayCell.style.textAlign = 'center';
                            endOfDayCell.style.width = '13.33%';
                            endOfDayCell.textContent = '';
                            tr.appendChild(endOfDayCell);

                            batchTbody.appendChild(tr);
                        }
                    }

                    batchTable.appendChild(batchTbody);


                    if (printType === 'week') {
                        batchMainContentDiv.appendChild(batchDeptHeader);
                        batchMainContentDiv.appendChild(batchTable);
                        pageDiv.appendChild(batchMainContentDiv);
                        pageDiv.appendChild(batchSummaryDiv);
                    } else {
                        batchDeptHeader.style.width = '100%';
                        batchDeptHeader.style.textAlign = 'center';
                        batchDeptHeader.style.writingMode = 'horizontal-tb';
                        batchDeptHeader.style.textOrientation = 'mixed';
                        batchDeptHeader.style.maxWidth = '600px';
                        batchDeptHeader.style.margin = '0 auto';
                        batchTable.style.width = '100%';
                        batchTable.style.maxWidth = '600px';
                        batchTable.style.margin = '0 auto';
                        batchSummaryDiv.style.width = '100%';
                        batchSummaryDiv.style.maxWidth = '600px';
                        batchSummaryDiv.style.margin = '0 auto';
                        pageDiv.appendChild(batchDeptHeader);
                        pageDiv.appendChild(batchTable);
                        pageDiv.appendChild(batchSummaryDiv);
                    }
                }

                if (dept === 'Demold') {
                    // calculate layoutTotalHours = 0; since no hours
                    const layoutSummaryDiv = document.createElement('div');
                    layoutSummaryDiv.className = 'print-dept-summary';
                    layoutSummaryDiv.textContent = `Layout - Total Hours: 0`;

                    const layoutMainContentDiv = document.createElement('div');
                    layoutMainContentDiv.style.display = 'flex';
                    layoutMainContentDiv.style.alignItems = 'stretch';
                    if (printType === 'day') {
                        layoutMainContentDiv.style.justifyContent = 'flex-end';
                    }

                    const layoutDeptHeader = document.createElement('div');
                    layoutDeptHeader.className = `print-department-header department-layout`;
                    if (printType === 'day') {
                        layoutDeptHeader.classList.add('print-department-header-day');
                    }
                    layoutDeptHeader.textContent = 'Layout';

                    const layoutTable = document.createElement('table');
                    layoutTable.className = 'print-table';
                    if (printType === 'day') {
                        layoutTable.classList.add('print-table-day');
                    }
                    if (isCompact || getMaxTasksForDept('Layout', printType) > 6) {
                        layoutTable.classList.add('compact');
                    }

                    // Create thead for Layout
                    const layoutThead = document.createElement('thead');
                    const layoutHeaderRow = document.createElement('tr');

                    if (printType === 'week') {
                        currentPrintWeekDates.forEach(date => {
                            const th = document.createElement('th');
                            th.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<br>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                            layoutHeaderRow.appendChild(th);
                        });
                    } else {
                        const taskHeader = document.createElement('th');
                        taskHeader.textContent = selectedDateFormatted;
                        layoutHeaderRow.appendChild(taskHeader);

                        const revenueHeader = document.createElement('th');
                        revenueHeader.textContent = 'Revenue';
                        layoutHeaderRow.appendChild(revenueHeader);

                        const midDayHeader = document.createElement('th');
                        midDayHeader.textContent = 'Mid-Day';
                        layoutHeaderRow.appendChild(midDayHeader);

                        const endOfDayHeader = document.createElement('th');
                        endOfDayHeader.textContent = 'End of Day';
                        layoutHeaderRow.appendChild(endOfDayHeader);
                    }

                    layoutThead.appendChild(layoutHeaderRow);
                    layoutTable.appendChild(layoutThead);

                    // Create tbody for Layout
                    const layoutTbody = document.createElement('tbody');
                    const layoutMaxTasks = getMaxTasksForDept('Layout', printType);

                    if (printType === 'week') {
                        for (let row = 0; row < layoutMaxTasks; row++) {
                            const tr = document.createElement('tr');
                            currentPrintWeekDates.forEach(date => {
                                const dateString = date.toDateString();
                                const layoutTasksForDate = printLayoutTasks.filter(t => parseDate(t.date).toDateString() === dateString);
                                const task = layoutTasksForDate[row];
                                const td = document.createElement('td');
                                td.className = 'print-grid-cell';
                                if (task) {
                                    td.innerHTML = `
                                        <div class="print-task-card department-layout">
                                            <div class="print-task-title">${task.project}</div>
                                            <div class="print-project-description">${task.projectDescription || ''}</div>
                                            <div class="print-task-day-counter">${task.dayCounter || ''}</div>
                                            <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                            <div class="print-task-details">
                                                ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
                                                <strong>Hours:</strong> ${task.hours} | <strong>Revenue:</strong> $${(() => {
                                                    let hours = parseFloat(task.hours);
                                                    let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                                    return revenue.toLocaleString();
                                                })()}
                                            </div>
                                        </div>
                                    `;
                                }
                                tr.appendChild(td);
                            });
                            layoutTbody.appendChild(tr);
                        }
                    } else {
                        for (let row = 0; row < layoutMaxTasks; row++) {
                            const tr = document.createElement('tr');
                            const value = document.getElementById('print-date-select').value;
                            const [year, month, day] = value.split('-').map(Number);
                            const selectedDate = new Date(year, month - 1, day);
                            const dateString = selectedDate.toDateString();
                            const layoutTasksForDate = printLayoutTasks.filter(t => parseDate(t.date).toDateString() === dateString);
                            const task = layoutTasksForDate[row];

                            // Task cell
                            const taskCell = document.createElement('td');
                            taskCell.className = 'print-grid-cell';
                            taskCell.style.width = '60%';
                            if (task) {
                                taskCell.innerHTML = `
                                    <div class="print-task-card department-layout" style="margin: 0 auto; max-width: 180px;">
                                        <div class="print-task-title">${task.project}</div>
                                        <div class="print-project-description">${task.projectDescription || ''}</div>
                                        <div class="print-task-day-counter">${task.dayCounter || ''}</div>
                                        <div class="print-task-description">${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}</div>
                                        <div class="print-task-details">
                                            ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
                                            <strong>Hours:</strong> ${task.hours} | <strong>Revenue:</strong> $${(() => {
                                                let hours = parseFloat(task.hours);
                                                let revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                                                return revenue.toLocaleString();
                                            })()}
                                        </div>
                                    </div>
                                `;
                            }
                            tr.appendChild(taskCell);

                            // Revenue cell (empty for batch/layout tasks)
                            const revenueCell = document.createElement('td');
                            revenueCell.className = 'print-grid-cell';
                            revenueCell.style.textAlign = 'center';
                            revenueCell.style.width = '13.33%';
                            revenueCell.textContent = '';
                            tr.appendChild(revenueCell);

                            // Mid-Day cell (blank)
                            const midDayCell = document.createElement('td');
                            midDayCell.className = 'print-grid-cell';
                            midDayCell.style.textAlign = 'center';
                            midDayCell.style.width = '13.33%';
                            midDayCell.textContent = '';
                            tr.appendChild(midDayCell);

                            // End of Day cell (blank)
                            const endOfDayCell = document.createElement('td');
                            endOfDayCell.className = 'print-grid-cell';
                            endOfDayCell.style.textAlign = 'center';
                            endOfDayCell.style.width = '13.33%';
                            endOfDayCell.textContent = '';
                            tr.appendChild(endOfDayCell);

                            layoutTbody.appendChild(tr);
                        }
                    }

                    layoutTable.appendChild(layoutTbody);


                    if (printType === 'week') {
                        layoutMainContentDiv.appendChild(layoutDeptHeader);
                        layoutMainContentDiv.appendChild(layoutTable);
                        pageDiv.appendChild(layoutMainContentDiv);
                        pageDiv.appendChild(layoutSummaryDiv);
                    } else {
                        layoutDeptHeader.style.width = '100%';
                        layoutDeptHeader.style.textAlign = 'center';
                        layoutDeptHeader.style.writingMode = 'horizontal-tb';
                        layoutDeptHeader.style.textOrientation = 'mixed';
                        layoutDeptHeader.style.maxWidth = '600px';
                        layoutDeptHeader.style.margin = '0 auto';
                        layoutTable.style.width = '100%';
                        layoutTable.style.maxWidth = '600px';
                        layoutTable.style.margin = '0 auto';
                        layoutSummaryDiv.style.width = '100%';
                        layoutSummaryDiv.style.maxWidth = '600px';
                        layoutSummaryDiv.style.margin = '0 auto';
                        pageDiv.appendChild(layoutDeptHeader);
                        pageDiv.appendChild(layoutTable);
                        pageDiv.appendChild(layoutSummaryDiv);
                    }
                }

                printContainer.appendChild(pageDiv);
                // Remove page break after the last department to avoid extra blank page
                // Only add page breaks between departments, not after the last one
                if (index < selectedDepts.length - 1) {
                    pageDiv.style.pageBreakAfter = 'always';
                } else {
                    pageDiv.style.pageBreakAfter = 'auto';
                }
            });

            return printContainer;
        }

        function getMaxTasksForDept(dept, printType) {
            if (dept === 'Batch' || dept === 'Layout') return 1;
            const deptTasksForMax = allTasks.filter(task => task.department === dept);
            if (printType === 'week') {
                let max = 0;
                currentPrintWeekDates.forEach(date => {
                    const dateString = date.toDateString();
                    const count = deptTasksForMax.filter(t => {
                        const taskDate = parseDate(t.date);
                        return taskDate && taskDate.toDateString() === dateString;
                    }).length;
                    if (count > max) max = count;
                });
                return max;
            } else {
                const value = document.getElementById('print-date-select').value;
                const [year, month, day] = value.split('-').map(Number);
                const selectedDate = new Date(year, month - 1, day);
                const selectedTimestamp = selectedDate.getTime();
                const count = deptTasksForMax.filter(t => {
                    const taskDate = parseDate(t.date);
                    if (!taskDate) return false;
                    const taskTimestamp = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate()).getTime();
                    return taskTimestamp === selectedTimestamp;
                }).length;
                return count;
            }
        }


        // Event listeners for print modal
        document.getElementById('print-btn').addEventListener('click', showPrintModal);
        document.getElementById('print-close').addEventListener('click', hidePrintModal);
        document.getElementById('print-cancel-btn').addEventListener('click', hidePrintModal);
        document.getElementById('print-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('print-modal')) {
                hidePrintModal();
            }
        });

        document.getElementById('print-week-select').addEventListener('change', updateWeekDates);

        document.querySelectorAll('input[name="print-type"]').forEach(radio => {
            radio.addEventListener('change', updatePrintTypeDisplay);
        });

        document.getElementById('check-all-depts').addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
            // Save the state
            const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem('printSelectedDepartments', JSON.stringify(selectedDepts));
        });

        document.getElementById('uncheck-all-depts').addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
            // Save the state
            localStorage.setItem('printSelectedDepartments', JSON.stringify([]));
        });

        document.getElementById('print-execute-btn').addEventListener('click', () => {
            let styleElement = null;
            if (currentPrintType === 'day') {
                styleElement = document.createElement('style');
                styleElement.textContent = '@page { size: letter portrait; margin: 0.5in; }';
                document.head.appendChild(styleElement);
            }
            const printContent = generatePrintContent();
            if (printContent) {
                document.body.appendChild(printContent);

                const printType = document.querySelector('input[name="print-type"]:checked').value;
                const pageMaxHeightPx = printType === 'day' ? 7 * 96 : 6 * 96; // Aggressive max heights to force scaling: day 7in portrait, week 6in landscape
                const pages = printContent.querySelectorAll('.print-page');

                // Intelligent scaling: scale the entire page to fit within printable area
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        pages.forEach(page => {
                            // Force layout recalculation
                            page.offsetHeight;
                            const height = page.offsetHeight;
                            if (height > pageMaxHeightPx) {
                                const scale = pageMaxHeightPx / height;
                                page.style.zoom = scale;
                            }
                        });
                    }, 100);
                });

                // Give more time for styles to apply
                setTimeout(() => {
                    window.print();
                    if (styleElement) {
                        document.head.removeChild(styleElement);
                    }
                    document.body.removeChild(printContent);
                    hidePrintModal();
                }, 1500);
            }
        });

        // Auto-refresh every 30 minutes (reduce frequency to improve performance)
        setInterval(() => {
            // Clear render cache when doing scheduled refresh to force fresh data
            renderCache = null;
            fetchTasks();
        }, 30 * 60 * 1000);

        // Handle tab visibility changes to refresh data when returning to the tab
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ Tab became visible, refreshing schedule...');
                const modalOpen = document.getElementById('project-modal').classList.contains('show') ||
                                  document.getElementById('password-modal').classList.contains('show') ||
                                  document.getElementById('print-modal').classList.contains('show');
                if (!modalOpen) {
                    console.log('🔄 Starting simplified resume refresh...');

                    // Preserve last viewed week on tab resume for better UX
                    // Restore saved week index from localStorage before refreshing
                    const savedWeekIndex = localStorage.getItem('currentViewedWeekIndex');
                    if (savedWeekIndex && !isNaN(parseInt(savedWeekIndex))) {
                        currentViewedWeekIndex = parseInt(savedWeekIndex);
                        console.log('📍 Restored week index:', currentViewedWeekIndex);
                    }

                    // Show loading
                    showLoading(true, 'Refreshing schedule...');

                    // Perform fresh data fetch (simplified approach)
                    fetchTasks()
                        .then(() => {
                            console.log('✅ Resume refresh completed');

                            // After rendering, restore scroll position if available
                            const savedScrollPosition = localStorage.getItem('scheduleScrollPosition');
                            if (savedScrollPosition && !isNaN(parseFloat(savedScrollPosition))) {
                                const scheduleWrapper = document.getElementById('schedule-wrapper');
                                if (scheduleWrapper) {
                                    scheduleWrapper.scrollLeft = parseFloat(savedScrollPosition);
                                    console.log('📍 Restored scroll position:', savedScrollPosition);
                                }
                            }

                            showLoading(false);
                        })
                        .catch(error => {
                            console.error('❌ Resume refresh failed:', error);
                            showLoading(false);
                        });
                }
            }
        });

        function editTaskInline(task, taskCard) {
            const descElement = taskCard.querySelector('.task-description');
            const originalText = descElement.innerHTML;

            // Add editing class to card
            taskCard.classList.add('editing');

            // Create input field
            const input = document.createElement('textarea');
            input.className = 'inline-edit-input';
            input.value = descElement.textContent.trim() === 'Staging Missing' ? '' : descElement.textContent.trim();
            input.style.width = '100%';
            input.style.minHeight = '60px';
            input.style.border = '1px solid var(--border-primary)';
            input.style.borderRadius = 'var(--border-radius-md)';
            input.style.fontSize = '1rem';
            input.style.fontFamily = 'inherit';
            input.style.backgroundColor = 'var(--background-secondary)';
            input.style.color = 'var(--text-primary)';
            input.style.resize = 'vertical';

            // Create control buttons
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'edit-controls';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'edit-confirm-btn';
            confirmBtn.textContent = '✓';
            confirmBtn.title = 'Confirm changes (Ctrl+Enter)';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'edit-cancel-btn';
            cancelBtn.textContent = '✕';
            cancelBtn.title = 'Cancel changes (Escape)';

            controlsDiv.appendChild(confirmBtn);
            controlsDiv.appendChild(cancelBtn);

            // Replace description with input and add controls
            descElement.replaceWith(input);
            taskCard.appendChild(controlsDiv);
            input.focus();
            input.select();

            // Handle save/cancel
            const saveEdit = async () => {
                const newText = input.value.trim();
                task.description = newText;

                // Update display
                const newDescElement = document.createElement('div');
                newDescElement.className = 'task-description';
                newDescElement.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                input.replaceWith(newDescElement);

                // Remove controls
                if (controlsDiv.parentNode) {
                    controlsDiv.parentNode.removeChild(controlsDiv);
                }

                // Remove editing class
                taskCard.classList.remove('editing');

                // Save to staging if possible
                try {
                    await saveToStaging(task.project, [{task, newText}]);
                    showSuccessNotification('Task updated successfully!');

                    // Send refresh signal to all other clients
                    await sendRefreshSignal({
                        action: 'task_updated',
                        project: task.project,
                        taskId: task.id,
                        description: newText.substring(0, 50) + (newText.length > 50 ? '...' : '')
                    });

                } catch (error) {
                    console.error('Failed to save:', error);
                    showSuccessNotification('Task updated locally. Sync failed.', true);
                }

                // Remove event listeners
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('keydown', handleKeydown);
            };

            const cancelEdit = () => {
                const newDescElement = document.createElement('div');
                newDescElement.className = 'task-description';
                newDescElement.innerHTML = originalText;
                input.replaceWith(newDescElement);

                // Remove controls
                if (controlsDiv.parentNode) {
                    controlsDiv.parentNode.removeChild(controlsDiv);
                }

                // Remove editing class
                taskCard.classList.remove('editing');

                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('keydown', handleKeydown);
            };

            // Button event handlers
            confirmBtn.addEventListener('click', saveEdit);
            cancelBtn.addEventListener('click', cancelEdit);

            const handleClickOutside = (e) => {
                if (!input.contains(e.target) && !controlsDiv.contains(e.target)) {
                    saveEdit();
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    cancelEdit();
                }
            };

            // Add event listeners
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
                document.addEventListener('keydown', handleKeydown);
            }, 10);
        }

        function showSuccessNotification(message, isError = false) {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'inline-edit-notification';
            notification.textContent = message;
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.background = isError ? '#ef4444' : '#22c55e';
            notification.style.color = 'white';
            notification.style.padding = '0.75rem 1rem';
            notification.style.borderRadius = 'var(--border-radius-md)';
            notification.style.boxShadow = 'var(--shadow-md)';
            notification.style.zIndex = '10000';
            notification.style.fontSize = '0.875rem';
            notification.style.fontWeight = '500';

            document.body.appendChild(notification);

            // Remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }

        // Initial load
        fetchTasks();

        // ============================================
        // SIMPLE REFRESH SYSTEM INTEGRATION
        // ============================================

        // Supabase configuration for task management
        const SUPABASE_URL = 'https://nrrkxlovhxgwwgzoihiu.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt4bG92aHhnd3dnem9paGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTEzMzAsImV4cCI6MjA3NjIyNzMzMH0.mwLAySKxtQHHl7ihT0MboMpZnzQJbw-QjCCgi3CCrT4';
        const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt4bG92aHhnd3dnem9paGl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY1MTMzMCwiZXhwIjoyMDc2MjI3MzMwfQ.Ni2pK3PZxU3WxJcSJvOkJf-ti9Wx4WenHUd2rxhBfAk';

        // Configuration for refresh system
        const SUPABASE_URL_REFRESH = SUPABASE_URL;
        const SUPABASE_ANON_KEY_REFRESH = SUPABASE_ANON_KEY;
        const SUPABASE_EDGE_URL_REFRESH = SUPABASE_URL_REFRESH + '/functions/v1/sync-sheet-data';
        const SERVICE_KEY_REFRESH = SUPABASE_SERVICE_KEY;

        // Google Sheets API configuration (already defined above, reusing)
        // const GOOGLE_SHEETS_API_KEY = 'AIzaSyA0i2Mr7kVirmM72ggu_L7_3XAB3_EAsNw';
        // const SPREADSHEET_ID = '1ReBnudzH_QAY6e45wwpf_sHd2OF1Akkppm0S7NmZ_ws';

        let supabaseClient = null;
        let refreshChannel = null;
        let tasksTable = 'weekly_tasks'; // Supabase table name for manual tasks

        /**
         * Initialize Supabase for task management and refresh signaling
         */
        async function initializeSupabase() {
            if (supabaseClient) return supabaseClient;

            // Load Supabase library if not already loaded
            if (!window.supabase) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // Subscribe to refresh signals
            setupRefreshSubscription();

            console.log('✅ Supabase initialized');
            return supabaseClient;
        }

        /**
         * Set up subscription to refresh signals
         */
        function setupRefreshSubscription() {
            // Create a channel for refresh signals
            refreshChannel = supabaseClient
                .channel('refresh_signals')
                .on('broadcast', { event: 'data_updated' }, (payload) => {
                    console.log('🔄 Refresh signal received:', payload);
                    handleRefreshSignal(payload);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Subscribed to refresh signals');
                    } else if (status === 'CLOSED') {
                        console.log('⚠️ Refresh subscription closed');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Refresh subscription error');
                    }
                });
        }

        /**
         * Handle refresh signal by reloading data from Google Sheets
         */
        function handleRefreshSignal(payload) {
            console.log('🔄 Processing refresh signal...');

            // Add visual indicator
            showRefreshIndicator();

            // Reload data using your existing fetchTasks function
            fetchTasks()
                .then(() => {
                    console.log('✅ Data refreshed from Google Sheets');
                })
                .catch(error => {
                    console.error('❌ Failed to refresh data:', error);
                });
        }

        /**
         * Send a refresh signal to all other clients
         * Call this after successfully updating Google Sheets or Supabase
         */
        async function sendRefreshSignal(updateInfo = {}) {
            if (!supabaseClient) {
                console.warn('⚠️ Supabase not initialized, cannot send refresh signal');
                return;
            }

            try {
                console.log('📡 Sending refresh signal to all clients...');

                // Send broadcast signal
                const { error } = await supabaseClient
                    .channel('refresh_signals')
                    .send({
                        type: 'broadcast',
                        event: 'data_updated',
                        payload: {
                            timestamp: new Date().toISOString(),
                            source: 'web_app',
                            info: updateInfo
                        }
                    });

                if (error) {
                    console.error('❌ Failed to send refresh signal:', error);
                } else {
                    console.log('✅ Refresh signal sent successfully');
                }

            } catch (error) {
                console.error('❌ Error sending refresh signal:', error);
            }
        }

        /**
         * Save a new task to Supabase
         */
        async function saveTaskToSupabase(taskData) {
            if (!supabaseClient) {
                await initializeSupabase();
            }

            try {
                const { data, error } = await supabaseClient
                    .from(tasksTable)
                    .insert([{
                        id: taskData.id || `task-${Date.now()}`,
                        week: taskData.week,
                        project: taskData.project,
                        project_description: taskData.projectDescription || '',
                        description: taskData.description || '',
                        date: taskData.date,
                        department: taskData.department,
                        value: taskData.value || '',
                        hours: taskData.hours || '',
                        day_number: taskData.dayNumber || '',
                        total_days: taskData.totalDays || '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);

                if (error) {
                    throw error;
                }

                console.log('✅ Task saved to Supabase');
                return data;
            } catch (error) {
                console.error('❌ Failed to save task to Supabase:', error);
                throw error;
            }
        }

        /**
         * Delete a task from Supabase
         */
        async function deleteTaskFromSupabase(taskId) {
            if (!supabaseClient) {
                await initializeSupabase();
            }

            try {
                const { error } = await supabaseClient
                    .from(tasksTable)
                    .delete()
                    .eq('id', taskId);

                if (error) {
                    throw error;
                }

                console.log('✅ Task deleted from Supabase');
                return true;
            } catch (error) {
                console.error('❌ Failed to delete task from Supabase:', error);
                throw error;
            }
        }

        /**
         * Load manual tasks from Supabase and merge with Google Sheets data
         */
        async function loadManualTasks() {
            if (!supabaseClient) {
                await initializeSupabase();
            }

            try {
                const { data, error } = await supabaseClient
                    .from(tasksTable)
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }

                // Convert Supabase data to match Google Sheets task structure
                const manualTasks = data.map(row => ({
                    id: row.id,
                    week: row.week,
                    project: row.project,
                    projectDescription: row.project_description || '',
                    description: row.description || '',
                    date: row.date,
                    department: normalizeDepartment(row.department),
                    value: row.value || '',
                    hours: row.hours || '',
                    dayNumber: row.day_number || '',
                    totalDays: row.total_days || '',
                    dayCounter: '',
                    missingDate: !row.date,
                    isManual: true // Flag to identify manual tasks
                }));

                // Calculate day counters for manual tasks
                calculateProjectDayCounts(manualTasks);

                return manualTasks;
            } catch (error) {
                console.error('❌ Failed to load manual tasks:', error);
                return [];
            }
        }

        /**
         * Enhanced save function that updates Google Sheets and signals refresh
         */
        async function saveTaskAndRefresh(taskData, rowIndex) {
            try {
                console.log('💾 Starting save and refresh process...');

                // Step 1: Update Google Sheets (your existing logic)
                await updateGoogleSheets(taskData, rowIndex);

                // Step 2: Send refresh signal to all other clients
                await sendRefreshSignal({
                    action: 'task_updated',
                    taskId: taskData.id,
                    rowIndex: rowIndex
                });

                // Show success
                showNotification('Changes saved and synced!', 'success');

                console.log('✅ Save and refresh completed successfully');

            } catch (error) {
                console.error('❌ Save/refresh failed:', error);
                showNotification('Save failed', 'error');
                throw error;
            }
        }

        /**
         * Your existing Google Sheets update function (modified for integration)
         */
        async function updateGoogleSheets(taskData, rowIndex) {
            const range = `Primary Live List 2!A${rowIndex}:J${rowIndex}`;

            const values = [[
                taskData.week || '',
                taskData.project || '',
                taskData.project_description || '',
                formatDateForSheets(taskData.task_date),
                taskData.department || '',
                taskData.task_value || '',
                taskData.hours || '',
                taskData.day_number || '',
                taskData.total_days || '',
                taskData.description || ''
            ]];

            const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${API_KEY}`;

            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google Sheets update failed: ${response.status} ${error}`);
            }

            console.log('✅ Google Sheets updated successfully');
        }

        /**
         * Utility functions for refresh system
         */
        function showRefreshIndicator() {
            const indicator = document.createElement('div');
            indicator.textContent = '🔄 Refreshing...';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;

            document.body.appendChild(indicator);
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 2000);
        }

        function showNotification(message, type = 'info') {
            console.log(`[${type.toUpperCase()}] ${message}`);

            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;

            document.body.appendChild(notification);
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 4000);
        }

        /**
         * Initialize the refresh system when the page loads
         */
        document.addEventListener('DOMContentLoaded', async () => {
            // Initialize existing functionality first
            try {
                await initializeSupabase();
                console.log('🚀 Supabase and refresh system ready');
                // Re-enable add card indicators after any DOM changes
                setTimeout(enableAddCardIndicators, 500);
            } catch (error) {
                console.error('❌ Failed to initialize system:', error);
            }
        });

        // Add modal styles
        const addCardModalStyles = `
        <style>
        .add-card-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
            padding: 2rem;
            box-sizing: border-box;
        }

        .add-card-modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .add-card-content {
            background: var(--background-secondary);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            width: 90vw;
            max-width: 500px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--border-primary);
        }

        .add-card-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-primary);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--background-primary);
        }

        .add-card-header h3 {
            margin: 0;
            color: var(--text-primary);
            font-size: 1.25rem;
            font-weight: 600;
        }

        .add-card-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0.25rem;
            border-radius: var(--border-radius-md);
            transition: all 0.3s ease;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .add-card-close:hover {
            color: var(--accent-primary);
            background: rgba(79, 70, 229, 0.1);
        }

        .add-card-body {
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-row {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .form-row .form-group {
            flex: 1;
            margin-bottom: 0;
        }

        .form-group label {
            display: block;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border-primary);
            border-radius: var(--border-radius-md);
            background: var(--background-secondary);
            color: var(--text-primary);
            font-family: inherit;
            font-size: 0.875rem;
            box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
        }

        .form-actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid var(--border-primary);
        }

        .btn-primary, .btn-secondary {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: var(--border-radius-md);
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-primary {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        .btn-secondary {
            background: var(--border-primary);
            color: var(--text-primary);
        }

        .btn-secondary:hover {
            background: var(--border-secondary);
        }

        .task-card-placeholder.add-enabled {
            position: relative;
            cursor: pointer;
        }

        .task-card-placeholder.add-enabled:hover {
            background: rgba(79, 70, 229, 0.1);
            border: 2px dashed var(--accent-primary);
        }

        .task-card-placeholder.add-enabled::before {
            content: '+';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2rem;
            color: var(--accent-primary);
            font-weight: bold;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .task-card-placeholder.add-enabled:hover::before {
            opacity: 1;
        }

        /* Drag and Drop Enhancements */
        .task-card[draggable="true"] {
            cursor: grab;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .task-card[draggable="true"]:active {
            cursor: grabbing;
        }

        .task-card.not-draggable {
            cursor: default;
        }

        .dragging-active .task-card-placeholder {
            background: rgba(79, 70, 229, 0.1);
            border: 1px dashed var(--accent-primary);
            transition: all 0.2s ease;
        }

        .dragging-active .task-card-placeholder.drag-over {
            background: rgba(79, 70, 229, 0.2);
            border: 2px solid var(--accent-primary);
            transform: scale(1.02);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .dragging-active .task-card-placeholder.drag-invalid {
            background: rgba(239, 68, 68, 0.1);
            border: 2px solid #ef4444;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .task-card.dragging {
            transform: rotate(5deg) scale(1.05);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            filter: brightness(1.1);
        }

        /* Hover effects for draggable cards */
        .task-card[draggable="true"]:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        /* Disable hover effects during drag */
        .dragging-active .task-card[draggable="true"]:hover {
            transform: none;
        }
        </style>`;

        // Insert modal styles
        document.head.insertAdjacentHTML('beforeend', addCardModalStyles);

        // Global variables for add card functionality
        let currentAddCardContext = null; // { department, date, week }

        // Show add card modal
        function showAddCardModal(department, date, week) {
            currentAddCardContext = { department, date, week };

            console.log('showAddCardModal called with:', { department, date, week });

            // First ensure modal exists in DOM
            let modal = document.getElementById('add-card-modal');
            if (!modal) {
                console.error('Modal not found! Inserting modal HTML...');
                // Re-insert the modal if it's missing
                document.head.insertAdjacentHTML('beforeend', addCardModalStyles);
                document.body.insertAdjacentHTML('beforeend', addCardModalHTML);
                modal = document.getElementById('add-card-modal');
            }

            console.log('Modal element:', modal);

            // Set default values - autofill department and date if provided
            const elements = {
                'task-project': '',
                'task-description': '',
                'task-department': department || '',
                'task-date': date || '',
                'task-hours': '0',
                'task-day-number': '1',
                'task-total-days': '1'
            };

            modal.classList.add('show');
            document.body.style.overflow = 'hidden';

            // Use setTimeout to ensure the modal is rendered before populating fields
            setTimeout(() => {
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.value = value;
                        console.log(`"${id}" set to:`, value);
                    } else {
                        console.error(`Element with id "${id}" not found!`);
                    }
                });
                const taskProjectEl = document.getElementById('task-project');
                if (taskProjectEl) taskProjectEl.focus();
            }, 50); // A short delay is enough
        }

        // Hide add card modal
        function hideAddCardModal() {
            document.getElementById('add-card-modal').classList.remove('show');
            document.body.style.overflow = '';
            currentAddCardContext = null;
        }

        // Handle add card form submission
        async function handleAddCardSubmit(e) {
            e.preventDefault();

            const formData = new FormData(e.target);
            const taskData = {
                id: `manual-${Date.now()}`,
                week: currentAddCardContext.week,
                project: formData.get('project'),
                description: formData.get('description'),
                department: formData.get('department'),
                date: formData.get('date'),
                hours: formData.get('hours'),
                dayNumber: formData.get('dayNumber'),
                totalDays: formData.get('totalDays'),
                value: '',
                projectDescription: ''
            };

            // Basic validation
            if (!taskData.project || !taskData.department || !taskData.date) {
                alert('Please fill in all required fields.');
                return;
            }

            try {
                // Show loading
                const submitBtn = document.getElementById('add-card-submit');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';

                // Save to Supabase
                await saveTaskToSupabase(taskData);

                // Send refresh signal to all clients
                await sendRefreshSignal({
                    action: 'task_added',
                    taskId: taskData.id,
                    department: taskData.department,
                    date: taskData.date
                });

                // Refresh local data
                await fetchTasks();

                hideAddCardModal();

            } catch (error) {
                console.error('Failed to add task:', error);
                alert('Failed to add task. Please try again.');
            } finally {
                const submitBtn = document.getElementById('add-card-submit');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Task';
            }
        }

        // Enable visual add indicators on empty cells
        function enableAddCardIndicators() {
            const isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';
            if (!isEditingUnlocked) {
                console.log('Editing not unlocked, skipping add card indicators');
                // Remove add-enabled class if editing is locked
                const placeholders = document.querySelectorAll('.task-card-placeholder.add-enabled');
                placeholders.forEach(placeholder => {
                    placeholder.classList.remove('add-enabled');
                });
                return;
            }

            const placeholders = document.querySelectorAll('.task-card-placeholder');
            placeholders.forEach(placeholder => {
                placeholder.classList.add('add-enabled');
            });
        }

        // Event listeners for add card modal
        document.getElementById('add-card-close').addEventListener('click', hideAddCardModal);
        document.getElementById('add-card-cancel').addEventListener('click', hideAddCardModal);
        document.getElementById('add-card-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('add-card-modal')) {
                hideAddCardModal();
            }
        });
        document.getElementById('add-card-form').addEventListener('submit', handleAddCardSubmit);

        // Add tooltip for draggable cards
        document.addEventListener('mouseenter', function(e) {
            if (!(e.target instanceof Element)) return;
            const taskCard = e.target.closest('.task-card[draggable="true"]');
            if (taskCard && !document.body.classList.contains('dragging-active')) {
                taskCard.title = 'Drag to move to different date';
            }
        }, true);

        document.addEventListener('mouseleave', function(e) {
            if (!(e.target instanceof Element)) return;
            const taskCard = e.target.closest('.task-card[draggable="true"]');
            if (taskCard) {
                taskCard.title = '';
            }
        });

        // Handle clicking on delete buttons
        document.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            const deleteBtn = e.target.closest('.task-delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                const taskId = deleteBtn.dataset.taskId;
                const taskCard = deleteBtn.closest('.task-card');
                const taskName = taskCard ? taskCard.querySelector('.task-title').textContent : 'this task';

                if (confirm(`Are you sure you want to delete "${taskName}"? This action cannot be undone.`)) {
                    deleteTaskFromSupabase(taskId).then(async () => {
                        // Send refresh signal to all clients
                        await sendRefreshSignal({
                            action: 'task_deleted',
                            taskId: taskId
                        });

                        // Refresh the tasks
                        await fetchTasks();
                        showSuccessNotification('Task deleted successfully!');
                    }).catch(error => {
                        console.error('Failed to delete task:', error);
                        showSuccessNotification('Failed to delete task.', true);
                    });
                }
            }
        });

        // Handle clicking on empty cells to add tasks
        document.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            const placeholder = e.target.closest('.task-card-placeholder.add-enabled');
            if (placeholder) {
                // Check if editing is unlocked
                const isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';
                if (!isEditingUnlocked) {
                    return; // Do not show modal if editing is not unlocked
                }

                e.preventDefault();

                // Get context from data attributes on the placeholder
                const department = placeholder.dataset.department;
                const dateStr = placeholder.dataset.date;
                const weekText = placeholder.dataset.week;

                console.log('Clicked placeholder with data:', { department, dateStr, weekText });

                if (department && dateStr && weekText) {
                    showAddCardModal(department, dateStr, weekText);
                } else {
                    console.log('Missing data attributes, showing modal with empty context');
                    // Fallback: show modal with empty context
                    showAddCardModal('', '', '');
                }
            }
        });

        // Window resize handler with debouncing
        let resizeTimeout;
        function handleWindowResize() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                console.log('Window resized, refreshing layout...');

                // Update grid widths to match new window size
                const wrapper = document.getElementById('schedule-wrapper');
                const container = document.getElementById('schedule-container');
                const wrapperWidth = wrapper.clientWidth;
                const grids = container.querySelectorAll('.schedule-grid');
                grids.forEach(grid => {
                    grid.style.width = `${wrapperWidth}px`;
                });

                // Clear existing minHeight values and force a reflow before recalculating
                const allCards = container.querySelectorAll('.task-card');
                allCards.forEach(card => {
                    card.style.minHeight = 'auto';
                    // Force reflow by accessing offsetHeight
                    card.offsetHeight;
                });

                // Re-equalize card heights with improved logic
                equalizeAllCardHeights();

                // Force another reflow and re-equalize to ensure consistency
                setTimeout(() => {
                    equalizeAllCardHeights();
                }, 50);

                console.log('Layout refreshed after window resize');
            }, 250); // Debounce for 250ms
        }

        // Add window resize listener
        window.addEventListener('resize', handleWindowResize);

        // Initialize add card functionality after page load
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize Supabase
            initializeSupabase();

            // Enable add card indicators after initial render
            setTimeout(enableAddCardIndicators, 1000);
        });

        // Export functions for global use
        window.saveTaskAndRefresh = saveTaskAndRefresh;
        window.sendRefreshSignal = sendRefreshSignal;

    </script>
</body>
</html>

