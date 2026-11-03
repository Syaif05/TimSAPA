import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAcDirectory } from '../src/utils/acDirectory.js'

test('AC directory normalizes phones, merges stores and preserves distinct numbers', () => {
  const result = buildAcDirectory([
    { acName: ' budi ', cugAc: '81294671491', store: 'A' },
    { acName: 'BUDI', cugAc: '081294671491', store: 'B' },
    { acName: 'BUDI', cugAc: '081294671492', store: 'C' },
    { acName: 'ANI', cugAc: '0', store: 'D' },
    { acName: '', cugAc: '081294671491' },
  ])
  assert.equal(result.length, 3)
  assert.equal(result[0].name, 'ANI')
  assert.equal(result[0].phone, '')
  assert.deepEqual(result[1].stores, ['A', 'B'])
  assert.equal(result[1].phone, '6281294671491')
  assert.notEqual(result[1].key, result[2].key)
})
