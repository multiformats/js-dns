import { expect } from 'aegir/chai'
import { RecordType, RecordTypeLabel } from '../../src/index.js'
import { dnsJsonOverHttps } from '../../src/resolvers/dns-json-over-https.js'

describe('dns-json-over-https', () => {
  it('should query dns', async () => {
    const resolver = dnsJsonOverHttps('https://cloudflare-dns.com/dns-query')
    const result = await resolver('google.com', {
      types: [RecordType.A]
    })

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
    expect(result).to.have.nested.property('Answer[0].type', RecordType.A)
  })

  it('should query dns with RecordTypeLabel', async () => {
    const resolver = dnsJsonOverHttps('https://cloudflare-dns.com/dns-query')
    const result = await resolver('google.com', {
      types: [RecordTypeLabel.A]
    })

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
    expect(result).to.have.nested.property('Answer[0].type', RecordType.A)
  })

  it('should query dns with useRecordTypeValue=false', async () => {
    const resolver = dnsJsonOverHttps('https://cloudflare-dns.com/dns-query')
    const result = await resolver('google.com', {
      types: [RecordType.A],
      useRecordTypeValue: false
    })

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
    expect(result).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)
  })

  it('should query dns with RecordTypeLabel & useRecordTypeValue=false', async () => {
    const resolver = dnsJsonOverHttps('https://cloudflare-dns.com/dns-query')
    const result = await resolver('google.com', {
      types: [RecordTypeLabel.A],
      useRecordTypeValue: false
    })

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
    expect(result).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)
  })
})
