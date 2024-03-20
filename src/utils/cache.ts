import hashlru from 'hashlru'
import { RecordType } from '../index.js'
import { convertType } from './get-types.js'
import { DEFAULT_TTL, toDNSResponse } from './to-dns-response.js'
import type { Answer, DNSResponse, RecordTypeLabel } from '../index.js'

interface CachedAnswer {
  expires: number
  value: Answer
}

export interface AnswerCache {
  get (fqdn: string, types: Array<RecordType | RecordTypeLabel>): DNSResponse | undefined
  add (domain: string, answer: Answer): void
  remove (domain: string, type: ResponseType): void
  clear (): void
}

/**
 * Time Aware Least Recent Used Cache
 *
 * @see https://arxiv.org/pdf/1801.00390
 */
class CachedAnswers {
  private readonly lru: ReturnType<typeof hashlru>

  constructor (maxSize: number) {
    this.lru = hashlru(maxSize)
  }

  /**
   * We index the cache on 'domain-{@link RecordType}` instead of
   * 'domain-{@link RecordType}|{@link RecordTypeLabel}' to ensure that we don't
   * cache the same answers separately for RecordType.A and RecordTypeLabel.A.
   *
   * This means, if you query a resolver with `useRecordTypeValue=true`, and
   * they return an empty answer, that empty answer will be cached, and a
   * subsequent call with `useRecordTypeValue=false` would need to be paired
   * with `cached: false` to avoid getting the empty answer back when using a
   * {@link RecordTypeLabel}.
   *
   * NOTE: this will resolve/obfuscate the issue where dns resolvers return
   * different answers depending on the value of the "type" field in the query.
   * But give the user the ability to retry with a different type if they want
   */
  private getKey (domain: string, type: RecordType | RecordTypeLabel): string {
    return `${domain.toLowerCase()}-${convertType(type, true)}`
  }

  get (fqdn: string, types: RecordType[]): DNSResponse | undefined {
    let foundAllAnswers = true
    const answers: Answer[] = []

    for (const type of types) {
      const cached = this.getAnswers(fqdn, type)

      if (cached.length === 0) {
        foundAllAnswers = false
        break
      }

      answers.push(...cached)
    }

    if (foundAllAnswers) {
      return toDNSResponse({ answers })
    }
  }

  private getAnswers (domain: string, type: RecordType): Answer[] {
    const key = this.getKey(domain, type)
    const answers: CachedAnswer[] = this.lru.get(key)

    if (answers != null) {
      const cachedAnswers = answers
        .filter((entry) => {
          return entry.expires > Date.now()
        })
        .map(({ expires, value }) => ({
          ...value,
          TTL: Math.round((expires - Date.now()) / 1000),
          type: RecordType[value.type]
        }))

      if (cachedAnswers.length === 0) {
        this.lru.remove(key)
      }

      // @ts-expect-error hashlru stringifies stored types which turns enums
      // into strings, we convert back into enums above but tsc doesn't know
      return cachedAnswers
    }

    return []
  }

  add (domain: string, answer: Answer): void {
    const key = this.getKey(domain, answer.type)

    const answers: CachedAnswer[] = this.lru.get(key) ?? []
    answers.push({
      expires: Date.now() + ((answer.TTL ?? DEFAULT_TTL) * 1000),
      value: answer
    })

    this.lru.set(key, answers)
  }

  remove (domain: string, type: ResponseType): void {
    const key = `${domain.toLowerCase()}-${type}`

    this.lru.remove(key)
  }

  clear (): void {
    this.lru.clear()
  }
}

/**
 * Avoid sending multiple queries for the same hostname by caching results
 */
export function cache (size: number): AnswerCache {
  return new CachedAnswers(size)
}
