
var {readNode} = require('./prepare')

module.exports = async function prepare (file) {
  var config = []
  await readNode(config, './', file, true)
  return config
}
