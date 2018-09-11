const {Parser} = require('./parser')
const {extendObservable, autorun, observable, action} = require('mobx')


class Store {
  constructor ({schemeOrParser, path = '/', context = {}, skipUndefined = false, skipErrors = false}) {
    this.disposers = []
    this.parser = schemeOrParser
    if (!(this.parser instanceof Parser)) {
      this.parser = new Parser(this.parser)
    }
    extendObservable(this, {
      context : observable.struct(context),
      config  : observable.struct(void 0),
      path,
      skipErrors,
      skipUndefined,
    })

    this.autoparse = this.autoparse.bind(this)
    this.mergeConfig = action(this.mergeConfig.bind(this))
    this.setContext = action(this.setContext.bind(this))

    this.disposers.push(autorun(this.autoparse))
  }
  destroy () {
    this.disposers.reverse().map(d => d())
  }
  autoparse () {
    console.log(this.context)
    let [config, err] = this.parser.parse(this.path, this.context, this.skipUndefined, this.skipErrors)
    console.log({config, err})
    if (err) {
      console.error(err)
      return
    }
    this.mergeConfig(config)
  }
  mergeConfig (config) {
    this.config = config
  }
  setContext (newContext) {
    this.context = newContext
  }
}

module.exports = {
  Store,
}
