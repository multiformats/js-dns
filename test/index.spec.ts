import { expect } from 'aegir/chai'
import Sinon from 'sinon'
import { RecordType, dns } from '../src/index.js'

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
})
