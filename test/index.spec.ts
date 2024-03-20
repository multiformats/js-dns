import { expect } from 'aegir/chai'
import Sinon from 'sinon'
import { RecordType, RecordTypeLabel, dns } from '../src/index.js'
import type { Answer } from '../src/index.js'

describe('dns', () => {
  it('should query dns', async () => {
    const resolver = dns()
    const result = await resolver.query('google.com')

    expect(result).to.have.nested.property('Answer[0].data').that.is.a('string')
  })

  it('should query specific resolver', async () => {
    const comResolver = Sinon.stub()
    const defaultResolver = Sinon.stub()

    const answer = {
      name: 'example.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    comResolver.withArgs('example.com').resolves({
      Answer: [answer]
    })

    const resolver = dns({
      resolvers: {
        'com.': comResolver,
        '.': defaultResolver
      }
    })
    const result = await resolver.query('example.com')

    expect(result).to.have.nested.property('Answer[0].data', answer.data)
    expect(defaultResolver.called).to.be.false()
  })

  it('should cache results', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'another.com',
      data: '123.123.123.123',
      type: RecordType.A
    }
    const answerAAAA = {
      name: 'another.com',
      data: ':::1',
      type: RecordType.AAAA
    }

    defaultResolver.withArgs('another.com').resolves({
      Answer: [answerA, answerAAAA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    const result = await resolver.query('another.com')
    await resolver.query('another.com')
    await resolver.query('another.com')
    await resolver.query('another.com')

    expect(result).to.have.nested.property('Answer[0].data', answerA.data)
    expect(result).to.have.nested.property('Answer[1].data', answerAAAA.data)
    expect(defaultResolver.calledOnce).to.be.true()
  })

  it('should update the TTL of cached results', async () => {
    const defaultResolver = Sinon.stub()

    const answerA: Answer = {
      name: 'result-with-update-ttl.com',
      data: '123.123.123.123',
      type: RecordType.A,
      TTL: 60
    }

    defaultResolver.withArgs('result-with-update-ttl.com').resolves({
      Answer: [answerA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    const resultA = await resolver.query('result-with-update-ttl.com')

    // wait for long enough that TTL changes
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 5000)
    })

    const resultB = await resolver.query('result-with-update-ttl.com')

    expect(defaultResolver.calledOnce).to.be.true()
    expect(resultA.Answer[0].TTL).to.be.greaterThan(resultB.Answer[0].TTL)
  })

  it('should use separate caches', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'another.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    defaultResolver.withArgs('another.com').resolves({
      Answer: [answerA]
    })

    const resolverA = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    const resolverB = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    await resolverA.query('another.com')
    await resolverA.query('another.com')
    await resolverB.query('another.com')
    await resolverB.query('another.com')

    expect(defaultResolver.calledTwice).to.be.true()
  })

  it('should ignore cache results', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'another.com',
      data: '123.123.123.123',
      type: RecordType.A
    }
    const answerAAAA = {
      name: 'another.com',
      data: ':::1',
      type: RecordType.AAAA
    }

    defaultResolver.withArgs('another.com').resolves({
      Answer: [answerA, answerAAAA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    await resolver.query('another.com', {
      cached: false
    })
    await resolver.query('another.com', {
      cached: false
    })
    await resolver.query('another.com', {
      cached: false
    })
    await resolver.query('another.com', {
      cached: false
    })

    expect(defaultResolver.callCount).to.equal(4)
  })

  it('should return enums from cache', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-enum-cache.com',
      data: '123.123.123.123',
      type: RecordType.A
    }
    const answerAAAA = {
      name: 'example-enum-cache.com',
      data: ':::1',
      type: RecordType.AAAA
    }

    defaultResolver.withArgs('example-enum-cache.com').resolves({
      Answer: [answerA, answerAAAA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })

    const res1 = await resolver.query('example-enum-cache.com')
    expect(res1).to.have.nested.property('Answer[0].type', RecordType.A)

    const res2 = await resolver.query('example-enum-cache.com')
    expect(res2).to.have.nested.property('Answer[0].type', RecordType.A)

    expect(defaultResolver.callCount).to.equal(1)
  })

  it('should stop resolving if the user aborts the request', async () => {
    const error = new Error('Aborted!')
    const controller = new AbortController()
    const fake = (): void => {
      controller.abort()

      throw error
    }
    const resolvers = [
      Sinon.stub().callsFake(fake),
      Sinon.stub().callsFake(fake),
      Sinon.stub().callsFake(fake)
    ]

    const resolver = dns({
      resolvers: {
        '.': resolvers
      }
    })
    const result = resolver.query('test-abort-stops-resolving.com', {
      signal: controller.signal
    })

    await expect(result).to.eventually.be.rejectedWith(error)

    // only one resolver should have been called
    expect(resolvers.reduce((acc, curr) => acc + curr.callCount, 0)).to.equal(1)
  })

  it('should convert RecordTypeLabel to RecordType when useRecordTypeValue=true', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-useRecordTypeValue-true.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    const answerA2 = {
      name: 'example-useRecordTypeValue-true.com',
      data: '123.123.123.123',
      type: RecordTypeLabel.A
    }

    defaultResolver.onCall(0).resolves({
      Answer: [answerA]
    })
    defaultResolver.onCall(1).resolves({
      Answer: [answerA2]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })

    const res1 = await resolver.query('example-useRecordTypeValue-true.com', {
      cached: false,
      types: [RecordTypeLabel.A]
    })
    const res2 = await resolver.query('example-useRecordTypeValue-true.com', {
      cached: false,
      types: [RecordType.A]
    })
    expect(res1).to.have.nested.property('Answer[0].type', RecordType.A)
    expect(res2).to.have.nested.property('Answer[0].type', RecordType.A)

    expect(defaultResolver.callCount).to.equal(2)
  })

  it('should convert RecordType to RecordTypeLabel when useRecordTypeValue=false', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-useRecordTypeValue-false.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    const answerA2 = {
      name: 'example-useRecordTypeValue-false.com',
      data: '123.123.123.123',
      type: RecordTypeLabel.A
    }

    defaultResolver.onCall(0).resolves({
      Answer: [answerA]
    })
    defaultResolver.onCall(1).resolves({
      Answer: [answerA2]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      },
      useRecordTypeValue: false
    })

    const res1 = await resolver.query('example-useRecordTypeValue-false.com', {
      cached: false,
      types: [RecordTypeLabel.A]
    })
    const res2 = await resolver.query('example-useRecordTypeValue-false.com', {
      cached: false,
      types: [RecordType.A]
    })
    expect(res1).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)
    expect(res2).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)

    expect(defaultResolver.callCount).to.equal(2)
  })

  it('should override useRecordTypeValue default', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-override-useRecordTypeValue.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    defaultResolver.resolves({
      Answer: [answerA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })
    await resolver.query('example-override-useRecordTypeValue.com', {
      types: [RecordType.A],
      useRecordTypeValue: false
    })
    expect(defaultResolver.withArgs('example-override-useRecordTypeValue.com', Sinon.match({ useRecordTypeValue: true })).callCount).to.equal(0)
    expect(defaultResolver.withArgs('example-override-useRecordTypeValue.com', Sinon.match({ useRecordTypeValue: false })).callCount).to.equal(1)
  })

  it('should override useRecordTypeValue=false', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-override-useRecordTypeValue-false.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    defaultResolver.resolves({
      Answer: [answerA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      },
      useRecordTypeValue: false
    })

    await resolver.query('example-override-useRecordTypeValue-false.com', {
      types: [RecordType.A],
      useRecordTypeValue: true
    })
    expect(defaultResolver.withArgs('example-override-useRecordTypeValue-false.com', Sinon.match({ useRecordTypeValue: true })).callCount).to.equal(1)
    expect(defaultResolver.withArgs('example-override-useRecordTypeValue-false.com', Sinon.match({ useRecordTypeValue: false })).callCount).to.equal(0)
  })

  it('should convert cached RecordType', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-RecordType-cached.com',
      data: '123.123.123.123',
      type: RecordType.A
    }

    defaultResolver.resolves({
      Answer: [answerA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })

    const res1 = await resolver.query('example-RecordType-cached.com', {
      types: [RecordType.A]
    })
    expect(res1).to.have.nested.property('Answer[0].type', RecordType.A)

    const res2 = await resolver.query('example-RecordType-cached.com', {
      cached: true,
      types: [RecordTypeLabel.A],
      useRecordTypeValue: false // convert from cached RecordType to RecordTypeLabel
    })
    expect(res2).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)

    expect(defaultResolver.callCount).to.equal(1)
  })

  it('should convert cached RecordTypeLabel', async () => {
    const defaultResolver = Sinon.stub()

    const answerA = {
      name: 'example-RecordType-cached.com',
      data: '123.123.123.123',
      type: RecordTypeLabel.A
    }

    defaultResolver.resolves({
      Answer: [answerA]
    })

    const resolver = dns({
      resolvers: {
        '.': defaultResolver
      }
    })

    const res1 = await resolver.query('example-RecordType-cached.com', {
      cached: true,
      types: [RecordType.A],
      useRecordTypeValue: false
    })
    expect(res1).to.have.nested.property('Answer[0].type', RecordTypeLabel.A)

    const res2 = await resolver.query('example-RecordType-cached.com', {
      cached: true,
      types: [RecordType.A]
    })
    expect(res2).to.have.nested.property('Answer[0].type', RecordType.A)

    expect(defaultResolver.callCount).to.equal(1)
  })
})
