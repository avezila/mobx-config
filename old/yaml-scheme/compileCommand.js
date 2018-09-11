var path = require('path')
const util = require('util')
const fs = require('fs')
const yaml = require('js-yaml')

var prepare = require('./index')
const WriteFile = util.promisify(fs.writeFile)

module.exports = async function compileCommand (args) {
  var dir = path.resolve(args.scheme || './')
  var config = await prepare(dir)
  var stringConf = ''
  if (args.y) {
    stringConf = yaml.dump(config, {
      noRefs      : true,
      skipInvalid : true,
    })
  } else {
    stringConf = JSON.stringify(config, void 0, args.pretty ? 2 : void 0)
  }
  if (args.o) {
    await WriteFile(path.resolve(args.o), stringConf)
  } else {
    console.log(stringConf)
  }
}
