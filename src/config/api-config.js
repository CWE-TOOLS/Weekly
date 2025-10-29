/**
 * API Configuration
 * Contains all API keys, endpoints, and authentication configuration
 */

// Google Sheets API Configuration
export const GOOGLE_SHEETS = {
    API_KEY: 'AIzaSyA0i2Mr7kVirmM72ggu_L7_3XAB3_EAsNw',
    SPREADSHEET_ID: '1ReBnudzH_QAY6e45wwpf_sHd2OF1Akkppm0S7NmZ_ws',
    SHEET_NAME: 'Primary Live List 2',
    STAGING_SHEET_NAME: 'Staging - Project Details'
};

// Supabase Configuration
export const SUPABASE = {
    URL: 'https://nrrkxlovhxgwwgzoihiu.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt4bG92aHhnd3dnem9paGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTEzMzAsImV4cCI6MjA3NjIyNzMzMH0.mwLAySKxtQHHl7ihT0MboMpZnzQJbw-QjCCgi3CCrT4',
    SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt4bG92aHhnd3dnem9paGl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY1MTMzMCwiZXhwIjoyMDc2MjI3MzMwfQ.Ni2pK3PZxU3WxJcSJvOkJf-ti9Wx4WenHUd2rxhBfAk',
    TASKS_TABLE: 'weekly_tasks',
    CDN_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
};

// Service Account for Google Sheets Write Access
export const SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "test-1-468219",
    private_key_id: "fbc2ff13cf04d5fb4b147818628d600e91ed5345",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDh+/evKttIQC2i\nbWxlXGpW76QjRz9iZfvGsJVAlbt/wZjVQEhozhvpM2guU0czVsgvB4r6MZo/AAif\nkzihTYz1iNWD+giyq/7zCoIZfWVe+kMPwetMPSYSTuneK8G3KLFxJss8aTKk1evF\n/0qoNxxNQKpkG03E9srwo6a9F9y+t+wDTclNWQVtzlfILhxW+nCtMzx9i2HhX/i3\n/A8NhmznCZwVALPAVIL25yWx/1jD/TSSk5z952eJ62kzknzjcoGjmjgFfgV7T2uk\nEocGkoFPQwHJ0S/94XUkjJyqqEd65CnvQH57Gd35jE0tiGyQRRB1W9/MzG1M4Brl\ndVxV4e+FAgMBAAECggEAB1Z3JGjv1di/opaK/n+RtGDzo3GczUUid8EkF4TFIdDX\ndZUwxLZskZXpvBdYKIKY3W4RRS53I7SMkyHkpNgvy4k15aMoxSRwktO0hb9cm0jl\nBI33ZfJWWiHV1jD1iUz49gOcdcm0q0WG8lbnxa6EbL28yqNYUxzwWf/2Wg18TXT7\nw/hF3MUVYIiycGIy4TTcT82kdmqV+O02/gbNKSKUAXF1M1BEsDTEXXQTd2HJng6s\nclZYDNMQLWU2gnYqnLW/+SoLvdv8w1hJJlWcmBhV9oPeRCxxB8sUwt3xvv4NjOPs\nvfygpSXkRdAHBwWWt0qKbzl1sPWzmCxq/F7DVxjrwQKBgQD4nG7xrz55GHeEB3ax\nw/mweu7A34PRWO1E33YCHXE9s/3uKfVLkc4BezXOuXleWxmtkeOQ4cipltp7Ay2I\n8F944pI1jMdWSq+m4sKQbltgeT5xBxmS9Io8ms9aHCOoloe3TyNQtTFYad4+6wiw\nAcBVGKfcBCcV0y50eTuj+f/qGwKBgQDos2CL8XqHztWB0XtaxB3r5+1aaD/RjdbN\ncNllfKAdZG74aWycGDcJ4LE6pR/XyCHIUx5v0aPqKjy7OH5T2BVbps2s1Cy+qzRm\nmvcR0V3brlbB1podfUwWI2YWp5CV4FWDuAJlYQgcNp8Jj+YGEy3oYgJXONbWxMKX\n5FDaTO8m3wKBgE0Hm1CDLeYzcISWE27M/AZ0cJmOJ7 eryAh4/IV3PekSZfFvSrOZ\nf6zx0iA1U6eqrnAbLdlsO9JgDV3kBC3T3KEGAqtY7UKNbZNV21cI+oMPzgsTWhcw\nccyJYwnWgi3wRijD+ns9SQbN9rCj/lMal89GDmybVMjsYA5yqcoK4gJVAoGBANmk\na/h3spKy8R6qPyV1qEasdWLJfmcQsocTtUEmftr+xIuyjtKwE0o5zYl8R3wawv4K\nP7115kltl7/D5uOkhtVh/ZxYFkF+/1O4PL19hLujI6HIhfxu5GsQULt/ncuQNmsr\n/5GyX1OEAtt+qzWjWpyujmHl14qoHRjTgouqyUMhAoGAVhTSRzcO5Fq58sH5RCLJ\nrDvPXBtKA/IwkSwxu0twsBFaoHDGF2ud//pET7o6B7WSDBGIK72HKXIz6yMSw0Ug\n5BAyQ63v17PucEZfYL9yUDOna//coqCvVTwgWp2AX7w0snnUtwSV1KGMV9lodsrs\nMpU8YEciOk6IMjaUTmSITNk=\n-----END PRIVATE KEY-----\n",
    client_email: "sheet-writer@test-1-468219.iam.gserviceaccount.com",
    client_id: "117725617866432687465",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/sheet-writer%40test-1-468219.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

// Refresh System Configuration
export const REFRESH_CONFIG = {
    EDGE_URL: `${SUPABASE.URL}/functions/v1/sync-sheet-data`,
    CHANNEL_NAME: 'refresh_signals',
    EVENT_NAME: 'data_updated'
};
