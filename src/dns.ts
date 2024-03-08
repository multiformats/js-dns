import { CustomProgressEvent } from 'progress-events'
import { defaultResolver } from './resolvers/default.js'
import { cache } from './utils/cache.js'
import { RecordType } from './index.js'
import type { DNS as DNSInterface, DNSInit, DNSResponse, QueryOptions } from './index.js'
import type { DNSResolver } from './resolvers/index.js'

export class DNS implements DNSInterface {
  private resolvers: Record<string, DNSResolver[]>

  constructor (init: DNSInit) {
    this.resolvers = {}

    Object.entries(init.resolvers ?? {}).forEach(([tld, resolver]) => {
      if (!Array.isArray(resolver)) {
        resolver = [resolver]
      }

      // convert `com` -> `com.`
      if (!tld.endsWith('.')) {
        tld = `${tld}.`
      }

      this.resolvers[tld] = resolver
    })

    // configure default resolver if none specified
    if (this.resolvers['.'] == null) {
      this.resolvers['.'] = defaultResolver()
    }
  }

  /**
   * Queries DNS resolvers for the passed record types for the passed domain.
   *
   * If cached records exist for all desired types they will be returned
   * instead.
   *
   * Any new responses will be added to the cache for subsequent requests.
   */
  async query (domain: string, options: QueryOptions = {}): Promise<DNSResponse> {
    const types: RecordType[] = []

    if (options.types != null) {
      if (Array.isArray(options.types)) {
        types.push(...options.types)
      } else {
        types.push(options.types)
      }
    } else {
      types.push(RecordType.A, RecordType.AAAA)
    }

    const cached = options.cached !== false ? cache.get(domain, types) : undefined

    if (cached != null) {
      options.onProgress?.(new CustomProgressEvent<string>('dns:cache', { detail: cached }))

      return cached
    }

    const tld = `${domain.split('.').pop()}.`
    const resolvers = (this.resolvers[tld] ?? this.resolvers['.']).sort(() => {
      return (Math.random() > 0.5) ? -1 : 1
    })

    const errors: Error[] = []

    for (const resolver of resolvers) {
      try {
        const result = await resolver(domain, Array.isArray(types) ? types : [types], options)

        for (const answer of result.Answer) {
          cache.add(domain, answer)
        }

        return result
      } catch (err: any) {
        errors.push(err)
        options.onProgress?.(new CustomProgressEvent<Error>('dns:error', { detail: err }))
      }
    }

    if (errors.length === 1) {
      throw errors[0]
    }

    throw new AggregateError(errors, `DNS lookup of ${domain} ${types} failed`)
  }
}
