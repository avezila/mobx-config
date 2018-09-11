
const util = require('util')
const fs = require('fs')
const path = require('path')
const {sortBy} = require('lodash')
const yaml = require('js-yaml')

const Stat = util.promisify(fs.stat)
const ReadFile = util.promisify(fs.readFile)
const Readdir = util.promisify(fs.readdir)

// function fsPathToPath (str) {
//   return path.normalize().split(path.sep).filter(a => a && a !== '.')
// }


async function readNode (subNode, subpath, node, init = false) {
  try {
    let stat = void 0
    try {
      stat = await Stat(node)
    } catch (e) {
      try {
        stat = await Stat(node + '.yaml')
        node = node + '.yaml'
      } catch (e2) {
        throw e
      }
    }
    if (stat.isFile() && node.match(/\.yaml$/)) {
      await readFile(subNode, subpath, node, init)
    } else if (stat.isDirectory()) {
      if (!init) {
        let newSubNode = []
        let newNode = {
          type      : 'map',
          directory : node,
          value     : [[path.basename(node), newSubNode]],
        }
        subNode.push(newNode)
        await readDirectory(newSubNode, path.join(subpath, path.basename(node)), node, init)
      } else {
        await readDirectory(subNode, subpath, node, init)
      }
    }
  } catch (e) {
    console.error(`Failed stat ${node}`, e.stack)
  }
}

async function readDirectory (subNode, subpath, dir, init = false) {
  try {
    // if (!init) {
    // let newNode = {
    //   type      : 'map',
    //   directory : dir,
    //   value     : [],
    // }
    // subNode.push([path.basename(dir), newNode])
    // subNode = newNode.value
    // }

    let nodes = await Readdir(dir)
    nodes =  sortBy(nodes, node => node.match(/\.yaml$/) ? `1_${node}` : `0_${node}`)
    for (let node of nodes) {
      await readNode(subNode, subpath, path.join(dir, node))
    }
  } catch (e) {
    console.error(`Failed read directory ${dir}`, e.stack)
  }
}

async function readFile (subNode, subpath, file, init = false) {
  var source, json
  try {
    source = await ReadFile(file)
  } catch (e) {
    console.error(`failed read file ${file}`, e.stack)
    return
  }

  try {
    json = yaml.load(source)
  } catch (e) {
    console.error(`failed parse yaml in ${file}`, e.stack)
    return
  }
  // if (!init) {
  //   var newNode = [path.basename(subpath)]
  //   subNode.push(newNode)
  //   subNode = newNode
  // }
  await readYamlNode(subNode, subpath, json, file)
}

async function readYamlNode (subNode, subpath, node, file) {
  var newNode = {}
  if (file) newNode.file = file
  if (Array.isArray(node)) {
    let isMap = true
    for (let val of node) {
      if (typeof val === 'object' && val !== null) {
        if (Object.keys(val).length === 1) {
          continue
        }
      }
      isMap = false
      break
    }
    if (isMap) {
      newNode.type = 'map'
      newNode.value = []
      for (let val of node) {
        let key = Object.keys(val)[0]
        let newKey = key
        if (newKey[0] === '$') newKey = newKey.toLowerCase()
        await readYamlNode(newNode.value, path.join(subpath, newKey), val[key])
      }
    } else {
      newNode.type = 'array'
      newNode.value = []
      for (let index in node) {
        await readYamlNode(newNode.value, path.join(subpath, String(index)), node[index])
      }
    }
  } else if (typeof node === 'object' && node !== null) {
    newNode.type = 'map'
    newNode.value = []
    for (let key in node) {
      let sn = []
      let newKey = key
      if (newKey[0] === '$') newKey = newKey.toLowerCase()
      newNode.value.push([newKey, sn])
      await readYamlNode(sn, path.join(subpath, newKey), node[key])
    }
  } else {
    if (node === void 0) return
    newNode.type = 'primitive'
    newNode.value = node
  }
  subNode.push(newNode)
}

module.exports = {
  readNode,
  readDirectory,
}
