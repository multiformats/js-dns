/* eslint-env browser */

import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { toDNSResponse } from '../utils/to-dns-response.js'
import type { DNSResolver } from './index.js'
import type { DNSResponse } from '../index.js'

/**
 * Browsers limit concurrent connections per host (~6), we don't want to exhaust
 * the limit so this value controls how many DNS queries can be in flight at
 * once.
 */
export const DEFAULT_QUERY_CONCURRENCY = 4

export interface DNSJSONOverHTTPSOptions {
  queryConcurrency?: number
}

/**
 * Uses the RFC 8427 'application/dns-json' content-type to resolve DNS queries.
 *
 * Supports and server that uses the same schema as Google's DNS over HTTPS
 * resolver.
 *
 * This resolver needs fewer dependencies than the regular DNS-over-HTTPS
 * resolver so can result in a smaller bundle size and consequently is preferred
 * for browser use.
 *
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 * @see https://github.com/curl/curl/wiki/DNS-over-HTTPS#publicly-available-servers
 * @see https://dnsprivacy.org/public_resolvers/
 * @see https://datatracker.ietf.org/doc/html/rfc8427
 */
export function dnsJsonOverHttps (url: string, init: DNSJSONOverHTTPSOptions = {}): DNSResolver {
  const httpQueue = new PQueue({
    concurrency: init.queryConcurrency ?? DEFAULT_QUERY_CONCURRENCY
  })

  return async (fqdn, types, options = {}) => {
    const searchParams = new URLSearchParams()
    searchParams.set('name', fqdn)

    types.forEach(type => {
      searchParams.append('type', type.toString())
    })

    options.onProgress?.(new CustomProgressEvent<string>('dns:query', { detail: fqdn }))

    // query DNS-JSON over HTTPS server
    const response = await httpQueue.add(async () => {
      const res = await fetch(`${url}?${searchParams}`, {
        headers: {
          accept: 'application/dns-json'
        },
        signal: options?.signal
      })

      if (res.status !== 200) {
        throw new Error(`Unexpected HTTP status: ${res.status} - ${res.statusText}`)
      }

      const response = toDNSResponse(await res.json())

      options.onProgress?.(new CustomProgressEvent<DNSResponse>('dns:response', { detail: response }))

      return response
    }, {
      signal: options.signal
    })

    if (response == null) {
      throw new Error('No DNS response received')
    }

    return response
  }
}
