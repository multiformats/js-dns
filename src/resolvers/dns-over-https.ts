/* eslint-env browser */

import { Buffer } from 'buffer'
import dnsPacket from 'dns-packet'
import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { RecordType } from '../index.js'
import { toDNSResponse } from '../utils/to-dns-response.js'
import type { DNSResolver } from './index.js'
import type { DNSResponse } from '../index.js'

/**
 * Browsers limit concurrent connections per host (~6), we don't want to exhaust
 * the limit so this value controls how many DNS queries can be in flight at
 * once.
 */
export const DEFAULT_QUERY_CONCURRENCY = 4

export interface DNSOverHTTPSOptions {
  queryConcurrency?: number
}

/**
 * Uses the RFC 1035 'application/dns-message' content-type to resolve DNS
 * queries.
 *
 * This resolver needs more dependencies than the non-standard
 * DNS-JSON-over-HTTPS resolver so can result in a larger bundle size and
 * consequently is not preferred for browser use.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc1035
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-wireformat/
 * @see https://github.com/curl/curl/wiki/DNS-over-HTTPS#publicly-available-servers
 * @see https://dnsprivacy.org/public_resolvers/
 */
export function dnsOverHttps (url: string, init: DNSOverHTTPSOptions = {}): DNSResolver {
  const httpQueue = new PQueue({
    concurrency: init.queryConcurrency ?? DEFAULT_QUERY_CONCURRENCY
  })

  return async (fqdn, types, options = {}) => {
    const dnsQuery = dnsPacket.encode({
      type: 'query',
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      // @ts-expect-error type types are incompatible
      questions: types.map(type => ({
        type: RecordType[type],
        name: fqdn
      }))
    })

    const searchParams = new URLSearchParams()
    searchParams.set('dns', uint8ArrayToString(dnsQuery, 'base64url'))

    options.onProgress?.(new CustomProgressEvent<string>('dns:query', { detail: fqdn }))

    // query DNS over HTTPS server
    const response = await httpQueue.add(async () => {
      const res = await fetch(`${url}?${searchParams}`, {
        headers: {
          accept: 'application/dns-message'
        },
        signal: options.signal
      })

      if (res.status !== 200) {
        throw new Error(`Unexpected HTTP status: ${res.status} - ${res.statusText}`)
      }

      const buf = await res.arrayBuffer()
      const response = toDNSResponse(dnsPacket.decode(Buffer.from(buf)))

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
