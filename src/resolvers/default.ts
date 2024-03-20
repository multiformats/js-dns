import { Resolver } from 'dns/promises'
import { RecordType } from '../index.js'
import { convertType, getTypes } from '../utils/get-types.js'
import { toDNSResponse } from '../utils/to-dns-response.js'
import type { DNSResolver } from './index.js'
import type { Answer, RecordTypeLabel } from '../index.js'

const nodeResolver: DNSResolver = async (fqdn, options = {}) => {
  const resolver = new Resolver()
  const listener = (): void => {
    resolver.cancel()
  }
  const types = getTypes(options.types, options.useRecordTypeValue)

  try {
    options.signal?.addEventListener('abort', listener)

    const answers = await Promise.all(types.map(async type => {
      const valueType = convertType(type, options.useRecordTypeValue)
      if (valueType === RecordType.A) {
        return mapToAnswers(fqdn, type, await resolver.resolve4(fqdn))
      }

      if (valueType === RecordType.CNAME) {
        return mapToAnswers(fqdn, type, await resolver.resolveCname(fqdn))
      }

      if (valueType === RecordType.TXT) {
        return mapToAnswers(fqdn, type, await resolver.resolveTxt(fqdn))
      }

      if (valueType === RecordType.AAAA) {
        return mapToAnswers(fqdn, type, await resolver.resolve6(fqdn))
      }

      throw new TypeError('Unsupported DNS record type')
    }))

    return toDNSResponse({
      Question: types.map(type => ({
        name: fqdn,
        type
      })),
      Answer: answers.flat()
    })
  } finally {
    options.signal?.removeEventListener('abort', listener)
  }
}

export function defaultResolver (): DNSResolver[] {
  return [
    nodeResolver
  ]
}

function mapToAnswer (name: string, type: RecordType | RecordTypeLabel, data: string): Omit<Answer, 'TTL'> {
  return {
    name,
    type,
    data
  }
}

function mapToAnswers (name: string, type: RecordType | RecordTypeLabel, data: string | string[] | string[][]): Array<Omit<Answer, 'TTL'>> {
  if (!Array.isArray(data)) {
    data = [data]
  }

  return data.map(data => {
    if (Array.isArray(data)) {
      return data.map(data => mapToAnswer(name, type, data))
    }

    return mapToAnswer(name, type, data)
  })
    .flat()
}
