const yaml = require('js-yaml')
const fs = require('fs')
const util = require('util')
const path = require('path')
const Stat = util.promisify(fs.stat)
const ReadFile = util.promisify(fs.readFile)
const Readdir = util.promisify(fs.readdir)
var ooMergePatch = require('json8-merge-patch')
var colors = require('colors')
var _ = require('lodash')

var Parser = require('./parser').Parser
var prepare = require('./index')

let wasError = false

module.exports = async function testCommand (args) {
  let stat = await Stat(args.tests)
  let testFiles = []
  if (stat.isFile()) {
    testFiles.push(args.tests)
  } else if (stat.isDirectory()) {
    let files = await Readdir(args.tests)
    files = files.filter(file => file.match(/_test.*\.yaml$/))
    files.forEach(file => {
      testFiles.push(path.join(args.tests, file))
    })
  }
  if (!testFiles.length) {
    console.error('nothing to test')
    wasError = true
  } else {
    await Promise.all(testFiles.map(async testPath => {
      let schemePath = args.scheme
      if (!args.scheme) {
        schemePath = path.join(
          path.dirname(testPath),
          path.basename(testPath, '.yaml').replace(/_test.*/, ''),
        )
      }
      return Test(schemePath, testPath, args)
    }))
  }
  if (wasError) process.exit(1)
}


async function Test (schemePath, testPath, args) {
  var scheme
  try {
    scheme = await prepare(schemePath)
  } catch (e) {
    console.log(
      colors.cyan(`${schemePath}`),
      colors.red('FAILED when compile scheme:')
    )
    console.log(colors.yellow(e.stack), '\n')
    wasError = true
    return
  }
  var tests
  try {
    tests = yaml.loadAll(await ReadFile(testPath))
  } catch (e) {
    console.log(
      colors.red('FAILED when read test file:'),
      colors.cyan(`${testPath}`)
    )
    console.log(colors.yellow(e.stack), '\n')
    wasError = true
    return
  }
  if (!tests) {
    console.error(`empty test file ${testPath}`)
    return
  }
  if (!Array.isArray(tests)) tests = [tests]
  tests.forEach((test, i) => {
    let context = test.context || {}
    let output = test.output || void 0
    let pathInScheme = test.path || '/'
    let parser
    try {
      parser = new Parser(scheme)
    } catch (e) {
      console.log(
        colors.red('FAILED when preparse scheme:'),
        colors.cyan(`${testPath}[${i}] on ${schemePath}("${pathInScheme}")`)
      )
      console.log(colors.yellow(e.stack), '\n')
      wasError = true
      return
    }
    let config, errors
    try {
      let p1 = process.hrtime();
      [config, errors] = parser.parse(pathInScheme, context)
      p1 = process.hrtime(p1)
      if (args.time) {
        console.log(`parse time: ${(p1[0] * 1000 + p1[1] / 1000000).toFixed(3)}ms`)
      }
    } catch (e) {
      console.log(
        colors.red('FAILED when parse scheme by context:'),
        colors.cyan(`${testPath}[${i}] on ${schemePath}("${pathInScheme}")`)
      )
      console.log(colors.yellow(e.stack), '\n')
      wasError = true
      return
    }
    if (test.outputPath) config = _.get(config, test.outputPath)
    let diff = ooMergePatch.diff(output, config)

    if (JSON.stringify(diff) === '{}') {
      console.log(colors.green('OK'), colors.cyan(`${testPath}[${i}] on ${schemePath}("${pathInScheme}")`))
    } else {
      console.log(
        colors.red('FAILED TEST'),
        colors.cyan(`${testPath}[${i}] on ${schemePath}("${pathInScheme}")`),
      )
      console.log(colors.yellow(yaml.safeDump({
        EXPECTED : output,
        PARSED   : config,
        DIFF     : diff,
      }, {
        skipInvalid : true,
        noRefs      : true,
      })))
      if (errors) {
        errors.map(err => {
          console.error(
            colors.red(`Parse error`),
            colors.red(`\nConfig path:`), colors.cyan(`/${err.path.join('/')}`),
            colors.yellow('\n' + err.message),
          )
        })
      }
      wasError = true
    }
  })
}
