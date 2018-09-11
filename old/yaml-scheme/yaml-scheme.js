#!/usr/bin/env node

var args = require('./args')
var testCommand = require('./testCommand')
var compileCommand = require('./compileCommand')

async function main () {
  switch (args._[0]) {
  case 'test': return testCommand(args)
  case 'compile': return compileCommand(args)
  }
  return void 0
}

main()

