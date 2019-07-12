import * as Util from '../util'

test('pop slash', () => {
    expect(Util.popSlash('a')).toEqual('a')
    expect(Util.popSlash('a/')).toEqual('a')
    expect(Util.popSlash('a/b/')).toEqual('a/b')
})

test('get basename', () => {
    expect(Util.basename('file')).toEqual('file')
    expect(Util.basename('file.json')).toEqual('file.json')
    expect(Util.basename('one/two')).toEqual('two')
    expect(Util.basename('one/two.json')).toEqual('two.json')
    expect(Util.basename('one/two/')).toEqual('two')
})

test('get dirname', () => {
    expect(Util.dirname('a')).toEqual('')
    expect(Util.dirname('a/b')).toEqual('a')
    expect(Util.dirname('a/b/')).toEqual('a')
    expect(Util.dirname('a/b.json')).toEqual('a')
    expect(Util.dirname('a/b/c')).toEqual('a/b')
    expect(Util.dirname('a/b/c/')).toEqual('a/b')
    expect(Util.dirname('a/b/c.json')).toEqual('a/b')
})

test('pad right', () => {
    expect(Util.padRight('', 4)).toEqual('')
    expect(Util.padRight('a', 4)).toEqual('a' + ' '.repeat(3))
    expect(Util.padRight('ab', 4)).toEqual('ab' + ' '.repeat(2))
    expect(Util.padRight('abc', 4)).toEqual('abc ')
    expect(Util.padRight('abcd', 4)).toEqual('abcd')
})
