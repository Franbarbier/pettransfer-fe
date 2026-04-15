export type DriveFileItem = {
  id: string;
  name: string;
  mimeType?: string;
  hasThumbnail?: boolean;
  thumbnailLink?: string;
  iconLink?: string;
  webViewLink?: string;
  viewedByMeTime?: string;
  modifiedTime?: string;
  parents?: string[];
};
