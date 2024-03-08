import type { DNSResponse, QueryOptions, RecordType } from '../index.js'

export interface DNSResolver {
  (domain: string, types: RecordType[], options?: QueryOptions): Promise<DNSResponse>
}

export { dnsOverHttps } from './dns-over-https.js'
export { dnsJsonOverHttps } from './dns-json-over-https.js'
