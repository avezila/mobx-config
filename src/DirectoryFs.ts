import {readdir, watch, FSWatcher, stat, Stats} from "fs";
import {promisify} from "util";
import {Directory, IDirectoryProps} from "./Directory";
import {flow, observable, reaction, action} from "mobx";
import {join} from "path-browserify";
import {FileFs} from "./FileFs";

const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);

export class DirectoryFs extends Directory {
  @observable
  watchFs = false;

  constructor(props: IDirectoryProps) {
    super(props);
    this.disposers.push(
      reaction(() => [this.watchFs], this.updateWatching, {fireImmediately: true})
    );
    this.disposers.push(this.unwatch);
  }

  LoadFromFS = flow(function*(this: DirectoryFs) {
    let fnames: string[] = [];
    try {
      fnames = yield readdirAsync(this.absolutePath);
    } catch (e) {
      console.error(`${this.absolutePath}:\nFailed load file\n${e.stack}`);
    }
    let fnamesSet = new Set(fnames);
    for (let fname of fnamesSet.keys()) {
      let fileAbsoluteName = join(this.absolutePath, fname);
      try {
        let stat: Stats = yield statAsync(fileAbsoluteName);
        if (stat.isFile() && fname.match(/\.(?:yaml|js)$/)) {
          yield this.AddFile(fname);
        } else if (stat.isDirectory()) {
          yield this.AddDirectory(fname);
        } else {
          fnamesSet.delete(fname);
        }
      } catch (e) {
        console.error(`${fileAbsoluteName}:\nFailed stat\n${e.stack}`);
      }
    }
    for (let fname of this.directories.keys()) {
      if (!fnamesSet.has(fname)) this.RemoveDirectory(fname);
    }
    for (let fname of this.files.keys()) {
      if (fnamesSet.has(fname)) this.RemoveFile(fname);
    }
  }).bind(this);
  AddDirectory(fname: string): DirectoryFs | null {
    let dir = super.AddDirectory(fname) as DirectoryFs | null;
    if (dir) dir.LoadFromFS();
    return dir;
  }
  AddFile(fname: string): FileFs | null {
    let file = super.AddFile(fname) as FileFs | null;
    if (file) file.LoadFromFS();
    return file;
  }
  FileClass() {
    return FileFs;
  }
  DirectoryClass() {
    return DirectoryFs;
  }

  private watcher: FSWatcher | null = null;
  private updateWatching = () => {
    if (!this.watchFs) this.unwatch();
    else this.watch();
  };
  @action
  private unwatch = () => {
    if (!this.watcher) return;
    this.watcher.close();
    this.watcher = null;
  };
  @action
  private watch = () => {
    if (this.watcher) return;
    this.watcher = watch(this.absolutePath, this.LoadFromFS);
  };
}
