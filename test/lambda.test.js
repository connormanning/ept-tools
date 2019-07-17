import * as Util from '../src/util'

const ec2Root = 'https://usgs-tiles.entwine.io'
const devRoot = 'https://wx06np7hkd.execute-api.us-west-2.amazonaws.com/prod/'

const resource = 'IL_BooneCo_2007'

test('fetches JSON from lambda', async () => {
    const verify = await Util.getJson(
        Util.protojoin(ec2Root, resource, 'tileset.json')
    )
    const lambda = await Util.getJson(
        Util.protojoin(devRoot, resource, 'tileset.json')
    )

    expect(lambda).toEqual(verify)
})

test('fetches binary PNTS data from lambda', async () => {
    console.time('ec2')
    const verify = await Util.getBuffer(
        Util.protojoin(ec2Root, resource, '0-0-0-0.pnts')
    )
    console.timeEnd('ec2')

    console.time('lambda')
    const lambda = await Util.getBuffer(
        Util.protojoin(devRoot, resource, '0-0-0-0.pnts')
    )
    console.timeEnd('lambda')

    console.log(lambda.length / verify.length)
    expect(lambda.length).toEqual(verify.length)
}, 20000)
