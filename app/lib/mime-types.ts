/**
 * MIME type utilities for preserving file types during encryption/decryption
 */

// Common MIME types mapping
const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  
  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wma': 'audio/x-ms-wma',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  
  // Text
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'text/xml',
  '.json': 'application/json',
  
  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  
  // Code
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.jsx': 'text/javascript',
  '.tsx': 'text/typescript',
  '.css': 'text/css',
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.cpp': 'text/x-c++',
  '.c': 'text/x-c',
  '.h': 'text/x-c',
  '.sh': 'text/x-shellscript',
  
  // Other
  '.bin': 'application/octet-stream',
  '.exe': 'application/x-msdownload',
  '.dmg': 'application/x-apple-diskimage',
  '.iso': 'application/x-iso9660-image',
  '.epub': 'application/epub+zip',
};

/**
 * Get MIME type from filename
 * @param filename - The filename to check
 * @returns The MIME type or 'application/octet-stream' as default
 */
export function getMimeType(filename: string): string {
  if (!filename) return 'application/octet-stream';
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return 'application/octet-stream';
  
  const extension = filename.substring(lastDotIndex).toLowerCase();
  return MIME_TYPES[extension] || 'application/octet-stream';
}

/**
 * Get file extension from filename
 * @param filename - The filename to check
 * @returns The file extension including the dot, or empty string
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  
  return filename.substring(lastDotIndex);
}

/**
 * Extract base filename without extension
 * @param filename - The filename to process
 * @returns The filename without extension
 */
export function getBaseName(filename: string): string {
  if (!filename) return '';
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return filename;
  
  return filename.substring(0, lastDotIndex);
}

/**
 * Parse file metadata from a filename
 * @param filename - The filename to parse
 * @returns Object containing basename, extension, and mimeType
 */
export function parseFileMetadata(filename: string): {
  basename: string;
  extension: string;
  mimeType: string;
} {
  return {
    basename: getBaseName(filename),
    extension: getFileExtension(filename),
    mimeType: getMimeType(filename),
  };
}