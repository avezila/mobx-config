import {readFile, watch, FSWatcher} from "fs";
import {promisify} from "util";
import {File, IFileProps} from "./File";
import {flow, observable, reaction, action} from "mobx";

const readFileAsync = promisify(readFile);

export class FileFs extends File {
  @observable
  watchFs = false;

  constructor(props: IFileProps) {
    super(props);
    this.disposers.push(
      reaction(() => [this.watchFs], this.updateWatching, {fireImmediately: true})
    );
    this.disposers.push(this.unwatch);
  }

  LoadFromFS = flow(function*(this: File) {
    try {
      this.source = yield readFileAsync(this.absolutePath);
    } catch (e) {
      console.error(`${this.absolutePath}:\nFailed load file\n${e.stack}`);
    }
  }).bind(this);

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
