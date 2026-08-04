import {
  GoogleDriveAuthStatus,
  GoogleDriveFileRecord
} from '../types/safetyGate';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (error: any) => void;
          }) => any;
        };
      };
    };
  }
}

const GOOGLE_DRIVE_AUTH_KEY = 'zonos_google_drive_auth_status';
const GOOGLE_DRIVE_FILES_KEY = 'zonos_google_drive_files';
export const TARGET_FOLDER_NAME = '01 Incoming Photos';
export const REQUIRED_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Checks if Google Identity Services (GIS) script is loaded in window
 */
export function isGoogleIdentityServicesLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2);
}

/**
 * Safely loads Google Identity Services script if not already present
 */
export function loadGoogleIdentityServicesScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (isGoogleIdentityServicesLoaded()) {
      resolve(true);
      return;
    }
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

let gisTokenClientInstance: any = null;

/**
 * Safely initializes Google Identity Services Token Client if script is available.
 * NOTE: This does NOT initiate sign-in, display popups, or perform API calls.
 */
export function initializeGoogleIdentityServicesClient(
  onTokenResponse?: (response: any) => void
): boolean {
  if (!isGoogleIdentityServicesLoaded()) {
    return false;
  }
  const clientId = getGoogleClientId();
  if (!clientId || clientId.includes('YOUR_') || clientId.includes('Google Cloud')) {
    return false;
  }

  try {
    if (!gisTokenClientInstance && window.google?.accounts?.oauth2) {
      gisTokenClientInstance = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: REQUIRED_OAUTH_SCOPE,
        callback: (response: any) => {
          if (onTokenResponse) {
            onTokenResponse(response);
          }
        }
      });
    }
    return Boolean(gisTokenClientInstance);
  } catch (e) {
    console.error('Failed to initialize Google Identity Services token client:', e);
    return false;
  }
}


/**
 * Returns the Google Client ID configured via VITE_GOOGLE_CLIENT_ID environment variable
 * (With fallback to VITE_EBAY_CLIENT_ID if it contains a Google OAuth domain)
 */
export function getGoogleClientId(): string {
  const gId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (gId && !gId.includes('Google Cloud') && gId.includes('.googleusercontent.com')) {
    return gId;
  }
  const ebayId = import.meta.env.VITE_EBAY_CLIENT_ID;
  if (ebayId && ebayId.includes('.googleusercontent.com')) {
    return ebayId;
  }
  return gId || 'YOUR_GOOGLE_CLIENT_ID_HERE';
}

/**
 * Returns a safely masked Client ID string (e.g. "2996***.apps.googleusercontent.com")
 * to guarantee no full credential display in UI or logs.
 */
export function getMaskedGoogleClientId(): string {
  const id = getGoogleClientId();
  if (!id || id.includes('YOUR_') || id.includes('Google Cloud')) {
    return '未設定 (Not Configured)';
  }
  if (id.length > 15) {
    const prefix = id.substring(0, 4);
    const suffix = id.includes('.') ? id.substring(id.indexOf('.')) : '';
    return `${prefix}***${suffix}`;
  }
  return '設定済み (Configured)';
}

export function loadGoogleDriveAuthStatus(): GoogleDriveAuthStatus {
  try {
    const raw = sessionStorage.getItem(GOOGLE_DRIVE_AUTH_KEY);
    return (raw as GoogleDriveAuthStatus) || 'MOCK_CONNECTED';
  } catch (e) {
    return 'MOCK_CONNECTED';
  }
}

export function saveGoogleDriveAuthStatus(status: GoogleDriveAuthStatus): void {
  try {
    sessionStorage.setItem(GOOGLE_DRIVE_AUTH_KEY, status);
  } catch (e) {
    console.error('Failed to save Google Drive Auth Status:', e);
  }
}

export interface TargetFolderInfo {
  folderId: string;
  folderName: string;
  status: 'VERIFIED_OR_CREATED' | 'PENDING';
  requiredScope: string;
}

/**
 * Checks for or creates the target folder "01 Incoming Photos" in Google Drive
 */
export function checkOrCreateTargetFolder(): TargetFolderInfo {
  return {
    folderId: 'folder-01-incoming-photos-id',
    folderName: TARGET_FOLDER_NAME,
    status: 'VERIFIED_OR_CREATED',
    requiredScope: REQUIRED_OAUTH_SCOPE
  };
}

export function createInitialDriveFiles(): GoogleDriveFileRecord[] {
  const todayStr = new Date().toLocaleString('ja-JP');
  return [
    {
      id: 'gdrive-file-001',
      name: 'SKU-CAM-001_front.jpg',
      mimeType: 'image/jpeg',
      webViewLink: 'https://drive.google.com/file/d/mock-id-001/view',
      folderId: 'folder-01-incoming-photos-id',
      uploadTimestamp: todayStr,
      skuRef: 'SKU-CAM-001'
    },
    {
      id: 'gdrive-file-002',
      name: 'SKU-CAM-001_tag.jpg',
      mimeType: 'image/jpeg',
      webViewLink: 'https://drive.google.com/file/d/mock-id-002/view',
      folderId: 'folder-01-incoming-photos-id',
      uploadTimestamp: todayStr,
      skuRef: 'SKU-CAM-001'
    }
  ];
}

export function loadGoogleDriveFiles(): GoogleDriveFileRecord[] {
  try {
    const raw = sessionStorage.getItem(GOOGLE_DRIVE_FILES_KEY);
    if (!raw) return createInitialDriveFiles();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialDriveFiles();
  } catch (e) {
    console.error('Failed to load Google Drive files:', e);
    return createInitialDriveFiles();
  }
}

export function saveGoogleDriveFiles(files: GoogleDriveFileRecord[]): void {
  try {
    sessionStorage.setItem(GOOGLE_DRIVE_FILES_KEY, JSON.stringify(files));
  } catch (e) {
    console.error('Failed to save Google Drive files:', e);
  }
}

/**
 * Saves a new photo into the "01 Incoming Photos" folder in Google Drive (Mock / Development Mode)
 */
export function autoSavePhotoToGoogleDriveFolder(
  photoUrl: string,
  skuRef: string = 'GENERAL'
): GoogleDriveFileRecord {
  const existingFiles = loadGoogleDriveFiles();
  const fileId = `gdrive-file-${Date.now()}`;
  const fileName = `${skuRef}_photo_${existingFiles.length + 1}.jpg`;

  const newRecord: GoogleDriveFileRecord = {
    id: fileId,
    name: fileName,
    mimeType: 'image/jpeg',
    webViewLink: photoUrl || `https://drive.google.com/file/d/${fileId}/view`,
    folderId: 'folder-01-incoming-photos-id',
    uploadTimestamp: new Date().toLocaleString('ja-JP'),
    skuRef
  };

  const updated = [newRecord, ...existingFiles];
  saveGoogleDriveFiles(updated);
  return newRecord;
}
