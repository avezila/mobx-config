import {observable, action, computed} from "mobx";
import {File} from "./File";
import {Directory} from "./Directory";
import {join, dirname} from "path-browserify";

export class Scheme {
  @observable
  sources: [string, File | Directory][] = [];

  @action
  AddSource(path: string, source: File | Directory) {
    this.sources.push([path, source]);
  }

  @computed
  get filesByPath() {
    let map: {[key: string]: File[]} = {};

    this.sources.forEach(([prefix, source]) => {
      if (source.IsFile()) {
        addFileToMap(map, prefix, source as File);
      } else {
        (source as Directory).Each(file => addFileToMap(map, prefix, file));
      }
    });
    return map;
  }
}

function addFileToMap(map: any, prefix: string, file: File) {
  let path = dirname(join(prefix, file.path));
  let node = map[path];
  if (!node) {
    node = [];
    map[path] = node;
  }
  node.push(file);
}
