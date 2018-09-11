
module.exports = require('yargs')
  .command('compile [scheme]', 'compile scheme', yargs => {
    yargs
      .option('pretty', {
        describe : 'pretty print json',
        type     : 'boolean',
      })
      .option('o', {
        alias    : 'out',
        describe : 'output file with generated json signle file configuration',
        type     : 'string',
      })
      .option('y', {
        alias    : 'yaml',
        describe : 'output file with generated json signle file configuration as yaml',
        type     : 'boolean',
      })
      .positional('scheme', {
        describe : 'path of configuration to compile',
        type     : 'string',
      })
  })
  .command('test [tests] [scheme]', 'run tests on scheme', yargs => {
    yargs
      .option('time', {
        alias    : 't',
        describe : 'print time for each test parse',
        type     : 'boolean',
      })
      .positional('scheme', {
        describe : 'path to scheme to test',
        type     : 'string',
      })
      .positional('tests', {
        describe : 'path to tests directory or file',
        type     : 'string',
        default  : './',
      })
  })
  .help('help')
  .argv
