export type StorageCapability = {
  projects: boolean;
  checkpoints: boolean;
  settings: boolean;
  sessionRestore: boolean;
};

export function getStorageCapabilities(): StorageCapability {
  return {
    projects: true,
    checkpoints: true,
    settings: true,
    sessionRestore: true,
  };
}
