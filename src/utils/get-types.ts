import { RecordType, RecordTypeLabel } from '../index.js'

function recordTypeGuard (type: RecordType | RecordTypeLabel): type is RecordType {
  return typeof type === 'number' && type in RecordType
}
function recordTypeLabelGuard (type: RecordType | RecordTypeLabel): type is RecordTypeLabel {
  return typeof type === 'string' && type in RecordTypeLabel
}

export function convertType (type: RecordType | RecordTypeLabel, useRecordTypeValue?: true): RecordType
export function convertType (type: RecordType | RecordTypeLabel, useRecordTypeValue?: false): RecordTypeLabel
export function convertType (type: RecordType | RecordTypeLabel, useRecordTypeValue?: boolean): RecordType | RecordTypeLabel
export function convertType (type: RecordType | RecordTypeLabel, useRecordTypeValue: boolean = true): RecordType | RecordTypeLabel {
  if (useRecordTypeValue && recordTypeGuard(type)) {
    return type
  } else if (!useRecordTypeValue && recordTypeLabelGuard(type)) {
    return type
  } else {
    const reverseMap = {
      [RecordTypeLabel.A]: RecordType.A,
      [RecordType.A]: RecordTypeLabel.A,
      [RecordTypeLabel.CNAME]: RecordType.CNAME,
      [RecordType.CNAME]: RecordTypeLabel.CNAME,
      [RecordTypeLabel.TXT]: RecordType.TXT,
      [RecordType.TXT]: RecordTypeLabel.TXT,
      [RecordTypeLabel.AAAA]: RecordType.AAAA,
      [RecordType.AAAA]: RecordTypeLabel.AAAA
    }
    // convert given type to other
    return reverseMap[type]
  }
}

export function getTypes (types?: (RecordType | RecordTypeLabel) | Array<RecordType | RecordTypeLabel>, useRecordTypeValue?: true): RecordType[]
export function getTypes (types?: (RecordType | RecordTypeLabel) | Array<RecordType | RecordTypeLabel>, useRecordTypeValue?: false): RecordTypeLabel[]
export function getTypes (types?: (RecordType | RecordTypeLabel) | Array<RecordType | RecordTypeLabel>, useRecordTypeValue?: boolean): Array<RecordType | RecordTypeLabel>
export function getTypes (types?: (RecordType | RecordTypeLabel) | Array<RecordType | RecordTypeLabel>, useRecordTypeValue: boolean = true): Array<RecordType | RecordTypeLabel> {
  const DEFAULT_TYPES = [
    RecordType.A
  ].map(type => convertType(type, useRecordTypeValue))

  if (types == null) {
    return DEFAULT_TYPES
  }

  if (Array.isArray(types)) {
    if (types.length === 0) {
      return DEFAULT_TYPES
    }

    return types.map(type => convertType(type, useRecordTypeValue))
  }

  return [
    convertType(types, useRecordTypeValue)
  ]
}
