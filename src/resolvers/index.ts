import type { DNSResponse, QueryOptions } from '../index.ts'

export interface DNSResolver {
  (domain: string, options?: QueryOptions): Promise<DNSResponse>
}

export { dnsOverHttps } from './dns-over-https.ts'
export { dnsJsonOverHttps } from './dns-json-over-https.ts'
