var {set, get, isPlainObject, isArray, unset} = require('lodash')
var nodePath = require('path-browserify')
var ooClone = require('json8/lib/clone')
const NODE_PRIMITIVE = 'primitive'
const NODE_MAP = 'map'
const NODE_ARRAY = 'array'


class Parser {
  constructor (scheme, isFork = false) {
    this.result = void 0
    this.lockedPaths   = new Map()
    this.requiredPaths = new Map()
    this.schemeByPaths = {}
    this.allowImport = false
    this.context = void 0
    this.scheme = scheme
    this.queue = []
    this.queue.push({
      path : [],
      type : 'Rules',
      data : scheme,
    })
    if (isFork) return
    this.walkQueue(false, true)
  }
  walkQueue (skipUndefined = true, skipErrors = true) {
    if (!this.queue || !this.queue.length) return false

    let didSmth = false
    let gDidSmth = false
    do {
      do {
        this.queue = this.queue.map(v => v)
        this.lockedPaths.clear()
        this.allowImport = false
        didSmth = this.walkQueueItem({
          currentIndex  : 0,
          currentQueue  : this.queue,
          skipUndefined : false,
          skipErrors    : true,
        })
        gDidSmth = gDidSmth || didSmth
      } while (didSmth && this.queue && this.queue.length)
      this.allowImport = true
      this.lockedPaths.clear()
      didSmth = this.walkQueueItem({
        currentIndex  : 0,
        currentQueue  : this.queue,
        skipUndefined : false,
        skipErrors    : true,
      })
      gDidSmth = gDidSmth || didSmth
      if (didSmth) continue
      if (skipUndefined) {
        this.allowImport = true
        this.lockedPaths.clear()
        didSmth = this.walkQueueItem({
          currentIndex  : 0,
          currentQueue  : this.queue,
          skipUndefined : true,
          skipErrors    : true,
        })
        gDidSmth = gDidSmth || didSmth
        if (didSmth) continue
      }
    } while (didSmth && this.queue && this.queue.length)
    this.errors = []
    if (!skipErrors && !skipUndefined) {
      // feel errors
      this.lockedPaths.clear()
      this.walkQueueItem({
        currentIndex  : 0,
        currentQueue  : this.queue,
        skipUndefined : false,
        skipErrors    : false,
      })
    }
    return gDidSmth
  }
  walkQueueItem (props) {
    let item = props.currentQueue[props.currentIndex]
    if (!item) return false
    let didSmth = false
    if (Array.isArray(item)) {
      if (item.length === 0) {
        props.currentQueue[props.currentIndex] = void 0
        didSmth = true
        return true
      }
      var index = 0
      while (index < item.length) {
        if (!item[index]) {
          index++
          didSmth = true
          continue
        }
        let newDidSmth = this.walkQueueItem({
          ...props,
          currentQueue : item,
          currentIndex : index,
        })
        didSmth = didSmth || newDidSmth
        index++
        if (newDidSmth) index = 0
      }
      item = item.filter(v => v)
      if (item.length === 0) item = void 0
      if (item && item.length === 1) item = item[0]
      props.currentQueue[props.currentIndex] = item
      return didSmth
    }
    return this.handleItem({
      ...props,
      item,
    })
  }
  handleItem (props) {
    switch (props.item.type) {
    case 'Rule': return this.handleTypeRule(props)
    case 'Rules': return this.handleTypeRules(props)
    case 'Operator': return this.handleTypeOperator(props)
    }
    console.log('unknown queue type', props.item.type)
    return false
  }
  handleTypeRules (props) {
    let currentPath = props.item.path.join('/')
    let data = props.item.data || []
    if (!this.schemeByPaths[currentPath]) this.schemeByPaths[currentPath] = []
    this.schemeByPaths[currentPath] = [...this.schemeByPaths[currentPath], ...data]
    props.currentQueue[props.currentIndex] = data.map(rule => ({
      ...props.item,
      type : 'Rule',
      data : rule,
    }))
    return true
  }
  checkPathIsLocked (path) {
    for (let i = -1; i < path.length; i++) {
      if (this.lockedPaths.get(path.slice(0, i + 1).join('/'))) return true
    }
    return false
  }
  lockPath (path) {
    this.lockedPaths.set(path.join('/'), true)
  }
  checkPathRequired (path) {
    if (!this.requiredPaths.size) return true
    for (let i = -1; i < path.length; i++) {
      if (this.requiredPaths.get(path.slice(0, i + 1).join('/'))) return true
    }
    return false
  }
  handleTypeRule (props) {
    if (this.checkPathIsLocked(props.item.path)) return false
    if (!this.checkPathRequired(props.item.path)) return false
    switch (props.item.data.type) {
    case NODE_PRIMITIVE:
      this.setByPath(props.item.path, props.item.data.value)
      props.currentQueue[props.currentIndex] = void 0
      return true
    case NODE_ARRAY:
      this.setByPath(props.item.path, [])
      this.currentQueue[this.currentIndex] = props.item.data.value.map((v, i) => ({
        path : [...props.item.path, i],
        type : 'Rules',
        data : [v],
      }))
      return true
    case NODE_MAP:
      let didSmth = false
      let newQueue = []
      props.item.data.value.forEach(([mapKey, mapValue]) => {
        if (String(mapKey)[0] !== '$') {
          this.checkIsMap(props.item.path)
          didSmth = true
          newQueue.push({
            type : 'Rules',
            data : mapValue,
            path : [...props.item.path, mapKey],
          })
        } else {
          didSmth = true
          newQueue.push({
            type     : 'Operator',
            operator : mapKey,
            data     : mapValue,
            path     : props.item.path,
          })
        }
      })
      props.currentQueue[props.currentIndex] = newQueue
      return didSmth
    }
    return false
  }
  handleTypeOperator (props) {
    if (this.checkPathIsLocked(props.item.path)) return false
    if (!this.checkPathRequired(props.item.path)) return false
    switch (props.item.operator) {
    case '$switch': return this.handleOperatorSwitch(props)
    case '$omit': return this.handleOperatorOmit(props)
    case '$extend': return this.handleOperatorExtend(props)
    }
    return false
  }
  handleOperatorSwitch (props) {
    if (this.checkPathIsLocked(props.item.path)) return false
    if (!props.item.data || !props.item.data[0] || !props.item.data[0].type === NODE_MAP) {
      if (props.skipUndefined) {
        props.currentQueue[props.currentIndex] = void 0
        return true
      } else if (!props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `require map{$by,case1,case2,...} for $switch operator`,
        })
      }
      return false
    }
    var map = new Map(props.item.data[0].value)
    var omap = {}
    props.item.data[0].value.forEach(([k, v]) => {
      omap[k] = v
    })
    var $by = map.get('$by')
    if (!$by || !$by[0] || !$by[0].type === NODE_PRIMITIVE || !$by[0].value) {
      if (props.skipUndefined) {
        props.currentQueue[props.currentIndex] = void 0
        return true
      } else if (!props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `require primitive $by in $switch operator`,
        })
      }
      return false
    }
    $by = String($by[0].value)
    let $case = void 0
    if ($by[0] === '$') {
      var byValue = get(this.context, $by.slice(1))
      if (byValue === void 0) {
        $case = map.get('$default')
        if (props.skipUndefined) {
          if (!$case) {
            $case = []
            Array.from(map.keys())
              .filter(key => key[0] !== '$')
              .forEach(key => {
                let vals = map.get(key)
                if (!vals) return
                $case = [...$case, ...vals]
              })
          }
        } else {
          this.lockPath(props.item.path)
          if (!props.skipErrors) {
            this.errors.push({
              path    : props.item.path,
              message : `Undefined value "${$by}" in context for $switch.$by`,
            })
          }
          return false
        }
      } else {
        $case = omap[byValue]
      }
    } else {
      return false
    }
    if ($case === void 0) {
      if (!props.skipUndefined && !props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `undefined case value in switch\n switch.by === "${byValue}"`,
        })
      }
      return false
    }
    props.currentQueue[props.currentIndex] = {
      ...props.item,
      type : 'Rules',
      data : $case,
    }
    return true
  }
  handleOperatorOmit (props) {
    if (this.checkPathIsLocked(props.item.path)) return false
    if (!props.item.data || !props.item.data[0] || !props.item.data[0].type === NODE_ARRAY) {
      if (props.skipUndefined) {
        props.currentQueue[props.currentIndex] = void 0
        return true
      } else if (!props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `require array[key1,key2,key3] for $omit operator`,
        })
      }
      return false
    }
    var omitKeys = props.item.data[0].value.map(o => o && o.value)
    omitKeys.map(key => {
      this.setByPath([...props.item.path, key], void 0)
    })
    props.currentQueue[props.currentIndex] = void 0
    return true
  }
  handleOperatorExtend (props) {
    if (this.checkPathIsLocked(props.item.path)) return false
    if (!this.allowImport) return false
    if (!props.item.data || !props.item.data[0] || !props.item.data[0].type === NODE_PRIMITIVE) {
      if (props.skipUndefined) {
        props.currentQueue[props.currentIndex] = void 0
        return true
      } else if (!props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `require path:string for $extend operator\n For ex. $extend: ../offer/enum/SourceName`,
        })
      }
      return false
    }
    let pathToExtend = String(props.item.data[0].value).trim()
    if (pathToExtend[0] !== '/') {
      pathToExtend = nodePath.join('/' + props.item.path.join('/'), pathToExtend)
    }
    pathToExtend = nodePath.normalize(pathToExtend).slice(1)
    if (!this.checkPathRequired(pathToExtend.split('/'))) {
      this.requiredPaths.set(pathToExtend)
      this.allowImport = false
      return true
    }

    let schemeToExtend = this.schemeByPaths[pathToExtend]
    if (!schemeToExtend) {
      if (props.skipUndefined) {
        props.currentQueue[props.currentIndex] = void 0
        this.allowImport = false
        return true
      } else if (!props.skipErrors) {
        this.errors.push({
          path    : props.item.path,
          message : `nothing to extend in path /${pathToExtend} from path /${props.item.path.join('/')}`,
        })
      }
      return false
    }
    props.currentQueue[props.currentIndex] = {
      ...props.item,
      type : 'Rules',
      data : schemeToExtend,
    }
    this.allowImport = false

    return true
  }

  checkIsMap (path) {
    let o = this;
    ['result', ...path.slice(0, -1)].forEach(p => {
      if (!isPlainObject(o[p]) && !isArray(o[p])) o[p] = {}
      o = o[p]
    })
    if (!isPlainObject(get(o, path.slice(-1)))) {
      set(o, path.slice(-1), {})
      return true
    }
    return false
  }
  setByPath (path, value) {
    let o = this;
    ['result', ...path.slice(0, -1)].forEach(p => {
      if (!isPlainObject(o[p]) && !isArray(o[p])) o[p] = {}
      o = o[p]
    })
    if (value !== void 0) {
      set(o, path.slice(-1), value)
    } else {
      unset(o, path.slice(-1))
    }
  }

  parse (path = '/', context = {}, skipUndefined = false, skipErrors = false) {
    return this.fork()._parse(path, context, skipUndefined, skipErrors)
  }
  fork () {
    var fork = new Parser(this.scheme, true)
    fork.result = ooClone(this.result)
    fork.queue = ooClone(this.queue)
    fork.requiredPaths = new Map(ooClone(Array.from(this.requiredPaths.entries())))
    fork.schemeByPaths = ooClone(this.schemeByPaths)
    return fork
  }
  _parse (path, context, skipUndefined, skipErrors) {
    this.context = context
    this.requiredPaths.set(path.split('/').filter(v => v).join('/'), true)
    this.walkQueue(skipUndefined, skipErrors)
    let result = get(this, ['result', ...path.split('/').filter(v => v)])

    return [
      result === void 0 ? null : result,
      this.errors.length ? [...this.errors] : void 0,
    ]
  }
}

module.exports = {
  Parser,
}
