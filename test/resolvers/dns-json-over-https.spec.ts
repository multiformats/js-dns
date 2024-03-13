import { expect } from 'aegir/chai'
import { RecordType } from '../../src/index.js'
import { dnsJsonOverHttps } from '../../src/resolvers/dns-json-over-https.js'

describe('dns-json-over-https', () => {
  it('should query dns', async () => {
    const resolver = dnsJsonOverHttps('https://cloudflare-dns.com/dns-query')
    const result = await resolver('google.com', {
      types: [RecordType.A]
    })

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
  })
})
