import { vi } from 'vitest'
import { DriveService } from '../../types/drive'

// Creates a fully mocked DriveService with all required methods
export const createMockDriveService = (): DriveService => ({
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  searchFiles: vi.fn(),
  moveFile: vi.fn(),
  moveFolder: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  renameFolder: vi.fn()
})