import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface RecordedInteraction {
  method: string
  params: any
  response?: any
  error?: any
  timestamp: string
}

/**
 * Records real Google Drive API interactions for replay testing
 */
export class ApiRecorder {
  private interactions: RecordedInteraction[] = []
  private recordingPath: string

  constructor(sessionName: string) {
    this.recordingPath = join(__dirname, 'recordings', `${sessionName}.json`)
  }

  /**
   * Create a proxy that records all API calls
   */
  createRecordingProxy(client: GoogleDriveApiClient): GoogleDriveApiClient {
    const handler: ProxyHandler<GoogleDriveApiClient> = {
      get: (target, prop) => {
        const original = target[prop as keyof GoogleDriveApiClient]
        
        if (typeof original === 'function') {
          return async (...args: any[]) => {
            const interaction: RecordedInteraction = {
              method: prop as string,
              params: args[0],
              timestamp: new Date().toISOString()
            }

            try {
              const response = await (original as any).apply(target, args)
              interaction.response = this.sanitizeResponse(response)
              this.interactions.push(interaction)
              return response
            } catch (error) {
              interaction.error = this.sanitizeError(error)
              this.interactions.push(interaction)
              throw error
            }
          }
        }

        return original
      }
    }

    return new Proxy(client, handler)
  }

  /**
   * Save recorded interactions
   */
  save() {
    const dir = join(__dirname, 'recordings')
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true })
    }

    writeFileSync(this.recordingPath, JSON.stringify(this.interactions, null, 2))
    console.log(`Saved ${this.interactions.length} interactions to ${this.recordingPath}`)
  }

  /**
   * Load recorded interactions
   */
  static load(sessionName: string): RecordedInteraction[] {
    const path = join(__dirname, 'recordings', `${sessionName}.json`)
    if (!existsSync(path)) {
      throw new Error(`Recording not found: ${sessionName}`)
    }

    return JSON.parse(readFileSync(path, 'utf-8'))
  }

  /**
   * Replay recorded interactions against the stub and compare
   */
  static async replay(
    sessionName: string, 
    stubClient: GoogleDriveApiClient
  ): Promise<{
    passed: number
    failed: number
    errors: any[]
  }> {
    const interactions = this.load(sessionName)
    let passed = 0
    let failed = 0
    const errors: any[] = []

    for (const interaction of interactions) {
      try {
        const method = stubClient[interaction.method as keyof GoogleDriveApiClient] as any
        const result = await method.call(stubClient, interaction.params)

        if (interaction.error) {
          // Expected an error but got success
          failed++
          errors.push({
            interaction,
            error: 'Expected error but got success',
            result
          })
        } else {
          // Compare responses
          if (this.responsesMatch(interaction.response, result)) {
            passed++
          } else {
            failed++
            errors.push({
              interaction,
              error: 'Response mismatch',
              expected: interaction.response,
              actual: result
            })
          }
        }
      } catch (error: any) {
        if (interaction.error) {
          // Both threw errors - check if they match
          if (error.message === interaction.error.message) {
            passed++
          } else {
            failed++
            errors.push({
              interaction,
              error: 'Error mismatch',
              expected: interaction.error,
              actual: { message: error.message }
            })
          }
        } else {
          // Expected success but got error
          failed++
          errors.push({
            interaction,
            error: 'Expected success but got error',
            actual: error.message
          })
        }
      }
    }

    return { passed, failed, errors }
  }

  private sanitizeResponse(response: any): any {
    if (!response) return response

    // Deep clone and sanitize
    const sanitized = JSON.parse(JSON.stringify(response))
    
    // Recursively sanitize
    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject)
      }
      
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (key === 'id' && typeof obj[key] === 'string') {
            obj[key] = '<ID>'
          } else if (key === 'createdTime' || key === 'modifiedTime') {
            obj[key] = '<TIMESTAMP>'
          } else if (typeof obj[key] === 'object') {
            obj[key] = sanitizeObject(obj[key])
          }
        }
      }
      
      return obj
    }

    return sanitizeObject(sanitized)
  }

  private sanitizeError(error: any): any {
    return {
      message: error.message,
      code: error.code,
      status: error.status
    }
  }

  private static responsesMatch(recorded: any, actual: any): boolean {
    // Implement smart comparison that ignores IDs, timestamps, etc.
    const normalize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(normalize).sort((a, b) => 
          JSON.stringify(a).localeCompare(JSON.stringify(b))
        )
      }
      
      if (obj && typeof obj === 'object') {
        const normalized: any = {}
        for (const key in obj) {
          if (!['id', 'createdTime', 'modifiedTime', 'etag', 'kind'].includes(key)) {
            normalized[key] = normalize(obj[key])
          }
        }
        return normalized
      }
      
      return obj
    }

    return JSON.stringify(normalize(recorded)) === JSON.stringify(normalize(actual))
  }
}